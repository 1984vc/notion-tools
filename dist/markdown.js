import { Client, isFullPage } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';
import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { MetaGenerator } from './meta.js';
export class NotionMarkdownExporter {
    constructor(notionToken, basePath, transformers) {
        this.notion = new Client({ auth: notionToken });
        this.n2m = new NotionToMarkdown({ notionClient: this.notion });
        this.pagePathCache = new Map();
        this.metaGenerator = new MetaGenerator();
        this.basePath = basePath || '';
        if (transformers) {
            transformers(this.n2m);
        }
    }
    setCustomTransformer(type, transformer) {
        this.n2m.setCustomTransformer(type, transformer);
    }
    normalizeQuotes(content) {
        return content.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, '\'');
    }
    async getPageTitle(pageInfo) {
        const properties = pageInfo.properties;
        const titleProp = Object.values(properties).find((prop) => prop.type === 'title');
        return titleProp?.title?.[0]?.plain_text || 'untitled';
    }
    async getOutputPath(pageInfo, baseOutputDir, title, options) {
        const properties = pageInfo.properties;
        const pathProp = (properties['path'] || properties['Path']);
        if (pathProp?.type === 'rich_text' && pathProp.rich_text[0]?.plain_text) {
            const customPath = pathProp.rich_text[0].plain_text;
            const pathParts = customPath.split('/');
            const extension = options.extension || '.mdx';
            const filename = `${pathParts.pop()}${extension}`;
            const directories = pathParts.join('/');
            return join(baseOutputDir, directories, filename);
        }
        const extension = options.extension || '.mdx';
        const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}${extension}`;
        return join(baseOutputDir, filename);
    }
    async getPagePath(pageId) {
        try {
            const cleanId = pageId.replace(/-/g, '');
            const formattedId = cleanId.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
            if (this.pagePathCache.has(formattedId)) {
                return this.pagePathCache.get(formattedId) || null;
            }
            const pageInfo = await this.notion.pages.retrieve({ page_id: formattedId });
            if (!isFullPage(pageInfo)) {
                return null;
            }
            const properties = pageInfo.properties;
            const pathProp = (properties['path'] || properties['Path']);
            if (pathProp?.type === 'rich_text' && pathProp.rich_text[0]?.plain_text) {
                const path = pathProp.rich_text[0].plain_text;
                this.pagePathCache.set(formattedId, path);
                return path;
            }
            this.pagePathCache.set(formattedId, '');
            return null;
        }
        catch (error) {
            console.error(`Failed to fetch path for page ${pageId}:`, error);
            return null;
        }
    }
    async transformDatabaseLinks(markdown) {
        const linkRegex = /\[([^\]]+)\]\(\/([a-f0-9-]{32,36})\)/g;
        let transformedMarkdown = markdown;
        for (const match of transformedMarkdown.matchAll(linkRegex)) {
            const [fullMatch, linkText, pageId] = match;
            const pagePath = await this.getPagePath(pageId);
            if (pagePath) {
                const prefix = this.basePath ? `/${this.basePath}` : '';
                const newLink = `[${linkText}](${prefix}/${pagePath})`;
                transformedMarkdown = transformedMarkdown.replace(fullMatch, newLink);
            }
        }
        return transformedMarkdown;
    }
    async convertPageToMarkdown(pageId) {
        const mdblocks = await this.n2m.pageToMarkdown(pageId);
        const { parent: markdown } = this.n2m.toMarkdownString(mdblocks);
        const transformedMarkdown = await this.transformDatabaseLinks(markdown);
        return this.normalizeQuotes(transformedMarkdown);
    }
    async processPage(page, baseOutputDir, options) {
        const pageInfo = await this.notion.pages.retrieve({ page_id: page.id });
        if (!isFullPage(pageInfo)) {
            throw new Error('Retrieved incomplete page object');
        }
        const properties = pageInfo.properties;
        const weightProp = (properties['weight'] || properties['Weight']);
        const weight = weightProp?.type === 'number' ? weightProp.number : 0;
        const title = await this.getPageTitle(pageInfo);
        const markdown = await this.convertPageToMarkdown(page.id);
        const outputPath = await this.getOutputPath(pageInfo, baseOutputDir, title, options);
        return {
            title,
            content: markdown,
            metadata: {
                notionId: page.id,
                createdAt: pageInfo.created_time,
                lastEditedAt: pageInfo.last_edited_time,
                weight
            },
            outputPath,
        };
    }
    async exportDatabaseJson(database, output) {
        const response = await this.notion.databases.query({
            database_id: database
        });
        const pages = [];
        for (const page of response.results) {
            const pageInfo = await this.notion.pages.retrieve({ page_id: page.id });
            const blocks = await this.notion.blocks.children.list({ block_id: page.id });
            pages.push({
                page: pageInfo,
                blocks: blocks.results
            });
        }
        const jsonPath = join(output, 'index.json');
        await writeFile(jsonPath, JSON.stringify({ pages }, null, 2), 'utf8');
    }
    async *exportDatabase(options) {
        this.basePath = options.basePath || '';
        await mkdir(options.output, { recursive: true });
        const response = await this.notion.databases.query({
            database_id: options.database
        });
        yield {
            type: 'start',
            totalPages: response.results.length
        };
        for (const [index, page] of response.results.entries()) {
            try {
                if (!isFullPage(page)) {
                    throw new Error('Received partial page object');
                }
                const exportedPage = await this.processPage(page, options.output, options);
                const dirPath = dirname(exportedPage.outputPath);
                await mkdir(dirPath, { recursive: true });
                let content = exportedPage.content;
                if (!options.noFrontmatter) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const frontmatter = {
                        title: exportedPage.title,
                        notionId: exportedPage.metadata.notionId,
                        createdAt: exportedPage.metadata.createdAt,
                        lastEditedAt: exportedPage.metadata.lastEditedAt,
                        weight: exportedPage.metadata.weight
                    };
                    // Add all page properties
                    const properties = page.properties;
                    for (const [key, prop] of Object.entries(properties)) {
                        switch (prop.type) {
                            case 'title':
                                frontmatter[key] = prop.title?.[0]?.plain_text || '';
                                break;
                            case 'rich_text':
                                frontmatter[key] = prop.rich_text?.[0]?.plain_text || '';
                                break;
                            case 'number':
                                frontmatter[key] = prop.number;
                                break;
                            case 'select':
                                frontmatter[key] = prop.select?.name || '';
                                break;
                            case 'multi_select':
                                frontmatter[key] = prop.multi_select?.map(s => s.name) || [];
                                break;
                            case 'date':
                                frontmatter[key] = prop.date?.start || '';
                                break;
                            case 'checkbox':
                                frontmatter[key] = prop.checkbox;
                                break;
                            case 'url':
                                frontmatter[key] = prop.url || '';
                                break;
                            case 'email':
                                frontmatter[key] = prop.email || '';
                                break;
                            case 'phone_number':
                                frontmatter[key] = prop.phone_number || '';
                                break;
                            case 'formula':
                                frontmatter[key] = prop.formula?.string || prop.formula?.number || '';
                                break;
                            case 'relation':
                                frontmatter[key] = prop.relation?.map(r => r.id) || [];
                                break;
                            case 'rollup':
                                frontmatter[key] = prop.rollup?.array || [];
                                break;
                            case 'created_time':
                                frontmatter[key] = prop.created_time;
                                break;
                            case 'last_edited_time':
                                frontmatter[key] = prop.last_edited_time;
                                break;
                            case 'created_by':
                                frontmatter[key] = prop.created_by?.id || '';
                                break;
                            case 'last_edited_by':
                                frontmatter[key] = prop.last_edited_by?.id || '';
                                break;
                            default:
                                frontmatter[key] = '';
                        }
                    }
                    // Convert to YAML front-matter
                    const yaml = Object.entries(frontmatter)
                        .map(([key, value]) => {
                        if (Array.isArray(value)) {
                            return `${key}:\n${value.map(v => `  - ${v}`).join('\n')}`;
                        }
                        if (typeof value === 'string') {
                            return `${key}: ${value}`;
                        }
                        return `${key}: ${JSON.stringify(value)}`;
                    })
                        .join('\n');
                    content = `---
${yaml}
---

${content}`;
                }
                await writeFile(exportedPage.outputPath, content, 'utf8');
                this.metaGenerator.addPage(exportedPage.outputPath, exportedPage.title, exportedPage.metadata.weight);
                yield {
                    type: 'page',
                    currentPage: index + 1,
                    totalPages: response.results.length,
                    pageId: page.id,
                    outputPath: exportedPage.outputPath
                };
            }
            catch (error) {
                yield {
                    type: 'page',
                    currentPage: index + 1,
                    totalPages: response.results.length,
                    pageId: page.id,
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        }
        if (!options.skipMeta) {
            const directories = this.metaGenerator.getDirectories();
            for (const dir of directories) {
                await this.metaGenerator.generateMetaFile(dir);
                yield {
                    type: 'meta',
                    directory: dir
                };
            }
        }
        if (options.includeJson) {
            await this.exportDatabaseJson(options.database, options.output);
            yield {
                type: 'json'
            };
        }
        yield { type: 'complete' };
    }
}
//# sourceMappingURL=markdown.js.map
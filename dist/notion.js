import { Client, isFullPage } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';
import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
export class NotionExporter {
    constructor(notionToken) {
        this.notion = new Client({ auth: notionToken });
        this.n2m = new NotionToMarkdown({ notionClient: this.notion });
    }
    async getPageTitle(pageInfo) {
        const properties = pageInfo.properties;
        const titleProp = Object.values(properties).find((prop) => prop.type === 'title');
        return titleProp?.title?.[0]?.plain_text || 'untitled';
    }
    async getOutputPath(pageInfo, baseOutputDir, title) {
        const properties = pageInfo.properties;
        const pathProp = (properties['path'] || properties['Path']);
        if (pathProp?.type === 'rich_text' && pathProp.rich_text[0]?.plain_text) {
            const customPath = pathProp.rich_text[0].plain_text;
            const pathParts = customPath.split('/');
            const filename = `${pathParts.pop()}.mdx`;
            const directories = pathParts.join('/');
            return join(baseOutputDir, directories, filename);
        }
        const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.mdx`;
        return join(baseOutputDir, filename);
    }
    async convertPageToMarkdown(pageId) {
        const mdblocks = await this.n2m.pageToMarkdown(pageId);
        const { parent: markdown } = this.n2m.toMarkdownString(mdblocks);
        return markdown;
    }
    async processPage(page, baseOutputDir) {
        const pageInfo = await this.notion.pages.retrieve({ page_id: page.id });
        if (!isFullPage(pageInfo)) {
            throw new Error('Retrieved incomplete page object');
        }
        const title = await this.getPageTitle(pageInfo);
        const markdown = await this.convertPageToMarkdown(page.id);
        const outputPath = await this.getOutputPath(pageInfo, baseOutputDir, title);
        return {
            title,
            content: markdown,
            metadata: {
                notionId: page.id,
                createdAt: pageInfo.created_time,
                lastEditedAt: pageInfo.last_edited_time,
            },
            outputPath,
        };
    }
    async exportDatabase({ database, output, notionToken }) {
        const progress = [];
        // Create output directory if it doesn't exist
        await mkdir(output, { recursive: true });
        const response = await this.notion.databases.query({
            database_id: database
        });
        progress.push({
            type: 'start',
            totalPages: response.results.length
        });
        for (const [index, page] of response.results.entries()) {
            try {
                const exportedPage = await this.processPage(page, output);
                // Create necessary directories
                const dirPath = dirname(exportedPage.outputPath);
                await mkdir(dirPath, { recursive: true });
                // Add frontmatter and write to file
                const content = `---
title: ${exportedPage.title}
notionId: ${exportedPage.metadata.notionId}
createdAt: ${exportedPage.metadata.createdAt}
lastEditedAt: ${exportedPage.metadata.lastEditedAt}
---

${exportedPage.content}`;
                await writeFile(exportedPage.outputPath, content, 'utf8');
                progress.push({
                    type: 'page',
                    currentPage: index + 1,
                    totalPages: response.results.length,
                    pageId: page.id,
                    outputPath: exportedPage.outputPath
                });
            }
            catch (error) {
                progress.push({
                    type: 'page',
                    currentPage: index + 1,
                    totalPages: response.results.length,
                    pageId: page.id,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
        progress.push({ type: 'complete' });
        return progress;
    }
}
//# sourceMappingURL=notion.js.map
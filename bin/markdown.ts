import { Client, isFullPage } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';
import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints.js';
import { MetaGenerator } from './meta.js';

interface ExportOptions {
  database: string;
  output: string;
  notionToken: string;
  includeJson?: boolean;
  basePath?: string;
  noFrontmatter?: boolean;
}

interface PageExport {
  title: string;
  content: string;
  metadata: {
    notionId: string;
    createdAt: string;
    lastEditedAt: string;
    weight: number;
  };
  outputPath: string;
}

interface ExportProgress {
  type: 'start' | 'page' | 'meta' | 'json' | 'complete';
  totalPages?: number;
  currentPage?: number;
  pageId?: string;
  outputPath?: string;
  directory?: string;
  error?: string;
}

interface TitleProperty {
  type: 'title';
  title: Array<{
    plain_text: string;
  }>;
}

interface RichTextProperty {
  type: 'rich_text';
  rich_text: Array<{
    plain_text: string;
  }>;
}

interface NumberProperty {
  type: 'number';
  number: number;
}

type NotionProperty = TitleProperty | RichTextProperty | NumberProperty;

export class NotionMarkdownExporter {
  private notion: Client;
  private n2m: NotionToMarkdown;
  private pagePathCache: Map<string, string>;
  private metaGenerator: MetaGenerator;
  private basePath: string;

  constructor(notionToken: string, basePath?: string) {
    this.notion = new Client({ auth: notionToken });
    this.n2m = new NotionToMarkdown({ notionClient: this.notion });
    this.pagePathCache = new Map();
    this.metaGenerator = new MetaGenerator();
    this.basePath = basePath || '';
  }

  private normalizeQuotes(content: string): string {
    // Replace curly double quotes (U+201C and U+201D) with straight double quotes
    return content.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, '\'');
  }

  private async getPageTitle(pageInfo: PageObjectResponse): Promise<string> {
    const properties = pageInfo.properties as Record<string, NotionProperty>;
    const titleProp = Object.values(properties).find(
      (prop): prop is TitleProperty => prop.type === 'title'
    );

    return titleProp?.title?.[0]?.plain_text || 'untitled';
  }

  private async getOutputPath(pageInfo: PageObjectResponse, baseOutputDir: string, title: string): Promise<string> {
    const properties = pageInfo.properties as Record<string, NotionProperty>;
    const pathProp = (properties['path'] || properties['Path']) as RichTextProperty | undefined;
    
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

  private async getPagePath(pageId: string): Promise<string | null> {
    try {
      const formattedId = pageId.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
      
      if (this.pagePathCache.has(formattedId)) {
        return this.pagePathCache.get(formattedId) || null;
      }

      const pageInfo = await this.notion.pages.retrieve({ page_id: formattedId });
      if (!isFullPage(pageInfo)) {
        return null;
      }

      const properties = pageInfo.properties as Record<string, NotionProperty>;
      const pathProp = (properties['path'] || properties['Path']) as RichTextProperty | undefined;
      
      if (pathProp?.type === 'rich_text' && pathProp.rich_text[0]?.plain_text) {
        const path = pathProp.rich_text[0].plain_text;
        this.pagePathCache.set(formattedId, path);
        return path;
      }

      this.pagePathCache.set(formattedId, '');
      return null;
    } catch (error) {
      console.error(`Failed to fetch path for page ${pageId}:`, error);
      return null;
    }
  }

  private async transformDatabaseLinks(markdown: string): Promise<string> {
    const linkRegex = /\[([^\]]+)\]\(\/([a-f0-9]{32})\)/g;
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

  private async convertPageToMarkdown(pageId: string): Promise<string> {
    const mdblocks = await this.n2m.pageToMarkdown(pageId);
    const { parent: markdown } = this.n2m.toMarkdownString(mdblocks);
    const transformedMarkdown = await this.transformDatabaseLinks(markdown);
    return this.normalizeQuotes(transformedMarkdown);
  }

  private async processPage(page: PageObjectResponse, baseOutputDir: string): Promise<PageExport> {
    const pageInfo = await this.notion.pages.retrieve({ page_id: page.id });
    
    if (!isFullPage(pageInfo)) {
      throw new Error('Retrieved incomplete page object');
    }

    const properties = pageInfo.properties as Record<string, NotionProperty>;
    const weightProp = (properties['weight'] || properties['Weight']) as NumberProperty | undefined;
    const weight = weightProp?.type === 'number' ? weightProp.number : 0;

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
        weight
      },
      outputPath,
    };
  }

  private async exportDatabaseJson(database: string, output: string): Promise<void> {
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

  public async *exportDatabase({ database, output, includeJson, basePath, noFrontmatter = false }: ExportOptions): AsyncGenerator<ExportProgress> {
    this.basePath = basePath || '';
    
    await mkdir(output, { recursive: true });

    const response = await this.notion.databases.query({
      database_id: database
    });

    yield { 
      type: 'start',
      totalPages: response.results.length 
    };

    for (const [index, page] of response.results.entries()) {
      try {
        const exportedPage = await this.processPage(page as PageObjectResponse, output);

        const dirPath = dirname(exportedPage.outputPath);
        await mkdir(dirPath, { recursive: true });

        let content = exportedPage.content;
        if (!noFrontmatter) {
          content = `---
title: ${exportedPage.title}
notionId: ${exportedPage.metadata.notionId}
createdAt: ${exportedPage.metadata.createdAt}
lastEditedAt: ${exportedPage.metadata.lastEditedAt}
weight: ${exportedPage.metadata.weight}
---

${content}`;
        }

        await writeFile(exportedPage.outputPath, content, 'utf8');
        
        // Add page to meta generator with weight
        this.metaGenerator.addPage(exportedPage.outputPath, exportedPage.title, exportedPage.metadata.weight);

        yield {
          type: 'page',
          currentPage: index + 1,
          totalPages: response.results.length,
          pageId: page.id,
          outputPath: exportedPage.outputPath
        };

      } catch (error) {
        yield {
          type: 'page',
          currentPage: index + 1,
          totalPages: response.results.length,
          pageId: page.id,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }

    // Generate _meta.ts files
    const directories = this.metaGenerator.getDirectories();
    for (const dir of directories) {
      await this.metaGenerator.generateMetaFile(dir);
      yield {
        type: 'meta',
        directory: dir
      };
    }

    if (includeJson) {
      await this.exportDatabaseJson(database, output);
      yield {
        type: 'json'
      };
    }

    yield { type: 'complete' };
  }
}

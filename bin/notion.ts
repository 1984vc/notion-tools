import { Client, isFullPage } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';
import fs from 'fs/promises';
import path from 'path';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

interface ExportOptions {
  database: string;
  output: string;
  notionToken: string;
}

interface PageExport {
  title: string;
  content: string;
  metadata: {
    notionId: string;
    createdAt: string;
    lastEditedAt: string;
  };
  outputPath: string;
}

export class NotionExporter {
  private notion: Client;
  private n2m: NotionToMarkdown;

  constructor(notionToken: string) {
    this.notion = new Client({ auth: notionToken });
    this.n2m = new NotionToMarkdown({ notionClient: this.notion });
  }

  private async getPageTitle(pageInfo: PageObjectResponse): Promise<string> {
    const titleProp = Object.values(pageInfo.properties).find(
      (prop): prop is Extract<typeof prop, { type: 'title' }> => 
        prop.type === 'title'
    );

    return titleProp?.title?.[0]?.plain_text || 'untitled';
  }

  private async getOutputPath(pageInfo: PageObjectResponse, baseOutputDir: string, title: string): Promise<string> {
    const pathProp = pageInfo.properties['path'] || pageInfo.properties['Path'];
    
    if (pathProp && pathProp.type === 'rich_text' && pathProp.rich_text[0]?.plain_text) {
      const customPath = pathProp.rich_text[0].plain_text;
      const pathParts = customPath.split('/');
      const filename = `${pathParts.pop()}.mdx`;
      const directories = pathParts.join('/');
      return path.join(baseOutputDir, directories, filename);
    }

    const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.mdx`;
    return path.join(baseOutputDir, filename);
  }

  private async convertPageToMarkdown(pageId: string): Promise<string> {
    const mdblocks = await this.n2m.pageToMarkdown(pageId);
    const { parent: markdown } = this.n2m.toMarkdownString(mdblocks);
    return markdown;
  }

  private async processPage(page: PageObjectResponse, baseOutputDir: string): Promise<PageExport> {
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

  public async exportDatabase({ database, output }: ExportOptions): Promise<void> {
    // Create output directory if it doesn't exist
    await fs.mkdir(output, { recursive: true });

    console.log(`🔍 Fetching pages from database ${database}...`);

    const response = await this.notion.databases.query({
      database_id: database
    });

    console.log(`📝 Found ${response.results.length} pages to export`);

    for (const [index, page] of response.results.entries()) {
      try {
        console.log(`\n[${index + 1}/${response.results.length}] Converting page: ${page.id}`);

        const exportedPage = await this.processPage(page as PageObjectResponse, output);

        // Create necessary directories
        const dirPath = path.dirname(exportedPage.outputPath);
        await fs.mkdir(dirPath, { recursive: true });

        // Add frontmatter and write to file
        const content = `---
title: ${exportedPage.title}
notionId: ${exportedPage.metadata.notionId}
createdAt: ${exportedPage.metadata.createdAt}
lastEditedAt: ${exportedPage.metadata.lastEditedAt}
---

${exportedPage.content}`;

        await fs.writeFile(exportedPage.outputPath, content, 'utf8');
        console.log(`✅ Exported: ${exportedPage.outputPath}`);

      } catch (error) {
        console.error(`❌ Error processing page ${page.id}:`, error instanceof Error ? error.message : String(error));
      }
    }

    console.log('\n✨ Export complete!');
  }
}

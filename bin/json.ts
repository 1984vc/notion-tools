import { Client, isFullPage } from '@notionhq/client';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints.js';

interface ExportOptions {
  database: string;
  output: string;
  notionToken: string;
}

interface ExportProgress {
  type: 'start' | 'page' | 'complete';
  totalPages?: number;
  currentPage?: number;
  pageId?: string;
  outputPath?: string;
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

type NotionProperty = TitleProperty | RichTextProperty;

export class NotionJsonExporter {
  private notion: Client;

  constructor(notionToken: string) {
    this.notion = new Client({ auth: notionToken });
  }

  private async getPageTitle(pageInfo: PageObjectResponse): Promise<string> {
    const properties = pageInfo.properties as Record<string, NotionProperty>;
    const titleProp = Object.values(properties).find(
      (prop): prop is TitleProperty => prop.type === 'title'
    );

    return titleProp?.title?.[0]?.plain_text || 'untitled';
  }

  private async processPage(page: PageObjectResponse, index: number): Promise<Record<string, any>> {
    const pageInfo = await this.notion.pages.retrieve({ page_id: page.id });
    
    if (!isFullPage(pageInfo)) {
      throw new Error('Retrieved incomplete page object');
    }

    const title = await this.getPageTitle(pageInfo);
    const blocks = await this.notion.blocks.children.list({ block_id: page.id });

    return {
      id: page.id,
      title,
      created_time: pageInfo.created_time,
      last_edited_time: pageInfo.last_edited_time,
      weight: index,
      properties: pageInfo.properties,
      blocks: blocks.results
    };
  }

  public async exportDatabase({ database, output }: ExportOptions): Promise<ExportProgress[]> {
    const progress: ExportProgress[] = [];
    
    await mkdir(output, { recursive: true });

    const response = await this.notion.databases.query({
      database_id: database
    });

    progress.push({ 
      type: 'start',
      totalPages: response.results.length 
    });

    const pages = [];

    for (const [index, page] of response.results.entries()) {
      try {
        const exportedPage = await this.processPage(page as PageObjectResponse, index);
        pages.push(exportedPage);

        const outputPath = join(output, 'notion-export.json');
        await writeFile(outputPath, JSON.stringify({ pages }, null, 2), 'utf8');
        
        progress.push({
          type: 'page',
          currentPage: index + 1,
          totalPages: response.results.length,
          pageId: page.id,
          outputPath
        });

      } catch (error) {
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

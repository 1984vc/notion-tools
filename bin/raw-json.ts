import { Client } from '@notionhq/client';
import { writeFile } from 'fs/promises';

interface RawExportOptions {
  id: string;
  output?: string;
  notionToken: string;
}

export class NotionRawExporter {
  private notion: Client;

  constructor(notionToken: string) {
    this.notion = new Client({ auth: notionToken });
  }

  private async fetchDatabase(id: string): Promise<any> {
    const response = await this.notion.databases.query({
      database_id: id
    });
    return response;
  }

  private async fetchPage(id: string): Promise<any> {
    const page = await this.notion.pages.retrieve({
      page_id: id
    });
    const blocks = await this.notion.blocks.children.list({
      block_id: id
    });
    return { page, blocks };
  }

  public async exportRaw({ id, output }: RawExportOptions): Promise<string> {
    try {
      // Try as database first
      try {
        const data = await this.fetchDatabase(id);
        const json = JSON.stringify(data, null, 2);
        if (output) {
          await writeFile(output, json, 'utf8');
        }
        return json;
      } catch (error) {
        // If database fetch fails, try as page
        if ((error as any)?.code === 'object_not_found' || (error as any)?.status === 404) {
          const data = await this.fetchPage(id);
          const json = JSON.stringify(data, null, 2);
          if (output) {
            await writeFile(output, json, 'utf8');
          }
          return json;
        }
        throw error;
      }
    } catch (error) {
      throw new Error(`Failed to fetch Notion content: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

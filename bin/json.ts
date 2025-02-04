import { Client } from '@notionhq/client';

import type { GetPageResponse, GetBlockResponse, QueryDatabaseResponse } from '@notionhq/client/build/src/api-endpoints.js';
import { databaseTransformer, pageTransformer } from './transformers.js';

interface JSONExportOption {
  id: string;
  notionToken: string;
  rawJSON?: boolean;
}

interface NotionError {
  code?: string;
  status?: number;
  message?: string;
}

export interface PageWithBlocks {
  page: GetPageResponse;
  blocks: {
    results: GetBlockResponse[];
  };
}

export class NotionJSONExporter {
  private notion: Client;

  constructor(notionToken: string) {
    this.notion = new Client({ auth: notionToken });
  }

  private async fetchDatabase(id: string): Promise<QueryDatabaseResponse> {
    const response = await this.notion.databases.query({
      database_id: id
    });
    return response;
  }

  private async fetchPage(id: string): Promise<PageWithBlocks> {
    const page = await this.notion.pages.retrieve({
      page_id: id
    });
    const blocks = await this.notion.blocks.children.list({
      block_id: id
    });
    return { page, blocks } as PageWithBlocks;
  }

  public async exportJSON({ id, rawJSON }: JSONExportOption): Promise<string> {
    try {
      // Try as database first
      try {
        const data = await this.fetchDatabase(id);
        if (rawJSON) return JSON.stringify(data, null, 2)
        return JSON.stringify(databaseTransformer(data), null, 2)
        // TODO: flattenProps if needed
      } catch (error) {
        // If database fetch fails, try as page
        const notionError = error as NotionError;
        if (notionError?.code === 'object_not_found' || notionError?.status === 404) {
          const data = await this.fetchPage(id);
          if (rawJSON) return JSON.stringify(data, null, 2)
          return JSON.stringify(pageTransformer(data), null, 2)
        }
        throw error;
      }
    } catch (error) {
      throw new Error(`Failed to fetch Notion content: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

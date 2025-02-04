import { Client } from '@notionhq/client';
import { databaseTransformer, pageTransformer } from './transformers.js';
export class NotionJSONExporter {
    constructor(notionToken) {
        this.notion = new Client({ auth: notionToken });
    }
    async fetchDatabase(id) {
        const response = await this.notion.databases.query({
            database_id: id
        });
        return response;
    }
    async fetchPage(id) {
        const page = await this.notion.pages.retrieve({
            page_id: id
        });
        const blocks = await this.notion.blocks.children.list({
            block_id: id
        });
        return { page, blocks };
    }
    async exportJSON({ id, rawJSON }) {
        try {
            // Try as database first
            try {
                const data = await this.fetchDatabase(id);
                if (rawJSON)
                    return JSON.stringify(data, null, 2);
                return JSON.stringify(databaseTransformer(data), null, 2);
                // TODO: flattenProps if needed
            }
            catch (error) {
                // If database fetch fails, try as page
                const notionError = error;
                if (notionError?.code === 'object_not_found' || notionError?.status === 404) {
                    const data = await this.fetchPage(id);
                    if (rawJSON)
                        return JSON.stringify(data, null, 2);
                    return JSON.stringify(pageTransformer(data), null, 2);
                }
                throw error;
            }
        }
        catch (error) {
            throw new Error(`Failed to fetch Notion content: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
//# sourceMappingURL=json.js.map
import { Client } from '@notionhq/client';
import { writeFile } from 'fs/promises';
export class NotionRawExporter {
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
    async exportRaw({ id, output }) {
        try {
            // Try as database first
            try {
                const data = await this.fetchDatabase(id);
                const json = JSON.stringify(data, null, 2);
                if (output) {
                    await writeFile(output, json, 'utf8');
                }
                return json;
            }
            catch (error) {
                // If database fetch fails, try as page
                const notionError = error;
                if (notionError?.code === 'object_not_found' || notionError?.status === 404) {
                    const data = await this.fetchPage(id);
                    const json = JSON.stringify(data, null, 2);
                    if (output) {
                        await writeFile(output, json, 'utf8');
                    }
                    return json;
                }
                throw error;
            }
        }
        catch (error) {
            throw new Error(`Failed to fetch Notion content: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
//# sourceMappingURL=raw-json.js.map
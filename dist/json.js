import { Client, isFullPage } from '@notionhq/client';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
export class NotionJsonExporter {
    constructor(notionToken) {
        this.notion = new Client({ auth: notionToken });
    }
    async getPageTitle(pageInfo) {
        const properties = pageInfo.properties;
        const titleProp = Object.values(properties).find((prop) => prop.type === 'title');
        return titleProp?.title?.[0]?.plain_text || 'untitled';
    }
    async processPage(page, index) {
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
    async exportDatabase({ database, output }) {
        const progress = [];
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
                const exportedPage = await this.processPage(page, index);
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
//# sourceMappingURL=json.js.map
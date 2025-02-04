import type { GetPageResponse, GetBlockResponse } from '@notionhq/client/build/src/api-endpoints.js';
interface JSONExportOption {
    id: string;
    notionToken: string;
    rawJSON?: boolean;
}
export interface PageWithBlocks {
    page: GetPageResponse;
    blocks: {
        results: GetBlockResponse[];
    };
}
export declare class NotionJSONExporter {
    private notion;
    constructor(notionToken: string);
    private fetchDatabase;
    private fetchPage;
    exportJSON({ id, rawJSON }: JSONExportOption): Promise<string>;
}
export {};

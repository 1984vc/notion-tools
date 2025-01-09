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
export declare class NotionJsonExporter {
    private notion;
    constructor(notionToken: string);
    private getPageTitle;
    private processPage;
    exportDatabase({ database, output }: ExportOptions): Promise<ExportProgress[]>;
}
export {};

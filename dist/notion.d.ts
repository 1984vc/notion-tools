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
export declare class NotionExporter {
    private notion;
    private n2m;
    constructor(notionToken: string);
    private getPageTitle;
    private getOutputPath;
    private convertPageToMarkdown;
    private processPage;
    exportDatabase({ database, output, notionToken }: ExportOptions): Promise<ExportProgress[]>;
}
export {};

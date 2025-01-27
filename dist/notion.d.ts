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
    private pagePathCache;
    constructor(notionToken: string);
    private getPageTitle;
    private getOutputPath;
    private getPagePath;
    private transformDatabaseLinks;
    private convertPageToMarkdown;
    private processPage;
    exportDatabase({ database, output }: ExportOptions): Promise<ExportProgress[]>;
}
export {};

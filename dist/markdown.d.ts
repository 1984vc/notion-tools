import { NotionToMarkdown } from 'notion-to-md';
interface ExportOptions {
    database: string;
    output: string;
    notionToken: string;
    includeJson?: boolean;
    noFrontmatter?: boolean;
    extension?: string;
    skipMeta?: boolean;
    useHextraTransformers?: boolean;
}
interface ExportProgress {
    type: 'start' | 'page' | 'meta' | 'json' | 'complete';
    totalPages?: number;
    currentPage?: number;
    pageId?: string;
    outputPath?: string;
    directory?: string;
    error?: string;
}
type CustomTransformer = (block: any) => Promise<string>;
export declare class NotionMarkdownExporter {
    private notion;
    private n2m;
    private pagePathCache;
    private metaGenerator;
    private baseUrl;
    constructor(notionToken: string, baseUrl?: string, transformers?: (n2m: NotionToMarkdown) => void);
    setCustomTransformer(type: string, transformer: CustomTransformer): void;
    private normalizeQuotes;
    private getPageTitle;
    private getOutputPath;
    private getPagePath;
    private convertPageToMarkdown;
    private processPage;
    private exportDatabaseJson;
    exportDatabase(options: ExportOptions): AsyncGenerator<ExportProgress>;
}
export {};

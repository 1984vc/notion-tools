import { NotionToMarkdown } from 'notion-to-md';
import { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints.js';
interface ExportOptions {
    database: string;
    output: string;
    notionToken: string;
    includeJson?: boolean;
    basePath?: string;
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
type CustomTransformer = (block: BlockObjectResponse) => Promise<string>;
export declare class NotionMarkdownExporter {
    private notion;
    private n2m;
    private pagePathCache;
    private metaGenerator;
    private basePath;
    constructor(notionToken: string, basePath?: string, transformers?: (n2m: NotionToMarkdown) => void);
    setCustomTransformer(type: string, transformer: CustomTransformer): void;
    private normalizeQuotes;
    private getPageTitle;
    private getOutputPath;
    private getPagePath;
    private transformDatabaseLinks;
    private convertPageToMarkdown;
    private processPage;
    private exportDatabaseJson;
    exportDatabase(options: ExportOptions): AsyncGenerator<ExportProgress>;
}
export {};

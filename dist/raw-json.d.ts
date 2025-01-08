interface RawExportOptions {
    id: string;
    output?: string;
    notionToken: string;
}
export declare class NotionRawExporter {
    private notion;
    constructor(notionToken: string);
    private fetchDatabase;
    private fetchPage;
    exportRaw({ id, output }: RawExportOptions): Promise<string>;
}
export {};

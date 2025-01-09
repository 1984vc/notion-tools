export declare class MetaGenerator {
    private directoryPages;
    constructor();
    addPage(pagePath: string, title: string, weight: number): void;
    getDirectories(): string[];
    private generateMetaContent;
    generateMetaFile(directory: string): Promise<void>;
    generateMetaFiles(): Promise<void>;
}

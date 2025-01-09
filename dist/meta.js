import { writeFile, mkdir } from 'fs/promises';
import { join, basename, dirname } from 'path';
export class MetaGenerator {
    constructor() {
        this.directoryPages = new Map();
    }
    addPage(pagePath, title, weight) {
        const dir = dirname(pagePath);
        const pageInfo = {
            path: pagePath,
            title,
            weight
        };
        if (!this.directoryPages.has(dir)) {
            this.directoryPages.set(dir, []);
        }
        this.directoryPages.get(dir)?.push(pageInfo);
    }
    getDirectories() {
        return Array.from(this.directoryPages.keys());
    }
    generateMetaContent(pages) {
        // Sort pages by weight
        const sortedPages = [...pages].sort((a, b) => a.weight - b.weight);
        const entries = sortedPages.map(page => {
            // Get filename without extension
            const key = basename(page.path, '.mdx');
            // Escape any quotes in the title
            const title = page.title.replace(/'/g, "\\'");
            return `  '${key}': '${title}'`;
        });
        return `export default {
${entries.join(',\n')}
}
`;
    }
    async generateMetaFile(directory) {
        const pages = this.directoryPages.get(directory);
        if (!pages)
            return;
        // Create directory if it doesn't exist
        await mkdir(directory, { recursive: true });
        const metaPath = join(directory, '_meta.ts');
        const content = this.generateMetaContent(pages);
        await writeFile(metaPath, content, 'utf8');
    }
    async generateMetaFiles() {
        for (const directory of this.getDirectories()) {
            await this.generateMetaFile(directory);
        }
    }
}
//# sourceMappingURL=meta.js.map
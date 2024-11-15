import { writeFile, mkdir } from 'fs/promises';
import { join, basename, dirname } from 'path';

interface PageMeta {
  path: string;
  title: string;
}

export class MetaGenerator {
  private directoryPages: Map<string, PageMeta[]>;

  constructor() {
    this.directoryPages = new Map();
  }

  addPage(pagePath: string, title: string) {
    const dir = dirname(pagePath);
    const pageInfo: PageMeta = {
      path: pagePath,
      title
    };

    if (!this.directoryPages.has(dir)) {
      this.directoryPages.set(dir, []);
    }
    this.directoryPages.get(dir)?.push(pageInfo);
  }

  private generateMetaContent(pages: PageMeta[]): string {
    const entries = pages.map(page => {
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

  async generateMetaFiles(): Promise<void> {
    for (const [dir, pages] of this.directoryPages.entries()) {
      // Create directory if it doesn't exist
      await mkdir(dir, { recursive: true });
      
      const metaPath = join(dir, '_meta.ts');
      const content = this.generateMetaContent(pages);
      await writeFile(metaPath, content, 'utf8');
    }
  }
}

import { describe, it, expect, beforeEach } from 'vitest';
import { MetaGenerator } from '../bin/meta';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('MetaGenerator', () => {
  let generator: MetaGenerator;
  let testDir: string;

  beforeEach(() => {
    generator = new MetaGenerator();
    testDir = join(tmpdir(), 'notion-mdx-meta-test-' + Date.now());
  });

  describe('generateMetaFiles', () => {
    it('should generate _meta.ts file with correct content', async () => {
      // Add pages to the same directory
      generator.addPage(
        join(testDir, 'guides/cap-table-101.mdx'),
        'Cap Table 101',
        0
      );
      generator.addPage(
        join(testDir, 'guides/safe-vs-priced-rounds.mdx'),
        'Safe vs Priced Rounds',
        1
      );

      await generator.generateMetaFiles();

      const metaContent = await readFile(join(testDir, 'guides/_meta.ts'), 'utf8');
      expect(metaContent).toBe(`export default {
  'cap-table-101': 'Cap Table 101',
  'safe-vs-priced-rounds': 'Safe vs Priced Rounds'
}
`);
    });

    it('should handle multiple directories', async () => {
      // Add pages to different directories
      generator.addPage(
        join(testDir, 'guides/cap-table-101.mdx'),
        'Cap Table 101',
        0
      );
      generator.addPage(
        join(testDir, 'blog/first-post.mdx'),
        'First Post',
        0
      );

      await generator.generateMetaFiles();

      const guidesMetaContent = await readFile(join(testDir, 'guides/_meta.ts'), 'utf8');
      expect(guidesMetaContent).toBe(`export default {
  'cap-table-101': 'Cap Table 101'
}
`);

      const blogMetaContent = await readFile(join(testDir, 'blog/_meta.ts'), 'utf8');
      expect(blogMetaContent).toBe(`export default {
  'first-post': 'First Post'
}
`);
    });

    it('should escape special characters in titles', async () => {
      generator.addPage(
        join(testDir, 'guides/special-page.mdx'),
        "Title with 'quotes' and \"double quotes\"",
        0
      );

      await generator.generateMetaFiles();

      const metaContent = await readFile(join(testDir, 'guides/_meta.ts'), 'utf8');
      expect(metaContent).toBe(`export default {
  'special-page': 'Title with \\'quotes\\' and "double quotes"'
}
`);
    });

    it('should maintain order based on sort_order', async () => {
      // Add pages in random order
      generator.addPage(
        join(testDir, 'guides/third.mdx'),
        'Third Page',
        2
      );
      generator.addPage(
        join(testDir, 'guides/first.mdx'),
        'First Page',
        0
      );
      generator.addPage(
        join(testDir, 'guides/second.mdx'),
        'Second Page',
        1
      );

      await generator.generateMetaFiles();

      const metaContent = await readFile(join(testDir, 'guides/_meta.ts'), 'utf8');
      expect(metaContent).toBe(`export default {
  'first': 'First Page',
  'second': 'Second Page',
  'third': 'Third Page'
}
`);
    });
  });
});

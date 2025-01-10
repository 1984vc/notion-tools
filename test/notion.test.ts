import { describe, it, expect, beforeEach, vi } from 'vitest';
import { urlTransform } from '../bin/transformers';
import { NotionMarkdownExporter } from '../bin/markdown';
import type { PageObjectResponse, BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { join } from 'path';
import { tmpdir } from 'os';
import { readFile } from 'fs/promises';

describe('NotionMarkdownExporter', () => {
  let exporter: NotionMarkdownExporter;

  const createMockPage = (properties: Record<string, unknown>): PageObjectResponse => ({
    object: 'page',
    id: 'test-id',
    created_time: '2023-01-01T00:00:00.000Z',
    last_edited_time: '2023-01-02T00:00:00.000Z',
    created_by: {
      object: 'user',
      id: 'user-id'
    },
    last_edited_by: {
      object: 'user',
      id: 'user-id'
    },
    cover: null,
    icon: null,
    parent: {
      type: 'database_id',
      database_id: 'database-id'
    },
    archived: false,
    properties,
    url: 'https://notion.so/test-page'
  } as PageObjectResponse);

  beforeEach(() => {
    exporter = new NotionMarkdownExporter('fake-token');
  });

  describe('getPageTitle', () => {
    it('should extract title from page properties', async (): Promise<void> => {
      const mockPage = createMockPage({
        Name: {
          type: 'title',
          title: [
            {
              type: 'text',
              text: { content: 'Test Page' },
              plain_text: 'Test Page',
              annotations: {
                bold: false,
                italic: false,
                strikethrough: false,
                underline: false,
                code: false,
                color: 'default'
              }
            }
          ]
        }
      });

      // @ts-expect-error accessing private method for testing
      const title = await exporter.getPageTitle(mockPage);
      expect(title).toBe('Test Page');
    });

    it('should return "untitled" when no title is found', async (): Promise<void> => {
      const mockPage = createMockPage({});

      // @ts-expect-error accessing private method for testing
      const title = await exporter.getPageTitle(mockPage);
      expect(title).toBe('untitled');
    });
  });

  describe('normalizeQuotes', () => {
    it('should replace curly quotes with straight quotes in React components', async (): Promise<void> => {
      // This needs to stay as a unicode encoding (\u2018) to avoid being converted to plain quotes by the LLM coder
      const markdown = `
import { Callout } from \u2018nextra/components\u2019;

<Callout emoji=\u201C📢\u201D>
  This is a "quoted" text with some "React components"
</Callout>
      `;

      // @ts-expect-error accessing private method for testing
      const normalized = exporter.normalizeQuotes(markdown);

      expect(normalized).toBe(`
import { Callout } from 'nextra/components';

<Callout emoji="📢">
  This is a "quoted" text with some "React components"
</Callout>
      `);
    });
  });

  describe('processPage', () => {
    it('should include weight from page properties in metadata', async (): Promise<void> => {
      const mockPage = createMockPage({
        Name: {
          type: 'title',
          title: [
            {
              type: 'text',
              text: { content: 'Test Page' },
              plain_text: 'Test Page',
              annotations: {
                bold: false,
                italic: false,
                strikethrough: false,
                underline: false,
                code: false,
                color: 'default'
              }
            }
          ],
        },
        weight: {
          type: 'number',
          number: 5
        }
      });

      // Mock the necessary methods
      // @ts-expect-error accessing private instance for testing
      exporter.notion.pages.retrieve = async (): Promise<PageObjectResponse> => mockPage;
      // @ts-expect-error accessing private instance for testing
      exporter.n2m.pageToMarkdown = async (): Promise<BlockObjectResponse[]> => [];
      // @ts-expect-error accessing private instance for testing
      exporter.n2m.toMarkdownString = (): { parent: string } => ({ parent: '# Test Content' });

      // @ts-expect-error accessing private method for testing
      const result = await exporter.processPage(mockPage, '/output', {
        extension: '.mdx',
        noFrontmatter: false,
        skipMeta: false
      });

      expect(result.metadata.weight).toBe(5);
      expect(result.metadata.notionId).toBe('test-id');
      expect(result.title).toBe('Test Page');
    });

    it('should default weight to 0 when weight property is not found', async (): Promise<void> => {
      const mockPage = createMockPage({
        Name: {
          type: 'title',
          title: [{ plain_text: 'Test Page' }]
        }
      });

      // Mock the necessary methods
      // @ts-expect-error accessing private instance for testing
      exporter.notion.pages.retrieve = async (): Promise<PageObjectResponse> => mockPage;
      // @ts-expect-error accessing private instance for testing
      exporter.n2m.pageToMarkdown = async (): Promise<BlockObjectResponse[]> => [];
      // @ts-expect-error accessing private instance for testing
      exporter.n2m.toMarkdownString = (): { parent: string } => ({ parent: '# Test Content' });

      // @ts-expect-error accessing private method for testing
      const result = await exporter.processPage(mockPage, '/output', {
        extension: '.mdx',
        noFrontmatter: false,
        skipMeta: false
      });

      expect(result.metadata.weight).toBe(0);
    });
  });

  describe('exportDatabase', () => {
    it('should export database with JSON when includeJson is true', async (): Promise<void> => {
      const mockPage = createMockPage({
        Name: {
          type: 'title',
          title: [{ plain_text: 'Test Page' }]
        }
      });

      // Mock database query
      // @ts-expect-error accessing private instance for testing
      exporter.notion.databases.query = async (): Promise<{ results: PageObjectResponse[] }> => ({
        results: [mockPage]
      });

      // Mock page retrieval
      // @ts-expect-error accessing private instance for testing
      exporter.notion.pages.retrieve = async (): Promise<PageObjectResponse> => mockPage;

      // Mock blocks retrieval
      // @ts-expect-error accessing private instance for testing
      exporter.notion.blocks.children.list = async (): Promise<{ results: BlockObjectResponse[] }> => ({
        results: [{
          object: 'block',
          id: 'block-id',
          parent: { type: 'page_id', page_id: 'page-id' },
          created_time: '2024-01-01T00:00:00.000Z',
          last_edited_time: '2024-01-01T00:00:00.000Z',
          created_by: { object: 'user', id: 'user-id' },
          last_edited_by: { object: 'user', id: 'user-id' },
          has_children: false,
          archived: false,
          in_trash: false,
          type: 'paragraph',
          paragraph: {
            rich_text: [{
              type: 'text',
              text: { content: 'Test content', link: null },
              annotations: {
                bold: false,
                italic: false,
                strikethrough: false,
                underline: false,
                code: false,
                color: 'default'
              },
              plain_text: 'Test content',
              href: null
            }],
            color: 'default'
          }
        } as BlockObjectResponse]
      });

      // Mock markdown conversion
      // @ts-expect-error accessing private instance for testing
      exporter.n2m.pageToMarkdown = async (): Promise<BlockObjectResponse[]> => [];
      // @ts-expect-error accessing private instance for testing
      exporter.n2m.toMarkdownString = (): { parent: string } => ({ parent: '# Test Content' });

      const testOutputDir = join(tmpdir(), 'notion-mdx-test-' + Date.now());
      
      let progressCount = 0;
      for await (const progress of exporter.exportDatabase({
        database: 'test-db',
        output: testOutputDir,
        notionToken: 'fake-token',
        includeJson: true
      })) {
        progressCount++;
        expect(progress.type).toBeDefined();
      }

      expect(progressCount).toBeGreaterThan(0);
    });

    it('should include frontmatter by default', async (): Promise<void> => {
      const mockPage = createMockPage({
        Name: {
          type: 'title',
          title: [{ plain_text: 'Test Page' }]
        }
      });

      // Mock database query
      // @ts-expect-error accessing private instance for testing
      exporter.notion.databases.query = async (): Promise<{ results: PageObjectResponse[] }> => ({
        results: [mockPage]
      });

      // Mock page retrieval
      // @ts-expect-error accessing private instance for testing
      exporter.notion.pages.retrieve = async (): Promise<PageObjectResponse> => mockPage;

      // Mock markdown conversion
      // @ts-expect-error accessing private instance for testing
      exporter.n2m.pageToMarkdown = async (): Promise<BlockObjectResponse[]> => [];
      // @ts-expect-error accessing private instance for testing
      exporter.n2m.toMarkdownString = (): { parent: string } => ({ parent: '# Test Content' });

      const testOutputDir = join(tmpdir(), 'notion-mdx-test-' + Date.now());
      
      for await (const progress of exporter.exportDatabase({
        database: 'test-db',
        output: testOutputDir,
        notionToken: 'fake-token'
      })) {
        if (progress.type === 'page' && progress.outputPath) {
          const content = await readFile(progress.outputPath, 'utf8');
          expect(content).toContain('---');
          expect(content).toContain('title: Test Page');
          expect(content).toContain('notionId: test-id');
          expect(content).toContain('# Test Content');
        }
      }
    });

    it('should exclude frontmatter when noFrontmatter option is true', async (): Promise<void> => {
      const mockPage = createMockPage({
        Name: {
          type: 'title',
          title: [{ plain_text: 'Test Page' }]
        }
      });

      // Mock database query
      // @ts-expect-error accessing private instance for testing
      exporter.notion.databases.query = async (): Promise<{ results: PageObjectResponse[] }> => ({
        results: [mockPage]
      });

      // Mock page retrieval
      // @ts-expect-error accessing private instance for testing
      exporter.notion.pages.retrieve = async (): Promise<PageObjectResponse> => mockPage;

      // Mock markdown conversion
      // @ts-expect-error accessing private instance for testing
      exporter.n2m.pageToMarkdown = async (): Promise<BlockObjectResponse[]> => [];
      // @ts-expect-error accessing private instance for testing
      exporter.n2m.toMarkdownString = (): { parent: string } => ({ parent: '# Test Content' });

      const testOutputDir = join(tmpdir(), 'notion-mdx-test-' + Date.now());
      
      for await (const progress of exporter.exportDatabase({
        database: 'test-db',
        output: testOutputDir,
        notionToken: 'fake-token',
        noFrontmatter: true
      })) {
        if (progress.type === 'page' && progress.outputPath) {
          const content = await readFile(progress.outputPath, 'utf8');
          expect(content).not.toContain('---');
          expect(content).toBe('# Test Content');
        }
      }
    });
  });

  describe('URL transformation', () => {
    let mockN2m: any;

    beforeEach(() => {
      mockN2m = {
        setCustomTransformer: vi.fn()
      };
    });

    it('should not set up transformer when baseUrl is not provided', async () => {
      urlTransform(mockN2m);
      expect(mockN2m.setCustomTransformer).not.toHaveBeenCalled();
    });

    it('should transform absolute URLs to relative when they match baseUrl', async () => {
      const baseUrl = 'https://example.com';
      const mockBlock = {
        paragraph: {
          rich_text: [
            {
              href: 'https://example.com/docs/page',
              text: { content: 'Test Link' }
            }
          ]
        }
      };

      urlTransform(mockN2m, baseUrl);
      const transformer = mockN2m.setCustomTransformer.mock.calls[0][1];
      const result = await transformer(mockBlock);

      expect(result.paragraph.rich_text[0].href).toBe('/docs/page');
    });

    it('should convert exact baseUrl match to root path', async () => {
      const baseUrl = 'https://example.com';
      const mockBlock = {
        paragraph: {
          rich_text: [
            {
              href: 'https://example.com',
              text: { content: 'Home' }
            }
          ]
        }
      };

      urlTransform(mockN2m, baseUrl);
      const transformer = mockN2m.setCustomTransformer.mock.calls[0][1];
      const result = await transformer(mockBlock);

      expect(result.paragraph.rich_text[0].href).toBe('/');
    });

    it('should not transform URLs that do not match baseUrl', async () => {
      const baseUrl = 'https://example.com';
      const mockBlock = {
        paragraph: {
          rich_text: [
            {
              href: 'https://different-domain.com/page',
              text: { content: 'External Link' }
            }
          ]
        }
      };

      urlTransform(mockN2m, baseUrl);
      const transformer = mockN2m.setCustomTransformer.mock.calls[0][1];
      const result = await transformer(mockBlock);

      expect(result.paragraph.rich_text[0].href).toBe('https://different-domain.com/page');
    });

    it('should handle multiple links in the same paragraph', async () => {
      const baseUrl = 'https://example.com';
      const mockBlock = {
        paragraph: {
          rich_text: [
            {
              href: 'https://example.com/docs/page1',
              text: { content: 'Internal Link 1' }
            },
            {
              href: 'https://different-domain.com/page',
              text: { content: 'External Link' }
            },
            {
              href: 'https://example.com/docs/page2',
              text: { content: 'Internal Link 2' }
            }
          ]
        }
      };

      urlTransform(mockN2m, baseUrl);
      const transformer = mockN2m.setCustomTransformer.mock.calls[0][1];
      const result = await transformer(mockBlock);

      expect(result.paragraph.rich_text[0].href).toBe('/docs/page1');
      expect(result.paragraph.rich_text[1].href).toBe('https://different-domain.com/page');
      expect(result.paragraph.rich_text[2].href).toBe('/docs/page2');
    });
  });
});

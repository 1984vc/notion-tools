import { describe, it, expect, beforeEach } from 'vitest';
import { NotionMarkdownExporter } from '../bin/markdown';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { join } from 'path';
import { tmpdir } from 'os';

describe('NotionMarkdownExporter', () => {
  let exporter: NotionMarkdownExporter;

  const createMockPage = (properties: any): PageObjectResponse => ({
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
    it('should extract title from page properties', async () => {
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

    it('should return "untitled" when no title is found', async () => {
      const mockPage = createMockPage({});

      // @ts-expect-error accessing private method for testing
      const title = await exporter.getPageTitle(mockPage);
      expect(title).toBe('untitled');
    });
  });

  describe('transformDatabaseLinks', () => {
    it('should transform database links to use page paths', async () => {
      // Mock the Notion API call
      // @ts-expect-error accessing private instance for testing
      exporter.notion.pages.retrieve = async ({ page_id }) => createMockPage({
        path: {
          type: 'rich_text',
          rich_text: [{ plain_text: 'guides/safe-vs-priced-rounds' }]
        }
      });

      const markdown = 'Check out [Safe vs Priced Rounds](/3c5a0edb257449558cf968f5ded58812)';
      
      // @ts-expect-error accessing private method for testing
      const transformed = await exporter.transformDatabaseLinks(markdown);
      
      expect(transformed).toBe('Check out [Safe vs Priced Rounds](/guides/safe-vs-priced-rounds)');
    });

    it('should handle multiple database links', async () => {
      // Mock the Notion API call with different responses based on page ID
      // @ts-expect-error accessing private instance for testing
      exporter.notion.pages.retrieve = async ({ page_id }) => {
        const paths = {
          '3c5a0edb257449558cf968f5ded58812': 'guides/safe-vs-priced-rounds',
          '23f1324e5ecc4d32af0e81e60a03cf18': 'guides/pre-money-vs-post-money'
        };
        const id = page_id.replace(/-/g, '');
        return createMockPage({
          path: {
            type: 'rich_text',
            rich_text: [{ plain_text: paths[id] }]
          }
        });
      };

      const markdown = `Check out [Safe vs Priced Rounds](/3c5a0edb257449558cf968f5ded58812)
And [Pre vs Post Money](/23f1324e5ecc4d32af0e81e60a03cf18)`;
      
      // @ts-expect-error accessing private method for testing
      const transformed = await exporter.transformDatabaseLinks(markdown);
      
      expect(transformed).toBe(`Check out [Safe vs Priced Rounds](/guides/safe-vs-priced-rounds)
And [Pre vs Post Money](/guides/pre-money-vs-post-money)`);
    });

    it('should preserve links that do not have matching pages', async () => {
      // Mock the Notion API call to return a page without a path property
      // @ts-expect-error accessing private instance for testing
      exporter.notion.pages.retrieve = async () => createMockPage({});

      const markdown = 'Check out [Missing Page](/3c5a0edb257449558cf968f5ded58812)';
      
      // @ts-expect-error accessing private method for testing
      const transformed = await exporter.transformDatabaseLinks(markdown);
      
      expect(transformed).toBe(markdown);
    });

    it('should add basePath to internal links when provided', async () => {
      exporter = new NotionMarkdownExporter('fake-token', 'docs');

      // Mock the Notion API call
      // @ts-expect-error accessing private instance for testing
      exporter.notion.pages.retrieve = async ({ page_id }) => createMockPage({
        path: {
          type: 'rich_text',
          rich_text: [{ plain_text: 'guides/safe-vs-priced-rounds' }]
        }
      });

      const markdown = 'Check out [Safe vs Priced Rounds](/3c5a0edb257449558cf968f5ded58812)';
      
      // @ts-expect-error accessing private method for testing
      const transformed = await exporter.transformDatabaseLinks(markdown);
      
      expect(transformed).toBe('Check out [Safe vs Priced Rounds](/docs/guides/safe-vs-priced-rounds)');
    });
  });

  describe('normalizeQuotes', () => {
    it('should replace curly quotes with straight quotes in React components', async () => {
      const markdown = `
import { Callout } from "nextra/components";

<Callout emoji=”📢”>
  This is a "quoted" text with some "React components"
</Callout>
      `;

      // @ts-expect-error accessing private method for testing
      const normalized = exporter.normalizeQuotes(markdown);

      expect(normalized).toBe(`
import { Callout } from "nextra/components";

<Callout emoji="📢">
  This is a "quoted" text with some "React components"
</Callout>
      `);
    });
  });

  describe('processPage', () => {
    it('should include weight in page metadata', async () => {
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

      // Mock the necessary methods
      // @ts-expect-error accessing private instance for testing
      exporter.notion.pages.retrieve = async () => mockPage;
      // @ts-expect-error accessing private instance for testing
      exporter.n2m.pageToMarkdown = async () => [];
      // @ts-expect-error accessing private instance for testing
      exporter.n2m.toMarkdownString = () => ({ parent: '# Test Content' });

      // @ts-expect-error accessing private method for testing
      const result = await exporter.processPage(mockPage, '/output', 5);

      expect(result.metadata.weight).toBe(5);
      expect(result.metadata.notionId).toBe('test-id');
      expect(result.title).toBe('Test Page');
    });
  });

  describe('exportDatabase', () => {
    it('should export database with JSON when includeJson is true', async () => {
      const mockPage = createMockPage({
        Name: {
          type: 'title',
          title: [{ plain_text: 'Test Page' }]
        }
      });

      // Mock database query
      // @ts-expect-error accessing private instance for testing
      exporter.notion.databases.query = async () => ({
        results: [mockPage]
      });

      // Mock page retrieval
      // @ts-expect-error accessing private instance for testing
      exporter.notion.pages.retrieve = async () => mockPage;

      // Mock blocks retrieval
      // @ts-expect-error accessing private instance for testing
      exporter.notion.blocks.children.list = async () => ({
        results: [{ type: 'paragraph', paragraph: { text: [{ plain_text: 'Test content' }] } }]
      });

      // Mock markdown conversion
      // @ts-expect-error accessing private instance for testing
      exporter.n2m.pageToMarkdown = async () => [];
      // @ts-expect-error accessing private instance for testing
      exporter.n2m.toMarkdownString = () => ({ parent: '# Test Content' });

      const testOutputDir = join(tmpdir(), 'notion-mdx-test-' + Date.now());
      const progress = await exporter.exportDatabase({
        database: 'test-db',
        output: testOutputDir,
        notionToken: 'fake-token',
        includeJson: true
      });

      expect(progress).toHaveLength(3); // start, page, complete
      expect(progress[0].type).toBe('start');
      expect(progress[1].type).toBe('page');
      expect(progress[2].type).toBe('complete');
    });
  });
});

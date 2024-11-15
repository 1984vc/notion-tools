import { describe, it, expect, beforeEach } from 'vitest';
import { NotionExporter } from '../bin/notion';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

describe('NotionExporter', () => {
  let exporter: NotionExporter;

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
    exporter = new NotionExporter('fake-token');
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
  });

  describe('processPage', () => {
    it('should include sort_order in page metadata', async () => {
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

      expect(result.metadata.sort_order).toBe(5);
      expect(result.metadata.notionId).toBe('test-id');
      expect(result.title).toBe('Test Page');
    });
  });
});

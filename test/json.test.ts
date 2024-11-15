import { describe, it, expect, beforeEach } from 'vitest';
import { NotionJsonExporter } from '../bin/json';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

describe('NotionJsonExporter', () => {
  let exporter: NotionJsonExporter;

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
    exporter = new NotionJsonExporter('fake-token');
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

  describe('processPage', () => {
    it('should process page with all required fields', async () => {
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
      exporter.notion.blocks.children.list = async () => ({
        results: [
          {
            type: 'paragraph',
            paragraph: { text: [{ plain_text: 'Test content' }] }
          }
        ]
      });

      // @ts-expect-error accessing private method for testing
      const result = await exporter.processPage(mockPage, 5);

      expect(result.id).toBe('test-id');
      expect(result.title).toBe('Test Page');
      expect(result.weight).toBe(5);
      expect(result.created_time).toBe('2023-01-01T00:00:00.000Z');
      expect(result.last_edited_time).toBe('2023-01-02T00:00:00.000Z');
      expect(result.properties).toBeDefined();
      expect(result.blocks).toBeDefined();
      expect(Array.isArray(result.blocks)).toBe(true);
    });
  });
});

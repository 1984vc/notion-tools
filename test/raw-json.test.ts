import { describe, it, expect, beforeEach } from 'vitest';
import { NotionRawExporter } from '../bin/raw-json';

describe('NotionRawExporter', () => {
  let exporter: NotionRawExporter;

  beforeEach(() => {
    exporter = new NotionRawExporter('fake-token');
  });

  describe('exportRaw', () => {
    it('should fetch and format database data', async () => {
      const mockDatabaseResponse = {
        results: [
          {
            id: 'page-id',
            properties: {
              title: { type: 'title', title: [{ plain_text: 'Test Page' }] }
            }
          }
        ]
      };

      // @ts-expect-error accessing private instance for testing
      exporter.notion.databases.query = async () => mockDatabaseResponse;

      const result = await exporter.exportRaw({ id: 'test-db-id', notionToken: 'fake-token' });
      const parsed = JSON.parse(result);

      expect(parsed).toEqual(mockDatabaseResponse);
    });

    it('should fetch and format page data when database fetch fails', async () => {
      const mockPageResponse = {
        id: 'page-id',
        properties: {
          title: { type: 'title', title: [{ plain_text: 'Test Page' }] }
        }
      };

      const mockBlocksResponse = {
        results: [
          {
            type: 'paragraph',
            paragraph: { text: [{ plain_text: 'Test content' }] }
          }
        ]
      };

      // @ts-expect-error accessing private instance for testing
      exporter.notion.databases.query = async () => {
        const error: any = new Error('Not found');
        error.code = 'object_not_found';
        throw error;
      };

      // @ts-expect-error accessing private instance for testing
      exporter.notion.pages.retrieve = async () => mockPageResponse;
      // @ts-expect-error accessing private instance for testing
      exporter.notion.blocks.children.list = async () => mockBlocksResponse;

      const result = await exporter.exportRaw({ id: 'test-page-id', notionToken: 'fake-token' });
      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        page: mockPageResponse,
        blocks: mockBlocksResponse
      });
    });

    it('should throw error when neither database nor page is found', async () => {
      // @ts-expect-error accessing private instance for testing
      exporter.notion.databases.query = async () => {
        throw new Error('Database not found');
      };

      // @ts-expect-error accessing private instance for testing
      exporter.notion.pages.retrieve = async () => {
        throw new Error('Page not found');
      };

      await expect(
        exporter.exportRaw({ id: 'invalid-id', notionToken: 'fake-token' })
      ).rejects.toThrow('Failed to fetch Notion content');
    });
  });
});

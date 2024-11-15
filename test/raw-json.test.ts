import { describe, it, expect, beforeEach } from 'vitest';
import { NotionRawExporter } from '../bin/raw-json';
import type { QueryDatabaseResponse, PageObjectResponse, ListBlockChildrenResponse } from '@notionhq/client/build/src/api-endpoints';

interface NotionError extends Error {
  code?: string;
  status?: number;
}

describe('NotionRawExporter', () => {
  let exporter: NotionRawExporter;

  beforeEach(() => {
    exporter = new NotionRawExporter('fake-token');
  });

  describe('exportRaw', () => {
    it('should fetch and format database data', async (): Promise<void> => {
      const mockDatabaseResponse = {
        type: 'page_or_database',
        page_or_database: {},
        object: 'list',
        results: [
          {
            object: 'page',
            id: 'page-id',
            created_time: '2024-01-01T00:00:00.000Z',
            last_edited_time: '2024-01-01T00:00:00.000Z',
            created_by: { object: 'user', id: 'user-id' },
            last_edited_by: { object: 'user', id: 'user-id' },
            cover: null,
            icon: null,
            parent: { type: 'database_id', database_id: 'test-db' },
            archived: false,
            properties: {
              'Page Title': {
                id: 'title-id',
                type: 'title',
                title: [{
                  type: 'text',
                  text: { content: 'Test Page', link: null },
                  annotations: {
                    bold: false,
                    italic: false,
                    strikethrough: false,
                    underline: false,
                    code: false,
                    color: 'default'
                  },
                  plain_text: 'Test Page',
                  href: null
                }]
              }
            },
            url: 'https://notion.so/test-page',
            public_url: null,
            in_trash: false
          } as PageObjectResponse
        ],
        next_cursor: null,
        has_more: false
      } as unknown as QueryDatabaseResponse;

      // @ts-expect-error accessing private instance for testing
      exporter.notion.databases.query = async (): Promise<QueryDatabaseResponse> => mockDatabaseResponse;

      const result = await exporter.exportRaw({ id: 'test-db-id', notionToken: 'fake-token' });
      const parsed = JSON.parse(result);

      expect(parsed).toEqual(mockDatabaseResponse);
    });

    it('should fetch and format page data when database fetch fails', async (): Promise<void> => {
      const mockPageResponse = {
        object: 'page',
        id: 'page-id',
        created_time: '2024-01-01T00:00:00.000Z',
        last_edited_time: '2024-01-01T00:00:00.000Z',
        created_by: { object: 'user', id: 'user-id' },
        last_edited_by: { object: 'user', id: 'user-id' },
        cover: null,
        icon: null,
        parent: { type: 'database_id', database_id: 'test-db' },
        archived: false,
        properties: {
          'Page Title': {
            id: 'title-id',
            type: 'title',
            title: [{
              type: 'text',
              text: { content: 'Test Page', link: null },
              annotations: {
                bold: false,
                italic: false,
                strikethrough: false,
                underline: false,
                code: false,
                color: 'default'
              },
              plain_text: 'Test Page',
              href: null
            }]
          }
        },
        url: 'https://notion.so/test-page',
        public_url: null,
        in_trash: false
      } as unknown as PageObjectResponse;

      const mockBlocksResponse = {
        object: 'list',
        results: [
          {
            object: 'block',
            id: 'block-id',
            parent: { type: 'page_id', page_id: 'page-id' },
            created_time: '2024-01-01T00:00:00.000Z',
            last_edited_time: '2024-01-01T00:00:00.000Z',
            created_by: { object: 'user', id: 'user-id' },
            last_edited_by: { object: 'user', id: 'user-id' },
            has_children: false,
            archived: false,
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
          }
        ],
        next_cursor: null,
        has_more: false
      } as ListBlockChildrenResponse;

      // @ts-expect-error accessing private instance for testing
      exporter.notion.databases.query = async (): Promise<never> => {
        const error: NotionError = new Error('Not found');
        error.code = 'object_not_found';
        throw error;
      };

      // @ts-expect-error accessing private instance for testing
      exporter.notion.pages.retrieve = async (): Promise<PageObjectResponse> => mockPageResponse;
      // @ts-expect-error accessing private instance for testing
      exporter.notion.blocks.children.list = async (): Promise<ListBlockChildrenResponse> => mockBlocksResponse;

      const result = await exporter.exportRaw({ id: 'test-page-id', notionToken: 'fake-token' });
      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        page: mockPageResponse,
        blocks: mockBlocksResponse
      });
    });

    it('should throw error when neither database nor page is found', async (): Promise<void> => {
      // @ts-expect-error accessing private instance for testing
      exporter.notion.databases.query = async (): Promise<never> => {
        throw new Error('Database not found');
      };

      // @ts-expect-error accessing private instance for testing
      exporter.notion.pages.retrieve = async (): Promise<never> => {
        throw new Error('Page not found');
      };

      await expect(
        exporter.exportRaw({ id: 'invalid-id', notionToken: 'fake-token' })
      ).rejects.toThrow('Failed to fetch Notion content');
    });
  });
});

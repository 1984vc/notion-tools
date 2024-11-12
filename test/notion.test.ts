import { describe, it, expect, beforeEach } from 'vitest';
import { NotionExporter } from '../bin/notion';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

describe('NotionExporter', () => {
  let exporter: NotionExporter;

  beforeEach(() => {
    exporter = new NotionExporter('fake-token');
  });

  describe('getPageTitle', () => {
    it('should extract title from page properties', async () => {
      const mockPage = {
        properties: {
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
        }
      } as unknown as PageObjectResponse;

      // @ts-expect-error accessing private method for testing
      const title = await exporter.getPageTitle(mockPage);
      expect(title).toBe('Test Page');
    });

    it('should return "untitled" when no title is found', async () => {
      const mockPage = {
        properties: {}
      } as unknown as PageObjectResponse;

      // @ts-expect-error accessing private method for testing
      const title = await exporter.getPageTitle(mockPage);
      expect(title).toBe('untitled');
    });
  });
});

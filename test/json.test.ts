import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { join } from 'path';

import { databaseTransformer, pageTransformer } from "../bin/transformers"

const fixtureDbData = JSON.parse(
  await readFile(join(process.cwd(), 'test/fixtures/database.json'), 'utf-8')
);

const fixturePageData = JSON.parse(
  await readFile(join(process.cwd(), 'test/fixtures/page.json'), 'utf-8')
);

describe('NotionJsonExporter', () => {
  describe('transform JSON results into something easier to process', () => {
    it('should simplify database results correctly', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transformed = databaseTransformer(fixtureDbData) as any

      expect(transformed[0].properties).toEqual({
        Tags: [],
        URL: 'https://www.hyperdx.io/',
        Description: 'Open source Datadog',
        Filters: 'oss saas',
        Highlighted: false,
        'Sort Order Override': null,
        Story: '',
        Stage: null,
        Name: 'HyperDx'
      });
    });
    it('should simplify page results correctly', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transformed = pageTransformer(fixturePageData) as any

      expect(transformed.page.properties).toEqual({
        "Name": "Raising your Series A",
        "author": null,
        "description": "",
        "draft": false,
        "path": "/docs/founders-handbook/raising-your-series-a",
        "weight": 6,

      });
    });
  });
});

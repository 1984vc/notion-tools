import { QueryDatabaseResponse } from '@notionhq/client/build/src/api-endpoints.js';
import { NotionToMarkdown } from 'notion-to-md';
import { PageWithBlocks } from './json.js';
export declare function urlTransform(n2m: NotionToMarkdown, baseUrl?: string): void;
export declare function hextraTransform(n2m: NotionToMarkdown): void;
export declare const pageTransformer: (pageResponse: PageWithBlocks) => any;
export declare const databaseTransformer: (response: QueryDatabaseResponse) => any;
export declare const flattenProperties: (properties: Record<string, unknown>) => Record<string, unknown>;
export declare function imageTransform(n2m: NotionToMarkdown, assetsDirPath?: string, assetsDirBasePath?: string): void;

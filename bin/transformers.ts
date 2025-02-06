import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { QueryDatabaseResponse } from '@notionhq/client/build/src/api-endpoints.js';
import { NotionToMarkdown } from 'notion-to-md';
import { PageWithBlocks } from './json.js';

export function urlTransform(n2m: NotionToMarkdown, baseUrl?: string): void {
  if (!baseUrl) return;

  // Transform absolute links to relative links if they match the base URL
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  n2m.setCustomTransformer('paragraph', async (block: any) => {
    if (!block.paragraph?.rich_text) return block;

    // Transform URLs in rich_text array
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    block.paragraph.rich_text = block.paragraph.rich_text.map((text: any) => {
      if (!text.href || !text.href.startsWith(baseUrl)) return text;

      // If URL matches baseUrl exactly, convert to root path
      if (text.href === baseUrl) {
        text.href = '/';
        return text;
      }

      // Convert absolute URL to relative by removing baseUrl
      text.href = text.href.replace(baseUrl, '');
      return text;
    });

    return block;
  });
}

export function hextraTransform(n2m: NotionToMarkdown): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  n2m.setCustomTransformer('callout', async (block: any) => {
    // get the callout icon (emoji or external icon)
    const icon = block.callout.icon?.emoji || '📄';
    
    // map notion colors to hextra callout types
    const colortypemap: Record<string, string> = {
      red: 'error',
      red_background: 'error',
      orange: 'warning',
      orange_background: 'warning',
      default: 'info',
      blue: 'info',
      blue_background: 'info',
      green: 'info',
      green_background: 'info',
      yellow: 'info',
      yellow_background: 'info',
      pink: 'info',
      pink_background: 'info',
      purple: 'info',
      purple_background: 'info',
      brown: 'info',
      brown_background: 'info',
      gray: 'info',
      gray_background: 'info'
    };

    const calloutType = colortypemap[block.callout.color] || 'info';
    
    // Format for Hextra's Callout component
    const fakeParagraph = { ...block };
    fakeParagraph.type = 'paragraph';
    fakeParagraph.paragraph = { ...block.callout } 
    const mdBlocks = await n2m.blockToMarkdown(fakeParagraph);
    return `{{< callout type="${calloutType}" emoji="${icon}" >}}\n${mdBlocks}\n{{< /callout >}}`;
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const pageTransformer = (pageResponse: PageWithBlocks): any => {
  const page = pageResponse.page
  if ('properties' in page) {
    return {
      ...pageResponse,
      page: {
        ...pageResponse.page,
        properties: flattenProperties(page.properties),
      },
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const databaseTransformer = (response: QueryDatabaseResponse): any => {
  return response.results.map((page) => {
    if ('properties' in page) {
      return {
        ...page,
        properties: flattenProperties(page.properties),
      };
    }
    return page;
  });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export const flattenProperties = (properties: Record<string, unknown>): Record<string, unknown> => {
  const simplifiedProperties: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (value && typeof value === 'object') {
      const propertyType = (value as any).type;

      switch (propertyType) {
        case 'title':
          simplifiedProperties[key] = (value as any).title[0]?.plain_text || '';
          break;
        case 'rich_text':
          simplifiedProperties[key] = (value as any).rich_text.map((rt: any) => rt.plain_text).join('');
          break;
        case 'number':
          simplifiedProperties[key] = (value as any).number;
          break;
        case 'select':
          simplifiedProperties[key] = (value as any).select?.name || null;
          break;
        case 'multi_select':
          simplifiedProperties[key] = (value as any).multi_select.map((ms: any) => ms.name);
          break;
        case 'date':
          simplifiedProperties[key] = (value as any).date?.start || null;
          break;
        case 'checkbox':
          simplifiedProperties[key] = (value as any).checkbox;
          break;
        case 'url':
          simplifiedProperties[key] = (value as any).url || null;
          break;
        default:
          simplifiedProperties[key] = null;
          break;
      }
    } else {
      simplifiedProperties[key] = value;
    }
  }

  return simplifiedProperties;
}

export function imageTransform(n2m: NotionToMarkdown, assetsDirPath: string = 'assets', assetsDirBasePath: string = ''): void {
  // Ensure the assets directory exists
  if (!fs.existsSync(assetsDirPath)) {
    fs.mkdirSync(assetsDirPath, { recursive: true });
  }
  n2m.setCustomTransformer('image', async (block: any) => {
    if (!block.image) return block;
    if (block.image.external?.url && !block.image.file) return block;
    const url = block.image.external?.url || block.image.file?.url;
    if (!url) return block;
    const originalName = path.basename(new URL(url).pathname);
    const ext = path.extname(originalName);
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    const hash = crypto.createHash('sha1').update(fileBuffer).digest('hex');
    const fileName = hash + ext;
    const localFilePath = path.join(assetsDirPath, fileName);
    const linkFilePath = path.join(assetsDirBasePath, fileName);
    console.log(`Saving image as ${localFilePath}`);
    if (!fs.existsSync(localFilePath)) {
      fs.writeFileSync(localFilePath, fileBuffer);
    }
    return `![${fileName}](${linkFilePath}) ${block.image.caption ? `*${block.image.caption[0]?.plain_text}*` : ''}`;
  });
}

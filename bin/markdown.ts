import { Client, isFullPage } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';
import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { PageObjectResponse} from '@notionhq/client/build/src/api-endpoints.js';
import { MetaGenerator } from './meta.js';

interface ExportOptions {
  database: string;
  output: string;
  notionToken: string;
  includeJson?: boolean;
  basePath?: string;
  noFrontmatter?: boolean;
  extension?: string;
  skipMeta?: boolean;
  useHextraTransformers?: boolean;
}

interface PageExport {
  title: string;
  content: string;
  metadata: {
    notionId: string;
    createdAt: string;
    lastEditedAt: string;
    weight: number;
  };
  outputPath: string;
}

interface ExportProgress {
  type: 'start' | 'page' | 'meta' | 'json' | 'complete';
  totalPages?: number;
  currentPage?: number;
  pageId?: string;
  outputPath?: string;
  directory?: string;
  error?: string;
}

interface TitleProperty {
  type: 'title';
  title: Array<{
    plain_text: string;
  }>;
}

interface RichTextProperty {
  type: 'rich_text';
  rich_text: Array<{
    plain_text: string;
  }>;
}

interface NumberProperty {
  type: 'number';
  number: number;
}

interface SelectProperty {
  type: 'select';
  select: {
    name: string;
  } | null;
}

interface MultiSelectProperty {
  type: 'multi_select';
  multi_select: Array<{
    name: string;
  }>;
}

interface DateProperty {
  type: 'date';
  date: {
    start: string;
  } | null;
}

interface CheckboxProperty {
  type: 'checkbox';
  checkbox: boolean;
}

interface UrlProperty {
  type: 'url';
  url: string | null;
}

interface EmailProperty {
  type: 'email';
  email: string | null;
}

interface PhoneNumberProperty {
  type: 'phone_number';
  phone_number: string | null;
}

interface FormulaProperty {
  type: 'formula';
  formula: {
    type: 'string' | 'number';
    string?: string;
    number?: number;
  };
}

interface RelationProperty {
  type: 'relation';
  relation: Array<{
    id: string;
  }>;
}

interface RollupProperty {
  type: 'rollup';
  rollup: {
    type: 'array';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    array: Array<any>;
  };
}

interface CreatedTimeProperty {
  type: 'created_time';
  created_time: string;
}

interface LastEditedTimeProperty {
  type: 'last_edited_time';
  last_edited_time: string;
}

interface CreatedByProperty {
  type: 'created_by';
  created_by: {
    id: string;
  };
}

interface LastEditedByProperty {
  type: 'last_edited_by';
  last_edited_by: {
    id: string;
  };
}

interface PeopleProperty {
  type: 'people';
  people: Array<{
    object: 'user';
    id: string;
  }>;
}

type NotionProperty = TitleProperty | RichTextProperty | NumberProperty | SelectProperty | MultiSelectProperty | DateProperty | CheckboxProperty | UrlProperty | EmailProperty | PhoneNumberProperty | FormulaProperty | RelationProperty | RollupProperty | CreatedTimeProperty | LastEditedTimeProperty | CreatedByProperty | LastEditedByProperty | PeopleProperty;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CustomTransformer = (block: any) => Promise<string>;

export class NotionMarkdownExporter {
  private notion: Client;
  private n2m: NotionToMarkdown;
  private pagePathCache: Map<string, string>;
  private metaGenerator: MetaGenerator;
  private basePath: string;

  constructor(notionToken: string, basePath?: string, transformers?: (n2m: NotionToMarkdown) => void) {
    this.notion = new Client({ auth: notionToken });
    this.n2m = new NotionToMarkdown({ notionClient: this.notion });
    this.pagePathCache = new Map();
    this.metaGenerator = new MetaGenerator();
    this.basePath = basePath || '';
    
    if (transformers) {
      transformers(this.n2m);
    }
  }

  public setCustomTransformer(type: string, transformer: CustomTransformer): void {
    this.n2m.setCustomTransformer(type, transformer);
  }

  private normalizeQuotes(content: string): string {
    return content.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, '\'');
  }

  private async getPageTitle(pageInfo: PageObjectResponse): Promise<string> {
    const properties = pageInfo.properties as Record<string, NotionProperty>;
    const titleProp = Object.values(properties).find(
      (prop): prop is TitleProperty => prop.type === 'title'
    );

    return titleProp?.title?.[0]?.plain_text || 'untitled';
  }

  private async getOutputPath(pageInfo: PageObjectResponse, baseOutputDir: string, title: string, options: ExportOptions): Promise<string> {
    const properties = pageInfo.properties as Record<string, NotionProperty>;
    const pathProp = (properties['path'] || properties['Path']) as RichTextProperty | undefined;
    
    if (pathProp?.type === 'rich_text' && pathProp.rich_text[0]?.plain_text) {
      const customPath = pathProp.rich_text[0].plain_text;
      const pathParts = customPath.split('/');
      const extension = options.extension || '.mdx';
      const filename = `${pathParts.pop()}${extension}`;
      const directories = pathParts.join('/');
      return join(baseOutputDir, directories, filename);
    }

    const extension = options.extension || '.mdx';
    const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}${extension}`;
    return join(baseOutputDir, filename);
  }

  private async getPagePath(pageId: string): Promise<string | null> {
    try {
      const cleanId = pageId.replace(/-/g, '');
      const formattedId = cleanId.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
      
      if (this.pagePathCache.has(formattedId)) {
        return this.pagePathCache.get(formattedId) || null;
      }

      const pageInfo = await this.notion.pages.retrieve({ page_id: formattedId });
      if (!isFullPage(pageInfo)) {
        return null;
      }

      const properties = pageInfo.properties as Record<string, NotionProperty>;
      const pathProp = (properties['path'] || properties['Path']) as RichTextProperty | undefined;
      
      if (pathProp?.type === 'rich_text' && pathProp.rich_text[0]?.plain_text) {
        const path = pathProp.rich_text[0].plain_text;
        this.pagePathCache.set(formattedId, path);
        return path;
      }

      this.pagePathCache.set(formattedId, '');
      return null;
    } catch (error) {
      console.error(`Failed to fetch path for page ${pageId}:`, error);
      return null;
    }
  }

  private async transformDatabaseLinks(markdown: string): Promise<string> {
    const linkRegex = /\[([^\]]+)\]\(\/([a-f0-9-]{32,36})\)/g;
    let transformedMarkdown = markdown;

    for (const match of transformedMarkdown.matchAll(linkRegex)) {
      const [fullMatch, linkText, pageId] = match;
      const pagePath = await this.getPagePath(pageId);

      if (pagePath) {
        const prefix = this.basePath ? `/${this.basePath}` : '';
        const newLink = `[${linkText}](${prefix}/${pagePath})`;
        transformedMarkdown = transformedMarkdown.replace(fullMatch, newLink);
      }
    }

    return transformedMarkdown;
  }

  private async convertPageToMarkdown(pageId: string): Promise<string> {
    const mdblocks = await this.n2m.pageToMarkdown(pageId);
    const { parent: markdown } = this.n2m.toMarkdownString(mdblocks);
    const transformedMarkdown = await this.transformDatabaseLinks(markdown);
    return this.normalizeQuotes(transformedMarkdown);
  }

  private async processPage(page: PageObjectResponse, baseOutputDir: string, options: ExportOptions): Promise<PageExport> {
    const pageInfo = await this.notion.pages.retrieve({ page_id: page.id });
    
    if (!isFullPage(pageInfo)) {
      throw new Error('Retrieved incomplete page object');
    }

    const properties = pageInfo.properties as Record<string, NotionProperty>;
    const weightProp = (properties['weight'] || properties['Weight']) as NumberProperty | undefined;
    const weight = weightProp?.type === 'number' ? weightProp.number : 0;

    const title = await this.getPageTitle(pageInfo);
    const markdown = await this.convertPageToMarkdown(page.id);
    const outputPath = await this.getOutputPath(pageInfo, baseOutputDir, title, options);

    return {
      title,
      content: markdown,
      metadata: {
        notionId: page.id,
        createdAt: pageInfo.created_time,
        lastEditedAt: pageInfo.last_edited_time,
        weight
      },
      outputPath,
    };
  }

  private async exportDatabaseJson(database: string, output: string): Promise<void> {
    const response = await this.notion.databases.query({
      database_id: database
    });

    const pages = [];
    for (const page of response.results) {
      const pageInfo = await this.notion.pages.retrieve({ page_id: page.id });
      const blocks = await this.notion.blocks.children.list({ block_id: page.id });
      pages.push({
        page: pageInfo,
        blocks: blocks.results
      });
    }

    const jsonPath = join(output, 'index.json');
    await writeFile(jsonPath, JSON.stringify({ pages }, null, 2), 'utf8');
  }

  public async *exportDatabase(options: ExportOptions): AsyncGenerator<ExportProgress> {
    this.basePath = options.basePath || '';
    
    await mkdir(options.output, { recursive: true });

    const response = await this.notion.databases.query({
      database_id: options.database
    });

    yield { 
      type: 'start',
      totalPages: response.results.length 
    };

    for (const [index, page] of response.results.entries()) {
      try {
        if (!isFullPage(page)) {
          throw new Error('Received partial page object');
        }

        const exportedPage = await this.processPage(page, options.output, options);
        const dirPath = dirname(exportedPage.outputPath);
        await mkdir(dirPath, { recursive: true });

        let content = exportedPage.content;
        if (!options.noFrontmatter) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const frontmatter: Record<string, any> = {
            title: exportedPage.title,
            notionId: exportedPage.metadata.notionId,
            createdAt: exportedPage.metadata.createdAt,
            lastEditedAt: exportedPage.metadata.lastEditedAt,
            weight: exportedPage.metadata.weight
          };

          // Add all page properties
          const properties = page.properties as Record<string, NotionProperty>;
          for (const [key, prop] of Object.entries(properties)) {
            switch (prop.type) {
              case 'title':
                frontmatter[key] = prop.title?.[0]?.plain_text || '';
                break;
              case 'rich_text':
                frontmatter[key] = prop.rich_text?.[0]?.plain_text || '';
                break;
              case 'number':
                frontmatter[key] = prop.number;
                break;
              case 'select':
                frontmatter[key] = prop.select?.name || '';
                break;
              case 'multi_select':
                frontmatter[key] = prop.multi_select?.map(s => s.name) || [];
                break;
              case 'date':
                frontmatter[key] = prop.date?.start || '';
                break;
              case 'checkbox':
                frontmatter[key] = prop.checkbox;
                break;
              case 'url':
                frontmatter[key] = prop.url || '';
                break;
              case 'email':
                frontmatter[key] = prop.email || '';
                break;
              case 'phone_number':
                frontmatter[key] = prop.phone_number || '';
                break;
              case 'formula':
                frontmatter[key] = prop.formula?.string || prop.formula?.number || '';
                break;
              case 'relation':
                frontmatter[key] = prop.relation?.map(r => r.id) || [];
                break;
              case 'rollup':
                frontmatter[key] = prop.rollup?.array || [];
                break;
              case 'created_time':
                frontmatter[key] = prop.created_time;
                break;
              case 'last_edited_time':
                frontmatter[key] = prop.last_edited_time;
                break;
              case 'created_by':
                frontmatter[key] = prop.created_by?.id || '';
                break;
              case 'last_edited_by':
                frontmatter[key] = prop.last_edited_by?.id || '';
                break;
              case 'people':
                frontmatter[key] = prop.people?.map(p => p.id) || [];
                break;
              default:
                frontmatter[key] = '';
            }
          }

          // Convert to YAML front-matter
          const yaml = Object.entries(frontmatter)
            .map(([key, value]) => {
              if (Array.isArray(value)) {
                return `${key}:\n${value.map(v => `  - ${v}`).join('\n')}`;
              }
              if (typeof value === 'string') {
                return `${key}: ${value}`;
              }
              return `${key}: ${JSON.stringify(value)}`;
            })
            .join('\n');

          content = `---
${yaml}
---

${content}`;
        }

        await writeFile(exportedPage.outputPath, content, 'utf8');
        
        this.metaGenerator.addPage(exportedPage.outputPath, exportedPage.title, exportedPage.metadata.weight);

        yield {
          type: 'page',
          currentPage: index + 1,
          totalPages: response.results.length,
          pageId: page.id,
          outputPath: exportedPage.outputPath
        };

      } catch (error) {
        yield {
          type: 'page',
          currentPage: index + 1,
          totalPages: response.results.length,
          pageId: page.id,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }

    if (!options.skipMeta) {
      const directories = this.metaGenerator.getDirectories();
      for (const dir of directories) {
        await this.metaGenerator.generateMetaFile(dir);
        yield {
          type: 'meta',
          directory: dir
        };
      }
    }

    if (options.includeJson) {
      await this.exportDatabaseJson(options.database, options.output);
      yield {
        type: 'json'
      };
    }

    yield { type: 'complete' };
  }
}

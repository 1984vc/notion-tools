#!/usr/bin/env node

import { Command } from 'commander';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { NotionMarkdownExporter } from './markdown.js';
import { hextraTransform } from './transformers.js';
import { NotionJsonExporter } from './json.js';
import { NotionRawExporter } from './raw-json.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main(): Promise<void> {
  // Read package.json
  const packageJson = JSON.parse(
    await readFile(join(__dirname, '../package.json'), 'utf8')
  );

  // Check for required environment variable
  const NOTION_TOKEN = process.env.NOTION_TOKEN;

  const program = new Command();

  program
    .name('notion-export')
    .description('Export Notion database pages to various formats')
    .version(packageJson.version);

  interface ExportOptions {
    id: string;
    output: string;
    includeJson?: boolean;
    basePath?: string;
    noFrontmatter?: boolean;
  }

  program
    .command('export-nextra')
    .description('Export pages from a Notion database to MDX files for Nextra')
    .requiredOption('--id <id>', 'Notion database ID')
    .requiredOption('-o, --output <path>', 'Output directory path')
    .option('--include-json', 'Include raw JSON export in output directory')
    .option('--base-path <path>', 'Base path for internal links (e.g., /docs)')
    .option('--no-frontmatter', 'Exclude frontmatter from MDX files')
    .action(async (options: ExportOptions) => {
      if (!NOTION_TOKEN) {
        console.error('Error: NOTION_TOKEN environment variable is required');
        console.error('Please set it with: export NOTION_TOKEN=your_integration_token');
        process.exit(1);
      }

      try {
        const exporter = new NotionMarkdownExporter(
          NOTION_TOKEN,
          undefined,
          hextraTransform
        );
        
        // Create async iterator for progress updates
        const progressIterator = exporter.exportDatabase({
          database: options.id,
          output: options.output,
          notionToken: NOTION_TOKEN,
          includeJson: options.includeJson,
          basePath: options.basePath,
          noFrontmatter: options.noFrontmatter,
          extension: '.mdx',
          skipMeta: false
        });

        // Process progress updates as they come in
        for await (const update of progressIterator) {
          switch (update.type) {
            case 'start':
              console.log(`🔍 Found ${update.totalPages} pages to export`);
              break;
            case 'page':
              if (update.error) {
                console.error(`❌ [${update.currentPage}/${update.totalPages}] Error processing page ${update.pageId}: ${update.error}`);
              } else {
                console.log(`✅ [${update.currentPage}/${update.totalPages}] Exported: ${update.outputPath}`);
              }
              break;
            case 'meta':
              console.log(`📝 Generated _meta.ts in ${update.directory}`);
              break;
            case 'json':
              console.log('📄 Generated index.json with raw database content');
              break;
            case 'complete':
              console.log('\n✨ Export complete!');
              break;
          }
        }
      } catch (error) {
        console.error('❌ Export failed:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  program
    .command('export-hextra')
    .description('Export pages from a Notion database to Markdown files for Hextra')
    .requiredOption('--id <id>', 'Notion database ID')
    .requiredOption('-o, --output <path>', 'Output directory path')
    .option('--include-json', 'Include raw JSON export in output directory')
    .option('--base-path <path>', 'Base path for internal links (e.g., /docs)')
    .option('--no-frontmatter', 'Exclude frontmatter from Markdown files')
    .action(async (options: ExportOptions) => {
      if (!NOTION_TOKEN) {
        console.error('Error: NOTION_TOKEN environment variable is required');
        console.error('Please set it with: export NOTION_TOKEN=your_integration_token');
        process.exit(1);
      }

      try {
        const exporter = new NotionMarkdownExporter(
          NOTION_TOKEN,
          undefined,
          hextraTransform
        );
        
        // Create async iterator for progress updates
        const progressIterator = exporter.exportDatabase({
          database: options.id,
          output: options.output,
          notionToken: NOTION_TOKEN,
          includeJson: options.includeJson,
          basePath: options.basePath,
          noFrontmatter: options.noFrontmatter,
          extension: '.md',
          skipMeta: true
        });

        // Process progress updates as they come in
        for await (const update of progressIterator) {
          switch (update.type) {
            case 'start':
              console.log(`🔍 Found ${update.totalPages} pages to export`);
              break;
            case 'page':
              if (update.error) {
                console.error(`❌ [${update.currentPage}/${update.totalPages}] Error processing page ${update.pageId}: ${update.error}`);
              } else {
                console.log(`✅ [${update.currentPage}/${update.totalPages}] Exported: ${update.outputPath}`);
              }
              break;
            case 'meta':
              console.log(`📝 Generated _meta.ts in ${update.directory}`);
              break;
            case 'json':
              console.log('📄 Generated index.json with raw database content');
              break;
            case 'complete':
              console.log('\n✨ Export complete!');
              break;
          }
        }
      } catch (error) {
        console.error('❌ Export failed:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  program
    .command('json')
    .description('Export pages from a Notion database to a JSON file')
    .requiredOption('--id <id>', 'Notion database ID')
    .requiredOption('-o, --output <path>', 'Output directory path')
    .action(async (options: ExportOptions) => {
      if (!NOTION_TOKEN) {
        console.error('Error: NOTION_TOKEN environment variable is required');
        console.error('Please set it with: export NOTION_TOKEN=your_integration_token');
        process.exit(1);
      }

      try {
        const exporter = new NotionJsonExporter(NOTION_TOKEN);
        const progress = await exporter.exportDatabase({
          database: options.id,
          output: options.output,
          notionToken: NOTION_TOKEN
        });

        // Handle progress updates
        for (const update of progress) {
          switch (update.type) {
            case 'start':
              console.log(`🔍 Found ${update.totalPages} pages to export`);
              break;
            case 'page':
              if (update.error) {
                console.error(`❌ [${update.currentPage}/${update.totalPages}] Error processing page ${update.pageId}: ${update.error}`);
              } else {
                console.log(`✅ [${update.currentPage}/${update.totalPages}] Updated: ${update.outputPath}`);
              }
              break;
            case 'complete':
              console.log('\n✨ Export complete!');
              break;
          }
        }
      } catch (error) {
        console.error('❌ Export failed:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  program
    .command('raw-json')
    .description('Export raw JSON response from Notion API for a database or page')
    .requiredOption('--id <id>', 'Notion database or page ID')
    .option('-o, --output <path>', 'Output file path (optional, defaults to stdout)')
    .action(async (options: { id: string, output?: string }) => {
      if (!NOTION_TOKEN) {
        console.error('Error: NOTION_TOKEN environment variable is required');
        console.error('Please set it with: export NOTION_TOKEN=your_integration_token');
        process.exit(1);
      }

      try {
        const exporter = new NotionRawExporter(NOTION_TOKEN);
        const json = await exporter.exportRaw({
          id: options.id,
          output: options.output,
          notionToken: NOTION_TOKEN
        });

        if (!options.output) {
          console.log(json);
        } else {
          console.log(`✅ Raw JSON exported to: ${options.output}`);
        }
      } catch (error) {
        console.error('❌ Export failed:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  program.parse();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

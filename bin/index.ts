#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { NotionExporter } from './notion';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  // Read package.json
  const packageJson = JSON.parse(
    await fs.readFile(path.join(__dirname, '../package.json'), 'utf8')
  );

  // Check for required environment variable
  const NOTION_TOKEN = process.env.NOTION_TOKEN;

  const program = new Command();

  program
    .name('notion_mdx')
    .description('Export Notion database pages to MDX files')
    .version(packageJson.version);

  interface ExportOptions {
    database: string;
    output: string;
  }

  program
    .command('export')
    .description('Export pages from a Notion database to MDX files')
    .requiredOption('-d, --database <id>', 'Notion database ID')
    .requiredOption('-o, --output <path>', 'Output directory path')
    .action(async (options: ExportOptions) => {
      if (!NOTION_TOKEN) {
        console.error('Error: NOTION_TOKEN environment variable is required');
        console.error('Please set it with: export NOTION_TOKEN=your_integration_token');
        process.exit(1);
      }

      try {
        const exporter = new NotionExporter(NOTION_TOKEN);
        await exporter.exportDatabase({
          database: options.database,
          output: options.output,
          notionToken: NOTION_TOKEN
        });
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

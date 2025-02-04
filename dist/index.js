#!/usr/bin/env node
import { Command } from 'commander';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { NotionMarkdownExporter } from './markdown.js';
import { hextraTransform } from './transformers.js';
import { NotionJSONExporter } from './json.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
async function main() {
    // Read package.json
    const packageJson = JSON.parse(await readFile(join(__dirname, '../package.json'), 'utf8'));
    // Check for required environment variable
    const NOTION_TOKEN = process.env.NOTION_TOKEN ?? "";
    function requireNotionToken() {
        if (!NOTION_TOKEN) {
            console.error('Error: NOTION_TOKEN environment variable is required');
            console.error('Please set it with: export NOTION_TOKEN=your_integration_token');
            process.exit(1);
        }
    }
    const program = new Command();
    program
        .name('notion-tools')
        .description('Export Notion database pages to various formats')
        .version(packageJson.version);
    const exportCommand = program.command('export')
        .description('Export Notion database to various formats');
    exportCommand
        .command('nextra')
        .description('Export to MDX files for Nextra')
        .requiredOption('--id <id>', 'Notion database ID')
        .requiredOption('-o, --output <path>', 'Output directory path')
        .option('--include-json', 'Include raw JSON export in output directory')
        .option('--base-url <path>', 'Base path for internal links (e.g., /docs)')
        .option('--no-frontmatter', 'Exclude frontmatter from MDX files')
        .action(async (options) => {
        requireNotionToken();
        try {
            const exporter = new NotionMarkdownExporter(NOTION_TOKEN, undefined);
            // Create async iterator for progress updates
            const progressIterator = exporter.exportDatabase({
                database: options.id,
                output: options.output,
                notionToken: NOTION_TOKEN,
                includeJson: options.includeJson,
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
                        }
                        else {
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
        }
        catch (error) {
            console.error('❌ Export failed:', error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });
    exportCommand
        .command('hextra')
        .description('Export to Markdown files for Hextra')
        .requiredOption('--id <id>', 'Notion database ID')
        .requiredOption('-o, --output <path>', 'Output directory path')
        .option('--include-json', 'Include raw JSON export in output directory')
        .option('--base-url <path>', 'Base path for internal links (e.g., /docs)')
        .option('--no-frontmatter', 'Exclude frontmatter from Markdown files')
        .action(async (options) => {
        requireNotionToken();
        try {
            const exporter = new NotionMarkdownExporter(NOTION_TOKEN, options.baseUrl, hextraTransform);
            // Create async iterator for progress updates
            const progressIterator = exporter.exportDatabase({
                database: options.id,
                output: options.output,
                notionToken: NOTION_TOKEN,
                includeJson: options.includeJson,
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
                        }
                        else {
                            console.log(`✅ [${update.currentPage}/${update.totalPages}] Exported: ${update.outputPath}`);
                        }
                        break;
                    case 'json':
                        console.log('📄 Generated index.json with raw database content');
                        break;
                    case 'complete':
                        console.log('\n✨ Export complete!');
                        break;
                }
            }
        }
        catch (error) {
            console.error('❌ Export failed:', error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });
    exportCommand
        .command('json')
        .description('Export JSON response from Notion API for a database or page')
        .requiredOption('--id <id>', 'Notion database or page ID')
        .option('-o, --output <path>', 'Output file path (optional, defaults to stdout)')
        .option('--rawJSON', 'Simplify JSON output')
        .action(async (options) => {
        requireNotionToken();
        try {
            const exporter = new NotionJSONExporter(NOTION_TOKEN);
            const json = await exporter.exportJSON({
                id: options.id,
                notionToken: NOTION_TOKEN,
                rawJSON: options.rawJSON
            });
            if (!options.output) {
                console.log(json);
            }
            else {
                const dirName = dirname(options.output);
                await mkdir(dirName, { recursive: true });
                await writeFile(options.output, json, 'utf-8');
                console.log(`✅ Raw JSON exported to: ${options.output}`);
            }
        }
        catch (error) {
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
//# sourceMappingURL=index.js.map
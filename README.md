# @1984vc/notion_export

[![CI](https://github.com/1984vc/notion-tools/actions/workflows/ci.yml/badge.svg)](https://github.com/1984vc/notion-tools/actions/workflows/ci.yml)

A CLI tool to export Notion database pages to various format

## Features

- Export all pages from a Notion database to MD/MDX (Hextr and Nextra) files
- Preserves page metadata in frontmatter
- Maintains Notion content structure using notion-to-md
- Generates clean filenames from page titles
- Includes creation and last edited timestamps
- Supports internal link transformations
- Optional JSON export for raw data

## Prerequisites

- Node.js >= 14.0.0
- A Notion integration token
- Access to the Notion database you want to export

## Installation

You can install this CLI tool globally using npm:

```bash
npm install -g @1984vc/notion_export@2.0.0
```

Or locally in your project:

```bash
npm add -D @1984vc/notion-tools@2.0.0
```

## Setup

1. Create a Notion integration at https://www.notion.so/my-integrations
2. Copy the integration token
3. Set the token as an environment variable:
```bash
export NOTION_TOKEN=your_integration_token
```
4. Share your Notion database with the integration (click 'Share' in Notion and add your integration)

## Usage

### Export to MDX

```bash
notion-tools export-mdx --id <database_id> -o <output_path> [options]
```

Options:
- `--id`: Required. The Notion database ID
- `-o, --output`: Required. The output directory path for MDX files
- `--include-json`: Optional. Include raw JSON export in output directory
- `--base-path`: Optional. Base path for internal links (e.g., /docs)
- `--no-frontmatter`: Optional. Exclude frontmatter from MDX files

Example:
```bash
notion-tools export-mdx --id "123456789abcdef" -o "./content/posts" --base-path "/docs"
```

### Export to JSON

```bash
notion-tools json --id <database_id> -o <output_path>
```

Options:
- `--id`: Required. The Notion database ID
- `-o, --output`: Required. The output directory path for JSON file

Example:
```bash
notion-tools json --id "123456789abcdef" -o "./content/data"
```

### Export Raw JSON

```bash
notion-tools raw-json --id <id> [-o <output_path>]
```

Options:
- `--id`: Required. The Notion database or page ID
- `-o, --output`: Optional. Output file path (defaults to stdout)

Example:
```bash
notion-tools raw-json --id "123456789abcdef" -o "./data/raw.json"
```

### Finding Your Database ID

The database ID is the part of your Notion database URL after the workspace name and before the question mark:
```
https://www.notion.so/workspace-name/123456789abcdef?v=...
                                   ^^^^^^^^^^^^^^
                                   This is your database ID
```

## Output Format

Each page is exported as an MDX file with frontmatter metadata:

```mdx
---
title: Page Title
notionId: page-id
createdAt: 2024-01-01T00:00:00.000Z
lastEditedAt: 2024-01-01T00:00:00.000Z
weight: 0
---

[Your page content here]
```

## Development

To develop locally:

1. Clone this repository
2. Install dependencies: `npm install`
3. Set up your NOTION_TOKEN environment variable
4. Link the package locally: `npm link`
5. Run the CLI: `notion-tools export-mdx --id <database_id> -o <output_path>`

### Testing and Linting

Run tests:
```bash
npm test
```

Run linting:
```bash
npm run lint
```

## CI/CD

This project uses GitHub Actions for continuous integration and deployment:

### Continuous Integration

The CI workflow runs automatically on:
- All pull requests to the `main` branch
- All pushes to the `main` branch

It performs:
- Installation of dependencies
- Code linting
- Test suite execution

### Automated Releases

To publish a new version to npm:

1. Update the version in package.json:
```bash
npm version patch  # for bug fixes
npm version minor  # for new features
npm version major  # for breaking changes
```

2. Push the new version tag:
```bash
git push origin v*
```

The release workflow will automatically:
- Run tests
- Build the package
- Publish to npm under the @1984vc organization

Note: Publishing requires an NPM_TOKEN secret to be set in the repository's GitHub secrets.

## Dependencies

Key dependencies:
- @notionhq/client: ^2.2.15
- commander: ^12.1.0
- notion-to-md: ^3.1.1

## Error Handling

The CLI will:
- Verify the NOTION_TOKEN is set
- Create the output directory if it doesn't exist
- Skip and report any pages that fail to export
- Provide progress feedback during export

## License

MIT

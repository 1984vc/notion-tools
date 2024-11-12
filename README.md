# notion_mdx

A CLI tool to export Notion database pages to MDX files with frontmatter metadata.

## Features

- Export all pages from a Notion database to MDX files
- Preserves page metadata in frontmatter
- Maintains Notion content structure using notion-to-md
- Generates clean filenames from page titles
- Includes creation and last edited timestamps

## Prerequisites

- Node.js >= 14.0.0
- A Notion integration token
- Access to the Notion database you want to export

## Installation

You can install this CLI tool globally using npm:

```bash
npm install -g notion_mdx
```

Or locally in your project:

```bash
npm install notion_mdx
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

### Export Command

```bash
notion_mdx export -d <database_id> -o <output_path>
```

Options:
- `-d, --database`: Required. The Notion database ID
- `-o, --output`: Required. The output directory path for MDX files

Example:
```bash
notion_mdx export -d "123456789abcdef" -o "./content/posts"
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
---

[Your page content here]
```

## Development

To develop locally:

1. Clone this repository
2. Install dependencies: `npm install`
3. Set up your NOTION_TOKEN environment variable
4. Link the package locally: `npm link`
5. Run the CLI: `notion_mdx export -d <database_id> -o <output_path>`

## Error Handling

The CLI will:
- Verify the NOTION_TOKEN is set
- Create the output directory if it doesn't exist
- Skip and report any pages that fail to export
- Provide progress feedback during export

## License

ISC

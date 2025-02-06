import fs from 'fs';
import path from 'path';
export function urlTransform(n2m, baseUrl) {
    if (!baseUrl)
        return;
    // Transform absolute links to relative links if they match the base URL
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    n2m.setCustomTransformer('paragraph', async (block) => {
        if (!block.paragraph?.rich_text)
            return block;
        // Transform URLs in rich_text array
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        block.paragraph.rich_text = block.paragraph.rich_text.map((text) => {
            if (!text.href || !text.href.startsWith(baseUrl))
                return text;
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
export function hextraTransform(n2m) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    n2m.setCustomTransformer('callout', async (block) => {
        // Get the callout icon (emoji or external icon)
        const icon = block.callout.icon?.emoji || '📄';
        // Map Notion colors to Hextra callout types
        const colorTypeMap = {
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
        const calloutType = colorTypeMap[block.callout.color] || 'info';
        // Convert the rich text content to markdown
        const content = block.callout.rich_text
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((text) => text.plain_text)
            .join('');
        // Format for Hextra's Callout component
        return `{{< callout type="${calloutType}" emoji="${icon}" >}}\n${content}\n{{< /callout >}}`;
    });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const pageTransformer = (pageResponse) => {
    const page = pageResponse.page;
    if ('properties' in page) {
        return {
            ...pageResponse,
            page: {
                ...pageResponse.page,
                properties: flattenProperties(page.properties),
            },
        };
    }
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const databaseTransformer = (response) => {
    return response.results.map((page) => {
        if ('properties' in page) {
            return {
                ...page,
                properties: flattenProperties(page.properties),
            };
        }
        return page;
    });
};
/* eslint-disable @typescript-eslint/no-explicit-any */
export const flattenProperties = (properties) => {
    const simplifiedProperties = {};
    for (const [key, value] of Object.entries(properties)) {
        if (value && typeof value === 'object') {
            const propertyType = value.type;
            switch (propertyType) {
                case 'title':
                    simplifiedProperties[key] = value.title[0]?.plain_text || '';
                    break;
                case 'rich_text':
                    simplifiedProperties[key] = value.rich_text.map((rt) => rt.plain_text).join('');
                    break;
                case 'number':
                    simplifiedProperties[key] = value.number;
                    break;
                case 'select':
                    simplifiedProperties[key] = value.select?.name || null;
                    break;
                case 'multi_select':
                    simplifiedProperties[key] = value.multi_select.map((ms) => ms.name);
                    break;
                case 'date':
                    simplifiedProperties[key] = value.date?.start || null;
                    break;
                case 'checkbox':
                    simplifiedProperties[key] = value.checkbox;
                    break;
                case 'url':
                    simplifiedProperties[key] = value.url || null;
                    break;
                default:
                    simplifiedProperties[key] = null;
                    break;
            }
        }
        else {
            simplifiedProperties[key] = value;
        }
    }
    return simplifiedProperties;
};
export function imageTransform(n2m, assetsDir = 'assets') {
    // Ensure the assets directory exists
    if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
    }
    n2m.setCustomTransformer('image', async (block) => {
        if (!block.image)
            return block;
        if (block.image.external?.url && !block.image.file)
            return block;
        const url = block.image.external?.url || block.image.file?.url;
        if (!url)
            return block;
        const fileName = path.basename(new URL(url).pathname);
        const localFilePath = path.join(assetsDir, fileName);
        console.log(`Downloading ${url} to ${localFilePath}`);
        if (!fs.existsSync(localFilePath)) {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            fs.writeFileSync(localFilePath, Buffer.from(arrayBuffer));
        }
        return `![${fileName}](${localFilePath})`;
    });
}
//# sourceMappingURL=transformers.js.map
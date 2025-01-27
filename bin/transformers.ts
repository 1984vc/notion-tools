import { NotionToMarkdown } from 'notion-to-md';

export function urlTransform(n2m: NotionToMarkdown, baseUrl?: string): void {
  if (!baseUrl) return;

  // Transform absolute links to relative links if they match the base URL
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  n2m.setCustomTransformer('paragraph', async (block: any) => {
    if (!block.paragraph?.rich_text) return block;

    // Transform URLs in rich_text array
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
    // Get the callout icon (emoji or external icon)
    const icon = block.callout.icon?.emoji || '📄';
    
    // Map Notion colors to Hextra callout types
    const colorTypeMap: Record<string, string> = {
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
      .map((text: any) => text.plain_text)
      .join('');
    
    // Format for Hextra's Callout component
    return `{{< callout type="${calloutType}" emoji="${icon}" >}}\n${content}\n{{< /callout >}}`;
  });
}

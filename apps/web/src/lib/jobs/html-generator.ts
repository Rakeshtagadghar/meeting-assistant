import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

/**
 * Converts markdown to sanitized HTML using remark + rehype pipeline.
 * Supports GitHub Flavored Markdown (task lists, tables, strikethrough).
 */
export async function markdownToHtml(markdown: string): Promise<string> {
  const result = await unified()
    .use(remarkParse) // Parse markdown to mdast
    .use(remarkGfm) // Support GFM (tables, task lists, strikethrough)
    .use(remarkRehype) // Transform mdast to hast
    .use(rehypeSanitize) // Sanitize HTML (XSS protection)
    .use(rehypeStringify) // Stringify hast to HTML
    .process(markdown);

  return String(result);
}

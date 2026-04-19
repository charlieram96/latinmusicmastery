/**
 * Extract a plain-text preview from a TipTap JSON document.
 *
 * Used in list/preview contexts (teacher cards, admin list, course preview)
 * where we don't want to mount a TipTap editor just to show a snippet.
 * Returns an empty string if the document is null, not an object, or contains
 * no text nodes. Block-level nodes are joined with a single space so headings
 * and paragraphs read as one line when line-clamped.
 */
export function tiptapToPlainText(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";

  const parts: string[] = [];

  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const n = node as {
      type?: string;
      text?: string;
      content?: unknown[];
    };
    if (typeof n.text === "string") parts.push(n.text);
    if (Array.isArray(n.content)) {
      for (const child of n.content) walk(child);
      const isBlock =
        n.type === "paragraph" ||
        n.type === "heading" ||
        n.type === "blockquote" ||
        n.type === "listItem" ||
        n.type === "codeBlock";
      if (isBlock) parts.push(" ");
    }
  };

  walk(doc);
  return parts.join("").replace(/\s+/g, " ").trim();
}

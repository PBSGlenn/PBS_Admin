// PBS Admin - HTML to Markdown Conversion
// Used by ClientHistoryService to convert event notes (Tiptap rich-text HTML) to
// readable markdown for inclusion in patient history exports. Strips internal
// HTML comments (e.g. <!-- matchState: ... --> or <!-- emailLog: ... -->) that
// are used for machine-readable audit metadata and should never reach an
// external recipient.

import TurndownService from "turndown";

let cachedService: TurndownService | null = null;

function getService(): TurndownService {
  if (cachedService) return cachedService;

  const td = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "_",
  });

  // Drop internal audit metadata that the app stores as HTML comments inside
  // event notes — these are not for external eyes.
  td.addRule("strip-html-comments", {
    filter: (node) => node.nodeType === 8, // COMMENT_NODE
    replacement: () => "",
  });

  cachedService = td;
  return td;
}

/**
 * Pre-strip raw HTML comments before turndown sees the input. Turndown's
 * default DOM parser tends to keep some pre-tag whitespace; doing this at the
 * string level keeps the output cleaner.
 */
function stripRawHtmlComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, "");
}

/**
 * Convert HTML (typically from a Tiptap rich-text field) into clean markdown
 * suitable for embedding in a Pandoc-rendered DOCX.
 *
 * Returns an empty string if the input is null/empty or contains only
 * whitespace after conversion.
 */
export function htmlToMarkdown(html: string | null | undefined): string {
  if (!html) return "";
  const cleaned = stripRawHtmlComments(html).trim();
  if (!cleaned) return "";

  // If the input contains no HTML tags at all, return it as-is — turndown
  // would still work but this skips the DOM parse cost for plain-text notes.
  if (!/<[a-z!/][\s\S]*?>/i.test(cleaned)) {
    return cleaned;
  }

  try {
    const md = getService().turndown(cleaned).trim();
    return md;
  } catch {
    // Fall back to a tag-stripped version rather than crashing the export.
    return cleaned.replace(/<[^>]+>/g, "").trim();
  }
}

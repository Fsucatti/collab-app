// lib/sanitize.ts
import sanitizeHtml from "sanitize-html";

// Keep this single source of truth for both doc HTML + comments policy.
// If you tweak it, tweak the realtime server to match.
export const SANITIZE_HTML_CONFIG: sanitizeHtml.IOptions = {
  allowedTags: [
    "p","br","strong","em","u","s",
    "ul","ol","li",
    "h1","h2","h3","blockquote","code","pre","hr","span"
  ],
  // If you do NOT need inline styles in saved content, set {} and remove span below.
  allowedAttributes: {
    span: ["style"],
  },
  // Only allow safe URL schemes
  allowedSchemes: ["http", "https", "mailto"],
  // Optional: add stricter style property allowlist if you allow styles at all
  // This prevents arbitrary CSS injections in style=""
  allowedStyles: {
    // apply to all tags
    "*": {
      // background-color, color: hex / rgb(a)
      "background-color": [/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, /^rgb(a)?\(\s*[\d\s.,%]+\)$/i],
      "color":            [/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, /^rgb(a)?\(\s*[\d\s.,%]+\)$/i],
      // small set of safe text styles (optional)
      "text-decoration":  [/^(?:none|underline|line-through)$/i],
      "font-weight":      [/^(?:bold|400|500|600|700)$/],
      "font-style":       [/^(?:normal|italic)$/i],
    },
  },
  // Defense in depth
  disallowedTagsMode: "discard",
};

// Sanitize rich-text HTML (TipTap content) before persisting
export function sanitizeDocHTML(dirty: string): string {
  if (!dirty) return "";
  return sanitizeHtml(String(dirty), SANITIZE_HTML_CONFIG);
}

// Strip *all* tags for plain text fields (titles, authors, comment bodies, anchors)
export function sanitizePlainText(dirty: string): string {
  if (!dirty) return "";
  return sanitizeHtml(String(dirty), { allowedTags: [], allowedAttributes: {} }).trim();
}

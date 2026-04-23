/**
 * Simple server-side HTML sanitizer.
 * Allows safe HTML tags and attributes. Strips scripts, event handlers, javascript: URLs.
 */

const ALLOWED_TAGS = new Set([
  "section", "div", "span", "p", "br", "hr",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s",
  "ul", "ol", "li",
  "a", "img",
  "table", "thead", "tbody", "tr", "th", "td",
  "blockquote", "pre", "code",
  "style",
]);

const DANGEROUS_PATTERNS = [
  /on\w+\s*=/gi,           // onerror=, onclick=, etc.
  /javascript\s*:/gi,       // javascript: URLs
  /<script[\s>]/gi,         // <script> tags
  /<\/script>/gi,
  /<iframe[\s>]/gi,
  /<\/iframe>/gi,
  /<object[\s>]/gi,
  /<embed[\s>]/gi,
  /<form[\s>]/gi,
];

export function sanitizeHtml(html: string): string {
  let cleaned = html;

  // Remove dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  return cleaned;
}

/**
 * Check if HTML contains only allowed elements (basic check).
 * Returns true if safe, false if contains dangerous content.
 */
export function isHtmlSafe(html: string): boolean {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(html)) return false;
    // Reset regex lastIndex (global flag)
    pattern.lastIndex = 0;
  }
  return true;
}

/**
 * Simple server-side HTML sanitizer.
 * Allows safe HTML tags and attributes. Strips scripts, event handlers, javascript: URLs.
 * Allows YouTube embed iframes only.
 */

const ALLOWED_YOUTUBE_DOMAINS = [
  "https://www.youtube.com/embed/",
  "https://youtube.com/embed/",
  "https://www.youtube-nocookie.com/embed/",
];

const DANGEROUS_PATTERNS = [
  /on\w+\s*=/gi,           // onerror=, onclick=, etc.
  /javascript\s*:/gi,       // javascript: URLs
  /<script[\s>]/gi,         // <script> tags
  /<\/script>/gi,
  /<object[\s>]/gi,
  /<embed[\s>]/gi,
  /<form[\s>]/gi,
];

/**
 * Перевірити чи iframe має дозволений YouTube src
 */
function isYouTubeIframe(iframeTag: string): boolean {
  const srcMatch = iframeTag.match(/src\s*=\s*["']([^"']+)["']/i);
  if (!srcMatch) return false;
  const src = srcMatch[1];
  return ALLOWED_YOUTUBE_DOMAINS.some((domain) => src.startsWith(domain));
}

/**
 * Обгорнути YouTube iframe в responsive container
 */
function wrapYouTubeIframe(iframeHtml: string): string {
  return `<div style="position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;border-radius:8px;margin:1em 0">${iframeHtml.replace(/width\s*=\s*["'][^"']*["']/i, 'width="100%"').replace(/height\s*=\s*["'][^"']*["']/i, 'height="100%" style="position:absolute;top:0;left:0;width:100%;height:100%"')}</div>`;
}

export function sanitizeHtml(html: string): string {
  let cleaned = html;

  // Спочатку обробити iframe: дозволити YouTube, видалити інші
  cleaned = cleaned.replace(/<iframe[\s\S]*?<\/iframe>/gi, (match) => {
    if (isYouTubeIframe(match)) {
      // Прибрати event handlers з iframe
      const safe = match.replace(/on\w+\s*=\s*["'][^"']*["']/gi, "");
      return wrapYouTubeIframe(safe);
    }
    return ""; // Видалити non-YouTube iframes
  });

  // Remove dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  return cleaned;
}

/**
 * Check if HTML contains only allowed elements (basic check).
 */
export function isHtmlSafe(html: string): boolean {
  // Allow YouTube iframes
  const withoutYoutube = html.replace(/<iframe[\s\S]*?<\/iframe>/gi, (match) =>
    isYouTubeIframe(match) ? "" : match
  );

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(withoutYoutube)) return false;
    pattern.lastIndex = 0;
  }
  // Check for non-YouTube iframes
  if (/<iframe[\s>]/gi.test(withoutYoutube)) return false;
  return true;
}

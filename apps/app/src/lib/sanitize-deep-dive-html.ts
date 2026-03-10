/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Sanitizes AI-generated / stored HTML for the deep dive learn page to mitigate XSS.
 * Allows only trusted script sources (e.g. Tailwind CDN); strips inline script and event handlers.
 */

import sanitizeHtml from 'sanitize-html';

/** Script/link origins allowed for deep dive pages (e.g. Tailwind CDN). Exported for head preservation in prepare-deep-dive-document. */
export const ALLOWED_SCRIPT_ORIGINS = [
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net',
  'https://unpkg.com',
];

const defaults = sanitizeHtml.defaults as {
  allowedTags: string[];
  allowedAttributes: Record<string, string[]>;
};
const DEFAULT_ALLOWED_TAGS = defaults.allowedTags;
const DEFAULT_ALLOWED_ATTRIBUTES = defaults.allowedAttributes;

/**
 * Remove leftover tailwind.config = { ... } text that can appear when inline
 * script tags are stripped (sanitize-html removes the tag but may leave inner text).
 */
function stripTailwindConfigBlob(html: string): string {
  const startMarker = 'tailwind.config';
  let result = html;
  let idx: number;
  while ((idx = result.indexOf(startMarker)) !== -1) {
    const open = result.indexOf('{', idx);
    if (open === -1) break;
    let depth = 1;
    let i = open + 1;
    while (i < result.length && depth > 0) {
      const c = result[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      i++;
    }
    let end = i;
    if (result[end] === ';') end += 1;
    // Trim leading whitespace so we don't leave a stray line
    let startTrim = idx;
    while (startTrim > 0 && /[\s\n\r\t]/.test(result[startTrim - 1])) startTrim -= 1;
    result = result.slice(0, startTrim) + result.slice(end);
  }
  return result;
}

/**
 * Sanitize stored deep dive HTML before serving.
 * - Keeps script tags only when src is from an allowed CDN (e.g. Tailwind).
 * - Strips inline script, event handlers (on*), and unknown script sources.
 * - Removes any leftover tailwind.config text from stripped inline scripts.
 */
export function sanitizeDeepDiveHtml(html: string): string {
  const sanitized = sanitizeHtml(html, {
    allowedTags: [
      ...DEFAULT_ALLOWED_TAGS,
      'script',
      'img',
      'link',
      'style',
      'head',
      'html',
      'body',
      'meta',
      'title',
    ],
    allowedAttributes: {
      ...DEFAULT_ALLOWED_ATTRIBUTES,
      // Global: allow class, style, id on any tag so Tailwind and layout survive sanitization
      '*': ['class', 'style', 'id'],
      a: ['href', 'name', 'target', 'rel', 'class', 'style'],
      img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading', 'class', 'style'],
      link: ['href', 'rel', 'integrity', 'crossorigin', 'type'],
      script: ['src', 'integrity', 'crossorigin'],
      meta: ['charset', 'name', 'content', 'http-equiv'],
    },
    transformTags: {
      script(_tagName: string, attribs: Record<string, string>) {
        const src = attribs?.src;
        if (src && ALLOWED_SCRIPT_ORIGINS.some((origin) => src.startsWith(origin))) {
          return { tagName: 'script', attribs: { src } };
        }
        // Strip disallowed script: empty tagName removes the tag; attribs must be Record<string, string>
        return { tagName: '', attribs: {} as Record<string, string> };
      },
    },
    allowVulnerableTags: true,
  });
  return stripTailwindConfigBlob(sanitized);
}

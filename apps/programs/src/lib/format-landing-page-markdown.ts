/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Formats markdown for challenge/program landing page descriptions.
 * Parses full markdown (headings, lists, bold, italic) and sanitizes for safe display.
 */

import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'p',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'b',
  'i',
  'br',
  'span',
];

// Exclude 'style' to avoid CSS-based UI manipulation / risky inline CSS (e.g. expression, url)
const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  span: ['class'],
  p: ['class'],
};

/**
 * Strip single-quote wrappers from AI-generated content so they don't show in the UI.
 */
function stripWrappingQuotes(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/^'+/, '')
    .replace(/'+$/, '')
    .replace(/'; '/g, '; ')
    .replace(/'. /g, '. ')
    .replace(/ ' /g, ' ');
}

/**
 * Parse markdown to HTML and sanitize for safe display on challenge/program landing pages.
 * Supports headings, lists, bold, italic. Output is safe for dangerouslySetInnerHTML.
 */
export function formatLandingPageMarkdown(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') return '';

  const stripped = stripWrappingQuotes(markdown.trim());
  if (!stripped) return '';

  const rawHtml = marked.parse(stripped, {
    gfm: true,
    breaks: true,
    async: false,
  }) as string;

  return sanitizeHtml(rawHtml, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
  });
}

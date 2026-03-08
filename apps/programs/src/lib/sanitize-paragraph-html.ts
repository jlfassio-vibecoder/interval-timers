/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Sanitizes paragraph/simple HTML for exercise cues and biomechanics content.
 * Allows only safe inline and block tags; no script, iframe, or event handlers.
 */

import { normalizeMathSymbols } from '@/lib/normalize-math-symbols';
import DOMPurify from 'dompurify';

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'span'];

/**
 * Strip HTML tags to produce plain text. Use when sending biomechanics content to APIs.
 */
export function stripHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sanitize HTML for safe display in exercise deployment steps and additional tactical data.
 * Plain text passes through (no tags). Only the allowed tags and attributes are kept.
 * Uses DOMPurify (browser-only); callers must ensure this runs client-side.
 *
 * Note: DOMPurify's ALLOWED_ATTR is global (not per-tag). Previously sanitize-html allowed
 * class/style only on p and span. We accept class/style on all allowed tags here—content
 * is from our Firebase exercise DB (trusted pipeline), and class/style pose low XSS risk.
 */
export function sanitizeParagraphHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['class', 'style'],
  });
}

/**
 * Strip single-quote wrappers and delimiter quotes from AI-generated cues so they don't show in the UI.
 * Preserves apostrophes inside words (e.g. "don't").
 */
function stripWrappingQuotes(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let out = text
    .replace(/^'+/, '')
    .replace(/'+$/, '')
    .replace(/'; '/g, '; ')
    .replace(/'. '/g, '. ')
    .replace(/ ' /g, ' ');
  return out;
}

/**
 * Convert inline markdown (**bold**, *italic*) to HTML so it renders correctly instead of showing raw asterisks.
 * Applied before sanitization for exercise cues and biomechanics content.
 */
function markdownToHtml(text: string): string {
  if (!text || typeof text !== 'string') return '';
  // Bold first: **...** → <strong>...</strong>
  let out = text.replace(/\*\*([\s\S]*?)\*\*/g, '<strong>$1</strong>');
  // Then italic: *...* → <em>...</em> (single asterisks only)
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return out;
}

/**
 * Format paragraph content for display: strip quote wrappers, normalize LaTeX to Unicode, convert markdown to HTML, preserve line breaks, then sanitize.
 * Use for Deployment Steps and Additional Tactical Data so quotes, LaTeX, and markdown (bold/italic) don't show as raw syntax.
 */
export function formatParagraphContent(text: string): string {
  const stripped = stripWrappingQuotes(text);
  const normalized = normalizeMathSymbols(stripped);
  const withBreaks = normalized.replace(/\n/g, '<br>');
  return sanitizeParagraphHtml(markdownToHtml(withBreaks));
}

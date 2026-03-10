/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Prepares deep dive HTML for serving: ensures one <h1>, replaces <head> with a
 * controlled head (essential meta + our SEO + preserved allowed script/link from AI).
 */

import { ensureDeepDiveHeading } from '@/lib/ensure-deep-dive-heading';
import { EXERCISE_LABELS } from '@/lib/labels/exercises';
import {
  buildDeepDiveHeadContent,
  escapeHtmlAttribute,
  type DeepDiveMetaInput,
} from '@/lib/inject-deep-dive-meta';
import { filterRealSources } from '@/lib/parse-biomechanics';
import { ALLOWED_SCRIPT_ORIGINS } from '@/lib/sanitize-deep-dive-html';
import type { ExerciseSource } from '@/types/generated-exercise';

const ESSENTIAL_HEAD =
  '<meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">';

function isAllowedUrl(url: string): boolean {
  return ALLOWED_SCRIPT_ORIGINS.some((origin) => url.startsWith(origin));
}

/** Extract src or href from a tag's opening fragment (e.g. <script ...> or <link ...>). */
function getSrcOrHref(openingTag: string): string | null {
  const srcMatch = openingTag.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
  if (srcMatch) return srcMatch[1];
  const hrefMatch = openingTag.match(/\bhref\s*=\s*["']([^"']+)["']/i);
  if (hrefMatch) return hrefMatch[1];
  return null;
}

/** From head inner content, collect full tags for script (with body) and link whose src/href is allowed. */
function preserveAllowedHeadTags(innerHead: string): string {
  const preserved: string[] = [];

  // <script ...>...</script> — keep full tag when src is allowed
  const scriptRegex = /<script\s[^>]*>[\s\S]*?<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptRegex.exec(innerHead)) !== null) {
    const fullTag = m[0];
    const openEnd = fullTag.indexOf('>');
    const openingTag = fullTag.slice(0, openEnd + 1);
    const url = getSrcOrHref(openingTag);
    if (url && isAllowedUrl(url)) {
      preserved.push(fullTag);
    }
  }

  // <link ...> or <link ... />
  const linkRegex = /<link\s[^>]*\/?>/gi;
  while ((m = linkRegex.exec(innerHead)) !== null) {
    const fullTag = m[0];
    const url = getSrcOrHref(fullTag);
    if (url && isAllowedUrl(url)) {
      preserved.push(fullTag);
    }
  }

  return preserved.length > 0 ? '\n  ' + preserved.join('\n  ') : '';
}

/** Encode slug for safe use as URL path segment in href. Handles /, space, and reserved chars. */
function escapeSlugForHref(slug: string): string {
  return encodeURIComponent(slug);
}

/**
 * Removes AI-generated back buttons to avoid duplication with our fixed nav bar.
 * Strips links whose text is "Go Back", "Back to Exercises", or "Back to Learning Center".
 */
function removeAiGoBackButton(html: string): string {
  const backButtonPatterns = [
    /\s*<a\s[^>]*href\s*=\s*["'][^"']*["'][^>]*>\s*Go\s+Back\s*<\/a>\s*/gi,
    /\s*<a\s[^>]*href\s*=\s*["'][^"']*["'][^>]*>\s*Back\s+to\s+Exercises\s*<\/a>\s*/gi,
    /\s*<a\s[^>]*href\s*=\s*["'][^"']*["'][^>]*>\s*Back\s+to\s+Learning\s+Center\s*<\/a>\s*/gi,
  ];
  let result = html;
  for (const re of backButtonPatterns) {
    result = result.replace(re, '');
  }
  return result;
}

/**
 * Removes the AI-generated Sources section (dead "Vertexaisearch" link).
 * Only strips the Vertex links; we do not regex-remove wrapper div/section blocks
 * because nested HTML causes incorrect matches and document corruption.
 * The app injects a proper Sources section before </body>.
 */
function removeAiSourcesSection(html: string): string {
  return html.replace(
    /<a\s[^>]*>[^<]*(?:Vertex(?:ai)?\s*[Ss]earch|Vertex\s+AI\s+[Ss]earch)[^<]*<\/a>/gi,
    ''
  );
}

/**
 * Escapes text for safe use in HTML content (e.g. link text).
 */
function escapeHtmlText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Injects a Sources section before </body> from exercise.sources.
 * Uses search-verification links (same pattern as detail page).
 * If no sources, adds fallback link to the exercise detail page.
 */
function injectDeepDiveSourcesSection(
  html: string,
  slug: string,
  sources: ExerciseSource[]
): string {
  const escapedSlug = escapeSlugForHref(slug);
  let sectionHtml: string;
  if (sources.length > 0) {
    const links = sources
      .map(
        (s) =>
          `<a href="https://google.com/search?q=${encodeURIComponent(s.searchQuery)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-700 hover:text-white">${escapeHtmlText(s.title)}</a>`
      )
      .join('\n                ');
    sectionHtml = `
<div class="mt-12 border-t border-slate-700 px-4 py-6">
  <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Sources</h3>
  <div class="flex flex-wrap gap-2">
    ${links}
  </div>
</div>`;
  } else {
    sectionHtml = `
<div class="mt-12 border-t border-slate-700 px-4 py-6">
  <p class="text-sm text-slate-500"><a href="/exercises/${escapedSlug}" class="text-slate-400 underline hover:text-white">Sources for this exercise</a> are listed on the main exercise page.</p>
</div>`;
  }
  return html.replace(/<\/body\s*>/i, sectionHtml + '\n</body>');
}

/**
 * Injects a fixed nav bar: back link (left) and Close X (right).
 * Inserts immediately after the opening <body> tag.
 * backHref/backLinkLabel default to /exercises and EXERCISE_LABELS.backLink when omitted.
 */
function injectDeepDiveCloseBar(
  html: string,
  slug: string,
  backHref?: string,
  backLinkLabel?: string
): string {
  const bodyMatch = html.match(/<body([^>]*)>/i);
  if (!bodyMatch) return html;
  const escapedSlug = escapeSlugForHref(slug);
  const href = backHref ?? '/exercises';
  const label = backLinkLabel ?? EXERCISE_LABELS.backLink;
  const navBar = `
<div class="fixed left-0 right-0 top-0 z-[9999] flex items-center justify-between p-4">
  <a href="${escapeHtmlAttribute(href)}" class="inline-flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-black/80">${escapeHtmlText(label)}</a>
  <a href="/exercises/${escapedSlug}" class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80" aria-label="Close and return to exercise">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  </a>
</div>`;
  return html.replace(bodyMatch[0], bodyMatch[0] + navBar);
}

/**
 * Prepares deep dive document: ensure h1, replace <head> with controlled head
 * (essential + SEO + preserved allowed script/link), with fallback when head is missing or malformed.
 */
export function prepareDeepDiveDocument(html: string, input: DeepDiveMetaInput): string {
  const withH1 = ensureDeepDiveHeading(html, input.exerciseName);
  const withoutAiBack = removeAiGoBackButton(withH1);
  const withoutAiSources = removeAiSourcesSection(withoutAiBack);
  const withCloseBar = injectDeepDiveCloseBar(
    withoutAiSources,
    input.slug,
    input.backHref,
    input.backLinkLabel
  );

  const headOpenMatch = withCloseBar.match(/<head\s[^>]*>/i) ?? withCloseBar.match(/<head\s*>/i);
  const headCloseMatch = withCloseBar.match(/<\/head\s*>/i);

  // Edge case: no proper head — fall back to inject-style behavior (append our block before </head> or create minimal head)
  if (!headOpenMatch || !headCloseMatch) {
    const seoBlock = buildDeepDiveHeadContent(input);
    const newHeadContent = ESSENTIAL_HEAD + '\n  ' + seoBlock;
    let edgeResult: string;
    if (headCloseMatch) {
      edgeResult = withCloseBar.replace(/(<\/head\s*>)/i, newHeadContent + '\n$1');
    } else {
      const doctypeMatch = withCloseBar.match(/^(\s*<!DOCTYPE[^>]*>\s*)/i);
      if (doctypeMatch) {
        const afterDoctype = withCloseBar.slice(doctypeMatch[1].length);
        edgeResult = doctypeMatch[1] + '<head>\n  ' + newHeadContent + '\n</head>\n' + afterDoctype;
      } else {
        edgeResult = '<head>\n  ' + newHeadContent + '\n</head>\n' + withCloseBar;
      }
    }
    return injectDeepDiveSourcesSection(
      edgeResult,
      input.slug,
      filterRealSources(input.sources ?? [])
    );
  }

  const headOpenEnd = withCloseBar.indexOf(headOpenMatch[0]) + headOpenMatch[0].length;
  const headCloseStart = withCloseBar.indexOf(headCloseMatch[0]);
  const innerHead = withCloseBar.slice(headOpenEnd, headCloseStart);
  const preserved = preserveAllowedHeadTags(innerHead);
  const seoBlock = buildDeepDiveHeadContent(input);
  const newHeadContent = ESSENTIAL_HEAD + '\n  ' + seoBlock + preserved;

  const headOpenStart = withCloseBar.indexOf(headOpenMatch[0]);
  const beforeHead = withCloseBar.slice(0, headOpenStart);
  const afterHead = withCloseBar.slice(headCloseStart + headCloseMatch[0].length);
  const afterHeadWithSources = injectDeepDiveSourcesSection(
    afterHead,
    input.slug,
    filterRealSources(input.sources ?? [])
  );

  return beforeHead + '<head>\n  ' + newHeadContent + '\n</head>' + afterHeadWithSources;
}

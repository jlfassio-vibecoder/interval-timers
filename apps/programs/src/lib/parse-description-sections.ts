/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Parses markdown description into sections for tabbed display.
 * Splits on ## (h2) headings; content before first ## is overview.
 */

import { formatLandingPageMarkdown } from '@/lib/format-landing-page-markdown';

export interface DescriptionSection {
  slug: string;
  title: string;
  content: string;
}

export interface ParsedDescriptionSections {
  overview: string;
  overviewRaw: string;
  sections: DescriptionSection[];
}

/**
 * Derive a URL-safe slug from a heading title.
 * Lowercase, replace non-alphanumeric with '-', collapse multiple dashes.
 */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Parse markdown into overview and sections by ## (h2) headings.
 * Content before first ## becomes overview. Each ## block becomes a section.
 */
export function parseMarkdownIntoSections(markdown: string): ParsedDescriptionSections {
  if (!markdown || typeof markdown !== 'string') {
    return { overview: '', overviewRaw: '', sections: [] };
  }

  const trimmed = markdown.trim();
  if (!trimmed) {
    return { overview: '', overviewRaw: '', sections: [] };
  }

  // Split by ## at start of line (with optional leading whitespace)
  const h2Regex = /^##\s+/m;
  const parts = trimmed.split(h2Regex);

  const overviewRaw = parts[0]?.trim() ?? '';
  const overview = overviewRaw ? formatLandingPageMarkdown(overviewRaw) : '';

  if (parts.length <= 1) {
    return { overview, overviewRaw, sections: [] };
  }

  const result: DescriptionSection[] = [];

  for (let i = 1; i < parts.length; i++) {
    const block = parts[i]?.trim() ?? '';
    if (!block) continue;

    // First line is the section title; rest is content
    const firstNewline = block.indexOf('\n');
    const title = firstNewline >= 0 ? block.slice(0, firstNewline).trim() : block.trim();
    const contentRaw = firstNewline >= 0 ? block.slice(firstNewline + 1).trim() : '';

    const slug = slugify(title) || `section-${i}`;
    const content = contentRaw ? formatLandingPageMarkdown(contentRaw) : '';

    result.push({ slug, title, content });
  }

  return { overview, overviewRaw, sections: result };
}

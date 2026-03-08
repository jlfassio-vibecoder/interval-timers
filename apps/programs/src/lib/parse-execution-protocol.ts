/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Extracts the "Execution Protocol" (or Step-by-Step Instructions) list from
 * deep dive HTML for use in the Daily Warm-Up timer. Used by the warmup-config API
 * and by DeepDiveEditor for live preview. Uses multiple strategies so we find the
 * list even when heading wording or structure varies. Prefers <body> when present.
 */

/** Section heading: h2/h3 containing Execution Protocol / step list (case-insensitive). */
const EXECUTION_SECTION =
  /<h[23][^>]*>[\s\S]*?(?:Execution\s*Protocol\s*:?|Step-by-Step\s+(?:Instructions|Execution)\s*:?)[\s\S]*?<\/h[23]>/i;

/** Keywords for broad heading match (Strategy B). */
const BROAD_HEADING_KEYWORDS = [
  'execution',
  'step-by-step',
  'protocol',
  'instructions',
  'how to perform',
  'technique',
];

/**
 * Strip HTML tags from a string and normalize whitespace.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract list item text from an <ol> or <ul> block. Handles nested tags inside <li>.
 */
function extractListItems(listBlock: string): string[] {
  const items: string[] = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  while ((m = liRegex.exec(listBlock)) !== null) {
    const text = stripHtml(m[1]);
    if (text) items.push(text);
  }
  return items;
}

/**
 * Find the first <ol> or <ul> after startIndex in html and return its <li> text array.
 */
function getFirstListAfter(html: string, startIndex: number): string[] {
  const fragment = html.slice(startIndex);
  const listOpenMatch = fragment.match(/<(ol|ul)[\s>]/i);
  if (!listOpenMatch) return [];

  const tag = listOpenMatch[1].toLowerCase();
  const listStart = fragment.indexOf(listOpenMatch[0]);
  const contentStart = fragment.indexOf('>', listStart) + 1;
  const closeTag = `</${tag}>`;
  const closeIndex = fragment.indexOf(closeTag, contentStart);
  if (closeIndex === -1) return [];

  const listBlock = fragment.slice(contentStart, closeIndex);
  return extractListItems(listBlock);
}

/**
 * If html looks like a full document, return only the body inner HTML so we don't
 * match headings/lists in head or outside body. Otherwise return html as-is.
 */
function getSearchRegion(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body\s*>/i);
  if (bodyMatch) return bodyMatch[1];
  return html;
}

/**
 * Strategy A: strict heading match (Execution Protocol, Step-by-Step Instructions/Execution).
 */
function strategyA(html: string): string[] {
  const sectionMatch = html.match(EXECUTION_SECTION);
  if (!sectionMatch) return [];

  const sectionEndIndex = html.indexOf(sectionMatch[0]) + sectionMatch[0].length;
  return getFirstListAfter(html, sectionEndIndex);
}

/**
 * Strategy B: any h2/h3 whose inner text contains Execution, Step-by-Step, Protocol, etc.
 * Returns list if it has at least 1 item (single-step protocols allowed).
 */
function strategyB(html: string): string[] {
  const h2h3Regex = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = h2h3Regex.exec(html)) !== null) {
    const innerText = stripHtml(m[2]).toLowerCase();
    const hasKeyword = BROAD_HEADING_KEYWORDS.some((kw) => innerText.includes(kw));
    if (!hasKeyword) continue;

    const endOfHeading = m.index + m[0].length;
    const list = getFirstListAfter(html, endOfHeading);
    if (list.length >= 1) return list;
  }
  return [];
}

/**
 * Strategy C: search for "Execution Protocol" or "Step-by-Step" anywhere, then next list.
 * Returns list if it has at least 1 item.
 */
function strategyC(html: string): string[] {
  const searchRegex = /Execution\s*Protocol|Step-by-Step/gi;
  const match = searchRegex.exec(html);
  if (!match) return [];

  const startIndex = match.index + match[0].length;
  const list = getFirstListAfter(html, startIndex);
  if (list.length >= 1) return list;
  return [];
}

/**
 * Strategy D: when "Execution" or "Step-by-Step" appears in the region, return the
 * longest <ol> or <ul> (by number of <li>s) in that region. Case-insensitive for tags.
 */
function strategyD(html: string): string[] {
  const region = getSearchRegion(html);
  const lower = region.toLowerCase();
  if (!lower.includes('execution') && !lower.includes('step-by-step')) return [];

  let best: string[] = [];

  for (const tag of ['ol', 'ul'] as const) {
    const openRegex = new RegExp(`<${tag}[\\s>]`, 'gi');
    const closeTag = `</${tag}>`;
    let m: RegExpExecArray | null;
    while ((m = openRegex.exec(region)) !== null) {
      const openIdx = m.index;
      const contentStart = region.indexOf('>', openIdx) + 1;
      const closeIdx = lower.indexOf(closeTag, contentStart);
      if (closeIdx === -1) continue;
      const items = extractListItems(region.slice(contentStart, closeIdx));
      if (items.length >= 1 && items.length > best.length) best = items;
      openRegex.lastIndex = closeIdx + closeTag.length;
    }
  }
  return best;
}

/**
 * Strategy E: after "Execution Protocol" or "Step-by-Step", take the following block of
 * content (until next h2/h3 or end), strip HTML, and split by numbered items (1. 2. or 1) 2)).
 * Handles deep dives that use <p> or <div> with "1. Step" instead of <ol><li>.
 * Works when stripHtml collapses to one line (split by \d+[.)] pattern).
 */
function strategyE(html: string): string[] {
  const region = getSearchRegion(html);
  const searchRegex = /Execution\s*Protocol|Step-by-Step/gi;
  const match = searchRegex.exec(region);
  if (!match) return [];

  const start = match.index + match[0].length;
  const rest = region.slice(start, start + 12000);
  const nextHeading = rest.match(/<\s*h[23][\s>]/i);
  const block = nextHeading ? rest.slice(0, nextHeading.index ?? rest.length) : rest;
  const text = stripHtml(block);
  const steps: string[] = [];
  // Match number at start-of-string or after whitespace so "1. First step 2. Second" splits correctly
  const splitByNumber = text.split(/(?:^|\s)\d+[.)]\s+/);
  for (let i = 0; i < splitByNumber.length; i++) {
    const step = splitByNumber[i].trim();
    if (step.length > 2) steps.push(step);
  }
  return steps.length >= 1 ? steps : [];
}

/**
 * Extracts the Execution Protocol (or step list) as an array of step strings from deep dive HTML.
 * Search is done inside <body> when present. Tries Strategy A → B → C → D → E.
 * Returns [] if no list is found.
 */
export function extractExecutionProtocolFromDeepDiveHtml(html: string): string[] {
  if (!html || typeof html !== 'string') return [];

  const searchHtml = getSearchRegion(html);

  const fromA = strategyA(searchHtml);
  if (fromA.length > 0) return fromA;

  const fromB = strategyB(searchHtml);
  if (fromB.length > 0) return fromB;

  const fromC = strategyC(searchHtml);
  if (fromC.length > 0) return fromC;

  const fromD = strategyD(html);
  if (fromD.length > 0) return fromD;

  const fromE = strategyE(html);
  if (fromE.length > 0) return fromE;

  return [];
}

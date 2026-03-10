/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Converts LaTeX-style inline math and common commands to Unicode so they
 * display correctly in deep dive and modal content (no math renderer required).
 */

export interface NormalizeMathSymbolsOptions {
  /**
   * When true, only replace known LaTeX patterns with Unicode; do not strip
   * generic $...$. Use for HTML (e.g. deep dive body) to avoid touching
   * attribute values. When false, also strip remaining $...$ to inner text.
   */
  htmlSafe?: boolean;
}

/** Known LaTeX inline math and commands → Unicode. Applied in order. Backslashes in literals. */
const LATEX_TO_UNICODE: [string | RegExp, string][] = [
  ['$\\tau$', 'τ'],
  ['$\\theta$', 'θ'],
  ['\\times', '×'],
  ['$r$', 'r'],
  ['$F$', 'F'],
];

/**
 * Replaces common LaTeX inline math and commands with Unicode equivalents.
 * Use for paragraph/modal content (formatParagraphContent) with htmlSafe: false
 * to also strip remaining $...$ to inner text. Use for deep dive HTML with
 * htmlSafe: true to only replace known patterns and avoid touching attributes.
 */
export function normalizeMathSymbols(text: string, options?: NormalizeMathSymbolsOptions): string {
  if (!text || typeof text !== 'string') return '';
  const htmlSafe = options?.htmlSafe === true;
  let out = text;

  for (const [pattern, replacement] of LATEX_TO_UNICODE) {
    if (typeof pattern === 'string') {
      out = out.split(pattern).join(replacement);
    } else {
      out = out.replace(pattern, replacement);
    }
  }

  if (!htmlSafe) {
    // Strip remaining $...$ to inner text (e.g. "lever arm ($r$)" → "lever arm (r)")
    out = out.replace(/\$([^$]+)\$/g, '$1');
  }

  return out;
}

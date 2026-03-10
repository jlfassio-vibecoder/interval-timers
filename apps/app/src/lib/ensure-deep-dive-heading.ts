/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Ensures the deep dive HTML has at least one <h1> for the exercise name (SEO and accessibility).
 * When the document has no <h1>, injects one immediately after the opening <body> tag.
 */

/** Escape text for use inside HTML element content (e.g. <h1>...</h1>). */
function escapeHtmlText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * If the HTML has no <h1>, injects a single <h1> with the exercise name right after the opening <body> tag.
 * Otherwise returns the HTML unchanged. Malformed HTML without <body> is returned unchanged.
 */
export function ensureDeepDiveHeading(html: string, exerciseName: string): string {
  if (/<h1[\s>]/i.test(html)) {
    return html;
  }
  const bodyMatch = html.match(/<body([^>]*)>/i);
  if (!bodyMatch) {
    return html;
  }
  const escapedName = escapeHtmlText(exerciseName);
  const h1 = `<h1 class="text-2xl font-bold mb-4">${escapedName}</h1>`;
  return html.replace(bodyMatch[0], bodyMatch[0] + '\n' + h1);
}

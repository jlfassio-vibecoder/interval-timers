/**
 * Build a Response for exercise deep-dive HTML (sanitize → math normalize → full document).
 * Caller must set `meta.nonce` (used in CSP and in injected head).
 */

import type { DeepDiveMetaInput } from '@/lib/inject-deep-dive-meta';
import { normalizeMathSymbols } from '@/lib/normalize-math-symbols';
import { prepareDeepDiveDocument } from '@/lib/prepare-deep-dive-document';
import { sanitizeDeepDiveHtml } from '@/lib/sanitize-deep-dive-html';

const CSP_TEMPLATE = (nonce: string) =>
  `default-src 'self'; script-src 'self' 'nonce-${nonce}' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'none'`;

export function deepDiveLearnResponse(html: string, meta: DeepDiveMetaInput): Response {
  if (!meta.nonce?.trim()) {
    throw new Error('deepDiveLearnResponse: meta.nonce is required for CSP and injected head');
  }
  const nonce = meta.nonce.trim();
  const body = prepareDeepDiveDocument(
    normalizeMathSymbols(sanitizeDeepDiveHtml(html), { htmlSafe: true }),
    meta
  );
  return new Response(body, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': CSP_TEMPLATE(nonce),
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

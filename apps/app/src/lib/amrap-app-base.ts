/**
 * Base URL for the AMRAP SPA (no trailing slash), e.g. `https://example.com/amrap`.
 *
 * The Mission Control /account app (Astro) deploy often does **not** include the AMRAP Vite
 * bundle; it is copied into the merged landing output (`scripts/copy-standalone-apps-to-dist.cjs`).
 * Links that assume same-origin `/amrap` then 404 on app-only hosts.
 *
 * Set **`PUBLIC_AMRAP_BASE_URL`** to the full AMRAP base (custom domain root or `.../amrap` on the marketing site).
 * Or set **`PUBLIC_MARKETING_SITE_URL`** to the marketing origin; we append `/amrap` for the common merged-landing layout.
 */

export function getAmrapAppBase(): string {
  if (typeof import.meta === 'undefined') return '';
  const explicit = (import.meta.env?.PUBLIC_AMRAP_BASE_URL ?? '').trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const marketing = (import.meta.env?.PUBLIC_MARKETING_SITE_URL ?? '').trim();
  if (marketing) return `${marketing.replace(/\/+$/, '')}/amrap`;
  return '';
}

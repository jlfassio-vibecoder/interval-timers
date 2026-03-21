/**
 * Open main-app handoff URL in a new tab; detect popup blocking.
 */

export interface OpenMainAppHandoffResult {
  /** True if window.open returned a non-null window reference (immediate check). */
  opened: boolean;
  url: string;
}

/**
 * Opens `fullUrl` in a new browsing context. Some browsers still return a Window
 * when popups are “soft” blocked; callers should show a fallback link regardless.
 */
export function openMainAppHandoff(fullUrl: string): OpenMainAppHandoffResult {
  const win = window.open(fullUrl, '_blank', 'noopener,noreferrer');
  return { opened: win != null, url: fullUrl };
}

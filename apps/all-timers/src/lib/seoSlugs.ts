/**
 * SEO-friendly URL slugs for protocol pages.
 * Maps protocol IDs to keyword-rich paths matching high-traffic search terms.
 */

import type { IntervalTimerPage } from '@interval-timers/types';
import { VALID_PROTOCOLS } from '@interval-timers/timer-core';

export const PROTOCOL_TO_SLUG: Record<IntervalTimerPage, string> = {
  mindful: 'japanese-walking',
  tabata: 'tabata-timer',
  warmup: 'daily-warm-up',
  aerobic: 'aerobic-timer',
  lactate: 'lactate-threshold',
  phosphagen: 'power-intervals',
  gibala: 'gibala-method',
  wingate: 'wingate-test',
  timmons: 'timmons-protocol',
  emom: 'emom-timer',
  amrap: 'amrap-timer',
  '10-20-30': '10-20-30',
};

const SLUG_TO_PROTOCOL_ENTRIES = (Object.entries(PROTOCOL_TO_SLUG) as [IntervalTimerPage, string][]).map(
  ([id, slug]) => [slug, id] as const
);
export const SLUG_TO_PROTOCOL: Record<string, IntervalTimerPage> = Object.fromEntries(SLUG_TO_PROTOCOL_ENTRIES);

/**
 * Parse pathname to protocol. Expects path like "/japanese-walking" (leading slash, no query).
 */
export function getProtocolFromPath(pathname: string): IntervalTimerPage | null {
  const segment = pathname.replace(/^\/+|\/+$/g, '') || '';
  const protocol = SLUG_TO_PROTOCOL[segment];
  return protocol ?? null;
}

/**
 * Return SEO slug for a protocol (no leading slash).
 */
export function getSlugForProtocol(protocol: IntervalTimerPage): string {
  return PROTOCOL_TO_SLUG[protocol];
}

/**
 * All valid slugs for redirect/sitemap.
 */
export const ALL_SLUGS: string[] = VALID_PROTOCOLS.map((p) => PROTOCOL_TO_SLUG[p]);

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure helpers for scheduled live calendar card titles (client + server safe).
 * Keep separate from `trainer-live-scheduled.ts` so React bundles do not pull `supabase/server`.
 */

/** Default card heading when `displayName` is null or blank. */
export const SCHEDULED_LIVE_DEFAULT_CARD_TITLE = 'Scheduled Live';

export function scheduledLiveCardTitle(item: { displayName?: string | null }): string {
  const t = item.displayName?.trim();
  return t ? t : SCHEDULED_LIVE_DEFAULT_CARD_TITLE;
}

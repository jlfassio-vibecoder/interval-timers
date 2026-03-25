/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Preferred HIIT styles (`preferred_hiit_styles` text[] on profiles). Ids align with
 * `intervalTimerProtocols` / `?protocol=` in the main interval timer app.
 */

/** Same ids as `IntervalTimerPage` / `VALID_PROTOCOLS`, plus legacy `wood`. */
export const HIIT_STYLE_IDS = [
  'warmup',
  'tabata',
  'mindful',
  'aerobic',
  'lactate',
  'phosphagen',
  'gibala',
  'wingate',
  'timmons',
  'emom',
  'amrap',
  '10-20-30',
  'wood',
] as const;

export type HiitStyleId = (typeof HIIT_STYLE_IDS)[number];

export const HIIT_STYLE_BADGES: { id: HiitStyleId; label: string }[] = [
  { id: 'warmup', label: 'Daily Warm-Up' },
  { id: 'tabata', label: 'Tabata' },
  { id: 'mindful', label: 'Japanese Walking' },
  { id: 'aerobic', label: 'Aerobic' },
  { id: 'lactate', label: 'Lactate' },
  { id: 'phosphagen', label: 'Power' },
  { id: 'gibala', label: 'Gibala' },
  { id: 'wingate', label: 'Wingate' },
  { id: 'timmons', label: 'Timmons' },
  { id: 'emom', label: 'EMOM' },
  { id: 'amrap', label: 'AMRAP' },
  { id: '10-20-30', label: '10-20-30' },
  { id: 'wood', label: 'WOOD' },
];

export function labelForHiitStyleId(id: string): string {
  const found = HIIT_STYLE_BADGES.find((b) => b.id === id);
  return found?.label ?? id.replace(/_/g, ' ');
}

export function isHiitStyleId(s: string): s is HiitStyleId {
  return (HIIT_STYLE_IDS as readonly string[]).includes(s);
}

/** Toggle a protocol id in a multi-select list (order preserved). */
export function toggleHiitStyle(selected: readonly string[], id: HiitStyleId): string[] {
  const i = selected.indexOf(id);
  if (i >= 0) {
    return selected.filter((_, j) => j !== i);
  }
  return [...selected, id];
}

export function labelsForHiitStyleIds(ids: readonly string[]): string {
  return ids.map((id) => labelForHiitStyleId(id)).join(', ');
}

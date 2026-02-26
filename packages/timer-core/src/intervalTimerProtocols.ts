/**
 * Single source of truth for the 12 interval timer protocols.
 * Used by the shared nav and "coming soon" view.
 */

import type { IntervalTimerPage, ProtocolAccentTheme } from '@interval-timers/types';
import { GOLD_ACCENT } from '@interval-timers/types';

export type { IntervalTimerPage, ProtocolAccentTheme };
export { GOLD_ACCENT };

export const VALID_PROTOCOLS: IntervalTimerPage[] = [
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
];

export const INTERVAL_TIMER_PROTOCOLS: { id: IntervalTimerPage; label: string }[] = [
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
];

export function getProtocolLabel(id: IntervalTimerPage): string {
  const found = INTERVAL_TIMER_PROTOCOLS.find((p) => p.id === id);
  return found ? found.label : id;
}

/** Per-protocol accent themes. Tabata red, Mindful green; others default to gold. */
const PROTOCOL_ACCENT_MAP: Partial<Record<IntervalTimerPage, ProtocolAccentTheme>> = {
  warmup: {
    badge: 'bg-slate-600/20',
    badgeText: 'text-slate-400',
    workBg: 'bg-slate-600',
  },
  tabata: {
    badge: 'bg-red-600/20',
    badgeText: 'text-red-400',
    workBg: 'bg-red-600',
  },
  mindful: {
    badge: 'bg-green-600/20',
    badgeText: 'text-green-400',
    workBg: 'bg-green-600',
  },
  aerobic: {
    badge: 'bg-indigo-600/20',
    badgeText: 'text-indigo-400',
    workBg: 'bg-indigo-600',
  },
  lactate: {
    badge: 'bg-amber-600/20',
    badgeText: 'text-amber-400',
    workBg: 'bg-amber-600',
  },
  phosphagen: {
    badge: 'bg-yellow-600/20',
    badgeText: 'text-yellow-400',
    workBg: 'bg-yellow-600',
  },
  gibala: {
    badge: 'bg-emerald-600/20',
    badgeText: 'text-emerald-400',
    workBg: 'bg-emerald-600',
  },
  wingate: {
    badge: 'bg-lime-600/20',
    badgeText: 'text-lime-400',
    workBg: 'bg-lime-600',
  },
  timmons: {
    badge: 'bg-sky-600/20',
    badgeText: 'text-sky-400',
    workBg: 'bg-sky-600',
  },
  emom: {
    badge: 'bg-teal-600/20',
    badgeText: 'text-teal-400',
    workBg: 'bg-teal-600',
  },
  amrap: {
    badge: 'bg-orange-600/20',
    badgeText: 'text-orange-400',
    workBg: 'bg-orange-600',
  },
  '10-20-30': {
    badge: 'bg-cyan-600/20',
    badgeText: 'text-cyan-400',
    workBg: 'bg-cyan-600',
  },
};

export function getProtocolAccent(id: IntervalTimerPage): ProtocolAccentTheme {
  return PROTOCOL_ACCENT_MAP[id] ?? GOLD_ACCENT;
}

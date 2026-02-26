/** Step-by-step protocol: title + body. Used for warmup instructions panel. */
export interface InstructionStep {
  title: string;
  body: string;
}

export type IntervalTimerPage =
  | 'warmup'
  | 'tabata'
  | 'mindful'
  | 'aerobic'
  | 'lactate'
  | 'phosphagen'
  | 'gibala'
  | 'wingate'
  | 'timmons'
  | 'emom'
  | 'amrap'
  | '10-20-30';

/** Optional per-protocol accent for badges/headers. Primary CTA and nav stay #ffbf00. */
export interface ProtocolAccentTheme {
  /** Tailwind classes for badge pill (e.g. "bg-red-600/20") */
  badge: string;
  /** Tailwind classes for badge text (e.g. "text-red-400") */
  badgeText: string;
  /** Tailwind class for overlay work-phase header (e.g. "bg-red-600") */
  workBg: string;
}

export const GOLD_ACCENT: ProtocolAccentTheme = {
  badge: 'bg-[#ffbf00]/20',
  badgeText: 'text-[#ffbf00]',
  workBg: 'bg-[#ffbf00]',
};

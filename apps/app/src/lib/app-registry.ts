/**
 * App registry for the account page launcher and entry-point card.
 * Used to resolve app name/path when redirecting with ?from=<appId>.
 */

import { appendQuery } from '@/lib/url-utils';

export interface AppEntry {
  id: string;
  name: string;
  path: string;
  description: string;
  /** When set, app is on a different origin (e.g. AMRAP at amrapwithfriends.com). Launcher uses this for the link. */
  baseUrl?: string;
}

export const APP_REGISTRY: readonly AppEntry[] = [
  { id: 'landing', name: 'Home', path: '/', description: 'Browse protocols' },
  { id: 'amrap', name: 'AMRAP', path: '/amrap/', description: 'Timer & With Friends' },
  { id: 'tabata', name: 'Tabata', path: '/tabata-timer', description: '4-min protocol' },
  { id: 'daily-warmup', name: 'Daily Warm-Up', path: '/daily-warm-up', description: 'Mobility' },
  { id: 'app', name: 'Programs', path: '/interval-timers', description: 'HUD & schedules' },
  {
    id: 'training-log',
    name: 'Training Log',
    path: '/training-log',
    description: 'Track & analyze workouts',
  },
  { id: 'lactate', name: 'Lactate', path: '/lactate-threshold', description: 'Threshold training' },
  {
    id: 'phosphagen',
    name: 'Power Intervals',
    path: '/power-intervals',
    description: 'Power & capacity',
  },
  { id: 'gibala', name: 'Gibala Method', path: '/gibala-method', description: '2:1 protocol' },
  { id: 'wingate', name: 'Wingate', path: '/wingate', description: '30s maximal' },
  { id: 'timmons', name: 'Timmons', path: '/timmons', description: '4×4 protocol' },
  { id: 'emom', name: 'EMOM', path: '/emom-timer', description: 'Every minute' },
  { id: '10-20-30', name: '10-20-30', path: '/10-20-30', description: 'Metabolic intervals' },
  {
    id: 'mindful',
    name: 'Japanese Walking',
    path: '/japanese-walking',
    description: 'Mindful walking',
  },
  { id: 'aerobic', name: 'Aerobic', path: '/aerobic-timer', description: 'VO2 intervals' },
  { id: 'bio-sync60', name: 'Bio-Sync 60', path: '/bio-sync60', description: 'Master clock' },
] as const;

export function getAppById(id: string): AppEntry | undefined {
  return APP_REGISTRY.find((app) => app.id === id);
}

const PUBLIC_AMRAP_BASE =
  (typeof import.meta !== 'undefined' && (import.meta.env?.PUBLIC_AMRAP_BASE_URL ?? '').trim()) ||
  '';

/** Resolves the launch URL for an app. Uses PUBLIC_AMRAP_BASE_URL for AMRAP when set (custom domain). */
export function getAppLaunchUrl(app: AppEntry, params: Record<string, string>): string {
  const base =
    app.baseUrl ??
    (app.id === 'amrap' && PUBLIC_AMRAP_BASE ? PUBLIC_AMRAP_BASE.replace(/\/+$/, '') + '/' : '');
  if (base) return appendQuery(base, params);
  return appendQuery(app.path, params);
}

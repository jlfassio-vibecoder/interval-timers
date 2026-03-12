/**
 * Canonical deploy paths for each protocol.
 * Must match vercel.json rewrites and copy script dest.
 */
import type { IntervalTimerPage } from '@interval-timers/timer-core';

export const PROTOCOL_TO_PATH: Record<IntervalTimerPage, string> = {
  warmup: 'daily-warm-up',
  mindful: 'japanese-walking',
  tabata: 'tabata-timer',
  aerobic: 'aerobic-timer',
  lactate: 'lactate-threshold',
  phosphagen: 'power-intervals',
  gibala: 'gibala-method',
  wingate: 'wingate',
  timmons: 'timmons',
  emom: 'emom-timer',
  amrap: 'amrap',
  '10-20-30': '10-20-30',
};

export function getPathForProtocol(p: IntervalTimerPage): string {
  const path = PROTOCOL_TO_PATH[p];
  // In dev with dev:landing:with-amrap, link directly to amrap (avoids proxy conflicts)
  const isDev = (import.meta as { env?: { DEV?: boolean } }).env?.DEV;
  if (isDev && p === 'amrap') {
    return 'http://localhost:5177/amrap/';
  }
  return '/' + path;
}

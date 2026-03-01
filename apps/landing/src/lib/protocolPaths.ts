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
  return '/' + PROTOCOL_TO_PATH[p];
}

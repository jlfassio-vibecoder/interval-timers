/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Profile IANA timezone helpers for calendar UIs and persistence.
 */

import { supabase } from '@/lib/supabase/supabase-instance';
import { safeIanaZone } from '@/lib/performance-lab/trainer-calendar-time';

/** Curated fallback when Intl.supportedValuesOf is unavailable. */
const FALLBACK_IANA_ZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Toronto',
  'America/Vancouver',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const;

export function getResolvedBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function getSupportedIanaTimeZones(): string[] {
  try {
    const supportedValuesOf = (
      Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf;
    if (typeof supportedValuesOf === 'function') {
      const list = [...supportedValuesOf('timeZone')];
      if (!list.includes('UTC')) list.push('UTC');
      return list.sort((a, b) => a.localeCompare(b));
    }
  } catch {
    // ignore
  }
  return [...FALLBACK_IANA_ZONES];
}

export async function getProfileTimezone(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  const tz = data?.timezone;
  return typeof tz === 'string' && tz.trim() ? tz.trim() : null;
}

export async function updateMyProfileTimezone(userId: string, zone: string): Promise<void> {
  const normalized = safeIanaZone(zone);
  const { error } = await supabase
    .from('profiles')
    .update({ timezone: normalized })
    .eq('id', userId);

  if (error) throw error;
}

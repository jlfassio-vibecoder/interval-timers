/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Compact timezone selector for calendar headers; persists via parent onCommit.
 */

import React, { useMemo, useState } from 'react';
import { DateTime } from 'luxon';
import { Globe } from 'lucide-react';
import {
  formatTimeInZone,
  safeIanaZone,
  shortZoneName,
} from '@/lib/performance-lab/trainer-calendar-time';
import {
  getResolvedBrowserTimeZone,
  getSupportedIanaTimeZones,
} from '@/lib/profile-timezone';

export interface CalendarTimezoneControlProps {
  value: string;
  onCommit: (zone: string) => void | Promise<void>;
  disabled?: boolean;
  busy?: boolean;
  className?: string;
  id?: string;
  /** When true, use slightly larger text (Mission Control). */
  variant?: 'hud' | 'trainer';
}

function nowUtcIso(): string {
  return DateTime.now().toUTC().toISO()!;
}

export const CalendarTimezoneControl: React.FC<CalendarTimezoneControlProps> = ({
  value,
  onCommit,
  disabled = false,
  busy = false,
  className = '',
  id,
  variant = 'hud',
}) => {
  const [saving, setSaving] = useState(false);
  const zones = useMemo(() => getSupportedIanaTimeZones(), []);
  const effective = safeIanaZone(value);
  const sampleIso = nowUtcIso();
  const abbr = shortZoneName(sampleIso, effective);
  const sampleTime = formatTimeInZone(sampleIso, effective);

  const textSize = variant === 'trainer' ? 'text-sm' : 'text-[10px]';
  const labelClass =
    variant === 'trainer' ? 'text-white/55' : 'font-mono text-white/50 uppercase tracking-wider';

  const runCommit = async (zone: string) => {
    const next = safeIanaZone(zone);
    if (next === effective) return;
    setSaving(true);
    try {
      await onCommit(next);
    } finally {
      setSaving(false);
    }
  };

  const combinedBusy = busy || saving;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Globe
        className={`shrink-0 text-orange-light ${variant === 'trainer' ? 'h-4 w-4' : 'h-3.5 w-3.5'}`}
        aria-hidden
      />
      <label htmlFor={id} className={`sr-only`}>
        Calendar timezone
      </label>
      <select
        id={id}
        value={effective}
        onChange={(e) => void runCommit(e.target.value)}
        disabled={disabled || combinedBusy}
        className={`max-w-[min(100%,14rem)] truncate rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 ${textSize} text-white focus:outline-none focus:ring-1 focus:ring-orange-light/50 disabled:opacity-50`}
        title={effective}
      >
        {!zones.includes(effective) ? (
          <option value={effective}>{effective} (current)</option>
        ) : null}
        {zones.map((z) => (
          <option key={z} value={z}>
            {z}
          </option>
        ))}
      </select>
      <span className={`${labelClass} hidden sm:inline`} title={effective}>
        {abbr ? `${sampleTime} ${abbr}` : sampleTime}
        {combinedBusy ? ' · …' : ''}
      </span>
      <button
        type="button"
        disabled={disabled || combinedBusy}
        onClick={() => void runCommit(getResolvedBrowserTimeZone())}
        className={`shrink-0 rounded-md border border-white/15 px-2 py-1 ${textSize} text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40`}
      >
        This device
      </button>
    </div>
  );
};

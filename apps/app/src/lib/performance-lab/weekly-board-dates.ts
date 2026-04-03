/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure date helpers for P4 weekly board (Mon-start week, local calendar).
 */

export function isValidDateOnly(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
}

/** Monday (local) of the week containing `d`, as YYYY-MM-DD. */
export function mondayOfWeekContainingLocal(d: Date): string {
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = dt.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const dayNum = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayNum}`;
}

export function addDaysDateOnly(dateStr: string, delta: number): string {
  const d = new Date(dateStr.trim() + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dayNum = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayNum}`;
}

export function isScheduledDateInWeek(scheduledDate: string, weekStartMonday: string): boolean {
  if (!isValidDateOnly(scheduledDate) || !isValidDateOnly(weekStartMonday)) return false;
  const start = new Date(weekStartMonday + 'T12:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const t = new Date(scheduledDate + 'T12:00:00');
  return t >= start && t < end;
}

/** Last 7 local calendar days ending today (inclusive), oldest first. */
export function rollingSevenDatesEndingToday(now = new Date()): string[] {
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const da = String(now.getDate()).padStart(2, '0');
  const endStr = `${y}-${mo}-${da}`;
  const out: string[] = [];
  for (let i = 6; i >= 0; i--) {
    out.push(addDaysDateOnly(endStr, -i));
  }
  return out;
}

/** Distinct week-start Mondays needed to load cards covering every date in `dates`. */
export function uniqueMondaysForDates(dates: string[]): string[] {
  const set = new Set<string>();
  for (const ds of dates) {
    if (!isValidDateOnly(ds)) continue;
    set.add(mondayOfWeekContainingLocal(new Date(ds + 'T12:00:00')));
  }
  return [...set];
}

/** Truncate for compact Kanban labels (code units, not grapheme clusters). */
export function truncateCardTitle(title: string, max = 20): string {
  const t = typeof title === 'string' ? title : '';
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

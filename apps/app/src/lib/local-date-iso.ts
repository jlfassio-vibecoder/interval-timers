/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Calendar day as YYYY-MM-DD in the user's local timezone (not UTC midnight from toISOString).
 * Use for date inputs and "today" defaults so evening users don't see the wrong calendar day.
 */

export function localCalendarDateISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

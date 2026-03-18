/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * RFC 5545 iCalendar (.ics) export from unified calendar events.
 */

import type { CalendarEvent } from '@/lib/calendar-events';

const PRODID = '-//Interval Timers//Calendar Export//EN';
const MAX_LINE = 75;

/** Escape text for iCalendar: \ → \\, ; → \;, , → \, CRLF → \n */
function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Fold line at 75 octets (RFC 5545); use CRLF + space. */
function foldLine(line: string): string {
  if (line.length <= MAX_LINE) return line;
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    const chunk = line.slice(i, i + MAX_LINE);
    out.push(out.length === 0 ? chunk : ' ' + chunk);
    i += MAX_LINE;
  }
  return out.join('\r\n');
}

/** Format YYYYMMDD from ISO date string YYYY-MM-DD */
function dateToIcsDate(isoDate: string): string {
  return isoDate.replace(/-/g, '');
}

/** Format YYYYMMDDTHHMMSSZ from ISO datetime or date; fallback time 12:00:00Z */
function toIcsDateTime(iso: string): string {
  if (iso.includes('T')) {
    const d = new Date(iso);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const h = String(d.getUTCHours()).padStart(2, '0');
    const min = String(d.getUTCMinutes()).padStart(2, '0');
    const sec = String(d.getUTCSeconds()).padStart(2, '0');
    return `${y}${m}${day}T${h}${min}${sec}Z`;
  }
  return `${dateToIcsDate(iso)}T120000Z`;
}

/** Stable secondary id for UID (sessionId, program:week:workout, logId, or index) */
function secondaryId(ev: CalendarEvent, index: number): string {
  if (ev.sessionId) return ev.sessionId;
  if (ev.type === 'program' && ev.programId != null && ev.weekId != null && ev.workoutId != null)
    return `${ev.programId}-${ev.weekId}-${ev.workoutId}`;
  if (ev.metadata?.logId) return ev.metadata.logId;
  return `i${index}`;
}

/** Generate unique UID for event (stable per event so re-export doesn’t duplicate in calendar apps) */
function uid(ev: CalendarEvent, index: number): string {
  const sid = secondaryId(ev, index);
  return `${ev.type}-${ev.date}-${sid}@interval-timers`;
}

/** Current time as DTSTAMP (YYYYMMDDTHHMMSSZ) */
function dtstamp(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const sec = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${day}T${h}${min}${sec}Z`;
}

const COMPLETED_STATUS: CalendarEvent['status'] = 'completed';
function isCompleted(ev: CalendarEvent): boolean {
  return ev.status === COMPLETED_STATUS;
}

/**
 * Build RFC 5545 .ics string from unified calendar events.
 * - program: all-day (DATE)
 * - amrap_scheduled, timer_scheduled: timed (DATETIME from metadata.scheduledAt)
 * - amrap, timer, readiness (completed): all-day with [Done] prefix
 */
export function buildIcsFromEvents(events: CalendarEvent[]): string {
  const now = dtstamp();
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const eventUid = escapeIcsText(uid(ev, i));
    let summary = ev.workoutTitle;
    if (ev.programTitle) summary += ` — ${ev.programTitle}`;
    if (ev.type === 'readiness')
      summary =
        'Readiness' + (ev.metadata?.rating != null ? ` - Score: ${ev.metadata.rating}` : '');
    if (isCompleted(ev) && ev.type !== 'readiness') summary = `[Done] ${summary}`;
    summary = escapeIcsText(summary);

    const isTimed =
      (ev.type === 'amrap_scheduled' || ev.type === 'timer_scheduled') && ev.metadata?.scheduledAt;
    const startIso = isTimed ? ev.metadata!.scheduledAt! : ev.date;
    const durationMinutes = ev.metadata?.durationMinutes;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${foldLine(eventUid)}`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`SUMMARY:${foldLine(summary)}`);

    if (isTimed) {
      lines.push(`DTSTART:${toIcsDateTime(startIso)}`);
      if (durationMinutes != null && durationMinutes > 0) {
        lines.push(`DURATION:PT${durationMinutes}M`);
      }
    } else {
      lines.push(`DTSTART;VALUE=DATE:${dateToIcsDate(ev.date)}`);
    }

    const descParts: string[] = [];
    if (ev.metadata?.effort != null) descParts.push(`Effort: ${ev.metadata.effort}/10`);
    if (ev.metadata?.rounds != null) descParts.push(`Rounds: ${ev.metadata.rounds}`);
    if (ev.metadata?.notes) descParts.push(`Notes: ${ev.metadata.notes}`);
    if (descParts.length > 0) {
      lines.push(`DESCRIPTION:${foldLine(escapeIcsText(descParts.join('\\n')))}`);
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

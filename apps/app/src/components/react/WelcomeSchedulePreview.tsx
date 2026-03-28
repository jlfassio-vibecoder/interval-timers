/**
 * Read-only next-7-days schedule for /welcome (reuses unified calendar pipeline + RLS).
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { trackEvent } from '@interval-timers/analytics';
import { supabase } from '@/lib/supabase/supabase-instance';
import { getLoggedDatesForCalendar } from '@/lib/supabase/client/calendar-completion';
import { getUnifiedCalendarEvents } from '@/lib/calendar-unified';
import { eventCompletionKey, type CalendarEvent } from '@/lib/calendar-events';
import {
  addCalendarDays,
  getTrainingLogLocalTodayISO,
  loadProgramsForCalendar,
} from '@/lib/supabase/client/training-log';
import type { WelcomeLandingStrings, WelcomeLocale } from '@/lib/welcome-landing-strings';

const PREVIEW_MAX_ITEMS = 10;

function formatPreviewDate(iso: string, locale: WelcomeLocale): string {
  const parts = iso.split('-').map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  const loc = locale === 'es' ? 'es-ES' : 'en-US';
  return date.toLocaleDateString(loc, { weekday: 'short', month: 'short', day: 'numeric' });
}

function eventTypeLabel(ev: CalendarEvent): string {
  switch (ev.type) {
    case 'program':
      return 'Program';
    case 'amrap_scheduled':
      return 'AMRAP';
    case 'timer_scheduled':
      return 'Timer';
    default:
      return ev.type;
  }
}

function eventTitle(ev: CalendarEvent): string {
  if (ev.type === 'program' && ev.programTitle) {
    return `${ev.programTitle} · ${ev.workoutTitle}`;
  }
  return ev.workoutTitle;
}

export interface WelcomeSchedulePreviewProps {
  userId: string;
  className?: string;
  /** Copy for the welcome island; defaults to English built-ins when omitted. */
  strings?: WelcomeLandingStrings;
  locale?: WelcomeLocale;
}

const DEFAULT_SCHEDULE_STRINGS_EN: WelcomeLandingStrings = {
  brandSubtitle: '',
  loadingInvitation: '',
  loadingInvitationDetails: '',
  checkingSession: '',
  signInEmailPhone: '',
  finishingSetup: '',
  invitedBy: '',
  invitedAt: '',
  kindFriendSub: '',
  kindClientSub: '',
  signInToAccept: '',
  signInSameContact: '',
  acceptSuccessFriend: '',
  acceptSuccessClient: '',
  openApp: '',
  missionControl: '',
  couldNotAccept: '',
  signInInvitedEmailRefresh: '',
  footerPrivacy: '',
  footerTerms: '',
  footerWrongPerson: '',
  footerWrongPersonSignOut: '',
  footerWrongPersonSignedOut: '',
  localeLabel: '',
  localeEn: '',
  localeEs: '',
  scheduleNext7Days: 'Next 7 days',
  scheduleReadOnly: 'Upcoming sessions on your calendar (read-only)',
  scheduleEmpty: 'No sessions scheduled this week.',
  scheduleOpenToPlan: 'Open app to plan',
  scheduleRetry: 'Retry',
  scheduleCouldNotLoad: 'Couldn’t load schedule',
};

const WelcomeSchedulePreview: React.FC<WelcomeSchedulePreviewProps> = ({
  userId,
  className = '',
  strings: stringsProp,
  locale = 'en',
}) => {
  const strings = stringsProp ?? DEFAULT_SCHEDULE_STRINGS_EN;
  const calendarPreviewTracked = useRef(false);
  const [items, setItems] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    calendarPreviewTracked.current = false;
  }, [userId]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const today = getTrainingLogLocalTodayISO();
      const rangeEnd = addCalendarDays(today, 6);
      const programs = await loadProgramsForCalendar(userId);
      const loggedMap = await getLoggedDatesForCalendar(userId, today, rangeEnd);
      const all = await getUnifiedCalendarEvents(userId, today, rangeEnd, {
        programs,
        loggedMap,
      });
      const upcoming = all
        .filter((e) => e.status === 'scheduled' && e.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date) || eventTitle(a).localeCompare(eventTitle(b)))
        .slice(0, PREVIEW_MAX_ITEMS);
      setItems(upcoming);
      if (upcoming.length > 0 && !calendarPreviewTracked.current) {
        calendarPreviewTracked.current = true;
        void trackEvent(
          supabase,
          'calendar_preview_view',
          { item_count: upcoming.length },
          { appId: 'app' }
        );
      }
    } catch {
      setItems([]);
      setError(strings.scheduleCouldNotLoad);
    } finally {
      setLoading(false);
    }
  }, [userId, strings.scheduleCouldNotLoad]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section
      className={`rounded-2xl border border-white/10 bg-black/30 p-6 text-left backdrop-blur-sm ${className}`}
      aria-labelledby="welcome-schedule-heading"
    >
      <h2
        id="welcome-schedule-heading"
        className="mb-1 font-heading text-sm font-bold uppercase tracking-widest text-orange-light"
      >
        Next 7 days
      </h2>
      <p className="mb-4 text-xs text-white/45">Upcoming sessions on your calendar (read-only)</p>

      {loading && (
        <div className="flex justify-center py-6">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-orange-light border-t-transparent" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200/90">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 text-xs font-bold uppercase tracking-wide text-orange-light hover:text-white"
          >
            {strings.scheduleRetry}
          </button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-6 text-center">
          <p className="text-sm text-white/65">{strings.scheduleEmpty}</p>
          <a
            href="/"
            className="mt-3 inline-block text-xs font-bold uppercase tracking-wide text-orange-light hover:text-white"
            onClick={() =>
              void trackEvent(supabase, 'cta_open_app', { surface: 'schedule_empty' }, { appId: 'app' })
            }
          >
            {strings.scheduleOpenToPlan}
          </a>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((ev, i) => (
            <li
              key={`${ev.type}-${ev.date}-${ev.sessionId ?? 'n'}-${eventCompletionKey(ev)}-${i}`}
              className="flex flex-col gap-1 rounded-lg border border-white/10 bg-black/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-white">{eventTitle(ev)}</p>
                <p className="text-xs text-white/50">{formatPreviewDate(ev.date, locale)}</p>
              </div>
              <span className="shrink-0 self-start rounded-md border border-white/15 bg-white/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white/60 sm:self-center">
                {eventTypeLabel(ev)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default WelcomeSchedulePreview;

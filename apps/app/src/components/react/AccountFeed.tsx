/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Activity feed for the Account page. Merges WorkoutPlayer sessions and AMRAP
 * session results, ordered by date. Placeholder for friend activity.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { getSessionHistory } from '@/lib/supabase/client/session-history';
import type { SessionHistoryItem } from '@/lib/supabase/client/session-history';
import { getAmrapSessionResults } from '@/lib/supabase/client/amrap-session-results';
import { fetchHandoffLogs } from '@/lib/supabase/client/workout-logs';
import { getProgramWithSchedule } from '@/lib/supabase/client/user-programs';
import type { ProgramSchedule } from '@/types/ai-program';

export type FeedItemType = 'program' | 'amrap' | 'timer';

export interface FeedItem {
  id: string;
  date: string;
  title: string;
  type: FeedItemType;
  durationSeconds?: number;
  durationMinutes?: number;
  link?: string;
  metadata?: { totalRounds?: number };
}

function parseWeekId(weekId: string): number {
  const n = parseInt(weekId.replace(/^week-/, ''), 10);
  return Number.isNaN(n) ? 1 : n;
}

async function resolveTitles(sessions: SessionHistoryItem[]): Promise<SessionHistoryItem[]> {
  const programIds = [...new Set(sessions.map((s) => s.programId))];
  const programMap = new Map<string | null, { title: string; schedule: ProgramSchedule[] }>();
  await Promise.all(
    programIds.map(async (id) => {
      const prog = await getProgramWithSchedule(id);
      if (prog) programMap.set(id, { title: prog.title, schedule: prog.schedule });
    })
  );

  return sessions.map((s) => {
    const prog = programMap.get(s.programId);
    if (!prog) return { ...s, workoutTitle: 'Workout', programTitle: undefined };
    const weekNum = parseWeekId(s.weekId);
    const week = prog.schedule.find((w) => w.weekNumber === weekNum);
    const idx = parseInt(s.workoutId, 10);
    const workoutTitle = week?.workouts?.[idx]?.title ?? 'Workout';
    return { ...s, workoutTitle, programTitle: prog.title };
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

const AccountFeed: React.FC = () => {
  const { user } = useAppContext();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.uid) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [sessionsRaw, amrapResults, handoffLogs] = await Promise.all([
        getSessionHistory(user.uid, 'all', 15),
        getAmrapSessionResults(user.uid, 15),
        fetchHandoffLogs(user.uid, 15),
      ]);
      const sessions = await resolveTitles(sessionsRaw);

      const programItems: FeedItem[] = sessions.map((s) => ({
        id: `program-${s.id}`,
        date: s.date,
        title: s.workoutTitle ?? 'Workout',
        type: 'program',
        durationSeconds: s.durationSeconds,
      }));

      const amrapItems: FeedItem[] = amrapResults.map((a) => ({
        id: `amrap-${a.id}`,
        date: a.completed_at.slice(0, 10),
        title: a.workout_list?.[0]?.trim() ?? 'AMRAP',
        type: 'amrap',
        durationMinutes: a.duration_minutes,
        link: `/amrap/with-friends/session/${a.session_id}`,
        metadata: { totalRounds: a.total_rounds },
      }));

      const timerItems: FeedItem[] = handoffLogs.map((log) => ({
        id: `timer-${log.id}`,
        date: log.date,
        title: log.workoutName,
        type: 'timer',
        durationSeconds: log.durationSeconds,
        metadata: log.rounds != null ? { totalRounds: log.rounds } : undefined,
      }));

      const merged = [...programItems, ...amrapItems, ...timerItems].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setItems(merged);
    } catch (e) {
      if (import.meta.env.DEV) console.error('[AccountFeed]', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user?.uid) {
    return (
      <p className="rounded-2xl border border-white/10 bg-black/20 p-6 text-center text-sm text-white/60">
        Sign in to see your activity.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-white/10 bg-black/20 font-mono text-[10px] uppercase text-white/40">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Your activity */}
      <section>
        <h3 className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-orange-light">
          Your activity
        </h3>
        {items.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center text-sm text-white/60">
            No workouts yet. Complete a workout or AMRAP session to see it here.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-2xl border border-white/10 bg-black/20 px-6 py-4 transition-colors hover:border-white/20"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-heading text-lg font-bold text-white">{item.title}</p>
                    <p className="font-mono text-[10px] text-white/50">
                      {formatDate(item.date)}
                      {item.durationSeconds != null && (
                        <> · {formatDuration(item.durationSeconds)}</>
                      )}
                      {item.durationMinutes != null && <> · {item.durationMinutes} min</>}
                      {item.metadata?.totalRounds != null && (
                        <> · {item.metadata.totalRounds} rounds</>
                      )}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase ${
                      item.type === 'amrap'
                        ? 'bg-orange-600/30 text-orange-400'
                        : item.type === 'timer'
                          ? 'bg-green-600/30 text-green-400'
                          : 'bg-white/10 text-white/70'
                    }`}
                  >
                    {item.type === 'amrap'
                      ? 'AMRAP'
                      : item.type === 'timer'
                        ? item.title
                        : 'Program'}
                  </span>
                </div>
                {item.link && (
                  <a
                    href={item.link}
                    className="text-orange-400 hover:text-orange-300 mt-2 inline-block text-xs font-medium"
                  >
                    View session →
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Friend activity placeholder */}
      <section>
        <h3 className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-orange-light">
          Friend activity
        </h3>
        <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-8 text-center">
          <p className="text-sm text-white/60">
            When you add friends, their workouts will appear here.
          </p>
        </div>
      </section>
    </div>
  );
};

export default AccountFeed;

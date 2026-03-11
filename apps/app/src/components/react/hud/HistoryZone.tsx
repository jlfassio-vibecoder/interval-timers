/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * History Zone: recent sessions feed, filter bar, session detail drawer, Do Again -> WorkoutPlayer.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import {
  getSessionHistory,
  type SessionFilter,
  type SessionHistoryItem,
} from '@/lib/supabase/client/session-history';
import {
  getAmrapSessionResults,
  type AmrapSessionResult,
} from '@/lib/supabase/client/amrap-session-results';

type FilterTab = 'all' | 'this_week' | 'this_month' | 'by_program';

function getAmrapWorkoutLabel(workoutList: string[]): string {
  return workoutList?.[0]?.trim() ?? 'AMRAP';
}
import { fetchUserPrograms, getProgramWithSchedule } from '@/lib/supabase/client/user-programs';
import SessionFeed from './SessionFeed';
import SessionDetailDrawer from './SessionDetailDrawer';
import WorkoutPlayer from '@/components/react/tracking/WorkoutPlayer';
import type { ProgramSchedule } from '@/types/ai-program';

type WorkoutFromSchedule = ProgramSchedule['workouts'][number];

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
    return {
      ...s,
      workoutTitle,
      programTitle: prog.title,
    };
  });
}

const HistoryZone: React.FC = () => {
  const { user } = useAppContext();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [programFilterId, setProgramFilterId] = useState<string | null>(null);
  const [programs, setPrograms] = useState<{ programId: string; title?: string }[]>([]);
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<SessionHistoryItem | null>(null);
  const [amrapResults, setAmrapResults] = useState<AmrapSessionResult[]>([]);
  const [amrapLoading, setAmrapLoading] = useState(true);
  const [workoutPlayer, setWorkoutPlayer] = useState<{
    workout: WorkoutFromSchedule;
    programId: string;
    weekId: string;
    workoutId: string;
  } | null>(null);

  const effectiveFilter: SessionFilter =
    filter === 'by_program' && programFilterId
      ? { programId: programFilterId }
      : filter === 'by_program'
        ? 'all'
        : filter;

  const loadSessions = useCallback(async () => {
    if (!user?.uid) {
      setSessions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const raw = await getSessionHistory(user.uid, effectiveFilter, 10);
      const withTitles = await resolveTitles(raw);
      setSessions(withTitles);
    } catch (e) {
      if (import.meta.env.DEV) console.error('[HistoryZone]', e);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, effectiveFilter]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!user?.uid) {
      setPrograms([]);
      return;
    }
    fetchUserPrograms(user.uid).then((list) =>
      setPrograms(list.map((p) => ({ programId: p.programId, title: p.title })))
    );
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setAmrapResults([]);
      setAmrapLoading(false);
      return;
    }
    setAmrapLoading(true);
    getAmrapSessionResults(user.uid, 10)
      .then(setAmrapResults)
      .catch(() => setAmrapResults([]))
      .finally(() => setAmrapLoading(false));
  }, [user?.uid]);

  const handleDoAgain = useCallback(
    (workout: WorkoutFromSchedule, programId: string, weekId: string, workoutId: string) => {
      setWorkoutPlayer({ workout, programId, weekId, workoutId });
    },
    []
  );

  return (
    <div>
      <h3 className="mb-3 font-heading text-lg font-black uppercase text-white">History</h3>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setFilter('all');
            setProgramFilterId(null);
          }}
          className={`rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase transition-colors ${
            filter === 'all'
              ? 'border-orange-light/60 bg-orange-light/20 text-orange-light'
              : 'border-white/20 bg-white/5 text-white/70 hover:bg-white/10'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => {
            setFilter('this_week');
            setProgramFilterId(null);
          }}
          className={`rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase transition-colors ${
            filter === 'this_week'
              ? 'border-orange-light/60 bg-orange-light/20 text-orange-light'
              : 'border-white/20 bg-white/5 text-white/70 hover:bg-white/10'
          }`}
        >
          This Week
        </button>
        <button
          type="button"
          onClick={() => {
            setFilter('this_month');
            setProgramFilterId(null);
          }}
          className={`rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase transition-colors ${
            filter === 'this_month'
              ? 'border-orange-light/60 bg-orange-light/20 text-orange-light'
              : 'border-white/20 bg-white/5 text-white/70 hover:bg-white/10'
          }`}
        >
          This Month
        </button>
        <div className="relative">
          <select
            value={filter === 'by_program' && programFilterId ? programFilterId : ''}
            onChange={(e) => {
              const v = e.target.value;
              if (v) {
                setFilter('by_program');
                setProgramFilterId(v);
              } else {
                setFilter('all');
                setProgramFilterId(null);
              }
            }}
            className="focus:ring-orange-light/40 appearance-none rounded-full border border-white/20 bg-white/5 px-3 py-1.5 pr-8 font-mono text-[10px] uppercase text-white/70 focus:outline-none focus:ring-1"
            aria-label="Filter by program"
          >
            <option value="">By Program</option>
            {programs.map((p) => (
              <option key={p.programId} value={p.programId}>
                {p.title ?? p.programId.slice(0, 8)}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/50">
            ▼
          </span>
        </div>
      </div>

      <SessionFeed sessions={sessions} onSessionClick={setSelectedSession} loading={loading} />

      {(amrapLoading || amrapResults.length > 0) && (
        <div className="mt-6">
          <h4 className="mb-2 font-mono text-xs font-medium uppercase text-white/60">
            AMRAP With Friends
          </h4>
          {amrapLoading ? (
            <p className="py-4 text-center text-sm text-white/50">Loading…</p>
          ) : (
            <ul className="space-y-2">
              {amrapResults.map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-white/90">
                    {getAmrapWorkoutLabel(r.workout_list)}
                  </span>
                  <span className="ml-2 text-white/60">
                    {r.total_rounds} rounds · {r.duration_minutes} min
                  </span>
                  <span className="ml-2 font-mono text-[10px] text-white/40">
                    {new Date(r.completed_at).toLocaleDateString()}
                  </span>
                  <a
                    href={`/amrap/with-friends/session/${r.session_id}`}
                    className="text-orange-400 ml-2 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View session
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {selectedSession && (
        <SessionDetailDrawer
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          onDoAgain={handleDoAgain}
        />
      )}

      {workoutPlayer && (
        <WorkoutPlayer
          workout={workoutPlayer.workout}
          programId={workoutPlayer.programId}
          weekId={workoutPlayer.weekId}
          workoutId={workoutPlayer.workoutId}
          onClose={() => setWorkoutPlayer(null)}
          onComplete={() => {
            setWorkoutPlayer(null);
            loadSessions();
          }}
        />
      )}
    </div>
  );
};

export default HistoryZone;

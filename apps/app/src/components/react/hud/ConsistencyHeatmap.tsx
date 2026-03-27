/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Zone 4: GitHub-style consistency heatmap (52 weeks × 7 days).
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { getWorkoutDates, type WorkoutDateEntry } from '@/lib/supabase/client/progress-analytics';

export interface ConsistencyHeatmapProps {
  hasAccess: boolean;
}

const WEEKS = 52;
const DAYS = 7;

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const ConsistencyHeatmap: React.FC<ConsistencyHeatmapProps> = ({ hasAccess }) => {
  const { user } = useAppContext();
  const [entries, setEntries] = useState<WorkoutDateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** When set (e.g. cell hover), overrides the default most-recent workout line below the grid. */
  const [activeDetail, setActiveDetail] = useState<{ date: string; title: string } | null>(null);

  useEffect(() => {
    if (!hasAccess || !user?.uid) {
      setLoading(false);
      setEntries([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    getWorkoutDates(user.uid, 365)
      .then(setEntries)
      .catch(() => {
        setEntries([]);
        setError('Could not load consistency heatmap.');
      })
      .finally(() => setLoading(false));
  }, [hasAccess, user?.uid]);

  useEffect(() => {
    setActiveDetail(null);
  }, [entries]);

  const dateToTitle = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of entries) m.set(e.date, e.workoutTitle ?? 'Workout');
    return m;
  }, [entries]);

  const workoutDates = useMemo(() => new Set(entries.map((e) => e.date)), [entries]);

  const mostRecentDetail = useMemo((): { date: string; title: string } | null => {
    if (!entries.length) return null;
    let best = entries[0];
    for (const e of entries) {
      if (e.date > best.date) best = e;
    }
    return { date: best.date, title: best.workoutTitle?.trim() || 'Workout' };
  }, [entries]);

  const displayDetail = activeDetail ?? mostRecentDetail;

  const grid = useMemo(() => {
    const end = new Date();
    const monday = getMondayOfWeek(end);
    monday.setDate(monday.getDate() - (WEEKS - 1) * 7);
    const out: { date: string; title: string }[][] = [];
    for (let rowIndex = 0; rowIndex < DAYS; rowIndex++) {
      const dayRow: { date: string; title: string }[] = [];
      for (let col = 0; col < WEEKS; col++) {
        const weekStart = new Date(monday);
        weekStart.setDate(weekStart.getDate() + col * 7);
        const d = new Date(weekStart);
        d.setDate(d.getDate() + rowIndex);
        const dateStr = toISO(d);
        dayRow.push({ date: dateStr, title: dateToTitle.get(dateStr) ?? '' });
      }
      out.push(dayRow);
    }
    return out;
  }, [dateToTitle]);

  if (!hasAccess) return null;

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl bg-white/5 font-mono text-[10px] uppercase text-white/40">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-xl bg-white/5 py-12 text-center font-mono text-[10px] uppercase italic text-white/40">
        {error}
      </p>
    );
  }

  const hasData = entries.length > 0;
  if (!hasData) {
    return (
      <p className="rounded-xl bg-white/5 py-12 text-center font-mono text-[10px] uppercase italic text-white/40">
        Log workouts to see your consistency
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div
        className="grid gap-0.5"
        style={{
          gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${DAYS}, minmax(0, 1fr))`,
          aspectRatio: `${WEEKS} / ${DAYS}`,
          maxHeight: '140px',
        }}
      >
        {grid.map((dayRow, row) =>
          dayRow.map((cell, col) => {
            const filled = workoutDates.has(cell.date);
            return (
              <div
                key={`${row}-${col}`}
                className={`rounded-sm transition-colors ${
                  filled ? 'bg-emerald-500/60' : 'bg-white/10'
                }`}
                style={{ minWidth: 2, minHeight: 2 }}
                onMouseEnter={() =>
                  setActiveDetail({
                    date: cell.date,
                    title: cell.title.trim() || (filled ? 'Workout' : 'No workout logged'),
                  })
                }
                role="img"
                aria-label={filled ? `Workout on ${cell.date}` : `No workout on ${cell.date}`}
              />
            );
          })
        )}
      </div>
      {displayDetail && (
        <div
          className="min-h-[2.5rem] rounded border border-white/20 bg-black/80 px-3 py-2 font-mono text-xs text-white/90"
          aria-live="polite"
        >
          <span className="text-white/70">{displayDetail.date}</span>
          {displayDetail.title ? (
            <span className="text-white/90"> — {displayDetail.title}</span>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default ConsistencyHeatmap;

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Recent sessions feed: rows with workout name, date, duration; expandable exercise/set preview.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { SessionHistoryItem } from '@/lib/supabase/client/session-history';
import type { ExerciseLog, SetLog } from '@/types/tracking';

export interface SessionFeedProps {
  sessions: SessionHistoryItem[];
  onSessionClick: (session: SessionHistoryItem) => void;
  loading?: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('default', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function SetRow({ set }: { set: SetLog }) {
  const weight = set.actualWeight > 0 ? `${set.actualWeight} lb` : '—';
  const reps = set.actualReps > 0 ? set.actualReps : '—';
  return (
    <tr className="border-b border-white/5 last:border-0">
      <td className="py-1.5 pr-2 font-mono text-[10px] text-white/50">{set.setNumber}</td>
      <td className="py-1.5 font-mono text-xs text-white/80">
        {weight} × {reps}
      </td>
      <td className="py-1.5">
        {set.completed ? (
          <span className="text-emerald-400" aria-label="Completed">
            ✓
          </span>
        ) : (
          <span className="text-white/30">—</span>
        )}
      </td>
    </tr>
  );
}

function ExerciseBlock({ exercise }: { exercise: ExerciseLog }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-1 font-mono text-[10px] font-medium uppercase text-white/70">
        {exercise.exerciseName}
      </p>
      <table className="w-full">
        <tbody>
          {exercise.sets.map((set, i) => (
            <SetRow key={i} set={set} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SessionFeed: React.FC<SessionFeedProps> = ({ sessions, onSessionClick, loading = false }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
    return <p className="font-mono text-[10px] uppercase text-white/40">Loading sessions…</p>;
  }

  if (sessions.length === 0) {
    return (
      <p className="font-mono text-[10px] text-white/50">
        No sessions yet. Complete a workout to see it here.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {sessions.map((session) => {
        const isExpanded = expandedId === session.id;
        return (
          <li
            key={session.id}
            className="overflow-hidden rounded-2xl border border-white/10 bg-white/5"
          >
            <div className="flex items-center gap-2 px-4 py-3">
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : session.id)}
                className="flex shrink-0 text-white/50 hover:text-white/80"
                aria-expanded={isExpanded}
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => onSessionClick(session)}
                className="-m-2 min-w-0 flex-1 rounded-lg p-2 text-left hover:bg-white/5"
              >
                <p className="truncate font-heading text-sm font-black text-white">
                  {session.workoutTitle ?? 'Workout'}
                </p>
                <p className="font-mono text-[10px] text-white/50">
                  {formatDate(session.date)} · {formatDuration(session.durationSeconds)}
                  {' · Effort — · Readiness —'}
                </p>
              </button>
            </div>
            {isExpanded && (
              <div className="border-t border-white/10 bg-black/20 px-4 py-3">
                {session.exercises.length === 0 ? (
                  <p className="font-mono text-[10px] text-white/40">No exercises logged</p>
                ) : (
                  session.exercises.map((ex, i) => <ExerciseBlock key={i} exercise={ex} />)
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};

export default SessionFeed;

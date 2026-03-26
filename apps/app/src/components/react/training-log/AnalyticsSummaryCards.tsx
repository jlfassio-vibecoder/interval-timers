/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Analytics summary cards: this week, this month, streak, most active day.
 */

import React, { useState, useCallback } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { HEALTH_GUIDELINE_WEEKLY_MINUTES } from '@/lib/training-log-constants';
import { warnIfBelowGuideline } from '@/lib/training-log-utils';
import { getProgressBgColorClass, getProgressTextColorClass } from '@/lib/progress-color-ramp';

export interface AnalyticsSummaryCardsProps {
  thisWeek: { totalMinutes: number; sessionCount: number };
  thisMonth: { totalMinutes: number; sessionCount: number };
  streak: number;
  mostActiveDay: string;
  goalMinutes?: number;
  /** When provided, shows edit goal control in This Week card. */
  onEditGoal?: (minutes: number) => Promise<void>;
}

const AnalyticsSummaryCards: React.FC<AnalyticsSummaryCardsProps> = ({
  thisWeek,
  thisMonth,
  streak,
  mostActiveDay,
  goalMinutes = HEALTH_GUIDELINE_WEEKLY_MINUTES,
  onEditGoal,
}) => {
  const [editingGoal, setEditingGoal] = useState(false);
  const [draftGoal, setDraftGoal] = useState(String(goalMinutes));
  const [saving, setSaving] = useState(false);

  const weekPct = Math.min(100, Math.round((thisWeek.totalMinutes / goalMinutes) * 100));
  const monthPct = Math.min(100, Math.round((thisMonth.totalMinutes / (goalMinutes * 4)) * 100));
  const weekProgressTextColorClass = getProgressTextColorClass(weekPct);
  const monthProgressTextColorClass = getProgressTextColorClass(monthPct);
  const weekProgressBarColorClass = getProgressBgColorClass(weekPct);
  const monthProgressBarColorClass = getProgressBgColorClass(monthPct);

  const handleStartEdit = useCallback(() => {
    setDraftGoal(String(goalMinutes));
    setEditingGoal(true);
  }, [goalMinutes]);

  const handleSaveGoal = useCallback(async () => {
    if (!onEditGoal) return;
    const n = Math.max(1, Math.min(999, parseInt(draftGoal, 10)));
    if (Number.isNaN(n) || n === goalMinutes) {
      setEditingGoal(false);
      setDraftGoal(String(goalMinutes));
      return;
    }
    setSaving(true);
    try {
      await onEditGoal(n);
      setEditingGoal(false);
      warnIfBelowGuideline(n);
    } catch {
      setDraftGoal(String(goalMinutes));
    } finally {
      setSaving(false);
    }
  }, [draftGoal, goalMinutes, onEditGoal]);

  const handleCancelEdit = useCallback(() => {
    setEditingGoal(false);
    setDraftGoal(String(goalMinutes));
  }, [goalMinutes]);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/50">This Week</p>
        <p className="mt-1 text-2xl font-bold text-white">
          {thisWeek.totalMinutes} <span className="text-base font-normal text-white/60">min</span>
        </p>
        <p className="mt-0.5 font-mono text-xs text-white/60">
          {thisWeek.sessionCount} session{thisWeek.sessionCount !== 1 ? 's' : ''}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all ${weekProgressBarColorClass}`}
            style={{ width: `${weekPct}%` }}
          />
        </div>
        <div
          className={`mt-1 flex items-center gap-1.5 font-mono text-[10px] ${weekProgressTextColorClass}`}
        >
          {editingGoal ? (
            <>
              <input
                type="number"
                min={1}
                max={999}
                value={draftGoal}
                onChange={(e) => setDraftGoal(e.target.value)}
                className="w-14 rounded border border-white/20 bg-white/5 px-1.5 py-0.5 text-white focus:border-orange-light focus:outline-none"
                aria-label="Weekly goal minutes"
                autoFocus
              />
              <span>min goal</span>
              <button
                type="button"
                onClick={handleSaveGoal}
                disabled={saving}
                className="rounded p-0.5 text-green-400 hover:bg-white/10 disabled:opacity-50"
                aria-label="Save goal"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={saving}
                className="rounded p-0.5 text-white/70 hover:bg-white/10 disabled:opacity-50"
                aria-label="Cancel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              <span>
                {weekPct}% of {goalMinutes} min goal
              </span>
              {onEditGoal && (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="rounded p-0.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Edit weekly goal"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/50">This Month</p>
        <p className="mt-1 text-2xl font-bold text-white">
          {thisMonth.totalMinutes} <span className="text-base font-normal text-white/60">min</span>
        </p>
        <p className="mt-0.5 font-mono text-xs text-white/60">
          {thisMonth.sessionCount} session{thisMonth.sessionCount !== 1 ? 's' : ''}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all ${monthProgressBarColorClass}`}
            style={{ width: `${monthPct}%` }}
          />
        </div>
        <p className={`mt-1 font-mono text-[10px] ${monthProgressTextColorClass}`}>
          ~{monthPct}% of monthly target
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/50">Streak</p>
        <p className="mt-1 text-2xl font-bold text-white">
          {streak}{' '}
          <span className="text-base font-normal text-white/60">week{streak !== 1 ? 's' : ''}</span>
        </p>
        <p className="mt-0.5 font-mono text-xs text-white/60">meeting {goalMinutes}+ min</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/50">
          Most Active Day
        </p>
        <p className="mt-1 text-2xl font-bold text-white">{mostActiveDay}</p>
        <p className="mt-0.5 font-mono text-xs text-white/60">highest avg activity</p>
      </div>
    </div>
  );
};

export default AnalyticsSummaryCards;

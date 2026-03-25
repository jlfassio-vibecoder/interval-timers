/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Main Training Log component: bubble grid, filters, workout detail modal.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { HEALTH_GUIDELINE_WEEKLY_MINUTES } from '@/lib/training-log-constants';
import { Download, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { trackEvent } from '@interval-timers/analytics';
import { useAppContext } from '@/contexts/AppContext';
import { warnIfBelowGuideline } from '@/lib/training-log-utils';
import { hasBaselineForMET, userProfileToProfileBaseline } from '@/lib/met';
import { getProfileHealthSummary } from '@/lib/profile-health-taxonomy';
import { useTrainingLogWeeks } from '@/hooks/useTrainingLogWeeks';
import {
  getCurrentWeekMondayISO,
  getTrainingLogLogsForExport,
} from '@/lib/supabase/client/training-log';
import { exportTrainingLogToCsv } from '@/lib/training-log-export';
import type { TrainingLogFilters } from '@/lib/training-log-filters';
import type { WorkoutLog } from '@/types';
import { supabase } from '@/lib/supabase/supabase-instance';
import FilterBar from './FilterBar';
import WeekRow, { DAY_LABELS } from './WeekRow';
import WorkoutSummaryModal from './WorkoutSummaryModal';
import TrainingLogAnalytics from './TrainingLogAnalytics';

function pickLogForModal(logs: WorkoutLog[], preferredMinutes?: number): WorkoutLog | null {
  if (logs.length === 0) return null;
  if (logs.length === 1) return logs[0];
  if (preferredMinutes == null) return logs[0];

  let best = logs[0];
  let bestDiff = Math.abs(Math.round((best.durationSeconds ?? 0) / 60) - preferredMinutes);
  for (let i = 1; i < logs.length; i++) {
    const min = Math.round((logs[i].durationSeconds ?? 0) / 60);
    const diff = Math.abs(min - preferredMinutes);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = logs[i];
    }
  }
  return best;
}

type TabId = 'log' | 'analytics';

const TrainingLog: React.FC = () => {
  const { user, setWeeklyGoalMinutes } = useAppContext();
  const [activeTab, setActiveTab] = useState<TabId>('log');
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [draftGoal, setDraftGoal] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);
  const [filters, setFilters] = useState<TrainingLogFilters>({});
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutLog | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [focusedWeekIndex, setFocusedWeekIndex] = useState(0);
  const [exportingCsv, setExportingCsv] = useState(false);
  const alignmentViewedTrackedRef = useRef(false);
  const weekCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const didScrollToCurrentWeek = useRef(false);

  const todayISO = useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    didScrollToCurrentWeek.current = false;
    alignmentViewedTrackedRef.current = false;
  }, [user?.uid]);

  const { weeks, loading, error, refetch } = useTrainingLogWeeks(user?.uid ?? null, 52, filters, 12);

  useEffect(() => {
    const handler = () => refetch();
    window.addEventListener('calendar:refresh', handler);
    return () => window.removeEventListener('calendar:refresh', handler);
  }, [refetch]);

  const handleWorkoutClick = useCallback((logs: WorkoutLog[], preferredMinutes?: number) => {
    const log = pickLogForModal(logs, preferredMinutes);
    setSelectedWorkout(log);
  }, []);

  const goalMinutes = user?.weeklyGoalMinutes ?? HEALTH_GUIDELINE_WEEKLY_MINUTES;

  const profileBaseline = userProfileToProfileBaseline(user);
  const showProfileNudge =
    user?.uid && profileBaseline && !hasBaselineForMET(profileBaseline);

  const healthSummary = useMemo(() => getProfileHealthSummary(user), [user]);

  const handleOpenGoalModal = useCallback(() => {
    setDraftGoal(String(goalMinutes));
    setGoalModalOpen(true);
  }, [goalMinutes]);

  const handleSaveGoal = useCallback(async () => {
    const n = Math.max(1, Math.min(999, parseInt(draftGoal, 10)));
    if (Number.isNaN(n)) return;
    setSavingGoal(true);
    try {
      await setWeeklyGoalMinutes(n);
      setGoalModalOpen(false);
      warnIfBelowGuideline(n);
    } catch {
      toast.error('Failed to update goal');
    } finally {
      setSavingGoal(false);
    }
  }, [draftGoal, setWeeklyGoalMinutes]);

  const handleExportCsv = useCallback(async () => {
    if (!user?.uid || exportingCsv) return;
    setExportingCsv(true);
    try {
      const logs = await getTrainingLogLogsForExport(user.uid, filters);
      const csv = exportTrainingLogToCsv(logs);
      const blob = new Blob([csv], { type: 'text/csv; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `training-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Training log exported');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExportingCsv(false);
    }
  }, [user?.uid, filters, exportingCsv]);

  useEffect(() => {
    weekCardRefs.current = weekCardRefs.current.slice(0, weeks.length);
  }, [weeks.length]);

  /** Initial scroll to current calendar week (once per user session until uid changes). */
  useEffect(() => {
    if (weeks.length === 0 || didScrollToCurrentWeek.current) return;
    const curMon = getCurrentWeekMondayISO();
    const idx = weeks.findIndex((w) => w.weekMonday === curMon);
    const targetIdx = idx >= 0 ? idx : Math.max(0, weeks.length - 1);
    didScrollToCurrentWeek.current = true;
    setFocusedWeekIndex(targetIdx);
    requestAnimationFrame(() => {
      weekCardRefs.current[targetIdx]?.scrollIntoView({
        behavior: 'auto',
        inline: 'center',
        block: 'nearest',
      });
    });
  }, [weeks]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (weeks.length === 0 || selectedWorkout) return;
      if (goalModalOpen) return;
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const next = Math.min(focusedWeekIndex + 1, weeks.length - 1);
        setFocusedWeekIndex(next);
        const el = weekCardRefs.current[next];
        el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        setTimeout(() => {
          el?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
        }, 100);
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = Math.max(focusedWeekIndex - 1, 0);
        setFocusedWeekIndex(prev);
        const el = weekCardRefs.current[prev];
        el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        setTimeout(() => {
          el?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
        }, 100);
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [weeks.length, focusedWeekIndex, selectedWorkout, goalModalOpen]);

  useEffect(() => {
    setFocusedWeekIndex((prev) => (weeks.length > 0 ? Math.min(prev, weeks.length - 1) : 0));
  }, [weeks.length]);

  useEffect(() => {
    if (activeTab !== 'analytics' || !user?.uid || alignmentViewedTrackedRef.current) return;
    alignmentViewedTrackedRef.current = true;
    void trackEvent(
      supabase,
      'training_log_alignment_viewed',
      { source: 'training_log_analytics' },
      { appId: 'app' }
    );
  }, [activeTab, user?.uid]);

  const focusedWeek = weeks[focusedWeekIndex];
  const liveRegionText = focusedWeek ? `Viewing week of ${focusedWeek.range}` : '';

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="font-mono text-sm text-white/50">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="font-mono text-sm text-red-400">
          Failed to load training log: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-white/10 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('log')}
            className={`rounded-md px-3 py-1.5 font-mono text-sm transition-colors ${
              activeTab === 'log'
                ? 'bg-orange-light/20 text-orange-light'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            Log
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`rounded-md px-3 py-1.5 font-mono text-sm transition-colors ${
              activeTab === 'analytics'
                ? 'bg-orange-light/20 text-orange-light'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            Analytics
          </button>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={exportingCsv}
          className="flex min-h-[44px] items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white/90 transition-colors hover:bg-white/10 disabled:opacity-50"
          aria-label="Export training log as CSV"
        >
          <Download className="h-4 w-4" aria-hidden />
          {exportingCsv ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {activeTab === 'log' && user?.uid && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-white/60">Weekly goal: {goalMinutes} min</span>
          <button
            type="button"
            onClick={handleOpenGoalModal}
            className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Edit weekly goal"
          >
            <Pencil className="h-3 w-3" aria-hidden />
            Edit
          </button>
        </div>
      )}

      {showProfileNudge && activeTab === 'log' && (
        <div className="mb-4 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3">
          <p className="text-sm text-white/90">
            <a href="/account/profile" className="font-medium text-orange-400 underline hover:text-orange-300">
              Complete your profile
            </a>
            {' '}— add date of birth, sex, weight, and height to unlock MET-based calorie estimates and a unified Total Work view.
          </p>
        </div>
      )}

      {healthSummary.showHealthReminder && activeTab === 'log' && user?.uid && (
        <div className="mb-4 rounded-lg border border-white/15 bg-white/5 px-4 py-3">
          <p className="text-sm text-white/80">
            Your profile includes health considerations. Use them as a reminder to choose appropriate
            intensity and modifications.{' '}
            <a
              href="/account/profile"
              className="font-medium text-orange-400 underline hover:text-orange-300"
            >
              Update profile
            </a>
          </p>
        </div>
      )}

      <FilterBar filters={filters} onFiltersChange={setFilters} />

      {activeTab === 'analytics' ? (
        user?.uid && (
          <TrainingLogAnalytics
            uid={user.uid}
            filters={filters}
            goalMinutes={user?.weeklyGoalMinutes ?? HEALTH_GUIDELINE_WEEKLY_MINUTES}
          />
        )
      ) : (
        <>
          {/* Live region for screen readers */}
          <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
            {liveRegionText}
          </div>

          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-white/40">
            Swipe or use arrow keys to move between weeks · Today’s week loads centered
          </p>

          {/* Horizontal week timeline: past ← → future (planned = dashed outline) */}
          <div
            className="-mx-2 flex max-h-[min(70vh,520px)] max-w-[100vw] snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth px-2 pb-2 sm:mx-0 sm:max-w-none sm:px-0"
            role="region"
            aria-label="Training weeks timeline"
          >
            {weeks.length === 0 ? (
              <div className="flex min-h-[40vh] min-w-full items-center justify-center">
                <p className="font-mono text-sm text-white/50">
                  No timeline to show. Sign in to load your training log.
                </p>
              </div>
            ) : (
              weeks.map((week, weekIndex) => (
                <div
                  key={week.weekMonday}
                  ref={(el) => {
                    weekCardRefs.current[weekIndex] = el;
                  }}
                  className="w-[min(100vw-2rem,36rem)] shrink-0 snap-center snap-always rounded-xl border border-white/10 bg-black/40 px-3 py-3 shadow-lg backdrop-blur-sm sm:w-[36rem]"
                >
                  <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-widest text-white/45">
                    {week.range}
                  </p>
                  <div className="mb-2 flex items-center gap-2">
                    <div className="grid flex-1 grid-cols-7 gap-1 sm:gap-2 md:gap-3">
                      {DAY_LABELS.map((label, i) => (
                        <div key={i} className="text-center font-mono text-xs text-white/50">
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>
                  <WeekRow
                    week={week}
                    weekIndex={weekIndex}
                    goalMinutes={user?.weeklyGoalMinutes ?? HEALTH_GUIDELINE_WEEKLY_MINUTES}
                    todayISO={todayISO}
                    onWorkoutClick={handleWorkoutClick}
                    hoveredKey={hoveredKey}
                    onHoverChange={setHoveredKey}
                    isFocused={weekIndex === focusedWeekIndex}
                    onFocus={() => setFocusedWeekIndex(weekIndex)}
                    inCard
                    hideRangeLabel
                  />
                </div>
              ))
            )}
          </div>
        </>
      )}

      <WorkoutSummaryModal
        workout={selectedWorkout}
        onClose={() => setSelectedWorkout(null)}
        profileBaseline={profileBaseline}
      />

      {/* Weekly goal edit modal */}
      {goalModalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="goal-modal-title"
        >
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0d0500] p-6 shadow-2xl">
            <h3
              id="goal-modal-title"
              className="mb-3 font-mono text-sm font-bold uppercase tracking-wider text-white"
            >
              Weekly goal (minutes)
            </h3>
            <p className="mb-4 font-mono text-[10px] text-white/60">
              Target minutes per week. Health organizations recommend ≥
              {HEALTH_GUIDELINE_WEEKLY_MINUTES} for general health.
            </p>
            <div className="mb-4 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={999}
                value={draftGoal}
                onChange={(e) => setDraftGoal(e.target.value)}
                className="w-20 rounded border border-white/20 bg-white/5 px-3 py-2 font-mono text-white focus:border-orange-light focus:outline-none"
                aria-label="Weekly goal minutes"
                autoFocus
              />
              <span className="font-mono text-sm text-white/50">min</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveGoal}
                disabled={savingGoal || Number.isNaN(parseInt(draftGoal, 10))}
                className="hover:bg-orange-400 flex-1 rounded-lg bg-orange-light py-2 font-mono text-sm font-bold text-black transition-colors disabled:opacity-50"
              >
                {savingGoal ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setGoalModalOpen(false)}
                disabled={savingGoal}
                className="flex-1 rounded-lg border border-white/20 py-2 font-mono text-sm text-white/80 transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainingLog;

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Program sidebar: Active Program Card, Trainer Card, All Programs list.
 * Replaces SavedProgramsSidebar. Uses activeProgramId from AppContext.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Calendar, TrendingUp, Play } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import {
  fetchUserPrograms,
  setProgramStartDate,
  getCurrentWeek,
} from '@/lib/supabase/client/user-programs';
import { getTodaysWorkout } from '@/lib/supabase/client/schedule-resolver';
import type { UserProgramAccess } from '@/types/user-program';
import SyncToCalendarModal from './SyncToCalendarModal';
import TrainerCard from './TrainerCard';
import WorkoutPlayer from '@/components/react/tracking/WorkoutPlayer';

export interface ProgramSidebarProps {
  isPaid: boolean;
  onOpenConversionModal: () => void;
  /** Called when user syncs/unsyncs a program so calendar can refresh. */
  onProgramsChange?: () => void;
}

type ProgramItem = UserProgramAccess & { programId: string; title?: string };

const ProgramSidebar: React.FC<ProgramSidebarProps> = ({
  isPaid,
  onOpenConversionModal,
  onProgramsChange,
}) => {
  const { user, activeProgramId, setActiveProgramId } = useAppContext();
  const [programs, setPrograms] = useState<ProgramItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncModalProgram, setSyncModalProgram] = useState<ProgramItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [continueLoading, setContinueLoading] = useState(false);
  const [workoutPlayer, setWorkoutPlayer] = useState<{
    workout: import('@/types/ai-program').ProgramSchedule['workouts'][number];
    weekNumber: number;
    workoutIndex: number;
    programId: string;
  } | null>(null);

  const loadPrograms = useCallback(async () => {
    if (!user?.uid) {
      setPrograms([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const accessList = await fetchUserPrograms(user.uid);
      setPrograms(
        accessList.map((a) => ({
          ...a,
          programId: a.programId,
          title: a.title ?? 'Program',
        }))
      );
    } catch (e) {
      if (import.meta.env.DEV) console.error('[ProgramSidebar] loadPrograms', e);
      setPrograms([]);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadPrograms();
  }, [loadPrograms]);

  const handleSaveStartDate = async (startDate: string) => {
    if (!user?.uid || !syncModalProgram) return;
    setSaving(true);
    try {
      await setProgramStartDate(user.uid, syncModalProgram.programId, startDate);
      await loadPrograms();
      onProgramsChange?.();
      setSyncModalProgram(null);
    } catch (e) {
      if (import.meta.env.DEV) console.error('[ProgramSidebar] setProgramStartDate', e);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFromCalendar = async () => {
    if (!user?.uid || !syncModalProgram) return;
    setSaving(true);
    try {
      await setProgramStartDate(user.uid, syncModalProgram.programId, null);
      await loadPrograms();
      onProgramsChange?.();
      setSyncModalProgram(null);
    } catch (e) {
      if (import.meta.env.DEV) console.error('[ProgramSidebar] remove startDate', e);
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = useCallback(async () => {
    if (!user?.uid || !activeProgramId) return;
    setContinueLoading(true);
    try {
      const result = await getTodaysWorkout(user.uid, activeProgramId);
      if (result) {
        setWorkoutPlayer({
          workout: result.workout,
          weekNumber: result.weekNumber,
          workoutIndex: result.workoutIndex,
          programId: activeProgramId,
        });
      }
    } catch (e) {
      if (import.meta.env.DEV) console.error('[ProgramSidebar] getTodaysWorkout', e);
    } finally {
      setContinueLoading(false);
    }
  }, [user?.uid, activeProgramId]);

  const activeProgram = programs.find((p) => p.programId === activeProgramId);
  const weekInfo = activeProgram
    ? getCurrentWeek(activeProgram.startDate ?? null, activeProgram.durationWeeks ?? 1)
    : null;

  const showLock = (source: ProgramItem['source']) =>
    !isPaid && source !== 'trainer_assigned' && source !== 'cohort';

  return (
    <div
      id="program-sidebar"
      className="space-y-6 rounded-xl border border-white/10 bg-black/20 p-6 backdrop-blur-sm"
    >
      <h4 className="border-orange-light/20 border-b pb-4 font-mono text-[10px] uppercase tracking-[0.4em] text-orange-light">
        Program
      </h4>

      {/* Active Program Card — always show container */}
      <section aria-label="Active program">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-white/50">
          Active program
        </p>
        {activeProgram && weekInfo ? (
          <div className="border-orange-light/20 rounded-xl border bg-white/5 p-4">
            <p className="mb-1 font-heading text-sm font-black uppercase tracking-tighter text-white">
              {activeProgram.title ?? 'Program'}
            </p>
            <p className="text-orange-light/80 mb-2 font-mono text-[10px] uppercase">
              Week {weekInfo.current} of {weekInfo.total}
            </p>
            <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-orange-light"
                style={{
                  width: `${Math.min(100, (weekInfo.current / weekInfo.total) * 100)}%`,
                }}
              />
            </div>
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase ${
                  weekInfo.status === 'complete'
                    ? 'bg-green-500/20 text-green-400'
                    : weekInfo.status === 'not_started'
                      ? 'bg-white/10 text-white/60'
                      : 'bg-orange-light/20 text-orange-light'
                }`}
              >
                {weekInfo.status === 'complete'
                  ? 'Complete'
                  : weekInfo.status === 'not_started'
                    ? 'Not Started'
                    : 'In Progress'}
              </span>
            </div>
            {activeProgram.startDate && (
              <p className="mb-3 font-mono text-[10px] text-white/50">
                Started {activeProgram.startDate}
              </p>
            )}
            <button
              type="button"
              onClick={handleContinue}
              disabled={continueLoading || weekInfo.status === 'not_started'}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-orange-light py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              {continueLoading ? 'Loading…' : 'Continue'}
            </button>
          </div>
        ) : (
          <p className="rounded-xl border border-white/5 bg-white/5 p-4 font-mono text-[10px] uppercase text-white/40">
            Tap a program below to set as active
          </p>
        )}
      </section>

      <TrainerCard />

      {/* All Programs List — always show container */}
      <section aria-label="All programs">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-white/50">
          All programs
        </p>
        {loading ? (
          <p className="font-mono text-[10px] uppercase text-white/40">Loading…</p>
        ) : programs.length === 0 ? (
          <p className="text-sm italic text-white/40">
            No programs yet. Unlock one from the Programs page.
          </p>
        ) : (
          <ul className="max-h-[40vh] space-y-4 overflow-y-auto">
            {programs.map((program) => {
              const isActive = program.programId === activeProgramId;
              const locked = showLock(program.source);
              return (
                <li
                  key={program.programId}
                  className={`rounded-xl border p-4 transition-colors ${
                    isActive ? 'border-orange-light/40 bg-white/10' : 'border-white/5 bg-white/5'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveProgramId(program.programId)}
                    className="mb-3 w-full text-left font-heading text-sm font-black uppercase tracking-tighter text-white hover:underline"
                  >
                    {program.title ?? 'Program'}
                  </button>
                  {program.startDate && (
                    <p className="text-orange-light/80 mb-2 font-mono text-[10px] uppercase">
                      Calendar: starts {program.startDate}
                    </p>
                  )}
                  <div className="flex flex-col gap-2">
                    {locked ? (
                      <>
                        <button
                          type="button"
                          onClick={onOpenConversionModal}
                          className="hover:border-orange-light/30 flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 py-2.5 font-mono text-[10px] uppercase tracking-widest text-white/60 transition-colors hover:text-orange-light"
                          title="Upgrade to unlock"
                        >
                          <Lock className="h-3.5 w-3.5" />
                          Sync to Calendar
                        </button>
                        <button
                          type="button"
                          onClick={onOpenConversionModal}
                          className="hover:border-orange-light/30 flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 py-2.5 font-mono text-[10px] uppercase tracking-widest text-white/60 transition-colors hover:text-orange-light"
                          title="Upgrade to unlock"
                        >
                          <Lock className="h-3.5 w-3.5" />
                          Track Progress
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setSyncModalProgram(program)}
                          className="flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 py-2.5 font-mono text-[10px] uppercase tracking-widest text-white transition-colors hover:bg-white/10"
                        >
                          <Calendar className="h-3.5 w-3.5" />
                          {program.startDate ? 'Change date' : 'Sync to Calendar'}
                        </button>
                        <a
                          href={`/programs/${program.programId}`}
                          className="flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 py-2.5 font-mono text-[10px] uppercase tracking-widest text-white transition-colors hover:bg-white/10"
                        >
                          <TrendingUp className="h-3.5 w-3.5" />
                          Track Progress
                        </a>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <SyncToCalendarModal
        isOpen={!!syncModalProgram}
        onClose={() => setSyncModalProgram(null)}
        programId={syncModalProgram?.programId ?? ''}
        programName={syncModalProgram?.title ?? ''}
        currentStartDate={syncModalProgram?.startDate}
        onSave={handleSaveStartDate}
        onRemove={syncModalProgram?.startDate ? handleRemoveFromCalendar : undefined}
        saving={saving}
      />

      {workoutPlayer && (
        <WorkoutPlayer
          workout={workoutPlayer.workout}
          programId={workoutPlayer.programId}
          weekId={`week-${workoutPlayer.weekNumber}`}
          workoutId={String(workoutPlayer.workoutIndex)}
          onClose={() => setWorkoutPlayer(null)}
          onComplete={() => setWorkoutPlayer(null)}
        />
      )}
    </div>
  );
};

export default ProgramSidebar;

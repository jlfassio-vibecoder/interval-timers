/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Public program sales view: Week 1 free, Weeks 2+ locked behind paywall.
 * Uses same Deployment Timeline and Deployment Grid as HUB.
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Play, Award } from 'lucide-react';
import type { Exercise } from '@/types';
import type { ProgramPreviewData } from '@/types/ai-program';
import type { DeploymentWorkoutCard } from '@/types/deployment';
import { getExerciseDetails } from '@/data/exercises';
import { getGeneratedExercises } from '@/lib/supabase/client/generated-exercises';
import type { GeneratedExercise } from '@/types/generated-exercise';
import type { ExtendedBiomechanics } from '@/components/react/ExerciseDetailModal';
import { buildApprovedExerciseMaps, normalizeExerciseName } from '@/lib/approved-exercise-maps';
import ExerciseDetailModal from '@/components/react/ExerciseDetailModal';
import { WEEK_LABELS } from '@/types/deployment';
import DeploymentTimeline from '../DeploymentTimeline';
import DeploymentGrid, { DEFAULT_WORKOUT_IMAGE } from '../DeploymentGrid';
import WorkoutDetailModal from '@/components/react/WorkoutDetailModal';
import { mapProgramWorkoutToArtist } from '@/lib/map-program-workout-to-artist';
import { getExercisesFromWorkout } from '@/lib/program-schedule-utils';
import { formatLandingPageMarkdown } from '@/lib/format-landing-page-markdown';
import { LANDING_DESCRIPTION_CLASS } from './landing-description-styles';

export interface ProgramSalesViewProps {
  program: ProgramPreviewData;
}

function difficultyToIntensity(d: string | undefined): number {
  if (d === 'advanced') return 5;
  if (d === 'intermediate') return 3;
  return 2;
}

type MissionParamsWorkout = {
  workout: ProgramPreviewData['previewWeek']['workouts'][number];
  workoutIndex: number;
};

const ProgramSalesView: React.FC<ProgramSalesViewProps> = ({ program }) => {
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [missionParamsWorkout, setMissionParamsWorkout] = useState<MissionParamsWorkout | null>(
    null
  );
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [selectedExerciseExtendedBiomechanics, setSelectedExerciseExtendedBiomechanics] =
    useState<ExtendedBiomechanics | null>(null);
  const [selectedExerciseSlug, setSelectedExerciseSlug] = useState<string | null>(null);
  const [unlockLoading, setUnlockLoading] = useState(false);

  const approvedExercisesMapRef = useRef<Map<string, Exercise>>(new Map());
  const approvedExtendedBiomechanicsMapRef = useRef<Map<string, ExtendedBiomechanics>>(new Map());
  const approvedExerciseSlugByNameRef = useRef<Map<string, string>>(new Map());
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const { metadata, previewWeek, totalWeeks } = program;
  const lockedWeeksCount = Math.max(0, totalWeeks - 1);
  const intensity = difficultyToIntensity(metadata.difficulty);

  const week1Cards = useMemo((): DeploymentWorkoutCard[] => {
    return previewWeek.workouts.map((workout, i) => ({
      id: `w1-${i}`,
      name: workout.title || `Workout ${i + 1}`,
      genre: '', // Preview text (e.g. warm-up/cool-down) not shown on cards
      image: DEFAULT_WORKOUT_IMAGE,
      day: `Day ${i + 1}`,
      intensity,
    }));
  }, [previewWeek.workouts, intensity]);

  // Load approved exercises for unified resolution (canonical data + slug for "View full page")
  useEffect(() => {
    let cancelled = false;
    getGeneratedExercises('approved')
      .then((list) => {
        if (cancelled) return;
        const { exerciseMap, extendedMap, slugMap } = buildApprovedExerciseMaps(
          list as GeneratedExercise[]
        );
        approvedExercisesMapRef.current = exerciseMap;
        approvedExtendedBiomechanicsMapRef.current = extendedMap;
        approvedExerciseSlugByNameRef.current = slugMap;
      })
      .catch(() => {
        if (!cancelled) {
          approvedExercisesMapRef.current = new Map();
          approvedExtendedBiomechanicsMapRef.current = new Map();
          approvedExerciseSlugByNameRef.current = new Map();
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUnlock = async () => {
    setUnlockError(null);
    setUnlockLoading(true);
    try {
      const res = await fetch('/api/programs/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ programId: metadata.id }),
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setUnlockError('Please log in to unlock this program.');
        return;
      }
      setUnlockError(data.error || 'Could not unlock; try again.');
    } catch {
      setUnlockError('Could not unlock; try again.');
    } finally {
      setUnlockLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      {/* Hero */}
      <header className="mb-12">
        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <a
            href="/programs"
            className="shrink-0 rounded-full border border-white/10 bg-white/5 px-8 py-3 font-mono text-xs font-bold uppercase tracking-widest transition-all hover:bg-white/20"
          >
            Terminate Session
          </a>
        </div>
        <h1 className="mb-4 font-heading text-3xl font-bold text-white md:text-4xl">
          {metadata.title || 'Untitled Program'}
        </h1>
        <div
          className={LANDING_DESCRIPTION_CLASS}
          dangerouslySetInnerHTML={{
            __html: formatLandingPageMarkdown(metadata.description || 'No description.'),
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setSelectedWeek(1)}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-light px-5 py-3 font-bold uppercase tracking-wider text-black transition hover:bg-white"
          >
            <Play className="h-5 w-5" />
            Start Week 1 (Free)
          </button>
          <span className="rounded bg-white/10 px-3 py-1 text-sm text-white/80">
            {metadata.durationWeeks} Weeks • {metadata.difficulty}
          </span>
        </div>
      </header>

      {/* Deployment Timeline + Grid (same as HUB) */}
      <section id="curriculum" className="mb-12">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-9">
            <AnimatePresence mode="wait">
              {selectedWeek === null ? (
                <motion.div
                  key="current-mission"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="group relative"
                >
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-orange-light to-orange-dark opacity-20 blur-2xl transition-opacity group-hover:opacity-30" />
                  <div className="relative rounded-3xl border border-white/10 bg-black/40 p-10 backdrop-blur-md">
                    <div className="mb-8 flex items-start justify-between">
                      <div>
                        <span className="mb-2 block font-mono text-xs uppercase tracking-[0.4em] text-orange-light">
                          Current Mission
                        </span>
                        <h3 className="font-heading text-3xl font-black uppercase text-white">
                          {metadata.title || 'Untitled Program'}
                        </h3>
                        <p className="mt-1 font-mono text-xs uppercase text-white/50">
                          Week 1 • Start with the workouts below
                        </p>
                      </div>
                      <Award className="h-10 w-10 text-orange-light" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedWeek(1)}
                      className="flex w-full items-center justify-center gap-3 rounded-xl bg-white py-5 text-sm font-black uppercase tracking-widest text-black transition-all hover:bg-orange-light"
                    >
                      <Play className="h-5 w-5" /> View Week 1
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="week-workouts"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <DeploymentGrid
                    title="Week 1 Workouts"
                    subtitle="Deployment Grid"
                    workouts={week1Cards}
                    onSelectWorkout={(card) => {
                      const match = card.id.match(/^w1-(\d+)$/);
                      const i = match ? parseInt(match[1], 10) : 0;
                      const workout = previewWeek.workouts[i];
                      if (workout) {
                        setMissionParamsWorkout({ workout, workoutIndex: i });
                      }
                    }}
                    backLabel="Back"
                    onBack={() => setSelectedWeek(null)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="space-y-6 lg:col-span-3">
            <DeploymentTimeline
              weeks={totalWeeks}
              unlockedWeeks={[1]}
              selectedWeek={selectedWeek}
              onSelectWeek={setSelectedWeek}
              weekLabels={WEEK_LABELS}
            />
          </div>
        </div>
      </section>

      {missionParamsWorkout != null && (
        <WorkoutDetailModal
          workout={mapProgramWorkoutToArtist(missionParamsWorkout.workout, {
            day: `Session ${missionParamsWorkout.workoutIndex + 1}`,
            intensity,
            id: `w1-${missionParamsWorkout.workoutIndex}`,
            image: DEFAULT_WORKOUT_IMAGE,
          })}
          onClose={() => setMissionParamsWorkout(null)}
          onLogWorkout={() => {
            // Sales view: sign-in / unlock flow; no WorkoutPlayer
            setMissionParamsWorkout(null);
            handleUnlock();
          }}
          onSelectExercise={(name) => {
            const normalized = normalizeExerciseName(name);
            const approvedMap = approvedExercisesMapRef.current;
            const extendedMap = approvedExtendedBiomechanicsMapRef.current;
            const slugMap = approvedExerciseSlugByNameRef.current;
            // 1. Approved canonical by exerciseName, then by exerciseQuery fallback
            let fromApproved = approvedMap.get(normalized);
            let matchKey = normalized;
            if (!fromApproved) {
              const block = getExercisesFromWorkout(missionParamsWorkout.workout).find(
                (b) => normalizeExerciseName(b.exerciseName) === normalized
              );
              const query = block?.exerciseQuery?.trim();
              if (query) {
                const queryNorm = normalizeExerciseName(query);
                fromApproved = approvedMap.get(queryNorm);
                if (fromApproved) matchKey = queryNorm;
              }
            }
            if (fromApproved) {
              setSelectedExercise(fromApproved);
              setSelectedExerciseExtendedBiomechanics(extendedMap.get(matchKey) ?? null);
              setSelectedExerciseSlug(slugMap.get(matchKey) ?? null);
              return;
            }
            // 2. Warmup block (block-specific instructions)
            const fromWarmup = missionParamsWorkout.workout.warmupBlocks?.find(
              (b) => normalizeExerciseName(b.exerciseName) === normalized
            );
            if (fromWarmup) {
              setSelectedExercise({
                name: fromWarmup.exerciseName,
                images: [],
                instructions: fromWarmup.instructions ?? [],
              });
              setSelectedExerciseExtendedBiomechanics(null);
              setSelectedExerciseSlug(null);
              return;
            }
            // 3. Static fallback
            setSelectedExerciseSlug(null);
            setSelectedExerciseExtendedBiomechanics(null);
            const ex = getExerciseDetails(name);
            if (ex) setSelectedExercise(ex);
          }}
        />
      )}

      <ExerciseDetailModal
        exercise={selectedExercise}
        onClose={() => {
          setSelectedExercise(null);
          setSelectedExerciseExtendedBiomechanics(null);
          setSelectedExerciseSlug(null);
        }}
        extendedBiomechanics={selectedExerciseExtendedBiomechanics}
        exerciseSlug={selectedExerciseSlug}
      />

      {/* Unlock CTA */}
      {lockedWeeksCount > 0 && (
        <div className="border-orange-light/30 bg-orange-light/10 rounded-xl border p-6 text-center">
          <p className="mb-4 font-medium text-white">
            Get access to all {totalWeeks} weeks and full workout details.
          </p>
          {unlockError && <p className="mb-3 text-sm text-red-300">{unlockError}</p>}
          <button
            type="button"
            onClick={handleUnlock}
            disabled={unlockLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-light px-6 py-3 font-bold uppercase tracking-wider text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Lock className="h-5 w-5" />
            {unlockLoading ? 'Unlocking…' : `Unlock Full ${totalWeeks}-Week Program`}
          </button>
        </div>
      )}
    </div>
  );
};

export default ProgramSalesView;

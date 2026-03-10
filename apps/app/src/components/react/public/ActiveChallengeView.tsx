/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Active challenge view: full challenge for owners (all weeks unlocked).
 * Includes milestones/check-in UI.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, Flag } from 'lucide-react';
import type { Exercise } from '@/types';
import type { ChallengeTemplate, ChallengeMilestone } from '@/types/ai-challenge';
import type { ProgramSchedule } from '@/types/ai-program';
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
import WorkoutPlayer from '@/components/react/tracking/WorkoutPlayer';
import { mapProgramWorkoutToArtist } from '@/lib/map-program-workout-to-artist';
import { getExercisesFromWorkout } from '@/lib/program-schedule-utils';

export interface ActiveChallengeViewProps {
  challenge: ChallengeTemplate;
  challengeId?: string;
}

type ActiveWorkout = {
  week: ProgramSchedule;
  workout: ProgramSchedule['workouts'][number];
  workoutIndex: number;
};

type MissionParamsWorkout = {
  week: ProgramSchedule;
  workout: ProgramSchedule['workouts'][number];
  workoutIndex: number;
};

function difficultyToIntensity(d: string | undefined): number {
  if (d === 'advanced') return 5;
  if (d === 'intermediate') return 3;
  return 2;
}

const ActiveChallengeView: React.FC<ActiveChallengeViewProps> = ({ challenge, challengeId }) => {
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [missionParamsWorkout, setMissionParamsWorkout] = useState<MissionParamsWorkout | null>(
    null
  );
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [selectedExerciseExtendedBiomechanics, setSelectedExerciseExtendedBiomechanics] =
    useState<ExtendedBiomechanics | null>(null);
  const [selectedExerciseSlug, setSelectedExerciseSlug] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const approvedExercisesMapRef = useRef<Map<string, Exercise>>(new Map());
  const approvedExtendedBiomechanicsMapRef = useRef<Map<string, ExtendedBiomechanics>>(new Map());
  const approvedExerciseSlugByNameRef = useRef<Map<string, string>>(new Map());

  const {
    title,
    description,
    difficulty,
    durationWeeks,
    theme,
    milestones = [],
    schedule,
  } = challenge;
  const intensity = difficultyToIntensity(difficulty);
  const unlockedWeeks = useMemo(
    () => Array.from({ length: durationWeeks }, (_, i) => i + 1),
    [durationWeeks]
  );

  const selectedWeekSchedule = useMemo(() => {
    if (selectedWeek == null) return null;
    return schedule.find((s) => s.weekNumber === selectedWeek) ?? null;
  }, [schedule, selectedWeek]);

  const selectedWeekCards = useMemo((): DeploymentWorkoutCard[] => {
    if (!selectedWeekSchedule) return [];
    return selectedWeekSchedule.workouts.map((workout, i) => ({
      id: `week-${selectedWeekSchedule.weekNumber}-${i}`,
      name: workout.title || `Workout ${i + 1}`,
      genre: '',
      image: DEFAULT_WORKOUT_IMAGE,
      day: `Day ${i + 1}`,
      intensity,
    }));
  }, [selectedWeekSchedule, intensity]);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(t);
  }, [toastMessage]);

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

  const handleSelectWorkout = (card: DeploymentWorkoutCard) => {
    if (!selectedWeekSchedule) return;
    const match = card.id.match(/^week-(\d+)-(\d+)$/);
    const workoutIndex = match ? parseInt(match[2], 10) : 0;
    const workout = selectedWeekSchedule.workouts[workoutIndex];
    if (workout) {
      setMissionParamsWorkout({
        week: selectedWeekSchedule,
        workout,
        workoutIndex,
      });
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <a
          href="/challenges"
          className="shrink-0 rounded-full border border-white/10 bg-white/5 px-8 py-3 font-mono text-xs font-bold uppercase tracking-widest transition-all hover:bg-white/20"
        >
          Back to Challenges
        </a>
      </div>

      {toastMessage && (
        <div
          className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-orange-light px-6 py-3 font-bold text-black shadow-lg"
          role="status"
        >
          {toastMessage}
        </div>
      )}

      {missionParamsWorkout != null && (
        <WorkoutDetailModal
          workout={mapProgramWorkoutToArtist(missionParamsWorkout.workout, {
            day: `Session ${missionParamsWorkout.workoutIndex + 1}`,
            intensity,
            id: `week-${missionParamsWorkout.week.weekNumber}-${missionParamsWorkout.workoutIndex}`,
            image: DEFAULT_WORKOUT_IMAGE,
          })}
          onClose={() => setMissionParamsWorkout(null)}
          onLogWorkout={() => {
            setActiveWorkout({
              week: missionParamsWorkout.week,
              workout: missionParamsWorkout.workout,
              workoutIndex: missionParamsWorkout.workoutIndex,
            });
            setMissionParamsWorkout(null);
          }}
          onOpenPlayer={() => {
            setActiveWorkout({
              week: missionParamsWorkout.week,
              workout: missionParamsWorkout.workout,
              workoutIndex: missionParamsWorkout.workoutIndex,
            });
            setMissionParamsWorkout(null);
          }}
          onSelectExercise={(name) => {
            const normalized = normalizeExerciseName(name);
            const approvedMap = approvedExercisesMapRef.current;
            const extendedMap = approvedExtendedBiomechanicsMapRef.current;
            const slugMap = approvedExerciseSlugByNameRef.current;
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

      {activeWorkout != null && challengeId && (
        <WorkoutPlayer
          workout={activeWorkout.workout}
          programId={challengeId}
          weekId={`week-${activeWorkout.week.weekNumber}`}
          workoutId={String(activeWorkout.workoutIndex)}
          onClose={() => setActiveWorkout(null)}
          onComplete={() => {
            setActiveWorkout(null);
            setToastMessage('Workout Saved!');
          }}
        />
      )}

      <header className="mb-12">
        <div className="mb-3 flex items-center gap-2">
          <span className="bg-orange-light/20 rounded px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-orange-light">
            Active Challenge
          </span>
          {theme && (
            <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/80">{theme}</span>
          )}
        </div>
        <h1 className="mb-4 font-heading text-3xl font-bold text-white md:text-4xl">
          {title || 'Untitled Challenge'}
        </h1>
        <p className="mb-6 text-lg text-white/80">{description || 'No description.'}</p>
        <span className="rounded bg-white/10 px-3 py-1 text-sm text-white/80">
          {durationWeeks} Weeks • {difficulty}
        </span>
      </header>

      {milestones.length > 0 && (
        <section className="mb-12 rounded-xl border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
          <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-bold text-white">
            <Flag className="h-5 w-5 text-orange-light" />
            Milestones
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {milestones
              .slice()
              .sort((a: ChallengeMilestone, b: ChallengeMilestone) => a.week - b.week)
              .map((m, i) => (
                <div key={i} className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="bg-orange-light/20 rounded px-2 py-0.5 text-xs font-medium text-orange-light">
                      Week {m.week}
                    </span>
                    <span className="font-medium text-white">{m.label}</span>
                  </div>
                  {m.checkInPrompt && <p className="text-sm text-white/70">{m.checkInPrompt}</p>}
                </div>
              ))}
          </div>
        </section>
      )}

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
                          {title || 'Untitled Challenge'}
                        </h3>
                        <p className="mt-1 font-mono text-xs uppercase text-white/50">
                          Select a week from the timeline
                        </p>
                      </div>
                      <Award className="h-10 w-10 text-orange-light" />
                    </div>
                    <p className="text-sm text-white/60">
                      All {durationWeeks} weeks are unlocked. Choose a week to view its workouts and
                      start a session.
                    </p>
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
                    title={`Week ${selectedWeek} Workouts`}
                    subtitle="Deployment Grid"
                    workouts={selectedWeekCards}
                    onSelectWorkout={handleSelectWorkout}
                    backLabel="Back"
                    onBack={() => setSelectedWeek(null)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="space-y-6 lg:col-span-3">
            <DeploymentTimeline
              weeks={durationWeeks}
              unlockedWeeks={unlockedWeeks}
              selectedWeek={selectedWeek}
              onSelectWeek={setSelectedWeek}
              weekLabels={WEEK_LABELS}
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export default ActiveChallengeView;

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, Timer, ZapOff, ClipboardList, Play } from 'lucide-react';
import type { Artist, OnSelectExercise, WorkoutComponent, WorkoutDetail } from '@/types';
import type { WorkoutInSet } from '@/types/ai-workout';
import { parsePhaseDurationMinutes } from '@/lib/parse-phase-duration';
import { isHIITWorkout, workoutInSetToHIITWorkoutData } from '@/lib/hiit-workout-data';
import IntensityBars from './IntensityBars';
import ExerciseCard from './ExerciseCard';
import DynamicHIITInterval from './DynamicHIITInterval';

const WORKOUT_DETAIL_PHASE_KEYS: (keyof WorkoutDetail)[] = [
  'warmup',
  'main',
  'finisher',
  'cooldown',
];

function isWorkoutComponent(v: unknown): v is WorkoutComponent {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.title === 'string' &&
    typeof o.duration === 'string' &&
    Array.isArray(o.exercises) &&
    o.exercises.every((e): e is string => typeof e === 'string')
  );
}

interface PhaseColor {
  text: string;
  bg: string;
  shadow: string;
}

const PHASE_COLORS: PhaseColor[] = [
  { text: 'text-orange-light', bg: 'bg-orange-light', shadow: 'shadow-[#ffbf00]' },
  { text: 'text-orange-500', bg: 'bg-orange-500', shadow: 'shadow-orange-500' },
  { text: 'text-red-600', bg: 'bg-red-600', shadow: 'shadow-red-600' },
  { text: 'text-white', bg: 'bg-white', shadow: 'shadow-white' },
];

function getPhaseColor(index: number): PhaseColor {
  return PHASE_COLORS[index] ?? PHASE_COLORS[0];
}

interface WorkoutDetailModalProps {
  workout: Artist | null;
  /** When provided and workout is HIIT (timer schema), shows "Launch Interval Timer" and enables Dynamic Protocol Engine. */
  rawWorkout?: WorkoutInSet | null;
  onClose: () => void;
  onLogWorkout: () => void;
  /** When provided, shows a mobile-friendly button below Mission Parameters that opens the WorkoutPlayer overlay. */
  onOpenPlayer?: () => void;
  onSelectExercise?: OnSelectExercise;
}

const WorkoutDetailModal: React.FC<WorkoutDetailModalProps> = ({
  workout,
  rawWorkout,
  onClose,
  onLogWorkout,
  onOpenPlayer,
  onSelectExercise,
}) => {
  const reduceMotion = useReducedMotion();
  const [heroImageError, setHeroImageError] = useState(false);
  const [showHIITTimer, setShowHIITTimer] = useState(false);

  useEffect(() => {
    setHeroImageError(false);
  }, [workout?.id, workout?.image]);

  useEffect(() => {
    setShowHIITTimer(false);
  }, [workout?.id, rawWorkout]);

  const hiitWorkoutData = useMemo(() => {
    if (!rawWorkout) return null;
    try {
      return workoutInSetToHIITWorkoutData(rawWorkout);
    } catch (error) {
      // Defensive: malformed rawWorkout (e.g. unexpected API shape) must not crash the modal.
      console.error(
        '[WorkoutDetailModal] Failed to transform rawWorkout to HIIT workout data',
        error
      );
      return null;
    }
  }, [rawWorkout]);
  const isHIIT = Boolean(rawWorkout && isHIITWorkout(rawWorkout));

  if (!workout) return null;

  const detail = workout.workoutDetail;
  const phaseEntries: { key: string; block: WorkoutComponent }[] = [];
  for (const key of WORKOUT_DETAIL_PHASE_KEYS) {
    const blockValue = detail?.[key];
    if (!isWorkoutComponent(blockValue)) continue;
    if (blockValue.exercises.length === 0 && blockValue.title.trim() === '') continue;
    phaseEntries.push({ key, block: blockValue });
  }
  const phaseCount = phaseEntries.length;
  const totalMinutesFromPhases = phaseEntries.reduce(
    (sum, entry) => sum + parsePhaseDurationMinutes(entry.block.duration),
    0
  );
  const targetVolumeMinutes =
    totalMinutesFromPhases > 0 ? totalMinutesFromPhases : (workout.targetVolumeMinutes ?? 45);
  const windowMinutes =
    totalMinutesFromPhases > 0 ? totalMinutesFromPhases : (workout.windowMinutes ?? 45);

  return (
    <AnimatePresence>
      {workout && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[120] cursor-auto overflow-y-auto bg-black/95 backdrop-blur-3xl"
        >
          <div className="flex min-h-full items-start justify-center pb-10 pt-20 md:pb-10 md:pt-20">
            {showHIITTimer && hiitWorkoutData ? (
              <div
                className="mx-4 flex min-h-[80vh] w-full max-w-7xl flex-col overflow-hidden rounded-[3rem] border border-white/10 bg-bg-dark shadow-[0_50px_100px_rgba(0,0,0,0.8)]"
                onClick={(e) => e.stopPropagation()}
              >
                <DynamicHIITInterval
                  workout={hiitWorkoutData}
                  onClose={() => setShowHIITTimer(false)}
                />
              </div>
            ) : (
              <motion.div
                initial={{ scale: 0.9, y: 40 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 40 }}
                transition={reduceMotion ? { duration: 0 } : undefined}
                onClick={(e) => e.stopPropagation()}
                className="relative mx-4 flex w-full max-w-7xl flex-col overflow-hidden rounded-[3rem] border border-white/10 bg-bg-dark shadow-[0_50px_100px_rgba(0,0,0,0.8)] md:my-0"
              >
                {/* min-h-72 is in Tailwind's default spacing scale (18rem); kept to avoid hero cutoff on small viewports. */}
                <div className="relative min-h-72 w-full shrink-0 md:h-[32rem]">
                  {!heroImageError ? (
                    <img
                      src={workout.image}
                      alt={workout.name}
                      className="h-full w-full object-cover opacity-40 grayscale transition-opacity group-hover:opacity-60"
                      onError={() => setHeroImageError(true)}
                    />
                  ) : (
                    <div className="h-full w-full bg-bg-dark" aria-hidden />
                  )}
                  <div className="via-bg-dark/40 absolute inset-0 bg-gradient-to-t from-bg-dark to-transparent" />

                  <button
                    onClick={onClose}
                    className="absolute right-10 top-10 z-20 rounded-full border border-white/10 bg-black/50 p-5 text-white backdrop-blur-md transition-all hover:bg-white hover:text-black"
                  >
                    <X className="h-6 w-6" />
                  </button>

                  <div className="absolute bottom-8 left-8 right-8 md:bottom-12 md:left-12 md:right-12">
                    <div className="flex flex-col justify-between gap-10 md:flex-row md:items-end">
                      <div className="min-w-0 flex-1">
                        <div className="mb-4 flex items-center gap-4 text-orange-light">
                          <span className="bg-orange-light/10 rounded px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.4em]">
                            Protocol {workout.day}
                          </span>
                          <IntensityBars level={workout.intensity} />
                        </div>
                        <h3 className="line-clamp-2 font-heading text-4xl font-black uppercase leading-tight tracking-tighter text-white drop-shadow-2xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl">
                          {workout.name}
                        </h3>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/30">
                          Target Volume
                        </span>
                        <span className="text-3xl font-black tracking-tighter text-orange-light sm:text-4xl md:text-5xl">
                          {targetVolumeMinutes}:00
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-20 overflow-y-auto p-12 md:p-20 lg:grid-cols-12">
                  <div className="space-y-12 lg:col-span-4">
                    <section>
                      <h4 className="border-orange-light/20 mb-6 border-b pb-4 font-mono text-[10px] uppercase tracking-[0.4em] text-orange-light">
                        Mission Parameters
                      </h4>
                      <p className="text-xl font-light italic leading-relaxed text-gray-300">
                        "{workout.description}"
                      </p>
                      {isHIIT && hiitWorkoutData && (
                        <button
                          type="button"
                          onClick={() => setShowHIITTimer(true)}
                          className="bg-orange-light/10 mt-6 flex min-h-[48px] w-full items-center justify-center gap-3 rounded-2xl border-2 border-orange-light py-4 font-mono text-sm font-bold uppercase tracking-wider text-orange-light transition-all active:scale-[0.98] md:min-h-[52px] md:py-5 md:text-base"
                          aria-label="Launch interval timer"
                        >
                          <Timer className="h-5 w-5 shrink-0 md:h-6 md:w-6" />
                          Launch Interval Timer
                        </button>
                      )}
                      {onOpenPlayer != null && (
                        <button
                          type="button"
                          onClick={onOpenPlayer}
                          className="bg-orange-light/10 mt-6 flex min-h-[48px] w-full items-center justify-center gap-3 rounded-2xl border-2 border-orange-light py-4 font-mono text-sm font-bold uppercase tracking-wider text-orange-light transition-all active:scale-[0.98] md:min-h-[52px] md:py-5 md:text-base"
                          aria-label="Open workout player"
                        >
                          <Play className="h-5 w-5 shrink-0 md:h-6 md:w-6" />
                          Start workout
                        </button>
                      )}
                    </section>

                    <div className="space-y-10 rounded-3xl border border-white/5 bg-white/5 p-8">
                      <div className="flex items-center gap-6">
                        <div className="bg-orange-light/10 rounded-2xl p-4">
                          <Timer className="h-6 w-6 text-orange-light" />
                        </div>
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-widest text-white/30">
                            Window
                          </div>
                          <div className="text-xl font-bold">{windowMinutes} Minutes</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="bg-orange-light/10 rounded-2xl p-4">
                          <ZapOff className="h-6 w-6 text-orange-light" />
                        </div>
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-widest text-white/30">
                            Rest Load
                          </div>
                          <div className="text-xl font-bold">
                            {workout.restLoad ?? 'Compressed'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4">
                      <button
                        onClick={onLogWorkout}
                        className="flex w-full items-center justify-center gap-4 rounded-2xl bg-orange-light py-6 font-black uppercase tracking-[0.3em] text-black shadow-[0_20px_40px_rgba(255,191,0,0.15)] transition-transform hover:scale-[1.02]"
                      >
                        Log Session Data <ClipboardList className="h-5 w-5" />
                      </button>
                      <button
                        onClick={onClose}
                        className="w-full rounded-xl border border-white/10 py-4 font-mono text-[10px] uppercase tracking-widest text-white/30 transition-all hover:bg-white/5"
                      >
                        Abort View
                      </button>
                    </div>
                  </div>

                  <div className="space-y-16 lg:col-span-8">
                    {phaseEntries.map((entry, idx) => {
                      const { key, block } = entry;
                      const color = getPhaseColor(idx);

                      return (
                        <div
                          key={key}
                          className="group/item relative border-l border-white/10 pl-12"
                        >
                          <div
                            className={`absolute left-[-8px] top-0 h-4 w-4 rounded-full ${color.bg} shadow-[0_0_15px] ${color.shadow}`}
                          />
                          <div className="mb-8 flex items-start justify-between">
                            <div>
                              <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.4em] text-white/30">
                                Phase{' '}
                                {(idx + 1).toString().padStart(phaseCount.toString().length, '0')}
                              </span>
                              <h5
                                className={`font-heading text-4xl font-black uppercase leading-none tracking-tighter ${color.text}`}
                              >
                                {block.title}
                              </h5>
                            </div>
                            <span
                              className={`${color.text} rounded border border-current px-3 py-1 font-mono text-xs tracking-widest`}
                            >
                              {block.duration}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {block.exercises.map((ex, i) => (
                              <ExerciseCard
                                key={i}
                                exerciseName={ex}
                                index={i}
                                onClick={() => onSelectExercise?.(ex)}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WorkoutDetailModal;

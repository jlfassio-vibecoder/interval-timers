/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Deployment Grid: workout cards (HUB and program views).
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, CheckCircle2, Target, Play } from 'lucide-react';
import type { DeploymentWorkoutCard } from '@/types/deployment';
import IntensityBars from './IntensityBars';

export const DEFAULT_WORKOUT_IMAGE = '/images/gym-barbell-squat-001.jpg';

export interface DeploymentGridProps {
  title: string;
  subtitle?: string;
  workouts: DeploymentWorkoutCard[];
  completedWorkouts?: Set<string>;
  onSelectWorkout?: (workout: DeploymentWorkoutCard) => void;
  backLabel?: string;
  onBack?: () => void;
}

const DeploymentGrid: React.FC<DeploymentGridProps> = ({
  title,
  subtitle = 'Deployment Grid',
  workouts,
  completedWorkouts = new Set(),
  onSelectWorkout,
  backLabel,
  onBack,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading text-2xl font-black uppercase text-white">{title}</h3>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-orange-light">
            {subtitle}
          </span>
        </div>
        {onBack && backLabel && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-white/40 transition-colors hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" /> {backLabel}
          </button>
        )}
      </div>

      {workouts.length > 0 ? (
        <div className="grid grid-cols-1 gap-6">
          {workouts.map((workout) => {
            const isDone = completedWorkouts.has(workout.id);
            const image = workout.image || DEFAULT_WORKOUT_IMAGE;
            const sessionLabel = workout.day?.startsWith('Day')
              ? workout.day.replace(/^Day\s*/i, '')
              : workout.id.includes('-d')
                ? `0${workout.id.split('-d')[1]}`
                : workout.day;

            return (
              <motion.div
                key={workout.id}
                role="button"
                tabIndex={0}
                whileHover={{ scale: 1.02 }}
                onClick={() => onSelectWorkout?.(workout)}
                onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelectWorkout?.(workout);
                  }
                }}
                className={`group relative flex h-40 w-full cursor-pointer items-center overflow-hidden rounded-3xl border px-8 shadow-2xl transition-all ${isDone ? 'bg-orange-light/5 border-orange-light shadow-[#ffbf00]/5' : 'hover:border-orange-light/30 border-white/10 bg-black/40'}`}
              >
                <div className="absolute inset-0 overflow-hidden">
                  <img
                    src={image}
                    className="h-full w-full object-cover opacity-20 grayscale transition-all duration-700 group-hover:scale-105 group-hover:opacity-40"
                    alt={workout.name}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
                </div>

                <div className="relative z-10 flex-1">
                  <div className="mb-3 flex items-center gap-4">
                    <div className="rounded-lg bg-white/10 p-2 backdrop-blur-md">
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-orange-light" />
                      ) : (
                        <Target className="h-4 w-4 text-white/40" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-orange-light">
                        Session {sessionLabel}
                      </span>
                      {workout.genre ? (
                        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">
                          {workout.genre}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <h4 className="font-heading text-2xl font-black uppercase text-white transition-colors group-hover:text-orange-light">
                    {workout.name}
                  </h4>
                  {isDone && (
                    <span className="border-orange-light/50 absolute right-4 top-4 rotate-12 rounded border bg-black/50 px-2 py-1 font-mono text-[10px] font-black text-orange-light">
                      COMPLETED
                    </span>
                  )}
                </div>

                <div className="relative z-10 flex flex-col items-end gap-3">
                  <IntensityBars level={workout.intensity} />
                  <div
                    className={`rounded-full p-4 transition-all ${isDone ? 'bg-orange-light text-black' : 'bg-white/5 text-white/40 group-hover:bg-white group-hover:text-black'}`}
                  >
                    <Play className="h-5 w-5 fill-current" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-white/40">
          No workouts available for this week
        </div>
      )}
    </div>
  );
};

export default DeploymentGrid;

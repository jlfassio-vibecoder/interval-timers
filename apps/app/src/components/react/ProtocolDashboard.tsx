/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  User,
  Award,
  Star,
  CheckCircle2,
  Zap,
  RefreshCcw,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import type { Artist, WorkoutLog } from '@/types';
import type { DeploymentWorkoutCard } from '@/types/deployment';
import { WEEK_LABELS } from '@/types/deployment';
import DeploymentTimeline from './DeploymentTimeline';
import DeploymentGrid from './DeploymentGrid';

interface ProtocolDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  user: { email: string | null } | null;
  workoutLogs: WorkoutLog[];
  completedWorkouts: Set<string>;
  weekWorkouts?: Artist[]; // Optional week workouts for week view
  onSelectWorkout?: (workout: Artist) => void;
}

const ProtocolDashboard: React.FC<ProtocolDashboardProps> = ({
  isOpen,
  onClose,
  user,
  workoutLogs,
  completedWorkouts,
  weekWorkouts = [],
  onSelectWorkout,
}) => {
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed inset-0 z-[90] cursor-auto overflow-y-auto bg-bg-dark px-6 pb-12 pt-24"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-12">
            {/* Dashboard Header */}
            <div className="flex flex-col items-start justify-between gap-6 border-b border-white/10 pb-10 md:flex-row md:items-end">
              <div>
                <div className="mb-2 flex items-center gap-3 text-orange-light">
                  <Activity className="h-5 w-5 animate-pulse" />
                  <span className="font-mono text-xs uppercase tracking-[0.4em]">
                    Operational Status: {user ? 'Active' : 'Offline'}
                  </span>
                </div>
                <h2 className="font-heading text-4xl font-black uppercase leading-none text-white md:text-7xl">
                  Protocol Dashboard
                </h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-full border border-white/10 bg-white/5 px-8 py-3 font-mono text-xs font-bold uppercase tracking-widest transition-all hover:bg-white/20"
              >
                Terminate Session
              </button>
            </div>

            <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
              {/* Left: Biometrics */}
              <div className="space-y-6 lg:col-span-3">
                <h4 className="mb-4 font-mono text-[10px] uppercase tracking-[0.4em] text-white/30">
                  Live Biometric Feed
                </h4>
                <div className="space-y-8 rounded-2xl border border-white/10 bg-white/5 p-6">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-xs uppercase text-white/50">Heart Rate</span>
                      <span className="font-bold text-orange-light">142 BPM</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className="h-full bg-orange-light"
                        animate={{ width: ['70%', '85%', '70%'] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-xs uppercase text-white/50">CNS Load</span>
                      <span className="text-orange-500 font-bold">88%</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className="bg-orange-500 h-full"
                        animate={{ width: ['80%', '92%', '80%'] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-xs uppercase text-white/50">
                        Metabolic Efficiency
                      </span>
                      <span className="font-bold text-red-500">94.2</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className="h-full bg-red-500"
                        animate={{ width: ['90%', '96%', '90%'] }}
                        transition={{ duration: 3, repeat: Infinity }}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-orange-light/20 bg-orange-light/5 rounded-2xl border p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <User className="h-5 w-5 text-orange-light" />
                    <h5 className="font-heading text-xs font-bold uppercase">Cadet Stats</h5>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between font-mono text-[10px] uppercase">
                      <span className="text-white/40">Total Workouts</span>
                      <span>{workoutLogs.length} / 18</span>
                    </div>
                    <div className="flex justify-between font-mono text-[10px] uppercase">
                      <span className="text-white/40">Efficiency Rank</span>
                      <span>
                        {workoutLogs.length > 5
                          ? 'Vanguard'
                          : workoutLogs.length > 2
                            ? 'Elite'
                            : 'Recruit'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* History List */}
                <div className="space-y-4">
                  <h4 className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/30">
                    Operational History
                  </h4>
                  {workoutLogs.length === 0 ? (
                    <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center font-mono text-[10px] uppercase italic text-white/20">
                      No logs recorded
                    </div>
                  ) : (
                    workoutLogs.slice(0, 3).map((log) => (
                      <div
                        key={log.id}
                        className="flex flex-col gap-2 rounded-xl border border-white/5 bg-white/5 p-4"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-bold uppercase text-orange-light">
                            {log.workoutName}
                          </span>
                          <span className="font-mono text-[10px] uppercase text-white/30">
                            {log.date}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-2.5 w-2.5 ${i < log.rating ? 'fill-current text-orange-light' : 'text-white/10'}`}
                            />
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Center: Mission Hub */}
              <div className="space-y-8 lg:col-span-6">
                <AnimatePresence mode="wait">
                  {selectedWeek === null ? (
                    <motion.div
                      key="mission-hub"
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
                              Neural Awakening
                            </h3>
                            <p className="mt-1 font-mono text-xs uppercase text-white/50">
                              Week 1 ● Day 1 ● Structural Alignment
                            </p>
                          </div>
                          <Award className="h-10 w-10 text-orange-light" />
                        </div>

                        <div className="mb-12 space-y-6">
                          <div className="flex items-start gap-4">
                            <div
                              className={`rounded-lg border p-3 transition-colors ${checkedIn ? 'border-orange-light bg-orange-light text-black' : 'border-white/10 bg-white/5 text-white/40'}`}
                            >
                              <CheckCircle2 className="h-5 w-5" />
                            </div>
                            <div>
                              <h6 className="font-bold text-white">Neural Drive Calibration</h6>
                              <p className="text-sm text-white/50">
                                8-minute dynamic mobilization sequence focusing on posterior chain
                                recruitment.
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-4">
                            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-white/40">
                              <Zap className="h-5 w-5" />
                            </div>
                            <div>
                              <h6 className="font-bold text-white">The Engine Block</h6>
                              <p className="text-sm italic text-gray-500">
                                Locked until check-in complete...
                              </p>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => setCheckedIn(!checkedIn)}
                          className={`flex w-full items-center justify-center gap-3 rounded-xl py-5 text-sm font-black uppercase tracking-widest transition-all ${
                            checkedIn
                              ? 'border-orange-light/30 cursor-default border bg-white/10 text-orange-light'
                              : 'bg-white text-black hover:bg-orange-light'
                          }`}
                        >
                          {checkedIn ? (
                            <>
                              MISSION LOGGED <CheckCircle2 className="h-5 w-5" />
                            </>
                          ) : (
                            <>
                              START OPERATIONAL DAY <RefreshCcw className="h-5 w-5" />
                            </>
                          )}
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
                        title={`Week ${selectedWeek} Workouts`}
                        subtitle="Deployment Grid"
                        workouts={weekWorkouts.map(
                          (w): DeploymentWorkoutCard => ({
                            id: w.id,
                            name: w.name,
                            genre: w.genre,
                            image: w.image,
                            day: w.day,
                            intensity: w.intensity,
                          })
                        )}
                        completedWorkouts={completedWorkouts}
                        onSelectWorkout={(card) => {
                          const artist = weekWorkouts.find((w) => w.id === card.id);
                          if (artist) onSelectWorkout?.(artist);
                        }}
                        backLabel="Back to Hub"
                        onBack={() => setSelectedWeek(null)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-2 gap-6">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                    <TrendingUp className="mx-auto mb-2 h-6 w-6 text-orange-light" />
                    <div className="font-mono text-[10px] uppercase text-white/40">
                      Efficiency Prime
                    </div>
                    <div className="text-xl font-bold">94.8%</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                    <BarChart3 className="mx-auto mb-2 h-6 w-6 text-orange-light" />
                    <div className="font-mono text-[10px] uppercase text-white/40">
                      Total Sessions
                    </div>
                    <div className="text-xl font-bold">{workoutLogs.length}</div>
                  </div>
                </div>
              </div>

              {/* Right: Map & Timeline */}
              <div className="space-y-6 lg:col-span-3">
                <DeploymentTimeline
                  weeks={6}
                  unlockedWeeks={[1]}
                  selectedWeek={selectedWeek}
                  onSelectWeek={setSelectedWeek}
                  weekLabels={WEEK_LABELS}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProtocolDashboard;

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Types for workout tracking (set-level logs, workout player).
 * Used by WorkoutPlayer and users/{uid}/workout_logs only.
 */

export interface SetLog {
  setNumber: number;
  targetReps: string;
  targetRPE: number;
  actualWeight: number;
  actualReps: number;
  completed: boolean;
}

export interface ExerciseLog {
  exerciseName: string;
  sets: SetLog[];
  notes?: string;
}

export interface WorkoutLog {
  id?: string;
  programId: string;
  weekId: string;
  workoutId: string;
  date: Date;
  durationSeconds: number;
  exercises: ExerciseLog[];
}

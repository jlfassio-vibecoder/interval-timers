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
  /** When prescription is per side: logged reps for left / right (stored in JSON on save). */
  actualRepsLeft?: number;
  actualRepsRight?: number;
  /** Logged session RPE (typically 1–10); omit or 0 when not entered. */
  actualRPE?: number;
  completed: boolean;
}

export interface ExerciseLog {
  exerciseName: string;
  sets: SetLog[];
  /** User notes for this exercise during the session. */
  notes?: string;
  /** Program / coach cues (optional context from schedule). */
  coachNotes?: string;
}

export interface WorkoutLog {
  id?: string;
  programId: string;
  weekId: string;
  workoutId: string;
  date: Date;
  durationSeconds: number;
  exercises: ExerciseLog[];
  /** Display label for Training Log (e.g. pasted workouts from Universal Activity Hub). */
  workoutDisplayName?: string;
  /** `client_coach_assignments.id` when completing from coach-assigned flow. */
  coachAssignmentId?: string;
  /** Snapshot of `client_coach_assignments.resource_id` (e.g. workouts.id / generated_wods.id). */
  coachResourceId?: string;
  coachAssignmentType?: 'workout' | 'wod';
}

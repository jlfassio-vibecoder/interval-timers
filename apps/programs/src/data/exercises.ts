/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Exercise } from '@/types';

// Exercise database - maps exercise names to their details
// This can be expanded with actual exercise data
export const EXERCISE_DATABASE: Record<string, Exercise> = {
  // Placeholder structure - can be populated with actual exercise data
  // Format: exercise name (normalized) -> Exercise object
};

// Helper function to get exercise details by name
export const getExerciseDetails = (exerciseName: string): Exercise | null => {
  // Normalize the exercise name (remove special chars, lowercase for matching)
  const normalized = exerciseName.toLowerCase().trim();

  if (EXERCISE_DATABASE[normalized]) {
    return EXERCISE_DATABASE[normalized];
  }

  // Return a default exercise structure if not found
  // This allows the modal to work even without full exercise database
  return {
    name: exerciseName,
    images: [
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1000&auto=format&fit=crop',
    ],
    instructions: [
      'Assume proper starting position with neutral spine alignment',
      'Execute movement with controlled tempo and full range of motion',
      'Maintain core engagement throughout the entire movement pattern',
      'Focus on quality over quantity - prioritize form and technique',
      'Complete the prescribed repetitions or time duration',
    ],
  };
};

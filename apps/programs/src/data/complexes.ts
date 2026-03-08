/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Artist type is the shared workout/card interface used across the app
// Keeping consistent with workouts.ts pattern rather than creating local aliases
import type { Artist } from '@/types';
import { defaultWorkoutDetails } from './workouts';

export const COMPLEXES: Artist[] = [
  {
    id: 'complexes-beginner',
    name: 'Beginner',
    genre: 'Movement quality & light load',
    day: 'Complexes',
    intensity: 1,
    image: '/images/mobility-and-flexibility-001.jpg',
    description: 'Barbell and bodyweight complexes scaled for movement quality and light load.',
    workoutDetail: {
      ...defaultWorkoutDetails,
      main: {
        ...defaultWorkoutDetails.main,
        title: 'Beginner Complexes',
        exercises: ['Goblet Squat', 'Push-up', 'Bent-over Row', 'Glute Bridge', 'Bird Dog'],
      },
    },
  },
  {
    id: 'complexes-intermediate',
    name: 'Intermediate',
    genre: 'Chain 3–5 movements, short rest',
    day: 'Complexes',
    intensity: 3,
    image: '/images/exercises_dumbbell-goblet-squat_male_anatomy.jpg',
    description: 'Chain 3–5 movements with short rest between complexes.',
    workoutDetail: {
      ...defaultWorkoutDetails,
      main: {
        ...defaultWorkoutDetails.main,
        title: 'Intermediate Complexes',
        exercises: [
          'Dumbbell Goblet Squat',
          'Dumbbell Row',
          'Push-up',
          'Romanian Deadlift',
          'Mountain Climbers',
        ],
      },
    },
  },
  {
    id: 'complexes-advanced',
    name: 'Advanced',
    genre: 'High density, minimal rest',
    day: 'Complexes',
    intensity: 5,
    image: '/images/gym-barbell-squat-001.jpg',
    description: 'High-density complexes with minimal rest for advanced conditioning.',
    workoutDetail: {
      ...defaultWorkoutDetails,
      main: {
        ...defaultWorkoutDetails.main,
        title: 'Advanced Complexes',
        exercises: ['Barbell Squat', 'Cleans', 'Push Press', 'Front Squat', 'Burpees'],
      },
    },
  },
];

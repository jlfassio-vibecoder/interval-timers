/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Artist type is the shared workout/card interface used across the app
// Keeping consistent with workouts.ts pattern rather than creating local aliases
import type { Artist } from '@/types';
import { defaultWorkoutDetails } from './workouts';

export const TABATA: Artist[] = [
  {
    id: 'tabata-beginner',
    name: 'Beginner',
    genre: '20 on, 10 off — lower impact',
    day: 'Tabata Workouts',
    intensity: 1,
    image: '/images/exercises_burpee_beginner_male_sketch.jpg',
    description: 'Tabata intervals with lower impact movements: 20 seconds work, 10 seconds rest.',
    workoutDetail: {
      ...defaultWorkoutDetails,
      main: {
        ...defaultWorkoutDetails.main,
        title: 'Beginner Tabata',
        exercises: ['Modified Burpees', 'Mountain Climbers', 'High Knees', 'Squats', 'Plank Hold'],
      },
    },
  },
  {
    id: 'tabata-intermediate',
    name: 'Intermediate',
    genre: 'Full 8-round blocks, mixed moves',
    day: 'Tabata Workouts',
    intensity: 3,
    image: '/images/exercises_mountain-climbers_male_realistic_001.jpg',
    description: 'Full 8-round Tabata blocks with mixed movements.',
    workoutDetail: {
      ...defaultWorkoutDetails,
      main: {
        ...defaultWorkoutDetails.main,
        title: 'Intermediate Tabata',
        exercises: ['Burpees', 'Mountain Climbers', 'Jump Squats', 'Push-ups', 'Plank to Push-up'],
      },
    },
  },
  {
    id: 'tabata-advanced',
    name: 'Advanced',
    genre: 'High-power, multiple blocks',
    day: 'Tabata Workouts',
    intensity: 5,
    image: '/images/exercises_star_jump_001.jpg',
    description: 'High-power Tabata with multiple blocks and minimal rest.',
    workoutDetail: {
      ...defaultWorkoutDetails,
      main: {
        ...defaultWorkoutDetails.main,
        title: 'Advanced Tabata',
        exercises: ['Star Jumps', 'Burpee Box Jumps', 'Battle Ropes', 'Sprints', 'Double-unders'],
      },
    },
  },
];

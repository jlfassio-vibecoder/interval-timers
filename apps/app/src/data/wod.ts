/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Artist type is the shared workout/card interface used across the app
// Keeping consistent with workouts.ts pattern rather than creating local aliases
import type { Artist } from '@/types';
import { defaultWorkoutDetails } from './workouts';

export const WOD: Artist[] = [
  {
    id: 'wod-beginner',
    name: 'Beginner',
    genre: 'One daily workout, scaled for you',
    day: 'WOD',
    intensity: 1,
    image: '/images/outdoor-calisthenics-workout-001.jpg',
    description: 'One daily workout scaled for beginners with modified movements and rest.',
    workoutDetail: {
      ...defaultWorkoutDetails,
      main: {
        ...defaultWorkoutDetails.main,
        title: 'Beginner WOD',
        exercises: ['Air Squats', 'Push-ups', 'Walking Lunges', 'Plank Hold', 'Jumping Jacks'],
      },
    },
  },
  {
    id: 'wod-intermediate',
    name: 'Intermediate',
    genre: 'Mixed modal, moderate volume',
    day: 'WOD',
    intensity: 3,
    image: '/images/outdoor-boot-camp-sand-bag-001.jpg',
    description: 'Mixed modal workout with moderate volume and varied time domains.',
    workoutDetail: {
      ...defaultWorkoutDetails,
      main: {
        ...defaultWorkoutDetails.main,
        title: 'Intermediate WOD',
        exercises: ['Thrusters', 'Pull-ups', 'Box Jumps', 'Kettlebell Swings', 'Burpees'],
      },
    },
  },
  {
    id: 'wod-advanced',
    name: 'Advanced',
    genre: 'Rx weights, time domains',
    day: 'WOD',
    intensity: 5,
    image: '/images/outdoor-speed-and-agility-001.jpg',
    description: 'Rx weights and strict time domains for advanced athletes.',
    workoutDetail: {
      ...defaultWorkoutDetails,
      main: {
        ...defaultWorkoutDetails.main,
        title: 'Advanced WOD',
        exercises: ['Power Cleans', 'Muscle-ups', 'Double-unders', 'Wall Balls', 'Rowing'],
      },
    },
  },
];

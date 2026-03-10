/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Artist, WorkoutDetail } from '@/types';

export const defaultWorkoutDetails: WorkoutDetail = {
  warmup: {
    title: 'Dynamic Mobilization',
    duration: '8 Minutes',
    exercises: [
      'Jumping Jacks',
      "World's Greatest Stretch",
      'Cat-Cow Transitions',
      'Bodyweight Squats',
      'Arm Circles',
    ],
  },
  main: {
    title: 'Metabolic Threshold Block',
    duration: '27 Minutes',
    exercises: [
      'Max Effort Sprints (45s)',
      'Active Recovery Plank (30s)',
      'Explosive Burpees (15 reps)',
      'Alternating Reverse Lunges',
      'Lateral Bounds',
    ],
  },
  finisher: {
    title: 'The Furnace finisher',
    duration: '5 Minutes',
    exercises: ['Tabata: Mountain Climbers vs. High Knees', 'Hold Hollow Body for 60s'],
  },
  cooldown: {
    title: 'Static Recovery & Pulse Drop',
    duration: '5 Minutes',
    exercises: [
      'Standing Quad Stretch',
      'Cross-Body Shoulder Stretch',
      "Child's Pose",
      'Deep Diaphragmatic Breathing',
    ],
  },
};

export const WEEK_1_WORKOUTS: Artist[] = [
  {
    id: 'w1-d1',
    name: 'Neural Reset',
    genre: 'CNS Calibration',
    day: 'Week 1 Day 1',
    intensity: 2,
    image:
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=1000&auto=format&fit=crop',
    description:
      'A dedicated focus on mobility and neurological readiness. Resetting the baseline for the weeks ahead.',
    workoutDetail: {
      ...defaultWorkoutDetails,
      warmup: {
        ...defaultWorkoutDetails.warmup,
        exercises: ['Neck Rolls', 'Shoulder Shrugs', 'Thoracic Openers', 'Hip Circles'],
      },
      main: {
        ...defaultWorkoutDetails.main,
        title: 'Neural Sync Circuits',
        exercises: [
          'Bird-Dogs (slow)',
          'Dead Bugs',
          'Glute Bridges (isometric)',
          'Scapular Pushups',
        ],
      },
    },
  },
  {
    id: 'w1-d2',
    name: 'Biomechanical Loading',
    genre: 'Stability / Foundation',
    day: 'Week 1 Day 2',
    intensity: 3,
    image:
      'https://images.unsplash.com/photo-1599058945522-28d584b6f0ff?q=80&w=1000&auto=format&fit=crop',
    description:
      'Establishing structural integrity through isometric holds and foundational movement patterns.',
    workoutDetail: {
      ...defaultWorkoutDetails,
      main: {
        ...defaultWorkoutDetails.main,
        title: 'Structural Load Testing',
        exercises: [
          'Tempo Air Squats (3:3:3)',
          'Static Lunge Hold',
          'Cossack Squats',
          'Bear Crawl Holds',
        ],
      },
    },
  },
  {
    id: 'w1-d3',
    name: 'Engine Primer',
    genre: 'Aerobic Base',
    day: 'Week 1 Day 3',
    intensity: 3,
    image:
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1000&auto=format&fit=crop',
    description:
      'Low-intensity steady-state work combined with dynamic intervals to prime the oxidative system.',
    workoutDetail: {
      ...defaultWorkoutDetails,
      main: {
        ...defaultWorkoutDetails.main,
        title: 'Oxidative Priming',
        exercises: ['Zone 2 Jog-in-place', 'Shadow Boxing', 'Light Burpees', 'Lateral Shuffle'],
      },
    },
  },
];

export const WORKOUTS: Artist[] = [
  {
    id: '1',
    name: 'VO2 Max Destroyer',
    genre: 'Aerobic Threshold',
    day: 'Intensity',
    intensity: 5,
    image: '/images/outdoor-boot-camp-sand-bag-002.jpg',
    description:
      'A relentless interval-based protocol designed to push your aerobic ceiling. This class utilizes high-intensity bouts with minimal recovery to optimize oxygen utilization.',
    workoutDetail: {
      ...defaultWorkoutDetails,
      main: { ...defaultWorkoutDetails.main, title: 'Destroyer Intervals' },
    },
  },
  {
    id: '2',
    name: 'Lactic Acid Threshold',
    genre: 'Anaerobic Power',
    day: 'Intensity',
    intensity: 4,
    image: '/images/outdoor-calisthenics-workout-002.jpg',
    description:
      'Train the body to buffer hydrogen ions and clear lactate efficiently. Expect sustained high-effort work that tests mental fortitude and metabolic efficiency.',
    workoutDetail: {
      ...defaultWorkoutDetails,
      main: { ...defaultWorkoutDetails.main, title: 'Lactate Accumulation Sets' },
    },
  },
  {
    id: '3',
    name: 'Oxidative Core Ignition',
    genre: 'Functional Stability',
    day: 'Intensity',
    intensity: 3,
    image:
      'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=1000&auto=format&fit=crop',
    description:
      'A multi-planar core workout that combines stability movements with aerobic components to ensure your engine is supported by a bulletproof chassis.',
    workoutDetail: {
      ...defaultWorkoutDetails,
      main: { ...defaultWorkoutDetails.main, title: 'Multidimensional Core Core' },
    },
  },
  {
    id: '4',
    name: 'Kinetic MetCon 500',
    genre: 'Caloric Burn',
    day: 'Intensity',
    intensity: 5,
    image: '/images/exercises_star_jump_001.jpg',
    description:
      'The ultimate metabolic conditioning challenge. A high-volume circuit designed to burn 500+ calories while improving total body explosive power.',
    workoutDetail: {
      ...defaultWorkoutDetails,
      main: { ...defaultWorkoutDetails.main, title: 'The 500 Rep Gauntlet' },
    },
  },
  {
    id: '5',
    name: 'Neural Drive Sprint',
    genre: 'CNS Activation',
    day: 'Intensity',
    intensity: 4,
    image: '/images/outdoor-speed-and-agility-001.jpg',
    description:
      'Focused on Central Nervous System recruitment. Short, explosive bursts followed by complete recovery to maximize force production and speed.',
    workoutDetail: {
      ...defaultWorkoutDetails,
      main: { ...defaultWorkoutDetails.main, title: 'Explosive CNS Bursts' },
    },
  },
  {
    id: '6',
    name: 'Ashen Active Recovery',
    genre: 'Metabolic Flush',
    day: 'Intensity',
    intensity: 1,
    image: '/images/mobility-and-flexibility-001.jpg',
    description:
      'Low-intensity steady-state movement designed to facilitate blood flow and nutrient delivery to recovering muscle tissue. Essential for high-performance longevity.',
    workoutDetail: {
      ...defaultWorkoutDetails,
      main: { ...defaultWorkoutDetails.main, title: 'Cellular Repair Flush' },
    },
  },
];

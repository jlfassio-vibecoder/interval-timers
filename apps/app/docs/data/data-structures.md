# Data Structures

## Overview

This document describes the data organization in the `src/data/` directory, including static data files, type definitions, and helper functions.

**Location**: `src/data/`

## Data Files

### `programs.ts`

**Purpose**: Defines available fitness programs

**Exports**:

- `FUSION_PROGRAMS: Program[]` - Array of all available programs
- `FOUNDATION_DETAIL: ProgramDetail` - Detailed information for Foundation program

**Usage**:

```tsx
import { FUSION_PROGRAMS } from '../../data/programs';

// Use in ProgramsGrid component
<ProgramsGrid programs={FUSION_PROGRAMS} />;
```

**Program Structure**:

```tsx
interface Program {
  id: string;
  name: string;
  weeks: number;
  description: string;
  image: string;
  intensity: number; // 1-5 scale
  focus: string;
  programDetail?: ProgramDetail;
}
```

**ProgramDetail Structure**:

```tsx
interface ProgramDetail {
  overview: string;
  phases: ProgramPhase[];
}

interface ProgramPhase {
  weeks: string;
  title: string;
  focus: string;
  deliverables: string[];
}
```

### `workouts.ts`

**Purpose**: Defines workout data and default workout structures

**Exports**:

- `defaultWorkoutDetails: WorkoutDetail` - Default workout structure template
- `WEEK_1_WORKOUTS: Artist[]` - Week 1 workout sessions
- `WORKOUTS: Artist[]` - General workout catalog

**Usage**:

```tsx
import { WEEK_1_WORKOUTS, defaultWorkoutDetails } from '../../data/workouts';

// Use in ProtocolDashboard
<ProtocolDashboard weekWorkouts={WEEK_1_WORKOUTS} />;
```

**WorkoutDetail Structure**:

```tsx
interface WorkoutDetail {
  warmup: WorkoutComponent;
  main: WorkoutComponent;
  finisher: WorkoutComponent;
  cooldown: WorkoutComponent;
}

interface WorkoutComponent {
  title: string;
  duration: string;
  exercises: string[];
}
```

**Artist (Workout) Structure**:

```tsx
interface Artist {
  id: string;
  name: string;
  genre: string; // e.g., "CNS Calibration"
  image: string;
  day: string; // e.g., "Week 1 Day 1"
  description: string;
  intensity: number; // 1-5 scale
  workoutDetail?: WorkoutDetail;
}
```

**WEEK_1_WORKOUTS**:
Contains three workouts:

- `w1-d1`: Neural Reset (CNS Calibration)
- `w1-d2`: Biomechanical Loading (Stability / Foundation)
- `w1-d3`: Engine Primer (Aerobic Base)

### `exercises.ts`

**Purpose**: Exercise database and lookup functions

**Exports**:

- `EXERCISE_DATABASE: Record<string, Exercise>` - Exercise lookup table
- `getExerciseDetails(exerciseName: string): Exercise | null` - Helper function

**Usage**:

```tsx
import { getExerciseDetails } from '../../data/exercises';

const exercise = getExerciseDetails('Bird-Dogs (slow)');
if (exercise) {
  // Display exercise details
}
```

**Exercise Structure**:

```tsx
interface Exercise {
  name: string;
  images: string[];
  instructions: string[];
}
```

**getExerciseDetails Function**:

- Normalizes exercise name (lowercase, trim)
- Looks up in `EXERCISE_DATABASE`
- Returns default exercise structure if not found
- Default includes placeholder images and generic instructions

**Current State**:

- `EXERCISE_DATABASE` is currently empty (placeholder structure)
- All exercises return default structure
- Can be populated with actual exercise data as needed

## Type Definitions

**Location**: `src/types.ts`

All data structures are defined as TypeScript interfaces in `src/types.ts`:

- `UserProfile`
- `Exercise`
- `WorkoutComponent`
- `WorkoutDetail`
- `WorkoutLog`
- `Artist`
- `ProgramPhase`
- `ProgramDetail`
- `Program`
- `ChatMessage`
- `Section` (enum)

**Import Pattern**:

```tsx
import type { Artist, Program, WorkoutLog } from '@/types';
```

## Adding New Data

### Adding a New Program

1. Add program object to `FUSION_PROGRAMS` array in `src/data/programs.ts`
2. Optionally add `ProgramDetail` if detailed information is needed
3. Import and use in components:

```tsx
import { FUSION_PROGRAMS } from '../../data/programs';
```

### Adding a New Workout

1. Add workout object to appropriate array in `src/data/workouts.ts`
2. Use `defaultWorkoutDetails` as base and override specific sections:

```tsx
const newWorkout: Artist = {
  id: 'w2-d1',
  name: 'Workout Name',
  // ... other fields
  workoutDetail: {
    ...defaultWorkoutDetails,
    main: {
      ...defaultWorkoutDetails.main,
      title: 'Custom Main Title',
      exercises: ['Exercise 1', 'Exercise 2'],
    },
  },
};
```

### Adding Exercise Details

1. Add exercise to `EXERCISE_DATABASE` in `src/data/exercises.ts`:

```tsx
export const EXERCISE_DATABASE: Record<string, Exercise> = {
  'bird-dogs (slow)': {
    name: 'Bird-Dogs (slow)',
    images: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
    instructions: [
      'Start on hands and knees',
      'Extend opposite arm and leg',
      'Hold for 3 seconds',
      'Return to start',
      'Repeat on other side',
    ],
  },
};
```

**Note**: Key should be normalized (lowercase, trimmed) to match lookup logic

## Data Flow

### Static Data → Components

```
src/data/programs.ts
  └── FUSION_PROGRAMS
      └── ProgramsGrid component
          └── User selects program
              └── ProgramDetail component

src/data/workouts.ts
  └── WEEK_1_WORKOUTS
      └── ProtocolDashboard component
          └── User selects workout
              └── WorkoutDetailModal component

src/data/exercises.ts
  └── getExerciseDetails()
      └── WorkoutDetailModal
          └── User clicks exercise
              └── ExerciseDetailModal component
```

### Dynamic Data → Firebase

Workout logs and user profiles are stored in Firebase and accessed via services:

- `src/services/firebaseService.ts` - Handles Firestore operations
- `src/contexts/AppContext.tsx` - Manages state from Firebase

## Best Practices

1. **Keep data files pure** - No side effects, just data exports
2. **Use TypeScript types** - All data structures should have corresponding types
3. **Normalize keys** - For lookup tables, use consistent key formats
4. **Provide defaults** - Helper functions should return sensible defaults
5. **Document structure** - Add JSDoc comments for complex data structures

## Related Documentation

- [Type Definitions](../configuration/typescript.md)
- [Firebase Service](../services/firebase-service.md)
- [React Components](../components/react-components.md)

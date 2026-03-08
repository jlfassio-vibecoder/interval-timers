# File Naming Conventions

## Overview

This document outlines the naming conventions used throughout the codebase to maintain consistency and clarity.

## Component Files

### Astro Components

**Pattern**: `PascalCase.astro`

**Location**: `src/components/astro/`

**Examples**:

- `HeroSection.astro`
- `WorkoutsHeader.astro`
- `ProgramsSection.astro`
- `Footer.astro`

**Rules**:

- Use PascalCase (capitalize first letter of each word)
- Descriptive names that indicate component purpose
- End with `.astro` extension

### React Components

**Pattern**: `PascalCase.tsx`

**Location**: `src/components/react/`

**Examples**:

- `AppWrapper.tsx`
- `WorkoutDetailModal.tsx`
- `ExerciseDetailModal.tsx`
- `IntensityBars.tsx`

**Rules**:

- Use PascalCase
- Descriptive names
- End with `.tsx` extension
- Component name should match file name

## Service Files

**Pattern**: `camelCase.ts`

**Location**: `src/services/`

**Examples**:

- `firebaseService.ts`
- `geminiService.ts`

**Rules**:

- Use camelCase (first word lowercase, subsequent words capitalized)
- End with `Service.ts` suffix
- Descriptive of the service purpose

## Data Files

**Pattern**: `camelCase.ts`

**Location**: `src/data/`

**Examples**:

- `programs.ts`
- `workouts.ts`
- `exercises.ts`

**Rules**:

- Use camelCase
- Plural nouns for arrays/collections
- Singular nouns for single entities
- No suffix needed

## Type Definitions

**Pattern**: `types.ts` (singular)

**Location**: `src/types.ts`

**Rules**:

- Single file named `types.ts`
- Contains all TypeScript interfaces and types
- Use `export interface` or `export type`

## Context Files

**Pattern**: `PascalCase.tsx`

**Location**: `src/contexts/`

**Examples**:

- `AppContext.tsx`

**Rules**:

- Use PascalCase
- End with `Context.tsx` suffix
- Matches React component naming

## Layout Files

**Pattern**: `PascalCase.astro`

**Location**: `src/layouts/`

**Examples**:

- `BaseLayout.astro`

**Rules**:

- Use PascalCase
- End with `Layout.astro` suffix
- Descriptive of layout purpose

## Page Files

**Pattern**: `kebab-case.astro` or `index.astro`

**Location**: `src/pages/`

**Examples**:

- `index.astro` (homepage)
- `about.astro` (becomes `/about`)
- `blog/[slug].astro` (dynamic route)

**Rules**:

- Use kebab-case for route names
- `index.astro` for homepage
- File name = route path

## Style Files

**Pattern**: `camelCase.css`

**Location**: `src/styles/`

**Examples**:

- `global.css`

**Rules**:

- Use camelCase
- Descriptive names
- `.css` extension

## Configuration Files

**Pattern**: `kebab-case.config.mjs` or standard names

**Location**: Root directory

**Examples**:

- `astro.config.mjs`
- `tailwind.config.mjs`
- `tsconfig.json`
- `package.json`

**Rules**:

- Follow framework conventions
- Use `.config.mjs` for JavaScript configs
- Use `.json` for JSON configs

## Import Path Patterns

### Path Alias (`@/`)

Use `@/` to import from `src/`:

```tsx
// Types
import type { Artist, Program } from '@/types';

// Context
import { useAppContext } from '@/contexts/AppContext';

// Services
import { syncUserProfile } from '@/services/firebaseService';
```

### Relative Imports

For components in the same directory or nearby:

```tsx
// Same directory
import ExerciseCard from './ExerciseCard';

// Parent directory
import { getExerciseDetails } from '../../data/exercises';

// Sibling directory
import { useAppContext } from '../../contexts/AppContext';
```

## Component Naming in Code

### React Components

Component name should match file name:

```tsx
// File: IntensityBars.tsx
const IntensityBars: React.FC<IntensityBarsProps> = ({ level }) => {
  // ...
};

export default IntensityBars;
```

### Props Interfaces

Props interface should match component name with `Props` suffix:

```tsx
// Component: WorkoutDetailModal
interface WorkoutDetailModalProps {
  workout: Artist | null;
  onClose: () => void;
}
```

## Function Naming

### Service Functions

**Pattern**: `camelCase` with descriptive verbs

**Examples**:

- `syncUserProfile()`
- `fetchWorkoutLogs()`
- `saveWorkoutLog()`
- `getExerciseDetails()`
- `sendMessageToGemini()`

**Rules**:

- Use camelCase
- Start with verb (get, set, fetch, save, etc.)
- Be descriptive of action

### Event Handlers

**Pattern**: `handle` + `Action`

**Examples**:

- `handleSelectExercise()`
- `handleSaveLog()`
- `handleActivateProtocol()`
- `handleLogout()`

**Rules**:

- Prefix with `handle`
- Use camelCase
- Describe the action

### State Setters

**Pattern**: `set` + `StateName`

**Examples**:

- `setSelectedArtist()`
- `setShowAuthModal()`
- `setWorkoutLogs()`

**Rules**:

- Prefix with `set`
- Use camelCase
- Match state variable name

## Variable Naming

### Constants

**Pattern**: `UPPER_SNAKE_CASE`

**Examples**:

- `FUSION_PROGRAMS`
- `WEEK_1_WORKOUTS`
- `EXERCISE_DATABASE`

**Rules**:

- All uppercase
- Words separated by underscores
- Used for exported constants

### Local Variables

**Pattern**: `camelCase`

**Examples**:

- `selectedArtist`
- `showAuthModal`
- `workoutLogs`

**Rules**:

- Use camelCase
- Be descriptive
- Avoid abbreviations

## File Organization Summary

```
src/
├── components/
│   ├── astro/
│   │   └── PascalCase.astro
│   └── react/
│       └── PascalCase.tsx
├── contexts/
│   └── PascalCase.tsx
├── data/
│   └── camelCase.ts
├── layouts/
│   └── PascalCase.astro
├── pages/
│   └── kebab-case.astro or index.astro
├── services/
│   └── camelCase.ts
├── styles/
│   └── camelCase.css
└── types.ts
```

## Best Practices

1. **Be consistent** - Follow existing patterns in the codebase
2. **Be descriptive** - Names should clearly indicate purpose
3. **Match file and component names** - React components should match file names
4. **Use appropriate case** - PascalCase for components, camelCase for functions/variables
5. **Avoid abbreviations** - Use full words for clarity

## Related Documentation

- [Directory Structure](../architecture/directory-structure.md)
- [Integration Patterns](./integration-patterns.md)
- [Adding Components](../workflows/adding-components.md)

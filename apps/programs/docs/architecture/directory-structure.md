# Directory Structure

## Overview

This document explains the complete directory structure of the AI Fitcopilot application and the purpose of each directory and file.

## Root Directory

```
ai-fitness-guy/
├── .astro/              # Astro build cache and types
├── docs/                 # Documentation (this directory)
├── public/               # Static assets (served at root URL)
│   └── videos/          # Video files organized by type
├── ref-files/            # Reference files (legacy code)
├── scripts/              # Build and deployment scripts
├── src/                  # Source code (main directory)
├── astro.config.mjs      # Astro configuration
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── tailwind.config.mjs   # Tailwind CSS configuration
└── [config files]        # Firebase, Docker, etc.
```

## Source Directory (`src/`)

The `src/` directory contains all application source code:

```
src/
├── components/          # All UI components
│   ├── astro/          # Astro components (static/SEO)
│   └── react/          # React components (interactive)
├── contexts/           # React context providers
├── data/               # Static data and constants
├── layouts/            # Astro layout templates
├── pages/              # Astro file-based routes
├── services/           # API and service layer
├── styles/             # Global CSS
└── types.ts            # TypeScript type definitions
```

## Component Directories

### `src/components/astro/`

**Purpose**: Static, SEO-friendly components rendered as HTML

**When to use**: Static content, headers, footers, sections that don't need interactivity

**Files**:

- `HeroSection.astro` - Landing page hero section
- `WorkoutsHeader.astro` - Workouts section header
- `ProgramsSection.astro` - Programs showcase section
- `Footer.astro` - Site footer

**Pattern**: `.astro` extension, frontmatter for logic, HTML template

### `src/components/react/`

**Purpose**: Interactive React components that hydrate on the client

**When to use**: Modals, forms, interactive UI, state management

**Files**:

- **Core**: `AppWrapper.tsx`, `AppIslands.tsx`
- **UI**: `Navigation.tsx`, `ArtistCard.tsx`, `ExerciseCard.tsx`, `IntensityBars.tsx`
- **Modals**: `AuthModal.tsx`, `WorkoutDetailModal.tsx`, `ExerciseDetailModal.tsx`, `LogWorkoutModal.tsx`, `ProgramDetail.tsx`, `ProgramsGrid.tsx`
- **Features**: `AIChat.tsx`, `ProtocolDashboard.tsx`, `PurchaseFlow.tsx`, `WorkoutCards.tsx`
- **Overlays**: `BiometricScanOverlay.tsx`, `FluidBackground.tsx`
- **Utilities**: `GlitchText.tsx`, `ProgramsButton.tsx`

**Pattern**: `.tsx` extension, React functional components

## Context Directory (`src/contexts/`)

**Purpose**: React Context API providers for global state

**Files**:

- `AppContext.tsx` - Main application context
  - Provides: `user`, `profile`, `workoutLogs`, `completedWorkouts`, `purchasedIndex`
  - Hook: `useAppContext()`

**Usage**: Wraps the app in `AppWrapper.tsx` via `AppProvider`

## Data Directory (`src/data/`)

**Purpose**: Static data, constants, and data lookup functions

**Files**:

- `programs.ts` - Program definitions (`FUSION_PROGRAMS`)
- `workouts.ts` - Workout definitions (`WEEK_1_WORKOUTS`, `defaultWorkoutDetails`)
- `exercises.ts` - Exercise database and `getExerciseDetails()` helper

**Pattern**: Export constants and helper functions

## Layouts Directory (`src/layouts/`)

**Purpose**: Astro layout templates that wrap pages

**Files**:

- `BaseLayout.astro` - Base HTML structure, head tags, fonts

**Usage**: Imported in `src/pages/index.astro`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout>
  <!-- Page content -->
</BaseLayout>
```

## Pages Directory (`src/pages/`)

**Purpose**: File-based routing - each file becomes a route

**Files**:

- `index.astro` → `/` (homepage)

**Pattern**: Astro components that export HTML. File name = route path.

## Services Directory (`src/services/`)

**Purpose**: API integrations, external services, data persistence

**Files**:

- `firebaseService.ts` - Firebase initialization, auth, Firestore
  - Functions: `syncUserProfile()`, `fetchWorkoutLogs()`, `saveWorkoutLog()`
- `geminiService.ts` - Vertex AI Gemini integration
  - Functions: `initializeChat()`, `sendMessageToGemini()`

**Pattern**: Export functions that handle service interactions

## Styles Directory (`src/styles/`)

**Purpose**: Global CSS and Tailwind configuration

**Files**:

- `global.css` - Global styles, custom scrollbar, base styles

**Usage**: Imported in `BaseLayout.astro`

## Type Definitions (`src/types.ts`)

**Purpose**: TypeScript interfaces and types used throughout the app

**Exports**:

- `UserProfile`, `Exercise`, `WorkoutComponent`, `WorkoutDetail`
- `WorkoutLog`, `Artist`, `Program`, `ProgramDetail`
- `ChatMessage`, `Section` enum

**Usage**: Import with `import type { ... } from '@/types'`

## Public Directory (`public/`)

**Purpose**: Static assets served at the root URL (not processed by Astro)

**Structure**:

```
public/
└── videos/              # Video assets organized by type
    ├── exercise/        # Exercise demonstration videos
    ├── workout/         # Full workout videos
    ├── complexes/       # Complex movement sequences
    ├── instruction/     # Instructional/tutorial videos
    └── form-check/      # Form correction and analysis videos
```

**Usage**: Files in `public/` are accessible at the root URL:

- `public/videos/exercise/squat.mp4` → `/videos/exercise/squat.mp4`
- `public/videos/workout/day1.mp4` → `/videos/workout/day1.mp4`

**Referencing in Code**:

```typescript
// In Exercise data
{
  name: "Squat",
  videoUrl: "/videos/exercise/squat.mp4"
}

// In React components
<VideoPlayer videoUrl="/videos/exercise/squat.mp4" />
```

**Note**: The `public/` directory is copied as-is to the build output. Files are not processed or optimized by Astro.

## Configuration Files

### `astro.config.mjs`

Astro configuration:

- Integrations: React, Tailwind
- Vite alias: `@/` → `src/`
- Server port: 3006

### `tsconfig.json`

TypeScript configuration:

- Path alias: `@/*` → `./src/*`
- React JSX mode
- Strict mode enabled

### `tailwind.config.mjs`

Tailwind CSS configuration:

- Custom theme colors
- Font families

## Import Patterns

### Path Alias (`@/`)

Use `@/` to import from `src/`:

```tsx
import type { Artist } from '@/types';
import { useAppContext } from '@/contexts/AppContext';
```

### Relative Imports

For components in the same directory or nearby:

```tsx
import ExerciseCard from './ExerciseCard';
import { getExerciseDetails } from '../../data/exercises';
```

## Adding New Files

### New Astro Component

Create in `src/components/astro/YourComponent.astro`

### New React Component

Create in `src/components/react/YourComponent.tsx`

### New Service

Create in `src/services/yourService.ts`

### New Data File

Create in `src/data/yourData.ts`

### New Page

Create in `src/pages/your-page.astro` (becomes `/your-page`)

## Related Documentation

- [Astro Patterns](./astro-patterns.md)
- [File Naming](../patterns/file-naming.md)
- [Adding Components](../workflows/adding-components.md)
- [Adding Pages](../workflows/adding-pages.md)

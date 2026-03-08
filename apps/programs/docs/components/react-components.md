# React Components

## Overview

React components handle all interactive functionality in the application. They're organized in `src/components/react/` and hydrate on the client using Astro's island architecture.

**Location**: `src/components/react/`

**File Pattern**: `ComponentName.tsx`

## Component Hierarchy

### Island Structure

```
AppWrapper (client:load) [React Island 1]
  └── AppProvider (Context available here)
      └── AppIslands (State Coordinator)
          ├── Navigation (uses Context ✓)
          ├── ProtocolDashboard (uses Context ✓)
          ├── WorkoutDetailModal (uses Context ✓)
          ├── ExerciseDetailModal (uses Context ✓)
          ├── LogWorkoutModal (uses Context ✓)
          ├── ProgramsGrid (uses Context ✓)
          ├── ProgramDetail (uses Context ✓)
          ├── BiometricScanOverlay (uses Context ✓)
          ├── AuthModal (uses Context ✓)
          ├── AIChat (uses Context ✓)
          ├── FluidBackground
          └── PurchaseFlow (uses Context ✓, via portal)

WorkoutCards (client:visible) [React Island 2 - Separate]
  └── ArtistCard (dispatches events, NO Context access)

ProgramsButton (client:load) [React Island 3 - Separate]
  └── (dispatches events, NO Context access)
```

**Island Boundaries**:

- **Island 1 (AppWrapper)**: All components within have access to `AppContext`
- **Island 2 (WorkoutCards)**: Separate island, communicates via Custom Events
- **Island 3 (ProgramsButton)**: Separate island, communicates via Custom Events

**Context Access**: Only components within the AppWrapper island can use `useAppContext()`. Separate islands cannot access Context and must use Custom Events for communication.

## Core Wrapper Components

### `AppWrapper.tsx`

**Purpose**: Root React component that provides context and mounts core features

**Location**: `src/components/react/AppWrapper.tsx`

**Usage**: Imported in `src/pages/index.astro` with `client:load`

**Responsibilities**:

- Wraps app in `AppProvider` (React Context)
- Renders `AppIslands` (main state coordinator)
- Renders `FluidBackground` (animated background)
- Renders `AIChat` (AI chat interface)
- Portals `PurchaseFlow` to `#purchase-flow-mount`

**Props**: None

**Key Code**:

```tsx
<AppProvider>
  <FluidBackground />
  <AIChat />
  <AppIslands />
  {mountPoint && createPortal(<PurchaseFlow />, mountPoint)}
</AppProvider>
```

### `AppIslands.tsx`

**Purpose**: Central state coordinator that manages all modals and interactive components

**Location**: `src/components/react/AppIslands.tsx`

**State Management**:

- Local state for modals: `showAuthModal`, `showDashboard`, `showLogModal`, etc.
- Selected items: `selectedArtist`, `selectedProgram`, `selectedExercise`
- Uses `useAppContext()` for global state

**Event Listeners**:

- `selectWorkout` - Opens workout detail modal
- `showAuthModal` - Opens auth modal
- `showPrograms` - Opens programs grid

**Key Functions**:

- `handleSelectExercise(exerciseName)` - Opens exercise detail modal
- `handleSaveLog(log)` - Saves workout log to Firebase
- `handleActivateProtocol()` - Activates a program

**Renders**:

- `Navigation` - Always visible
- `ProtocolDashboard` - Week 1 workouts dashboard
- `WorkoutDetailModal` - Workout details and exercises
- `ExerciseDetailModal` - Exercise instructions and images
- `LogWorkoutModal` - Log workout form
- `ProgramsGrid` - Program selection grid
- `ProgramDetail` - Program details and activation
- `BiometricScanOverlay` - Activation animation
- `AuthModal` - Authentication

## UI Components

### `Navigation.tsx`

**Purpose**: Top navigation bar with menu and user actions

**Location**: `src/components/react/Navigation.tsx`

**Props**:

```tsx
interface NavigationProps {
  onShowDashboard: () => void;
  onShowAuthModal: () => void;
  onLogout: () => void;
}
```

**Features**:

- Mobile-responsive hamburger menu
- User profile display
- Scroll to section navigation
- Logout functionality

**Uses**: `useAppContext()` for user state

### `ArtistCard.tsx`

**Purpose**: Card component for displaying workout/artist information

**Location**: `src/components/react/ArtistCard.tsx`

**Props**:

```tsx
interface ArtistCardProps {
  artist: Artist;
  onClick: () => void;
}
```

**Features**:

- Image background with hover zoom
- Intensity bars display
- Genre and name display
- Click handler for selection
- Framer Motion animations

**Uses**: `IntensityBars` component

### `ExerciseCard.tsx`

**Purpose**: Reusable card for displaying individual exercises in workout details

**Location**: `src/components/react/ExerciseCard.tsx`

**Props**:

```tsx
interface ExerciseCardProps {
  exerciseName: string;
  index: number;
  onClick?: () => void;
}
```

**Features**:

- Numbered exercise display (01, 02, etc.)
- Hover effects
- Clickable to open exercise details

**Usage**: Used in `WorkoutDetailModal` to display exercises

### `IntensityBars.tsx`

**Purpose**: Visual intensity indicator (1-5 scale)

**Location**: `src/components/react/IntensityBars.tsx`

**Props**:

```tsx
interface IntensityBarsProps {
  level: number; // 1-5
}
```

**Features**:

- 5-bar visual scale
- Color gradient (orange-100 to orange-900)
- Smooth transitions

**Usage**: Used in `ArtistCard`, `WorkoutDetailModal`, `ProtocolDashboard`

### `VideoPlayer.tsx`

**Purpose**: Reusable video player component with "Neural Feed" styling

**Location**: `src/components/react/VideoPlayer.tsx`

**Props**:

```tsx
interface VideoPlayerProps {
  videoUrl: string; // Path to video file (e.g., "/videos/exercise/squat.mp4")
}
```

**Features**:

- Auto-playing, looping video with muted audio
- "Neural Feed" badge with animated red dot
- Golden border styling matching app theme
- Responsive aspect-video container
- Defensive null check if videoUrl is missing

**Usage**: Used in `ExerciseDetailModal` to display exercise demonstration videos

**Video Storage**: Videos are stored in `public/videos/` organized by type (exercise, workout, complexes, instruction, form-check)

**See**: [Video Player Documentation](./video-player.md) for complete details on video storage, file organization, and usage patterns

## Modal Components

### `WorkoutDetailModal.tsx`

**Purpose**: Full-screen modal displaying workout details and exercises

**Location**: `src/components/react/WorkoutDetailModal.tsx`

**Props**:

```tsx
interface WorkoutDetailModalProps {
  workout: Artist | null;
  onClose: () => void;
  onLogWorkout: () => void;
  onSelectExercise?: (exerciseName: string) => void;
}
```

**Features**:

- Workout image header
- Mission parameters section
- Workout phases (warmup, main, finisher, cooldown)
- Exercise cards (clickable via `ExerciseCard`)
- Log workout button
- Framer Motion animations

**Uses**: `IntensityBars`, `ExerciseCard`

### `ExerciseDetailModal.tsx`

**Purpose**: Modal displaying exercise details with images and instructions

**Location**: `src/components/react/ExerciseDetailModal.tsx`

**Props**:

```tsx
interface ExerciseDetailModalProps {
  exercise: Exercise | null;
  onClose: () => void;
}
```

**Features**:

- Split-screen layout (images left, instructions right)
- Scrollable image gallery with video support
- Video player displayed at top of image stack (when `exercise.videoUrl` is present)
- Numbered instruction steps
- "Tactical Recon" branding
- Framer Motion animations

**Uses**: `VideoPlayer` component (when exercise has `videoUrl`)

**Data Source**: `getExerciseDetails()` from `src/data/exercises.ts`

### `LogWorkoutModal.tsx`

**Purpose**: Form modal for logging workout sessions

**Location**: `src/components/react/LogWorkoutModal.tsx`

**Props**:

```tsx
interface LogWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (log: Omit<WorkoutLog, 'id'>) => void;
  selectedArtist: Artist | null;
}
```

**Features**:

- Effort slider (1-10)
- Rating slider (1-5)
- Notes textarea
- Form validation
- Save to Firebase via `onSave`

### `ProgramsGrid.tsx`

**Purpose**: Grid modal displaying available programs

**Location**: `src/components/react/ProgramsGrid.tsx`

**Props**:

```tsx
interface ProgramsGridProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProgram: (program: Program) => void;
  programs: Program[];
}
```

**Features**:

- Grid layout of program cards
- Program selection
- Framer Motion animations

**Data Source**: `FUSION_PROGRAMS` from `src/data/programs.ts`

### `ProgramDetail.tsx`

**Purpose**: Modal displaying detailed program information

**Location**: `src/components/react/ProgramDetail.tsx`

**Props**:

```tsx
interface ProgramDetailProps {
  program: Program | null;
  onClose: () => void;
  onActivate: () => void;
}
```

**Features**:

- Program overview
- Phase breakdown
- Activation button
- Intensity display

### `AuthModal.tsx`

**Purpose**: Authentication modal for login/signup

**Location**: `src/components/react/AuthModal.tsx`

**Props**:

```tsx
interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}
```

**Features**:

- Email/password authentication
- Firebase Auth integration
- Error handling
- Modal overlay

## Feature Components

### `ProtocolDashboard.tsx`

**Purpose**: Dashboard displaying Week 1 workouts with check-in functionality

**Location**: `src/components/react/ProtocolDashboard.tsx`

**Props**:

```tsx
interface ProtocolDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  user: FirebaseUser | null;
  workoutLogs: WorkoutLog[];
  completedWorkouts: Set<string>;
  weekWorkouts: Artist[];
  onSelectWorkout?: (workout: Artist) => void;
}
```

**Features**:

- Week selector
- Workout deployment grid
- Completion tracking
- Workout selection
- Session numbering (Session 01, 02, etc.)

**Data Source**: `WEEK_1_WORKOUTS` from `src/data/workouts.ts`

### `WorkoutCards.tsx`

**Purpose**: Grid of workout cards that dispatch events

**Location**: `src/components/react/WorkoutCards.tsx`

**Island Status**: Separate React island (`client:visible`) - **Cannot access AppWrapper's Context**

**Features**:

- Grid layout of `ArtistCard` components
- Dispatches `selectWorkout` custom event
- Used in `src/pages/index.astro` with `client:visible`
- Communicates with `AppIslands` via Custom Events (not Context)

**Data Source**: `WORKOUTS` from `src/data/workouts.ts`

**Note**: This is a separate island from `AppWrapper`, so it cannot use `useAppContext()`. It communicates by dispatching Custom Events that `AppIslands` listens to.

### `AIChat.tsx`

**Purpose**: AI chat interface using Gemini

**Location**: `src/components/react/AIChat.tsx`

**Features**:

- Chat interface
- Message history
- Integration with `geminiService`
- System instructions for AI personality

**Uses**: `sendMessageToGemini()` from `src/services/geminiService.ts`

### `PurchaseFlow.tsx`

**Purpose**: Purchase flow component (portaled to mount point)

**Location**: `src/components/react/PurchaseFlow.tsx`

**Features**:

- Payment integration
- Rendered via React Portal to `#purchase-flow-mount`

## Overlay Components

### `BiometricScanOverlay.tsx`

**Purpose**: Full-screen overlay animation for program activation

**Location**: `src/components/react/BiometricScanOverlay.tsx`

**Props**:

```tsx
interface BiometricScanOverlayProps {
  isOpen: boolean;
  onComplete: () => void;
}
```

**Features**:

- Animated biometric scan effect
- 4-second animation
- Calls `onComplete` when finished

### `FluidBackground.tsx`

**Purpose**: Animated background effect

**Location**: `src/components/react/FluidBackground.tsx`

**Features**:

- Canvas-based fluid animation
- Always rendered (no props)
- Background layer

## Utility Components

### `ProgramsButton.tsx`

**Purpose**: Button component for opening programs grid

**Location**: `src/components/react/ProgramsButton.tsx`

**Island Status**: Separate React island (`client:load`) - **Cannot access AppWrapper's Context**

**Features**:

- Dispatches `showPrograms` custom event
- Used in `ProgramsSection.astro`
- Communicates with `AppIslands` via Custom Events (not Context)

**Note**: This is a separate island from `AppWrapper`, so it cannot use `useAppContext()`. It communicates by dispatching Custom Events that `AppIslands` listens to.

### `GlitchText.tsx`

**Purpose**: Text component with glitch animation effect

**Location**: `src/components/react/GlitchText.tsx`

**Props**:

```tsx
interface GlitchTextProps {
  text: string;
  className?: string;
}
```

## Component Patterns

### Props Interface

All components define TypeScript interfaces for props:

```tsx
interface MyComponentProps {
  required: string;
  optional?: number;
  callback: () => void;
}

const MyComponent: React.FC<MyComponentProps> = ({ required, optional, callback }) => {
  // Component implementation
};
```

### Context Usage

Components access global state via `useAppContext()`:

```tsx
import { useAppContext } from '../../contexts/AppContext';

const MyComponent: React.FC = () => {
  const { user, profile, workoutLogs } = useAppContext();
  // Use context values
};
```

### Event Dispatching

Components communicate via custom events:

```tsx
// Dispatch event
const event = new CustomEvent('selectWorkout', {
  detail: workout,
  bubbles: true,
});
window.dispatchEvent(event);

// Listen for event (in AppIslands)
window.addEventListener('selectWorkout', handleSelectWorkout);
```

### Modal Pattern

Modals follow this pattern:

```tsx
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div onClick={(e) => e.stopPropagation()}>{/* Modal content */}</motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

## Related Documentation

- [Astro Components](./astro-components.md)
- [Video Player](./video-player.md) - Complete guide to video functionality
- [App Context](../state-management/app-context.md)
- [Component State](../state-management/component-state.md)
- [Adding Components](../workflows/adding-components.md)

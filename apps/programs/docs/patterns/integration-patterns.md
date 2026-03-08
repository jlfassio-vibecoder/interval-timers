# Integration Patterns

## Overview

This document explains how Astro and React components work together, including client directives, portal usage, and cross-island communication patterns.

## Astro Pages Integrating React Components

### Basic Pattern

Astro pages import and use React components with client directives:

```astro
---
// src/pages/index.astro
import AppWrapper from '../components/react/AppWrapper';
import WorkoutCards from '../components/react/WorkoutCards';
---

<BaseLayout>
  <AppWrapper client:load />
  <WorkoutCards client:visible />
</BaseLayout>
```

### Client Directives

React components in Astro require a client directive to specify when/how they hydrate:

#### `client:load`

**Use for**: Critical components that need immediate interactivity

```astro
<AppWrapper client:load />
```

- Hydrates immediately when page loads
- Best for: Navigation, app wrappers, critical modals

#### `client:visible`

**Use for**: Components below the fold

```astro
<WorkoutCards client:visible />
```

- Hydrates when component enters viewport
- Best for: Content sections, cards, lists

#### `client:idle`

**Use for**: Non-critical components

```astro
<Analytics client:idle />
```

- Hydrates when browser is idle
- Best for: Analytics, non-critical features

#### `client:only="react"`

**Use for**: Components that require browser APIs

```astro
<ClientOnlyComponent client:only="react" />
```

- Skips SSR entirely
- Best for: Components using `window`, `document`, etc.

## Portal Usage

React portals allow rendering components outside their parent DOM hierarchy.

### AppWrapper Portal Pattern

`AppWrapper` uses portals to mount components at specific DOM locations:

```tsx
// src/components/react/AppWrapper.tsx
import { createPortal } from 'react-dom';

const AppWrapper: React.FC = () => {
  const [mountPoint, setMountPoint] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const element = document.getElementById('purchase-flow-mount');
    setMountPoint(element);
  }, []);

  return (
    <AppProvider>
      <AppIslands />
      {mountPoint && createPortal(<PurchaseFlow />, mountPoint)}
    </AppProvider>
  );
};
```

**HTML Mount Point**:

```astro
<!-- In index.astro -->
<div id="purchase-flow-mount"></div>
```

**Why Use Portals**:

- Render components at specific DOM locations
- Maintain React context while rendering elsewhere
- Useful for modals, tooltips, dropdowns

## Cross-Island Communication

React islands are isolated and cannot share props directly. Use custom DOM events for communication.

### Event Dispatching

Components dispatch custom events to communicate:

```tsx
// In WorkoutCards.tsx
const handleSelect = (workout: Artist) => {
  const event = new CustomEvent('selectWorkout', {
    detail: workout,
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(event);
};
```

### Event Listening

`AppIslands` listens for events and updates state:

```tsx
// In AppIslands.tsx
useEffect(() => {
  const handleSelectWorkout = (e: Event) => {
    const customEvent = e as CustomEvent<Artist>;
    if (customEvent.detail) {
      setSelectedArtist(customEvent.detail);
    }
  };

  window.addEventListener('selectWorkout', handleSelectWorkout);
  return () => window.removeEventListener('selectWorkout', handleSelectWorkout);
}, []);
```

### Available Events

- `selectWorkout` - Opens workout detail modal
  - Payload: `Artist` object
  - Dispatched by: `WorkoutCards`, `ProtocolDashboard`

- `showAuthModal` - Opens authentication modal
  - Payload: None
  - Dispatched by: Various components

- `showPrograms` - Opens programs grid
  - Payload: None
  - Dispatched by: `ProgramsButton`

## Keyboard Navigation

### Escape Key Handling

`AppIslands` handles Escape key for all modals:

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (selectedExercise && e.key === 'Escape') {
      setSelectedExercise(null);
      return;
    }
    if (showAuthModal && e.key === 'Escape') setShowAuthModal(false);
    // ... other modals
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [
  selectedArtist,
  showProgramsGrid,
  selectedProgram,
  showDashboard,
  showLogModal,
  showAuthModal,
  selectedExercise,
]);
```

### Component-Level Keyboard Handling

Components can handle keyboard events directly:

```tsx
// In ArtistCard.tsx
<div
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  }}
  tabIndex={0}
  role="button"
>
  {/* Card content */}
</div>
```

## Context Provider Pattern

### ⚠️ Important: Context Only Works Within a Single Island

React Context is provided at the top level of a React island:

```tsx
// AppWrapper.tsx (single React island)
<AppProvider>
  <AppIslands />
  {/* All components within this island can access context */}
</AppProvider>
```

**Within the same island**, all components can access context:

```tsx
// Any component within AppWrapper island
import { useAppContext } from '../../contexts/AppContext';

const MyComponent: React.FC = () => {
  const { user, profile } = useAppContext();
  // Works because we're in the same React instance
};
```

### Cross-Island State Sharing

**React Context does NOT work across separate islands**. Each `client:*` directive creates an isolated React instance:

- `AppWrapper` (client:load) = One React application
- `WorkoutCards` (client:visible) = **Separate** React application
- Context cannot be shared between them

**Solution: Use Nano Stores for cross-island state**

```tsx
// stores/userStore.ts
import { atom } from 'nanostores';

export const userStore = atom(null);

// In any island
import { useStore } from '@nanostores/react';
import { userStore } from '../../stores/userStore';

const MyComponent = () => {
  const user = useStore(userStore);
  // Works across all islands!
};
```

**Current Implementation**: This app uses Custom Events for cross-island communication, which works perfectly for the current architecture. `WorkoutCards` and `ProgramsButton` are separate islands that communicate with `AppIslands` via events.

### When to Use Custom Events vs Nano Stores

**Custom Events (Current Implementation)** - Use when:

- One-way communication: Islands dispatch events → Central coordinator updates state
- Simple action-based communication: User clicks → Event → State update
- No reactive subscriptions needed: Islands don't need to auto-update when state changes
- **Example**: `WorkoutCards` dispatches `selectWorkout` → `AppIslands` listens and opens modal

**Nano Stores** - Use when:

- Two-way reactive state: Multiple islands need to subscribe and auto-update
- Shared state subscriptions: Islands need to reactively display the same state
- Complex state management: Derived state, computed values across islands
- **Example**: If `WorkoutCards` needed to display current user name, it would need Nano Stores (can't access AppWrapper's Context)

## Component Hierarchy

```
index.astro (Astro Page)
  └── BaseLayout.astro
      └── AppWrapper (client:load) [React Island]
          └── AppProvider [Context]
              └── AppIslands [State Coordinator]
                  ├── Navigation
                  ├── ProtocolDashboard
                  ├── WorkoutDetailModal
                  ├── ExerciseDetailModal
                  └── [Other modals/components]

      └── WorkoutCards (client:visible) [React Island]
          └── ArtistCard (dispatches events)

      └── #purchase-flow-mount [DOM Element]
          └── PurchaseFlow (via portal)
```

## State Flow

### User Action → State Update

```
User clicks workout card
  └── WorkoutCards dispatches 'selectWorkout' event
      └── AppIslands listens and sets selectedArtist
          └── WorkoutDetailModal receives workout prop
              └── Modal displays
```

### Modal Interaction Flow

```
User clicks exercise in WorkoutDetailModal
  └── handleSelectExercise(exerciseName) called
      └── getExerciseDetails() looks up exercise
          └── setSelectedExercise(exercise)
              └── ExerciseDetailModal displays
```

## Best Practices

1. **Use appropriate client directives** - Balance performance and UX
2. **Centralize state in AppIslands** - Single source of truth for modals
3. **Use Custom Events for cross-island communication** - Islands can't share props or Context
4. **Handle keyboard navigation** - Support Escape key for all modals
5. **Use portals for dynamic mounting** - Render components at specific locations
6. **React Context works within one island only** - Components in separate islands cannot access Context
7. **Group related components in one island** - If they need shared Context, keep them together
8. **Custom Events are sufficient for most cases** - Only use Nano Stores if you need reactive two-way state sharing

## Common Patterns

### Modal Pattern

```tsx
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[120]"
    >
      <motion.div onClick={(e) => e.stopPropagation()}>{/* Modal content */}</motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

### Event Dispatch Pattern

```tsx
const handleAction = (data: SomeType) => {
  const event = new CustomEvent('actionName', {
    detail: data,
    bubbles: true,
  });
  window.dispatchEvent(event);
};
```

### Context Usage Pattern

```tsx
const { value, setValue } = useAppContext();
```

## Related Documentation

- [Astro Patterns](../architecture/astro-patterns.md)
- [App Context](../state-management/app-context.md)
- [Component State](../state-management/component-state.md)
- [File Naming](./file-naming.md)

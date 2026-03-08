# App Context - Global State Management

## Overview

The application uses React Context API for global state management. The `AppContext` provides user authentication state, profile data, workout logs, and purchase information to all React components.

**Location**: `src/contexts/AppContext.tsx`

**Provider**: `AppProvider` wraps the app in `src/components/react/AppWrapper.tsx`

## Context Structure

### Context Type

```tsx
interface AppContextType {
  // User state
  user: FirebaseUser | null;
  profile: UserProfile | null;

  // Workout data
  workoutLogs: WorkoutLog[];
  completedWorkouts: Set<string>;

  // Purchase state
  purchasedIndex: number | null;

  // Setters
  setProfile: (profile: UserProfile | null) => void;
  setWorkoutLogs: (logs: WorkoutLog[]) => void;
  setCompletedWorkouts: (workouts: Set<string>) => void;
  setPurchasedIndex: (index: number | null) => void;

  // Actions
  handleLogout: () => Promise<void>;
}
```

## Available Values

### `user: FirebaseUser | null`

Firebase authentication user object. `null` when not authenticated.

**Type**: `firebase/auth` `User` type

**Usage**:

```tsx
const { user } = useAppContext();
if (user) {
  console.log(user.uid, user.email);
}
```

### `profile: UserProfile | null`

User profile data from Firestore. Synced automatically on auth state change.

**Type**: `UserProfile` (from `@/types`)

**Structure**:

```tsx
interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string;
  isAdmin?: boolean;
  purchasedIndex?: number | null;
  createdAt: string;
}
```

**Usage**:

```tsx
const { profile } = useAppContext();
if (profile?.isAdmin) {
  // Admin functionality
}
```

### `workoutLogs: WorkoutLog[]`

Array of all workout logs for the current user. Fetched from Firestore on login.

**Type**: `WorkoutLog[]` (from `@/types`)

**Structure**:

```tsx
interface WorkoutLog {
  id: string;
  userId: string;
  workoutId?: string;
  workoutName: string;
  date: string;
  effort: number; // 1-10
  rating: number; // 1-5
  notes: string;
}
```

**Usage**:

```tsx
const { workoutLogs } = useAppContext();
const recentLogs = workoutLogs.slice(0, 5);
```

### `completedWorkouts: Set<string>`

Set of workout IDs that have been completed (logged). Used for UI indicators.

**Type**: `Set<string>`

**Usage**:

```tsx
const { completedWorkouts } = useAppContext();
const isCompleted = completedWorkouts.has(workoutId);
```

### `purchasedIndex: number | null`

Index of the purchased program. `null` if no purchase.

**Type**: `number | null`

**Usage**:

```tsx
const { purchasedIndex } = useAppContext();
if (purchasedIndex !== null) {
  // User has purchased a program
}
```

## Setters

### `setProfile(profile: UserProfile | null)`

Update the user profile in context.

**Usage**:

```tsx
const { setProfile } = useAppContext();
setProfile(updatedProfile);
```

### `setWorkoutLogs(logs: WorkoutLog[])`

Replace the workout logs array.

**Usage**:

```tsx
const { setWorkoutLogs, workoutLogs } = useAppContext();
setWorkoutLogs([newLog, ...workoutLogs]);
```

### `setCompletedWorkouts(workouts: Set<string>)`

Update the completed workouts set.

**Usage**:

```tsx
const { setCompletedWorkouts, completedWorkouts } = useAppContext();
const updated = new Set([...completedWorkouts, newWorkoutId]);
setCompletedWorkouts(updated);
```

### `setPurchasedIndex(index: number | null)`

Update the purchased program index.

**Usage**:

```tsx
const { setPurchasedIndex } = useAppContext();
setPurchasedIndex(programIndex);
```

## Actions

### `handleLogout(): Promise<void>`

Signs out the current user. Context automatically clears all state on logout.

**Usage**:

```tsx
const { handleLogout } = useAppContext();
await handleLogout();
```

## Using the Context

### Hook: `useAppContext()`

Import and use the hook in any React component:

```tsx
import { useAppContext } from '../../contexts/AppContext';

const MyComponent: React.FC = () => {
  const { user, profile, workoutLogs } = useAppContext();

  if (!user) {
    return <div>Please log in</div>;
  }

  return <div>Welcome, {profile?.displayName || user.email}</div>;
};
```

### Error Handling

The hook throws an error if used outside `AppProvider`:

```tsx
// ❌ This will throw
const MyComponent = () => {
  const context = useAppContext(); // Error: must be within AppProvider
};

// ✅ This works
<AppProvider>
  <MyComponent /> {/* Can use useAppContext() */}
</AppProvider>;
```

## State Flow

### Authentication Flow

```mermaid
graph TD
    A[User Logs In] --> B[onAuthStateChanged Fires]
    B --> C[syncUserProfile]
    C --> D[setProfile]
    B --> E[fetchWorkoutLogs]
    E --> F[setWorkoutLogs]
    E --> G[setCompletedWorkouts]
    B --> H[setPurchasedIndex]

    I[User Logs Out] --> J[onAuthStateChanged Fires]
    J --> K[Clear All State]
    K --> L[setProfile null]
    K --> M[setWorkoutLogs []]
    K --> N[setCompletedWorkouts Set]
    K --> O[setPurchasedIndex null]
```

### Data Updates

When workout logs are saved:

1. Component calls `saveWorkoutLog()` (Firebase service)
2. Component updates context: `setWorkoutLogs([newLog, ...workoutLogs])`
3. Component updates completed: `setCompletedWorkouts(new Set([...completedWorkouts, workoutId]))`
4. All components using context receive updates automatically

## Automatic State Sync

The context automatically syncs state when:

1. **User logs in**: Fetches profile and workout logs
2. **User logs out**: Clears all state
3. **Auth state changes**: Re-syncs all data

This happens via `useEffect` in `AppProvider`:

```tsx
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
    // Sync state based on auth state
  });
  return () => unsubscribe();
}, []);
```

## Best Practices

1. **Use the hook, not the context directly** - Always use `useAppContext()`
2. **Check for null values** - Always verify `user` or `profile` before use
3. **Update state immutably** - Create new arrays/sets when updating
4. **Don't mutate context directly** - Use setters provided by context

## Related Documentation

- [Component State](./component-state.md)
- [Firebase Service](../services/firebase-service.md)
- [React Components](../components/react-components.md)

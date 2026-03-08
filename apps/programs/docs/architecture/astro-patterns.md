# Astro Patterns and Architecture

## Overview

This application uses **Astro** as the primary framework with **React Islands** for interactive components. Astro provides excellent performance by shipping zero JavaScript by default, only hydrating React components where needed.

## Astro Islands Architecture

Astro uses an "islands architecture" where:

- Most content is **static HTML** (server-rendered, zero JS)
- Interactive components are **isolated islands** that hydrate on the client
- Each island is independent and can be loaded with different strategies

### File-Based Routing

Astro uses file-based routing in `src/pages/`:

- `src/pages/index.astro` → `/` (homepage)
- `src/pages/about.astro` → `/about`
- `src/pages/blog/[slug].astro` → `/blog/:slug` (dynamic routes)

See [Adding Pages](../workflows/adding-pages.md) for creating new pages.

## Astro vs React Components

### When to Use Astro Components (`*.astro`)

Use Astro components for:

- **Static content** that doesn't need interactivity
- **SEO-critical** sections (hero, headers, footers)
- **Layout structures** and page shells
- **Performance-critical** sections where zero JS is desired

**Location**: `src/components/astro/`

**Example**: `HeroSection.astro`, `Footer.astro`, `ProgramsSection.astro`

```astro
---
// Component script (runs at build time)
const { title } = Astro.props;
---

<div class="hero">
  <h1>{title}</h1>
  <slot />
  <!-- Children content -->
</div>
```

### When to Use React Components (`*.tsx`)

Use React components for:

- **Interactive UI** (modals, forms, buttons with state)
- **Client-side state management**
- **Event handlers** and user interactions
- **Dynamic content** that changes based on user actions

**Location**: `src/components/react/`

**Example**: `WorkoutDetailModal.tsx`, `AuthModal.tsx`, `AIChat.tsx`

```tsx
import { useState } from 'react';

const MyComponent: React.FC = () => {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
};
```

## Client Directives

When using React components in Astro, you must specify a **client directive** to control when/how the component hydrates:

### `client:load`

**Use for**: Critical interactive components that should load immediately

```astro
<AppWrapper client:load />
```

- Hydrates immediately when the page loads
- Best for: Navigation, critical modals, app wrappers

### `client:visible`

**Use for**: Components below the fold that can load when scrolled into view

```astro
<WorkoutCards client:visible />
```

- Hydrates when the component enters the viewport
- Best for: Content sections, cards, lists

### `client:idle`

**Use for**: Non-critical components that can wait for browser idle time

```astro
<Analytics client:idle />
```

- Hydrates when the browser is idle
- Best for: Analytics, non-critical features

### `client:only="react"`

**Use for**: Components that should only render on the client (skip SSR)

```astro
<ClientOnlyComponent client:only="react" />
```

- Skips server-side rendering entirely
- Best for: Components that rely on browser APIs

## Current Implementation

In `src/pages/index.astro`:

```astro
<AppWrapper client:load />
<!-- Loads immediately -->
<WorkoutCards client:visible />
<!-- Loads when visible -->
```

## SSR vs Client-Side Rendering

### Server-Side Rendering (SSR)

**Astro components** are rendered on the server by default:

- HTML is generated at build time (static) or request time (SSR mode)
- Zero JavaScript shipped to the client
- Perfect for SEO and initial page load

**Important**: By default, Astro is a **Static Site Generator (SSG)**. To enable real-time server rendering (SSR), you must:

1. Install an adapter (e.g., `@astrojs/node`, `@astrojs/vercel`, `@astrojs/netlify`)
2. Set `output: 'server'` in `astro.config.mjs`
3. Configure the adapter in your config

This is required for user-specific content that renders on the server at request time.

### Client-Side Hydration

**React components** with client directives:

- Initial HTML may be server-rendered (if SSR enabled)
- JavaScript hydrates the component on the client
- Interactive functionality becomes available

## Integration Pattern

The app follows this pattern:

1. **Astro page** (`index.astro`) provides the shell
2. **Astro components** render static sections
3. **React islands** handle interactivity
4. **AppWrapper** provides React context to components within its island
5. **Separate islands** communicate via Custom Events (not Context)

```astro
---
// src/pages/index.astro
import BaseLayout from '../layouts/BaseLayout.astro';
import HeroSection from '../components/astro/HeroSection.astro';
import AppWrapper from '../components/react/AppWrapper';
import WorkoutCards from '../components/react/WorkoutCards';
---

<BaseLayout>
  <HeroSection />
  <!-- Static Astro -->
  <AppWrapper client:load />
  <!-- React Island 1: Has Context -->
  <WorkoutCards client:visible />
  <!-- React Island 2: Uses Events -->
</BaseLayout>
```

### Island Communication

**Within AppWrapper island**: Components can use React Context

- `AppIslands`, `Navigation`, `AIChat`, `PurchaseFlow` all have access to `AppContext`

**Between separate islands**: Use Custom Events

- `WorkoutCards` (separate island) dispatches `selectWorkout` event
- `ProgramsButton` (separate island) dispatches `showPrograms` event
- `AppIslands` (in AppWrapper) listens to these events

**Why**: Each `client:*` directive creates an isolated React instance. Context cannot cross island boundaries.

### Custom Events vs Nano Stores

**Current Implementation: Custom Events**

This app uses Custom Events for cross-island communication, which is sufficient for the current architecture:

- **One-way communication**: Islands dispatch events → AppIslands listens and updates state
- **Simple and lightweight**: No additional dependencies required
- **Works well for**: User actions triggering state changes in a central coordinator

**Example**:

```tsx
// WorkoutCards (separate island)
window.dispatchEvent(new CustomEvent('selectWorkout', { detail: workout }));

// AppIslands (in AppWrapper island)
window.addEventListener('selectWorkout', handleSelectWorkout);
```

**When Nano Stores Would Be Beneficial**

Nano Stores would be useful if you need:

- **Reactive two-way state**: Multiple islands need to reactively update when state changes
- **Shared state subscriptions**: Islands need to subscribe to the same state and auto-update
- **Complex state management**: Multiple stores with computed values, derived state, etc.

**Example use case**: If `WorkoutCards` needed to display the current user's name (from AppContext), it would need Nano Stores because it can't access Context from AppWrapper.

**Current Status**: Nano Stores are **not required** for this app. Custom Events handle all cross-island communication effectively.

## Best Practices

1. **Prefer Astro for static content** - Better performance, SEO, and initial load
2. **Use React only when needed** - Interactive features, state management
3. **Choose appropriate client directives** - Balance between performance and UX
4. **Keep islands small** - Smaller bundles = faster hydration
5. **Use `client:visible` for below-fold content** - Defer non-critical hydration
6. **Use Nano Stores for cross-island state** - React Context only works within a single island
7. **Consider island boundaries** - Group related components in one island if they need shared Context

## Related Documentation

- [Directory Structure](./directory-structure.md)
- [React Components](../components/react-components.md)
- [Integration Patterns](../patterns/integration-patterns.md)
- [Adding Components](../workflows/adding-components.md)

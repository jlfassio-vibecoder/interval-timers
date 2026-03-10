# AI Fitcopilot - Documentation

Welcome to the AI Fitcopilot documentation. This directory contains comprehensive guides for understanding and working with the codebase architecture, components, patterns, and workflows.

## Quick Navigation

### Architecture

- **[Astro Patterns](./architecture/astro-patterns.md)** - Understanding Astro Islands, SSR, and component architecture
- **[Directory Structure](./architecture/directory-structure.md)** - Complete directory tree and organization patterns

### Components

- **[Astro Components](./components/astro-components.md)** - Static/SEO-friendly Astro components
- **[React Components](./components/react-components.md)** - Interactive React components catalog

### State Management

- **[App Context](./state-management/app-context.md)** - Global state via React Context API
- **[Component State](./state-management/component-state.md)** - Local state and event-driven communication

### Services

- **[Firebase Service](./services/firebase-service.md)** - Firebase integration, auth, and data persistence
- **[Gemini Service](./services/gemini-service.md)** - AI chat integration with Vertex AI

### Data

- **[Data Structures](./data/data-structures.md)** - Static data files, types, and data organization

### Patterns

- **[File Naming](./patterns/file-naming.md)** - Naming conventions and import patterns
- **[Integration Patterns](./patterns/integration-patterns.md)** - How Astro and React components work together

### Configuration

- **[Astro Config](./configuration/astro-config.md)** - Astro configuration and integrations
- **[TypeScript Config](./configuration/typescript.md)** - TypeScript setup and path aliases

### Workflows

- **[Adding Components](./workflows/adding-components.md)** - Step-by-step guide for new components
- **[Adding Pages](./workflows/adding-pages.md)** - Creating new Astro pages

## Quick Reference

### Key Files

- **Entry Point**: `src/pages/index.astro`
- **React Root**: `src/components/react/AppWrapper.tsx`
- **State Coordinator**: `src/components/react/AppIslands.tsx`
- **Global State**: `src/contexts/AppContext.tsx`
- **Type Definitions**: `src/types.ts`

### Key Functions

- `useAppContext()` - Access global app state
- `getExerciseDetails()` - Lookup exercise data
- `handleSelectExercise()` - Open exercise detail modal
- `handleSaveLog()` - Persist workout logs
- `handleActivateProtocol()` - Activate a program

### Component Hierarchy

```
index.astro
  └── BaseLayout
      └── AppWrapper (client:load)
          └── AppProvider
              └── AppIslands
                  ├── Navigation
                  ├── ProtocolDashboard
                  ├── WorkoutDetailModal
                  ├── ExerciseDetailModal
                  └── [other modals/components]
```

## Getting Started

1. **New to the codebase?** Start with [Directory Structure](./architecture/directory-structure.md)
2. **Adding a component?** Check [Adding Components](./workflows/adding-components.md)
3. **Understanding state?** Read [App Context](./state-management/app-context.md)
4. **Working with services?** See [Firebase Service](./services/firebase-service.md)

## Documentation Style

All documentation includes:

- Actual file paths and component names
- Code examples with real implementations
- "When to use" guidance
- Cross-references to related docs
- Decision trees where helpful

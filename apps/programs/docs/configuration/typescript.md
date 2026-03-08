# TypeScript Configuration

## Overview

This document explains the TypeScript configuration and type system used in the project.

**Location**: `tsconfig.json`

## Configuration File

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "types": ["node", "astro/client"],
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "moduleDetection": "force",
    "allowJs": true,
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "paths": {
      "@/*": ["./src/*"]
    },
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "baseUrl": ".",
    "strict": true
  },
  "include": ["src/**/*"]
}
```

## Base Configuration

**Extends**: `astro/tsconfigs/strict`

- Inherits Astro's strict TypeScript settings
- Ensures compatibility with Astro framework

## Compiler Options

### Target and Module

```json
"target": "ES2022",
"module": "ESNext"
```

- **target**: Compiles to ES2022 syntax
- **module**: Uses ESNext module system

### Libraries

```json
"lib": [
  "ES2022",
  "DOM",
  "DOM.Iterable"
]
```

- **ES2022**: Modern JavaScript features
- **DOM**: Browser DOM APIs
- **DOM.Iterable**: Iterable DOM collections

### Type Checking

```json
"skipLibCheck": true,
"strict": true
```

- **skipLibCheck**: Skips type checking of declaration files (faster builds)
- **strict**: Enables all strict type checking options

### JSX Configuration

```json
"jsx": "react-jsx",
"jsxImportSource": "react"
```

- **jsx**: Uses React 17+ JSX transform (no need to import React)
- **jsxImportSource**: React as JSX factory

### Module Resolution

```json
"moduleResolution": "bundler",
"isolatedModules": true,
"moduleDetection": "force"
```

- **moduleResolution**: Uses bundler resolution (Vite)
- **isolatedModules**: Ensures each file can be transpiled independently
- **moduleDetection**: Forces module detection

### Path Aliases

```json
"paths": {
  "@/*": [
    "./src/*"
  ]
},
"baseUrl": "."
```

- **paths**: Maps `@/` to `./src/`
- **baseUrl**: Base directory for non-relative module names

**Usage**:

```tsx
import type { Artist } from '@/types';
import { useAppContext } from '@/contexts/AppContext';
```

### Other Options

```json
"allowJs": true,
"allowImportingTsExtensions": true,
"noEmit": true
```

- **allowJs**: Allows JavaScript files in project
- **allowImportingTsExtensions**: Allows importing with `.ts` extensions
- **noEmit**: Doesn't emit files (Astro handles compilation)

## Type Definitions

### Included Types

```json
"types": [
  "node",
  "astro/client"
]
```

- **node**: Node.js type definitions
- **astro/client**: Astro client-side types

### Custom Types

**Location**: `src/types.ts`

All application types are defined in a single file:

```tsx
export interface UserProfile {
  uid: string;
  email: string | null;
  // ...
}

export interface Artist {
  id: string;
  name: string;
  // ...
}
```

**Import Pattern**:

```tsx
import type { Artist, Program, WorkoutLog } from '@/types';
```

### Environment Types

**Location**: `src/env.d.ts`

Astro automatically generates environment variable types.

## Type Safety Patterns

### Component Props

Always define props interfaces:

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

### Service Functions

Use proper return types:

```tsx
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  // Implementation
};
```

### Context Types

Define context type interface:

```tsx
interface AppContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  // ...
}

const AppContext = createContext<AppContextType | undefined>(undefined);
```

## Type Guards

Use type guards for unknown types:

```tsx
if (error instanceof Error) {
  console.error(error.message);
}
```

## Best Practices

1. **Use strict mode** - Catches more errors at compile time
2. **Define interfaces** - Don't use `any` types
3. **Import types separately** - Use `import type` for type-only imports
4. **Use path aliases** - `@/` for cleaner imports
5. **Type service functions** - Always specify return types
6. **Use type guards** - Check types before using unknown values

## Common Type Patterns

### Nullable Types

```tsx
const value: string | null = null;
```

### Optional Properties

```tsx
interface Props {
  required: string;
  optional?: number;
}
```

### Generic Types

```tsx
function getValue<T>(key: string): T | null {
  // Implementation
}
```

### Union Types

```tsx
type Status = 'pending' | 'completed' | 'failed';
```

## Related Documentation

- [Astro Config](./astro-config.md)
- [Data Structures](../data/data-structures.md)
- [File Naming](../patterns/file-naming.md)

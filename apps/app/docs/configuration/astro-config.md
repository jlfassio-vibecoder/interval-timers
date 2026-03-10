# Astro Configuration

## Overview

This document explains the Astro configuration file and its settings.

**Location**: `astro.config.mjs`

## Configuration File

```javascript
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false, // We have custom base styles
    }),
  ],
  server: {
    port: 3002,
    host: true,
  },
  vite: {
    resolve: {
      alias: {
        '@': new URL('./src', import.meta.url).pathname,
      },
    },
  },
});
```

## Integrations

### React Integration

```javascript
react();
```

**Purpose**: Enables React component support in Astro

**Features**:

- React component rendering
- JSX support
- Client directives (`client:load`, `client:visible`, etc.)

**Package**: `@astrojs/react`

### Tailwind Integration

```javascript
tailwind({
  applyBaseStyles: false,
});
```

**Purpose**: Enables Tailwind CSS support

**Configuration**:

- `applyBaseStyles: false` - Disables default Tailwind base styles
- Custom base styles are in `src/styles/global.css`

**Package**: `@astrojs/tailwind`

## Server Configuration

```javascript
server: {
  port: 3002,
  host: true
}
```

**Settings**:

- `port: 3002` - Development server port
- `host: true` - Allows access from network (not just localhost)

**Usage**: Run `npm run dev` to start development server on port 3002

## Vite Configuration

### Path Alias

```javascript
vite: {
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname
    }
  }
}
```

**Purpose**: Creates `@/` alias pointing to `src/` directory

**Usage**:

```tsx
// Instead of:
import { Artist } from '../../types';

// Use:
import { Artist } from '@/types';
```

**Benefits**:

- Cleaner imports
- No relative path navigation (`../../`)
- Consistent across project

## Build Output

**Mode**: Static (default)

Astro builds static HTML by default. All pages are pre-rendered at build time.

**Output Directory**: `dist/`

## Environment Variables

Astro uses Vite's environment variable system:

- `PUBLIC_*` - Exposed to client-side code
- Other variables - Server-side only

**Example**:

```javascript
// Accessible in client code
const apiKey = import.meta.env.PUBLIC_FIREBASE_API_KEY;

// Server-side only
const secret = import.meta.env.SECRET_KEY;
```

## Related Configuration Files

- `tailwind.config.mjs` - Tailwind CSS configuration
- `tsconfig.json` - TypeScript configuration
- `package.json` - Dependencies and scripts

## Scripts

Defined in `package.json`:

- `npm run dev` - Start development server (port 3002)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm start` - Start production server

## Best Practices

1. **Keep integrations minimal** - Only add what you need
2. **Use path aliases** - `@/` for cleaner imports
3. **Configure server appropriately** - Set port and host for your needs
4. **Environment variables** - Use `PUBLIC_*` prefix for client-side vars

## Related Documentation

- [TypeScript Config](./typescript.md)
- [Astro Patterns](../architecture/astro-patterns.md)
- [Directory Structure](../architecture/directory-structure.md)

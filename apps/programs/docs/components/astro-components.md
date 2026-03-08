# Astro Components

## Overview

Astro components are static, server-rendered components that ship zero JavaScript to the client. They're perfect for SEO-critical content, headers, footers, and static sections.

**Location**: `src/components/astro/`

**File Pattern**: `ComponentName.astro`

## Component List

### `HeroSection.astro`

**Purpose**: Landing page hero section with animated marquee banners

**Location**: `src/components/astro/HeroSection.astro`

**Usage**: Imported in `src/pages/index.astro`

**Features**:

- Full viewport height hero section
- Animated marquee text banners
- SEO-friendly static HTML
- Responsive typography

**Props**: None (static component)

**Example**:

```astro
---
import HeroSection from '../components/astro/HeroSection.astro';
---

<HeroSection />
```

### `WorkoutsHeader.astro`

**Purpose**: Header section for the workouts listing area

**Location**: `src/components/astro/WorkoutsHeader.astro`

**Usage**: Imported in `src/pages/index.astro` before `WorkoutCards`

**Features**:

- Section title and description
- Static content for SEO

### `ProgramsSection.astro`

**Purpose**: Programs showcase section with image and feature highlights

**Location**: `src/components/astro/ProgramsSection.astro`

**Usage**: Imported in `src/pages/index.astro` in the `#programs` section

**Features**:

- Two-column layout (text + image)
- Feature highlights with icons
- Integrated React island: `ProgramsButton` (with `client:load`)
- Static content with one interactive element

**React Integration**:

```astro
---
import ProgramsButton from '../react/ProgramsButton';
---

<ProgramsButton client:load />
```

### `Footer.astro`

**Purpose**: Site footer with branding and links

**Location**: `src/components/astro/Footer.astro`

**Usage**: Imported in `src/pages/index.astro` at the bottom

**Features**:

- Brand name
- Social links
- Static HTML for SEO

## Astro Component Structure

### Frontmatter (Component Script)

```astro
---
// Runs at build time (SSR) or request time (SSR mode)
const { title, description } = Astro.props;

// Can fetch data, compute values, etc.
const data = await fetch('...');
---
```

### Template

```astro
<!-- HTML template with Astro expressions -->
<div class="component">
  <h1>{title}</h1>
  <slot />
  <!-- Children content -->
</div>
```

### Styles

```astro
<style>
  /* Scoped styles (by default) */
  .component {
    color: red;
  }
</style>
```

## When to Create New Astro Components

Create an Astro component when:

1. **Static content** - No interactivity needed
2. **SEO critical** - Content that search engines need to index
3. **Performance** - Want zero JavaScript for this section
4. **Reusable static sections** - Headers, footers, static cards

**Don't create** an Astro component when:

- You need state management
- You need event handlers
- You need client-side interactivity
- You need React hooks

## Props and Slots

### Props

Props are defined in the frontmatter:

```astro
---
interface Props {
  title: string;
  description?: string;
}

const { title, description = 'Default' } = Astro.props;
---

<h1>{title}</h1>
<p>{description}</p>
```

### Slots

Slots allow passing children:

```astro
<!-- Component -->
<div class="card">
  <slot />
</div>

<!-- Usage -->
<Card>
  <p>This content goes in the slot</p>
</Card>
```

### Named Slots

```astro
<!-- Component -->
<div class="layout">
  <header><slot name="header" /></header>
  <main><slot /></main>
</div>

<!-- Usage -->
<Layout>
  <Fragment slot="header">Header Content</Fragment>
  <p>Main content</p>
</Layout>
```

## Best Practices

1. **Keep components focused** - One component, one purpose
2. **Use props for customization** - Make components reusable
3. **Scoped styles by default** - Styles don't leak to other components
4. **SEO-friendly markup** - Use semantic HTML
5. **Performance first** - No unnecessary JavaScript

## Integration with React

Astro components can include React components as islands:

```astro
---
import MyReactComponent from '../react/MyReactComponent';
---

<div class="static-content">
  <p>Static Astro content</p>
  <MyReactComponent client:load />
</div>
```

## Related Documentation

- [Astro Patterns](../architecture/astro-patterns.md)
- [React Components](./react-components.md)
- [Integration Patterns](../patterns/integration-patterns.md)
- [Adding Components](../workflows/adding-components.md)

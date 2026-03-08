# Adding Pages

## Overview

This guide explains how to create new Astro pages using file-based routing.

## File-Based Routing

Astro uses file-based routing in the `src/pages/` directory:

- File name = route path
- `index.astro` → `/` (homepage)
- `about.astro` → `/about`
- `blog/[slug].astro` → `/blog/:slug` (dynamic route)

## Step-by-Step Guide

### 1. Create Page File

Create a new `.astro` file in `src/pages/`:

**Example**: `src/pages/about.astro`

### 2. Import Base Layout

All pages should use `BaseLayout`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout>
  <!-- Page content -->
</BaseLayout>
```

### 3. Add Page Content

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout>
  <div class="min-h-screen text-white">
    <h1>About Page</h1>
    <p>Page content goes here</p>
  </div>
</BaseLayout>
```

### 4. Add React Components (if needed)

Import and use React components with client directives:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import MyReactComponent from '../components/react/MyReactComponent';
---

<BaseLayout>
  <div class="min-h-screen text-white">
    <h1>About Page</h1>
    <MyReactComponent client:load />
  </div>
</BaseLayout>
```

### 5. Add Astro Components (if needed)

Import and use Astro components:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import HeroSection from '../components/astro/HeroSection.astro';
---

<BaseLayout>
  <HeroSection />
  <div class="min-h-screen text-white">
    <h1>About Page</h1>
  </div>
</BaseLayout>
```

## Page Templates

### Basic Page

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout>
  <div class="min-h-screen p-8 text-white">
    <h1>Page Title</h1>
    <p>Page content</p>
  </div>
</BaseLayout>
```

### Page with React Islands

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import AppWrapper from '../components/react/AppWrapper';
import WorkoutCards from '../components/react/WorkoutCards';
---

<BaseLayout>
  <div class="relative min-h-screen text-white">
    <AppWrapper client:load />
    <WorkoutCards client:visible />
  </div>
</BaseLayout>
```

### Page with Astro Sections

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import HeroSection from '../components/astro/HeroSection.astro';
import Footer from '../components/astro/Footer.astro';
---

<BaseLayout>
  <HeroSection />

  <section class="py-20">
    <div class="mx-auto max-w-7xl px-4">
      <h2>Section Title</h2>
      <p>Section content</p>
    </div>
  </section>

  <Footer />
</BaseLayout>
```

## Dynamic Routes

### Single Parameter

**File**: `src/pages/blog/[slug].astro`

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';

const { slug } = Astro.params;
---

<BaseLayout>
  <div class="min-h-screen p-8 text-white">
    <h1>Blog Post: {slug}</h1>
  </div>
</BaseLayout>
```

**Route**: `/blog/my-post` → `slug = "my-post"`

### Multiple Parameters

**File**: `src/pages/blog/[year]/[month]/[slug].astro`

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';

const { year, month, slug } = Astro.params;
---

<BaseLayout>
  <div class="min-h-screen p-8 text-white">
    <h1>{year}/{month}: {slug}</h1>
  </div>
</BaseLayout>
```

**Route**: `/blog/2024/01/my-post` → `year = "2024"`, `month = "01"`, `slug = "my-post"`

### Rest Parameters

**File**: `src/pages/docs/[...path].astro`

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';

const { path } = Astro.params;
const pathArray = path ? path.split('/') : [];
---

<BaseLayout>
  <div class="min-h-screen p-8 text-white">
    <h1>Docs: {pathArray.join(' / ')}</h1>
  </div>
</BaseLayout>
```

**Route**: `/docs/getting-started/installation` → `path = "getting-started/installation"`

## Page Metadata

### Title and Description

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';

const title = 'About Us';
const description = 'Learn more about our company';
---

<BaseLayout title={title}>
  <div class="min-h-screen p-8 text-white">
    <h1>{title}</h1>
    <p>{description}</p>
  </div>
</BaseLayout>
```

**Note**: `BaseLayout` accepts a `title` prop that sets the page title.

## Integration Checklist

- [ ] Page file created in `src/pages/`
- [ ] `BaseLayout` imported and used
- [ ] Page content added
- [ ] React components added with client directives (if needed)
- [ ] Astro components added (if needed)
- [ ] Tested in browser
- [ ] Route works correctly
- [ ] No build errors

## Examples

### Example 1: Simple About Page

**File**: `src/pages/about.astro`

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout title="About Us">
  <div class="min-h-screen p-8 text-white">
    <h1 class="mb-4 text-4xl font-bold">About Us</h1>
    <p class="text-lg">We are a fitness company...</p>
  </div>
</BaseLayout>
```

### Example 2: Page with React Component

**File**: `src/pages/workouts.astro`

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import WorkoutCards from '../components/react/WorkoutCards';
---

<BaseLayout title="Workouts">
  <div class="min-h-screen text-white">
    <div class="mx-auto max-w-7xl px-4 py-8">
      <h1 class="mb-8 text-4xl font-bold">All Workouts</h1>
      <WorkoutCards client:visible />
    </div>
  </div>
</BaseLayout>
```

### Example 3: Dynamic Route

**File**: `src/pages/workout/[id].astro`

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { WORKOUTS } from '../../data/workouts';

const { id } = Astro.params;
const workout = WORKOUTS.find((w) => w.id === id);
---

<BaseLayout title={workout?.name || 'Workout'}>
  {
    workout ? (
      <div class="min-h-screen p-8 text-white">
        <h1 class="mb-4 text-4xl font-bold">{workout.name}</h1>
        <p class="text-lg">{workout.description}</p>
      </div>
    ) : (
      <div class="min-h-screen p-8 text-white">
        <h1>Workout not found</h1>
      </div>
    )
  }
</BaseLayout>
```

## Best Practices

1. **Always use BaseLayout** - Ensures consistent HTML structure
2. **Set page titles** - Pass `title` prop to `BaseLayout`
3. **Use appropriate client directives** - Choose based on component importance
4. **Keep pages focused** - One page, one purpose
5. **Use dynamic routes for similar content** - Don't create separate files for each item
6. **Handle missing data** - Check for undefined/null in dynamic routes

## Route Examples

| File Path                        | Route         |
| -------------------------------- | ------------- |
| `src/pages/index.astro`          | `/`           |
| `src/pages/about.astro`          | `/about`      |
| `src/pages/blog/index.astro`     | `/blog`       |
| `src/pages/blog/[slug].astro`    | `/blog/:slug` |
| `src/pages/docs/[...path].astro` | `/docs/*`     |

## Related Documentation

- [Astro Patterns](../architecture/astro-patterns.md)
- [Directory Structure](../architecture/directory-structure.md)
- [Adding Components](./adding-components.md)
- [Integration Patterns](../patterns/integration-patterns.md)

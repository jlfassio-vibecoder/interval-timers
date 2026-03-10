# Adding Components

## Overview

This guide provides step-by-step instructions for adding new components to the project, including decision-making for Astro vs React components.

## Decision Tree: Astro vs React

```
Need interactivity or state?
├─ No → Use Astro Component
│   └─ Location: src/components/astro/
│
└─ Yes → Use React Component
    └─ Location: src/components/react/
```

### When to Use Astro Components

- Static content (no interactivity)
- SEO-critical sections
- Performance-critical areas (zero JS)
- Layout structures
- Headers, footers, static sections

### When to Use React Components

- Interactive UI (buttons, forms, modals)
- Client-side state management
- Event handlers
- Dynamic content based on user actions
- Components that need React hooks

## Step-by-Step Guide

### 1. Determine Component Type

Ask yourself:

- Does it need state or event handlers? → React
- Is it purely presentational? → Astro
- Does it need to be SEO-friendly? → Astro

### 2. Choose Location

**Astro Component**: `src/components/astro/YourComponent.astro`

**React Component**: `src/components/react/YourComponent.tsx`

### 3. Create Component File

#### Astro Component Template

```astro
---
// Component script (runs at build time)
interface Props {
  title: string;
  description?: string;
}

const { title, description = 'Default' } = Astro.props;
---

<div class="component">
  <h1>{title}</h1>
  {description && <p>{description}</p>}
  <slot />
</div>

<style>
  .component {
    /* Scoped styles */
  }
</style>
```

#### React Component Template

```tsx
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { SomeType } from '@/types';

interface YourComponentProps {
  required: string;
  optional?: number;
  onAction: () => void;
}

const YourComponent: React.FC<YourComponentProps> = ({ required, optional, onAction }) => {
  return (
    <div className="component">
      <h1>{required}</h1>
      {optional && <p>{optional}</p>}
      <button onClick={onAction}>Action</button>
    </div>
  );
};

export default YourComponent;
```

### 4. Define Props Interface

**Astro**: Define in frontmatter

```astro
---
interface Props {
  title: string;
}
const { title } = Astro.props;
---
```

**React**: Define TypeScript interface

```tsx
interface YourComponentProps {
  title: string;
}
```

### 5. Add Types (if needed)

If using custom types, add to `src/types.ts`:

```tsx
export interface YourType {
  id: string;
  name: string;
}
```

### 6. Import Dependencies

**Common Imports**:

```tsx
// React
import React, { useState } from 'react';

// Framer Motion
import { motion, AnimatePresence } from 'framer-motion';

// Icons
import { IconName } from 'lucide-react';

// Types
import type { Artist, Program } from '@/types';

// Context
import { useAppContext } from '@/contexts/AppContext';

// Services
import { someFunction } from '@/services/someService';
```

### 7. Integrate Component

#### In Astro Page

```astro
---
import YourComponent from '../components/astro/YourComponent.astro';
import YourReactComponent from '../components/react/YourReactComponent';
---

<YourComponent title="Hello" />
<YourReactComponent client:load required="value" />
```

#### In React Component

```tsx
import YourComponent from './YourComponent';

const ParentComponent: React.FC = () => {
  return <YourComponent required="value" />;
};
```

### 8. Choose Client Directive (React only)

- `client:load` - Critical, load immediately
- `client:visible` - Below fold, load when visible
- `client:idle` - Non-critical, load when idle
- `client:only="react"` - Skip SSR, client-only

## Integration Checklist

- [ ] Component file created in correct location
- [ ] Props interface defined
- [ ] Types added to `src/types.ts` (if needed)
- [ ] Dependencies imported
- [ ] Component exported
- [ ] Integrated into parent component/page
- [ ] Client directive added (React components)
- [ ] Tested in browser
- [ ] No TypeScript errors
- [ ] No console errors

## Examples

### Example 1: Static Astro Component

**File**: `src/components/astro/FeatureCard.astro`

```astro
---
interface Props {
  title: string;
  description: string;
  icon: string;
}

const { title, description, icon } = Astro.props;
---

<div class="feature-card">
  <div class="icon">{icon}</div>
  <h3>{title}</h3>
  <p>{description}</p>
</div>

<style>
  .feature-card {
    padding: 1rem;
    border: 1px solid white/10;
  }
</style>
```

**Usage**:

```astro
<FeatureCard title="Feature" description="Description" icon="🔥" />
```

### Example 2: Interactive React Component

**File**: `src/components/react/Counter.tsx`

```tsx
import React, { useState } from 'react';

interface CounterProps {
  initialValue?: number;
  onCountChange?: (count: number) => void;
}

const Counter: React.FC<CounterProps> = ({ initialValue = 0, onCountChange }) => {
  const [count, setCount] = useState(initialValue);

  const increment = () => {
    const newCount = count + 1;
    setCount(newCount);
    onCountChange?.(newCount);
  };

  return (
    <div>
      <button onClick={increment}>Count: {count}</button>
    </div>
  );
};

export default Counter;
```

**Usage**:

```astro
<Counter client:load initialValue={0} />
```

### Example 3: Modal Component

**File**: `src/components/react/MyModal.tsx`

```tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface MyModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const MyModal: React.FC<MyModalProps> = ({ isOpen, onClose, title, children }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[120] bg-black/95"
        >
          <motion.div
            initial={{ scale: 0.9, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 40 }}
            onClick={(e) => e.stopPropagation()}
            className="relative rounded-3xl border border-white/10 bg-[#0d0500] p-8"
          >
            <button onClick={onClose}>
              <X className="h-6 w-6" />
            </button>
            <h2>{title}</h2>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MyModal;
```

## Best Practices

1. **Follow naming conventions** - PascalCase for components
2. **Define props interfaces** - Always type your props
3. **Use appropriate client directive** - Balance performance and UX
4. **Keep components focused** - One component, one purpose
5. **Extract reusable logic** - Don't duplicate code
6. **Test in isolation** - Ensure component works standalone
7. **Document complex props** - Add JSDoc comments if needed

## Common Patterns

### Conditional Rendering

```tsx
{
  condition && <Component />;
}
```

### List Rendering

```tsx
{
  items.map((item) => <ItemComponent key={item.id} item={item} />);
}
```

### Event Handling

```tsx
const handleClick = () => {
  // Handle click
};

<button onClick={handleClick}>Click</button>;
```

## Related Documentation

- [Astro Patterns](../architecture/astro-patterns.md)
- [React Components](../components/react-components.md)
- [File Naming](../patterns/file-naming.md)
- [Adding Pages](./adding-pages.md)

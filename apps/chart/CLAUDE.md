# CLAUDE.md - Chart (Svelte 5)

This file provides guidance to **Claude Code** when working with the **chart** Svelte 5 application.

## Project Overview

Chart is a Mermaid-based diagram and chart editor built with **Svelte 5** and **SvelteKit**. It provides a live editor for creating diagrams with real-time preview, export capabilities, and collaboration features.

## Technology Stack

- **Framework**: Svelte 5.23.2
- **Meta-Framework**: SvelteKit 2.20.3
- **Build Tool**: Vite 5.4.14
- **Styling**: Tailwind CSS 4.0.15 (CSS-first configuration)
- **UI Components**: Bits UI, Paneforge, Svelte Sonner
- **Icons**: Lucide Svelte, Unplugin Icons
- **Code Editor**: Monaco Editor 0.52.2
- **Diagram Engine**: Mermaid 11.6.0
- **State Management**: Svelte stores (built-in)
- **Testing**: Vitest 2.1.9, Playwright
- **Utilities**: clsx, tailwind-merge, tailwind-variants

## MCP Integration

**Use the Svelte MCP** for all Svelte-specific queries and code generation.

The MCP provides:

- Svelte 5 runes ($state, $derived, $effect)
- Component composition patterns
- SvelteKit routing and data loading
- Reactivity best practices
- Performance optimization

## Design System - CRITICAL

**ALL UI COMPONENTS MUST FOLLOW THE IDEM DESIGN SYSTEM**

**🚨 MANDATORY: This project uses Tailwind CSS 4.x and `@idem/shared-styles` package.**

### Shared Styles Integration

This project uses the **`@idem/shared-styles`** package for consistent design.

**Installation:**

```bash
pnpm add @idem/shared-styles
```

**Import in src/app.postcss:**

```css
/* Import shared design system (includes Tailwind 4) */
@import '@idem/shared-styles/styles.css';

/* External fonts */
@import '@fortawesome/fontawesome-free/css/all.min.css';
@import '@fontsource-variable/recursive/crsv.css';
```

**Tailwind config extends shared config:**

```js
import sharedConfig from '@idem/shared-styles/tailwind.config';

export default {
  ...sharedConfig,
  content: ['./src/**/*.{html,js,svelte,ts}']
  // Keep chart-specific colors for UI components
};
```

### Theme Configuration

The design system is defined in `@idem/shared-styles`. **ALWAYS** use this shared package.

#### Core Colors (oklch)

All colors use **oklch** color space from `@idem/shared-styles`:

```css
--color-primary: oklch(0.55 0.22 264) /* Blue */ --color-secondary: oklch(0.6 0.25 328)
  /* Magenta */ --color-accent: oklch(0.75 0.15 195) /* Cyan */ --color-bg-dark: oklch(0.1 0.01 264)
  /* Dark background */ --color-bg-light: oklch(0.15 0.01 264) /* Light background */
  --color-light-text: oklch(0.96 0 0) /* White text */ --color-success: oklch(0.55 0.15 145)
  /* Green */ --color-danger: oklch(0.58 0.2 25) /* Red */ --color-warning: oklch(0.7 0.18 75)
  /* Orange */;
```

**DO NOT redefine these variables** - they come from `@idem/shared-styles`.

#### Glass Morphism Classes

**Use classes from `@idem/shared-styles`:**

```svelte
<!-- Standard glass effect -->
<div class="glass rounded-2xl p-6">
  <!-- Content -->
</div>

<!-- Darker glass -->
<div class="glass-dark rounded-2xl p-6">
  <!-- Content -->
</div>

<!-- Glass card with hover -->
<div class="glass-card p-6">
  <!-- Content -->
</div>
```

**DO NOT redefine these classes** - they are provided by `@idem/shared-styles`.

#### Button Components

**Use classes from `@idem/shared-styles`:**

```svelte
<!-- Primary button with gradient -->
<button class="inner-button"> Primary Action </button>

<!-- Secondary glass button -->
<button class="outer-button"> Secondary Action </button>

<!-- With Tailwind utilities -->
<button class="inner-button hover:-translate-y-0.5"> Hover Effect </button>
```

#### Input Components

**Use `.input` class from `@idem/shared-styles`:**

```svelte
<script lang="ts">
  let value = $state('');
</script>

<div class="w-full">
  <label class="text-light-text mb-2 block text-sm"> Label </label>
  <input class="input" bind:value placeholder="Enter text" />
</div>
```

### Tailwind CSS 4 Guidelines

**🚨 CRITICAL**: This project uses Tailwind CSS 4 ONLY. Never use Tailwind v3 syntax.

#### Tailwind 4 Syntax - MANDATORY

| ❌ NEVER USE (v3)   | ✅ ALWAYS USE (v4)      |
| ------------------- | ----------------------- |
| `@tailwind base`    | `@import 'tailwindcss'` |
| `bg-opacity-50`     | `bg-black/50`           |
| `text-opacity-80`   | `text-white/80`         |
| `flex-shrink-0`     | `shrink-0`              |
| `flex-grow-1`       | `grow`                  |
| `overflow-ellipsis` | `text-ellipsis`         |

**Examples:**

```svelte
<!-- ✅ Correct (v4) -->
<div class="bg-black/50 text-white/80 shrink-0">

<!-- ❌ Wrong (v3) - DO NOT USE -->
<div class="bg-opacity-50 text-opacity-80 flex-shrink-0">
```

## Svelte 5 Best Practices

**🚨 Use shared configuration - DO NOT redefine design tokens**

```js
// tailwind.config.js
import sharedConfig from '@idem/shared-styles/tailwind.config';

/** @type {import('tailwindcss').Config} */
export default {
  ...sharedConfig,
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      ...sharedConfig.theme.extend
      // Only add Svelte-specific extensions if absolutely necessary
      // DO NOT redefine colors, fonts, or other design tokens
    }
  },
  plugins: []
};
```

**Colors, fonts, and design tokens come from `@idem/shared-styles` - never redefine them.**

## Svelte 5 Best Practices

### Runes - The New Reactivity System

**Use Svelte 5 runes instead of old reactive statements:**

#### $state - Reactive State

```svelte
<script lang="ts">
  let count = $state(0);
  let user = $state({ name: 'John', age: 30 });

  function increment() {
    count++;
  }

  function updateUser() {
    user.age++;
  }
</script>

<div class="glass-card p-6">
  <h2 class="text-light-text mb-4 text-2xl">Count: {count}</h2>
  <p class="mb-4 text-white/80">User: {user.name}, Age: {user.age}</p>

  <button class="inner-button" onclick={increment}> Increment Count </button>

  <button class="outer-button ml-2" onclick={updateUser}> Increment Age </button>
</div>
```

#### $derived - Computed Values

```svelte
<script lang="ts">
  let count = $state(0);
  let doubled = $derived(count * 2);
  let message = $derived(count > 10 ? 'High' : 'Low');
</script>

<div class="glass-card p-6">
  <p class="text-light-text">Count: {count}</p>
  <p class="text-white/80">Doubled: {doubled}</p>
  <p class="text-accent">Status: {message}</p>
</div>
```

#### $effect - Side Effects

```svelte
<script lang="ts">
  let count = $state(0);

  $effect(() => {
    console.log('Count changed:', count);
    document.title = `Count: ${count}`;
  });

  $effect(() => {
    const interval = setInterval(() => {
      count++;
    }, 1000);

    return () => clearInterval(interval);
  });
</script>
```

#### $props - Component Props

```svelte
<script lang="ts">
  interface Props {
    title: string;
    count?: number;
    onIncrement?: () => void;
  }

  let { title, count = 0, onIncrement }: Props = $props();
</script>

<div class="glass-card p-6">
  <h2 class="text-light-text mb-4 text-2xl">{title}</h2>
  <p class="mb-4 text-white/80">Count: {count}</p>

  {#if onIncrement}
    <button class="inner-button" onclick={onIncrement}> Increment </button>
  {/if}
</div>
```

### Component Structure

```svelte
<!-- Counter.svelte -->
<script lang="ts">
  import { cn } from '$lib/utils';

  interface Props {
    initialCount?: number;
    class?: string;
  }

  let { initialCount = 0, class: className }: Props = $props();

  let count = $state(initialCount);
  let doubled = $derived(count * 2);

  function increment() {
    count++;
  }

  function decrement() {
    count--;
  }

  $effect(() => {
    console.log('Count updated:', count);
  });
</script>

<div class={cn('glass-card p-6', className)}>
  <h2 class="text-light-text mb-4 text-2xl">Counter</h2>

  <div class="mb-4 flex items-center gap-4">
    <button class="outer-button" onclick={decrement}>-</button>
    <span class="text-light-text text-3xl">{count}</span>
    <button class="inner-button" onclick={increment}>+</button>
  </div>

  <p class="text-white/80">Doubled: {doubled}</p>
</div>

<style>
  /* Component-scoped styles if needed */
</style>
```

### Stores (For Global State)

```ts
// src/lib/stores/app.ts
import { writable, derived } from 'svelte/store';

interface User {
  id: string;
  name: string;
  email: string;
}

function createUserStore() {
  const { subscribe, set, update } = writable<User | null>(null);

  return {
    subscribe,
    setUser: (user: User) => set(user),
    clearUser: () => set(null),
    updateName: (name: string) => update((u) => (u ? { ...u, name } : null))
  };
}

export const userStore = createUserStore();

// Derived store
export const isAuthenticated = derived(userStore, ($user) => $user !== null);
```

```svelte
<!-- Usage in component -->
<script lang="ts">
  import { userStore, isAuthenticated } from '$lib/stores/app';
</script>

{#if $isAuthenticated}
  <div class="glass-card p-6">
    <h2 class="text-light-text text-2xl">Welcome, {$userStore?.name}!</h2>
  </div>
{:else}
  <div class="glass-card p-6">
    <p class="text-light-text">Please log in</p>
  </div>
{/if}
```

### Control Flow

```svelte
<script lang="ts">
  let items = $state<string[]>(['Item 1', 'Item 2', 'Item 3']);
  let loading = $state(false);
  let error = $state<string | null>(null);
</script>

<!-- If/Else -->
{#if loading}
  <div class="glass p-8 text-center">
    <div
      class="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-4 border-t-transparent">
    </div>
    <p class="text-light-text mt-4">Loading...</p>
  </div>
{:else if error}
  <div class="glass-dark border border-red-500 p-6">
    <p class="text-red-500">{error}</p>
  </div>
{:else}
  <!-- Each Loop -->
  <div class="glass-card p-6">
    {#each items as item, i (item)}
      <div class="rounded-lg p-4 transition-colors hover:bg-white/5">
        {i + 1}. {item}
      </div>
    {:else}
      <p class="text-white/60">No items found</p>
    {/each}
  </div>
{/if}
```

### Event Handling

```svelte
<script lang="ts">
  let count = $state(0);

  function handleClick(event: MouseEvent) {
    console.log('Clicked at:', event.clientX, event.clientY);
    count++;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      count++;
    }
  }
</script>

<div class="glass-card p-6">
  <button class="inner-button" onclick={handleClick} onkeydown={handleKeydown}>
    Click me ({count})
  </button>
</div>
```

### Two-Way Binding

```svelte
<script lang="ts">
  let name = $state('');
  let email = $state('');
  let agreed = $state(false);
</script>

<form class="glass-card p-6">
  <div class="mb-4">
    <label class="text-light-text mb-2 block text-sm">Name</label>
    <input bind:value={name} class="input" />
  </div>

  <div class="mb-4">
    <label class="text-light-text mb-2 block text-sm">Email</label>
    <input bind:value={email} type="email" class="input" />
  </div>

  <div class="mb-4">
    <label class="text-light-text flex cursor-pointer items-center gap-2">
      <input bind:checked={agreed} type="checkbox" />
      I agree to the terms
    </label>
  </div>

  <button class="inner-button w-full" disabled={!agreed}> Submit </button>
</form>
```

## SvelteKit Patterns

### Page Structure

```
src/routes/
├── +layout.svelte          # Root layout
├── +page.svelte            # Home page
├── about/
│   └── +page.svelte        # About page
├── blog/
│   ├── +page.svelte        # Blog list
│   ├── +page.ts            # Blog list data
│   └── [slug]/
│       ├── +page.svelte    # Blog post
│       └── +page.ts        # Blog post data
└── api/
    └── users/
        └── +server.ts      # API endpoint
```

### Loading Data

```ts
// src/routes/blog/+page.ts
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
  const response = await fetch('/api/posts');
  const posts = await response.json();

  return {
    posts
  };
};
```

```svelte
<!-- src/routes/blog/+page.svelte -->
<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<div class="glass-card p-6">
  <h1 class="text-light-text mb-6 text-4xl">Blog Posts</h1>

  <div class="space-y-4">
    {#each data.posts as post}
      <a href="/blog/{post.slug}" class="glass block rounded-lg p-4 hover:bg-white/5">
        <h2 class="text-light-text text-xl">{post.title}</h2>
        <p class="mt-2 text-white/60">{post.excerpt}</p>
      </a>
    {/each}
  </div>
</div>
```

### Form Actions

```ts
// src/routes/contact/+page.server.ts
import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';

export const actions: Actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    const name = data.get('name');
    const email = data.get('email');

    if (!name || !email) {
      return fail(400, { error: 'Name and email are required' });
    }

    // Process form
    console.log('Contact form:', { name, email });

    return { success: true };
  }
};
```

```svelte
<!-- src/routes/contact/+page.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData } from './$types';

  let { form }: { form: ActionData } = $props();
</script>

<form method="POST" use:enhance class="glass-card p-6">
  <h2 class="text-light-text mb-4 text-2xl">Contact Us</h2>

  {#if form?.error}
    <div class="glass-dark mb-4 border border-red-500 p-4">
      <p class="text-red-500">{form.error}</p>
    </div>
  {/if}

  {#if form?.success}
    <div class="glass-dark mb-4 border border-green-500 p-4">
      <p class="text-green-500">Message sent successfully!</p>
    </div>
  {/if}

  <div class="mb-4">
    <label class="text-light-text mb-2 block text-sm">Name</label>
    <input name="name" class="input" required />
  </div>

  <div class="mb-4">
    <label class="text-light-text mb-2 block text-sm">Email</label>
    <input name="email" type="email" class="input" required />
  </div>

  <button type="submit" class="inner-button w-full"> Send Message </button>
</form>
```

### API Routes

```ts
// src/routes/api/users/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const users = [
    { id: 1, name: 'John' },
    { id: 2, name: 'Jane' }
  ];

  return json(users);
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();

  // Validate and save user
  const user = { id: 3, ...body };

  return json(user, { status: 201 });
};
```

## Reusable Components

### Button Component

```svelte
<!-- src/lib/components/Button.svelte -->
<script lang="ts">
  import { cn } from '$lib/utils';

  interface Props {
    variant?: 'primary' | 'secondary';
    class?: string;
    onclick?: (e: MouseEvent) => void;
    disabled?: boolean;
    children: import('svelte').Snippet;
  }

  let {
    variant = 'primary',
    class: className,
    onclick,
    disabled = false,
    children
  }: Props = $props();
</script>

<button
  class={cn(variant === 'primary' ? 'inner-button' : 'outer-button', className)}
  {onclick}
  {disabled}>
  {@render children()}
</button>
```

### Card Component

```svelte
<!-- src/lib/components/Card.svelte -->
<script lang="ts">
  import { cn } from '$lib/utils';

  interface Props {
    class?: string;
    hover?: boolean;
    children: import('svelte').Snippet;
  }

  let { class: className, hover = true, children }: Props = $props();
</script>

<div class={cn('glass-card p-6', hover && 'hover:scale-[1.02]', className)}>
  {@render children()}
</div>
```

### Modal Component

```svelte
<!-- src/lib/components/Modal.svelte -->
<script lang="ts">
  interface Props {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: import('svelte').Snippet;
  }

  let { isOpen, onClose, title, children }: Props = $props();
</script>

{#if isOpen}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    onclick={onClose}
    role="dialog"
    aria-modal="true">
    <div class="glass-card m-4 w-full max-w-md p-6" onclick={(e) => e.stopPropagation()}>
      <h2 class="text-light-text mb-4 text-2xl">{title}</h2>
      {@render children()}

      <div class="mt-6 flex gap-4">
        <button class="outer-button flex-1" onclick={onClose}> Cancel </button>
        <button class="inner-button flex-1"> Confirm </button>
      </div>
    </div>
  </div>
{/if}
```

## Testing

### Unit Tests with Vitest

```ts
// src/lib/utils.test.ts
import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });
});
```

### Component Tests

```ts
// src/lib/components/Button.test.ts
import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import Button from './Button.svelte';

describe('Button', () => {
  it('renders correctly', () => {
    const { getByText } = render(Button, {
      props: { children: 'Click me' }
    });
    expect(getByText('Click me')).toBeInTheDocument();
  });

  it('handles click events', async () => {
    const handleClick = vi.fn();
    const { getByText } = render(Button, {
      props: { onclick: handleClick, children: 'Click me' }
    });

    await fireEvent.click(getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test

# Run tests with UI
npm run test:unit:ui

# Run E2E tests
npm run test:e2e

# Lint and format
npm run lint
npm run format
```

## Important Reminders

1. **🚨 Tailwind CSS 4 ONLY** - Never use v3 syntax, always use `@idem/shared-styles`
2. **Always use the design system** - from `@idem/shared-styles` package
3. **Use Svelte MCP** for Svelte-specific questions
4. **Use Svelte 5 runes** - $state, $derived, $effect, $props
5. **Snippets for children** - use snippet type for component children
6. **TypeScript strictly** - type all props and state
7. **Stores for global state** - use writable/readable stores
8. **SvelteKit for routing** - leverage file-based routing
9. **Form actions** - use SvelteKit form actions for mutations
10. **Performance** - Svelte compiles to vanilla JS, already optimized
11. **Testing** - write unit and E2E tests
12. **NO Tailwind v3 utilities** - use v4 syntax (bg-black/50 not bg-opacity-50)

## Additional Resources

- [Svelte 5 Documentation](https://svelte-5-preview.vercel.app/docs)
- [SvelteKit Documentation](https://kit.svelte.dev)
- [Tailwind CSS Documentation](https://tailwindcss.com)
- [Mermaid Documentation](https://mermaid.js.org)
- [Main Monorepo CLAUDE.md](../../CLAUDE.md)

---

**Remember**: Svelte 5 runes are the future. Use them for all new components and follow the unified dark glass design system.

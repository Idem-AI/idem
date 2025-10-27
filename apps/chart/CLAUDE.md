# CLAUDE.md - Chart (Svelte 5)

This file provides guidance to **Claude Code** when working with the **chart** Svelte 5 application.

## Project Overview

Chart is a Mermaid-based diagram and chart editor built with **Svelte 5** and **SvelteKit**. It provides a live editor for creating diagrams with real-time preview, export capabilities, and collaboration features.

## Technology Stack

- **Framework**: Svelte 5.23.2
- **Meta-Framework**: SvelteKit 2.20.3
- **Build Tool**: Vite 5.4.14
- **Styling**: Tailwind CSS 3.4.17 (will migrate to 4.x)
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

**Import in src/app.css:**

```css
@import '@idem/shared-styles/styles.css';
```

**Extend in tailwind.config.js:**

```js
import sharedConfig from '@idem/shared-styles/tailwind.config';

export default {
  ...sharedConfig,
  content: ['./src/**/*.{html,js,svelte,ts}']
};
```

### Theme Configuration

The design system is defined in `@idem/shared-styles`. **ALWAYS** use this shared package.

#### Global Styles (src/app.css)

**🚨 CRITICAL: Use Tailwind 4 import syntax**

```css
/* Import shared design system (includes Tailwind 4) */
@import '@idem/shared-styles/styles.css';

/* DO NOT USE these v3 directives:
@tailwind base;
@tailwind components;
@tailwind utilities;
*/

@import url('https://fonts.googleapis.com/css2?family=Jura:wght@300;400;500;600;700&display=swap');

/* Force dark mode */
:root {
  color-scheme: dark;

  --color-primary: #1447e6;
  --color-secondary: #d11ec0;
  --color-accent: #22d3ee;
  --color-primary-glow: rgba(20, 73, 230, 0.66);
  --color-secondary-glow: rgba(209, 30, 192, 0.66);
  --color-accent-glow: rgba(34, 211, 238, 0.6);

  --color-bg-dark: #06080d;
  --color-bg-light: #0f141b;
  --color-light-text: #f5f5f5;
  --color-success: #219653;
  --color-danger: #d34053;
  --color-warning: #ffa70b;

  --glass-bg: rgba(15, 20, 27, 0.4);
  --glass-bg-darker: rgba(20, 20, 30, 0.6);
  --glass-border: rgba(255, 255, 255, 0.1);
  --glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  --glass-blur: 8px;
}

* {
  font-family: 'Jura', sans-serif;
  scroll-behavior: smooth;
}

body {
  background-color: var(--color-bg-dark);
  background-size: 50px 50px;
  background-image:
    linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  min-height: 100vh;
  overflow-x: hidden;
}

@layer components {
  .glass {
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    box-shadow: var(--glass-shadow);
  }

  .glass-dark {
    background: var(--glass-bg-darker);
    border: 1px solid var(--glass-border);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    box-shadow: var(--glass-shadow);
  }

  .glass-card {
    background: var(--glass-bg);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    border: 1px solid var(--glass-border);
    border-radius: 20px;
    box-shadow: var(--glass-shadow);
    transition: all 0.3s ease;
  }

  .glass-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.45);
  }

  .inner-button {
    background: linear-gradient(135deg, var(--color-primary), var(--color-primary-glow));
    background-size: 200% 100%;
    animation: gradient-shift 3s ease infinite;
    color: white;
    padding: 0.6rem 1.2rem;
    border-radius: 10px;
    text-transform: uppercase;
    font-weight: 500;
    letter-spacing: 0.5px;
    border: none;
    position: relative;
    overflow: hidden;
    transition: all 0.3s ease;
    cursor: pointer;
  }

  .inner-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(60, 164, 250, 0.4);
  }

  .outer-button {
    border: 1px solid var(--glass-border);
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(8px);
    padding: 0.6rem 1.2rem;
    border-radius: 10px;
    text-transform: uppercase;
    font-weight: 500;
    letter-spacing: 0.5px;
    transition: all 0.3s ease;
    cursor: pointer;
  }

  .input {
    background: var(--glass-bg);
    backdrop-filter: blur(var(--glass-blur));
    border: 1px solid var(--glass-border);
    color: var(--color-light-text);
    padding: 0.8rem 1rem;
    border-radius: 8px;
    transition: all 0.3s ease;
    width: 100%;
  }

  .input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary-glow);
  }
}

@keyframes gradient-shift {
  0%,
  100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}
```

### Tailwind Configuration

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
  <h2 class="mb-4 text-2xl text-light-text">Count: {count}</h2>
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
  <h2 class="mb-4 text-2xl text-light-text">{title}</h2>
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
  <h2 class="mb-4 text-2xl text-light-text">Counter</h2>

  <div class="mb-4 flex items-center gap-4">
    <button class="outer-button" onclick={decrement}>-</button>
    <span class="text-3xl text-light-text">{count}</span>
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
    <h2 class="text-2xl text-light-text">Welcome, {$userStore?.name}!</h2>
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
      class="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent">
    </div>
    <p class="mt-4 text-light-text">Loading...</p>
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
    <label class="mb-2 block text-light-text text-sm">Name</label>
    <input bind:value={name} class="input" />
  </div>

  <div class="mb-4">
    <label class="mb-2 block text-light-text text-sm">Email</label>
    <input bind:value={email} type="email" class="input" />
  </div>

  <div class="mb-4">
    <label class="flex cursor-pointer items-center gap-2 text-light-text">
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
  <h1 class="mb-6 text-4xl text-light-text">Blog Posts</h1>

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
  <h2 class="mb-4 text-2xl text-light-text">Contact Us</h2>

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
    <label class="mb-2 block text-light-text text-sm">Name</label>
    <input name="name" class="input" required />
  </div>

  <div class="mb-4">
    <label class="mb-2 block text-light-text text-sm">Email</label>
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
      <h2 class="mb-4 text-2xl text-light-text">{title}</h2>
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

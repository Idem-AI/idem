# Shared Styles System Guide

## Overview

The Idem monorepo uses a **unified design system** through the `@idem/shared-styles` package. This ensures consistent UI across all frontend applications (Angular, React, Next.js, Svelte).

## 🚨 Critical Requirements

1. **Tailwind CSS 4.x ONLY** - No Tailwind v3 syntax allowed
2. **Use `@idem/shared-styles`** - All frontend projects must import this package
3. **No custom design tokens** - Never redefine colors, fonts, or spacing
4. **Dark theme only** - All UIs use the dark glass morphism theme

## Package Structure

```
packages/shared-styles/
├── package.json          # Package configuration
├── styles.css            # Global styles with Tailwind 4
├── tailwind.config.js    # Shared Tailwind configuration
└── README.md             # Usage documentation
```

## Installation

### For New Projects

```bash
# Using npm
npm install @idem/shared-styles

# Using pnpm
pnpm add @idem/shared-styles
```

### For Existing Projects

Add to your `package.json`:

```json
{
  "devDependencies": {
    "@idem/shared-styles": "workspace:*",
    "tailwindcss": "^4.0.15",
    "@tailwindcss/postcss": "^4.0.15"
  }
}
```

## Integration by Framework

### Angular 20 (main-app)

**1. Import in `src/styles.css`:**

```css
@import '@idem/shared-styles/styles.css';
```

**2. Extend `tailwind.config.ts`:**

```typescript
import sharedConfig from '@idem/shared-styles/tailwind.config';

export default {
  ...sharedConfig,
  content: ['./src/**/*.{html,ts}'],
};
```

**3. Update `angular.json`:**

```json
{
  "styles": ["src/styles.css"]
}
```

### React + Vite (we-dev-client)

**1. Import in `src/styles.css`:**

```css
@import '@idem/shared-styles/styles.css';
```

**2. Extend `tailwind.config.js`:**

```javascript
import sharedConfig from '@idem/shared-styles/tailwind.config';

export default {
  ...sharedConfig,
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
};
```

**3. Import in `main.tsx`:**

```typescript
import './styles.css';
```

### Next.js 15 (we-dev-next)

**1. Import in `app/globals.css`:**

```css
@import '@idem/shared-styles/styles.css';
```

**2. Extend `tailwind.config.ts`:**

```typescript
import type { Config } from 'tailwindcss';
import sharedConfig from '@idem/shared-styles/tailwind.config';

const config: Config = {
  ...sharedConfig,
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
};

export default config;
```

**3. Import in `app/layout.tsx`:**

```typescript
import './globals.css';
```

### Svelte 5 + SvelteKit (chart)

**1. Import in `src/app.css`:**

```css
@import '@idem/shared-styles/styles.css';
```

**2. Extend `tailwind.config.js`:**

```javascript
import sharedConfig from '@idem/shared-styles/tailwind.config';

export default {
  ...sharedConfig,
  content: ['./src/**/*.{html,js,svelte,ts}'],
};
```

**3. Import in `src/routes/+layout.svelte`:**

```svelte
<script>
  import '../app.css';
</script>
```

## Design System Components

### Glass Morphism

```html
<!-- Standard glass effect -->
<div class="glass p-6 rounded-lg">Content with glass effect</div>

<!-- Darker glass -->
<div class="glass-dark p-6 rounded-lg">Darker glass background</div>

<!-- Glass card with hover -->
<div class="glass-card p-6">Card with glass effect and hover animation</div>
```

### Buttons

```html
<!-- Primary gradient button -->
<button class="inner-button">Primary Action</button>

<!-- Secondary glass button -->
<button class="outer-button">Secondary Action</button>

<!-- Disabled state -->
<button class="inner-button" disabled>Disabled</button>
```

### Form Elements

```html
<!-- Input field -->
<input type="text" class="input" placeholder="Enter text" />

<!-- With label -->
<div>
  <label class="block text-sm text-light-text mb-2">Name</label>
  <input type="text" class="input" />
</div>
```

### Glow Effects

```html
<!-- Primary glow -->
<div class="glow-primary rounded-xl p-4">Content with primary glow</div>

<!-- Text glow -->
<h1 class="text-glow-primary text-4xl">Glowing Title</h1>
```

## Color Palette

### Primary Colors

- **Primary**: `#1447e6` - Main brand color (blue)
- **Secondary**: `#d11ec0` - Secondary brand color (magenta)
- **Accent**: `#22d3ee` - Accent color (cyan)

### Background Colors

- **BG Dark**: `#06080d` - Main background
- **BG Light**: `#0f141b` - Lighter background

### Status Colors

- **Success**: `#219653`
- **Danger**: `#d34053`
- **Warning**: `#ffa70b`

### Text Colors

- **Light Text**: `#f5f5f5` - Primary text color

### Usage in Code

```html
<!-- Using Tailwind utilities -->
<div class="bg-primary text-light-text">Primary background</div>
<div class="bg-secondary">Secondary background</div>
<div class="text-accent">Accent text</div>

<!-- Using CSS variables -->
<div style="background-color: var(--color-primary)">Custom styling</div>
```

## Tailwind CSS 4 Migration

### ⚠️ Breaking Changes from v3 to v4

#### Import Syntax

```css
/* ✅ Correct (v4) */
@import 'tailwindcss';
/* or */
@import '@idem/shared-styles/styles.css';

/* ❌ NEVER USE (v3) */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

#### Opacity Utilities

| ❌ NEVER USE (v3)        | ✅ ALWAYS USE (v4)     |
| ------------------------ | ---------------------- |
| `bg-opacity-50`          | `bg-black/50`          |
| `text-opacity-80`        | `text-white/80`        |
| `border-opacity-50`      | `border-black/50`      |
| `divide-opacity-50`      | `divide-black/50`      |
| `ring-opacity-50`        | `ring-black/50`        |
| `placeholder-opacity-50` | `placeholder-black/50` |

#### Flex Utilities

| ❌ NEVER USE (v3) | ✅ ALWAYS USE (v4) |
| ----------------- | ------------------ |
| `flex-shrink-0`   | `shrink-0`         |
| `flex-shrink-1`   | `shrink`           |
| `flex-grow-0`     | `grow-0`           |
| `flex-grow-1`     | `grow`             |

#### Text Utilities

| ❌ NEVER USE (v3)   | ✅ ALWAYS USE (v4)     |
| ------------------- | ---------------------- |
| `overflow-ellipsis` | `text-ellipsis`        |
| `decoration-slice`  | `box-decoration-slice` |
| `decoration-clone`  | `box-decoration-clone` |

### Examples

```html
<!-- ✅ Correct (Tailwind 4) -->
<div class="bg-black/50 text-white/80 shrink-0 grow">
  <p class="text-ellipsis">Truncated text</p>
</div>

<!-- ❌ Wrong (Tailwind 3) - DO NOT USE -->
<div class="bg-opacity-50 text-opacity-80 flex-shrink-0 flex-grow-1">
  <p class="overflow-ellipsis">Truncated text</p>
</div>
```

## CSS Variables Reference

All design tokens are available as CSS variables:

```css
/* Colors */
var(--color-primary)
var(--color-secondary)
var(--color-accent)
var(--color-primary-glow)
var(--color-secondary-glow)
var(--color-accent-glow)

/* Backgrounds */
var(--color-bg-dark)
var(--color-bg-light)

/* Text */
var(--color-light-text)
var(--color-success)
var(--color-danger)
var(--color-warning)

/* Glass Effects */
var(--glass-bg)
var(--glass-bg-darker)
var(--glass-border)
var(--glass-shadow)
var(--glass-blur)

/* Typography */
var(--font-size-title)
var(--font-size-title-mobile)
var(--font-size-subtitle)
var(--font-size-light-text)

/* Layout */
var(--radius)
```

## Best Practices

### ✅ DO

1. **Use shared styles** - Always import `@idem/shared-styles`
2. **Use utility classes** - Prefer `.glass-card` over custom CSS
3. **Follow Tailwind 4 syntax** - Use new opacity syntax
4. **Use CSS variables** - For dynamic styling
5. **Test dark mode** - All UIs are dark-only
6. **Maintain consistency** - Use design tokens, not custom values

### ❌ DON'T

1. **Don't use Tailwind v3 syntax** - No `@tailwind` directives
2. **Don't redefine colors** - Use shared palette
3. **Don't create custom glass effects** - Use provided utilities
4. **Don't hardcode values** - Use CSS variables
5. **Don't mix light/dark themes** - Dark only
6. **Don't skip shared-styles** - Always import it

## Troubleshooting

### Issue: Styles not applying

**Solution:**

1. Check that `@idem/shared-styles` is installed
2. Verify import in your main CSS file
3. Ensure Tailwind config extends shared config
4. Clear build cache and rebuild

### Issue: Tailwind v3 syntax errors

**Solution:**

1. Replace `@tailwind` with `@import 'tailwindcss'`
2. Update opacity utilities (e.g., `bg-opacity-50` → `bg-black/50`)
3. Update flex utilities (e.g., `flex-shrink-0` → `shrink-0`)

### Issue: Colors not matching

**Solution:**

1. Don't redefine colors in your Tailwind config
2. Use shared config: `...sharedConfig.theme.extend`
3. Use CSS variables for custom styling

### Issue: Glass effects not working

**Solution:**

1. Ensure backdrop-filter is supported (modern browsers)
2. Check that `.glass` classes are imported
3. Verify no conflicting CSS overrides

## Testing Checklist

Before deploying, verify:

- [ ] `@idem/shared-styles` is installed
- [ ] Main CSS file imports shared styles
- [ ] Tailwind config extends shared config
- [ ] No Tailwind v3 syntax used
- [ ] Glass effects render correctly
- [ ] Buttons have proper styling
- [ ] Form elements have focus states
- [ ] Colors match design system
- [ ] Dark theme is consistent
- [ ] No custom design tokens defined

## Migration Guide

### Migrating Existing Projects

**Step 1: Install Dependencies**

```bash
npm install @idem/shared-styles tailwindcss@^4.0.15 @tailwindcss/postcss@^4.0.15
```

**Step 2: Update CSS Imports**

```css
/* Before */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* After */
@import '@idem/shared-styles/styles.css';
```

**Step 3: Update Tailwind Config**

```javascript
// Before
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: { /* custom colors */ },
    },
  },
};

// After
import sharedConfig from '@idem/shared-styles/tailwind.config';

export default {
  ...sharedConfig,
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  // Don't redefine theme.extend.colors
};
```

**Step 4: Update Component Styles**

```html
<!-- Before -->
<div class="bg-opacity-50 flex-shrink-0">
  <!-- After -->
  <div class="bg-black/50 shrink-0"></div>
</div>
```

**Step 5: Test and Verify**

- Build the project
- Check for Tailwind errors
- Verify visual consistency
- Test all UI components

## Support

For issues or questions:

1. Check this guide first
2. Review `@idem/shared-styles/README.md`
3. Check framework-specific CLAUDE.md files
4. Consult main monorepo CLAUDE.md

## Version History

- **v1.0.0** - Initial release with Tailwind 4 support
  - Unified design system
  - Glass morphism components
  - Dark theme only
  - CSS variables for all tokens

---

**Remember**: Consistency is key. Always use `@idem/shared-styles` and Tailwind CSS 4 syntax.

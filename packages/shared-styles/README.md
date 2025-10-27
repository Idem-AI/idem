# @idem/shared-styles

Shared design system and styles for all Idem applications using **Tailwind CSS 4**.

## Features

- 🎨 **Unified Design System** - Consistent dark theme with glass morphism
- 🌙 **Dark Mode Only** - Optimized for dark interfaces
- ✨ **Glass Effects** - Pre-built glass morphism utilities
- 🎭 **Glow Effects** - Beautiful glow shadows for emphasis
- 🔘 **Button Styles** - Gradient and glass button components
- 📝 **Form Elements** - Styled inputs with focus states
- 🎬 **Animations** - Smooth transitions and keyframe animations
- 🎯 **Tailwind 4** - Latest Tailwind CSS with `@theme` syntax
- 🌈 **oklch Colors** - Wide color gamut using modern color space
- ⚡ **CSS-first Configuration** - Theme defined in CSS, not JavaScript

## Installation

```bash
npm install @idem/shared-styles
```

## Usage

### 1. Import the Styles

In your main CSS file:

```css
@import '@idem/shared-styles/styles.css';
```

### 2. Extend Tailwind Config (Optional)

**Note:** In Tailwind CSS 4, configuration is primarily done via `@theme` in CSS. You only need a `tailwind.config.js` if you want to add plugins or override content detection.

If you need a config file, create `tailwind.config.js`:

```js
import sharedConfig from '@idem/shared-styles/tailwind.config';

export default {
  ...sharedConfig,
  // Tailwind 4 auto-detects content, but you can override if needed
  content: ['./src/**/*.{js,ts,jsx,tsx,svelte,vue}'],
  // Add plugins if needed
  plugins: [],
};
```

**Most theme customization should be done in your CSS file using `@theme`**, not in the config file.

### 3. Use the Design System

#### Glass Components

```html
<!-- Glass card -->
<div class="glass-card p-6">
  <h2 class="text-2xl text-light-text">Card Title</h2>
  <p class="text-white/80">Card content</p>
</div>

<!-- Glass background -->
<div class="glass p-4 rounded-lg">Content with glass effect</div>

<!-- Darker glass -->
<div class="glass-dark p-4 rounded-lg">Darker glass background</div>
```

#### Buttons

```html
<!-- Primary gradient button -->
<button class="inner-button">Primary Action</button>

<!-- Secondary glass button -->
<button class="outer-button">Secondary Action</button>

<!-- Disabled state -->
<button class="inner-button" disabled>Disabled</button>
```

#### Form Elements

```html
<!-- Input field -->
<input type="text" class="input" placeholder="Enter text" />

<!-- With label -->
<div>
  <label class="block text-sm text-light-text mb-2">Name</label>
  <input type="text" class="input" />
</div>
```

#### Glow Effects

```html
<!-- Primary glow -->
<div class="glow-primary rounded-xl p-4">Content with primary glow</div>

<!-- Text glow -->
<h1 class="text-glow-primary text-4xl">Glowing Title</h1>
```

## Color Palette

All colors use **oklch** color space for wider gamut and better perceptual uniformity.

### Primary Colors

- **Primary**: `oklch(0.55 0.22 264)` - Main brand color (blue)
- **Secondary**: `oklch(0.60 0.25 328)` - Secondary brand color (magenta)
- **Accent**: `oklch(0.75 0.15 195)` - Accent color (cyan)

### Background Colors

- **BG Dark**: `oklch(0.10 0.01 264)` - Main background
- **BG Light**: `oklch(0.15 0.01 264)` - Lighter background

### Status Colors

- **Success**: `oklch(0.55 0.15 145)` - Success states
- **Danger**: `oklch(0.58 0.20 25)` - Error/danger states
- **Warning**: `oklch(0.70 0.18 75)` - Warning states

### Text Colors

- **Light Text**: `oklch(0.96 0 0)` - Primary text color

### Why oklch?

Tailwind CSS 4 uses oklch (Oklab Lightness Chroma Hue) instead of hex/rgb because:

- **Wider color gamut** - Access to more vivid colors on modern displays
- **Perceptual uniformity** - Equal numeric changes = equal perceived changes
- **Better interpolation** - Smoother gradients and transitions

## Tailwind Utilities

### Colors

```html
<div class="bg-primary text-light-text">Primary background</div>
<div class="bg-secondary">Secondary background</div>
<div class="bg-dark">Dark background</div>
<div class="text-accent">Accent text</div>
```

### Shadows

```html
<div class="shadow-glass">Glass shadow</div>
<div class="shadow-glow-primary">Primary glow shadow</div>
<div class="shadow-glow-secondary">Secondary glow shadow</div>
```

### Animations

```html
<!-- Gradient shift animation -->
<div class="animate-gradient-shift">Animated gradient</div>

<!-- Reveal animation -->
<div class="reveal">Fade in on scroll</div>

<!-- Spinner -->
<div class="spinner"></div>
```

## CSS Variables

All design tokens are available as CSS variables:

```css
var(--color-primary)
var(--color-secondary)
var(--color-accent)
var(--color-bg-dark)
var(--color-bg-light)
var(--color-light-text)
var(--glass-bg)
var(--glass-bg-darker)
var(--glass-border)
var(--glass-shadow)
var(--glass-blur)
```

## Framework-Specific Examples

### React

```jsx
import '@idem/shared-styles/styles.css';

function Card({ title, children }) {
  return (
    <div className="glass-card p-6">
      <h2 className="text-2xl text-light-text mb-4">{title}</h2>
      {children}
    </div>
  );
}
```

### Angular

```typescript
// In styles.css
@import '@idem/shared-styles/styles.css';

// In component
@Component({
  template: `
    <div class="glass-card p-6">
      <h2 class="text-2xl text-light-text">{{ title }}</h2>
    </div>
  `
})
```

### Svelte

```svelte
<script>
  import '@idem/shared-styles/styles.css';
</script>

<div class="glass-card p-6">
  <h2 class="text-2xl text-light-text">{title}</h2>
</div>
```

### Vue

```vue
<template>
  <div class="glass-card p-6">
    <h2 class="text-2xl text-light-text">{{ title }}</h2>
  </div>
</template>

<style>
@import '@idem/shared-styles/styles.css';
</style>
```

## Tailwind CSS 4 - CSS-First Configuration

This package uses **Tailwind CSS 4** with the new `@theme` directive for CSS-first configuration.

### What's Different in v4?

**1. Configuration in CSS, not JavaScript**

Instead of defining your theme in `tailwind.config.js`, you use the `@theme` directive in CSS:

```css
@import 'tailwindcss';

@theme {
  --color-primary: oklch(0.55 0.22 264);
  --font-sans: 'Jura', sans-serif;
  --spacing: 0.25rem;
}
```

**2. Automatic Content Detection**

Tailwind 4 automatically detects your source files by:

- Scanning your project directory
- Ignoring `.gitignore` patterns
- Excluding binary files automatically

No more `content: []` configuration needed!

**3. Built-in Import Support**

No need for `postcss-import` - Tailwind 4 handles `@import` natively.

**4. oklch Color Space**

All colors use `oklch` for wider gamut and better perceptual uniformity.

## Tailwind CSS 4 Migration Notes

Key changes from v3 to v4:

### Import Syntax

```css
/* ✅ Correct (v4) */
@import 'tailwindcss';

/* ❌ Wrong (v3) */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Opacity Utilities

```html
<!-- ✅ Correct (v4) -->
<div class="bg-black/50 text-white/80">
  <!-- ❌ Wrong (v3) -->
  <div class="bg-opacity-50 text-opacity-80"></div>
</div>
```

### Updated Utilities

| Deprecated (v3)     | Replacement (v4) |
| ------------------- | ---------------- |
| `bg-opacity-*`      | `bg-black/*`     |
| `text-opacity-*`    | `text-black/*`   |
| `flex-shrink-*`     | `shrink-*`       |
| `flex-grow-*`       | `grow-*`         |
| `overflow-ellipsis` | `text-ellipsis`  |

## Best Practices

1. **Always use the design system** - Don't create custom colors
2. **Glass effects for containers** - Use `.glass-card` for cards and modals
3. **Consistent spacing** - Use Tailwind spacing utilities
4. **Dark mode only** - All designs are optimized for dark theme
5. **Accessibility** - Ensure sufficient contrast ratios
6. **Performance** - Use backdrop-filter sparingly on mobile

## Contributing

When adding new styles:

1. Update `styles.css` with new utilities
2. Update `tailwind.config.js` if adding theme tokens
3. Document in this README
4. Test across all applications

## License

MIT

## Support

For issues or questions, please refer to the main Idem repository.

# @idem/shared-styles

The IDEM design system, for Tailwind CSS 4: design tokens, surfaces, buttons, natively styled form elements, and the Vilevile brand font with its icons. Every IDEM front end uses it.

**Use it, do not reproduce it.** A local `.card`, `.btn`, `.input` or spinner that imitates a class of this package is a defect, even if it looks the same: it creates a second source of truth that drifts. The rules and the full class inventory are in [`AGENTS.md`](../../AGENTS.md).

## Installation

In an application's global stylesheet, next to Tailwind:

```css
@import 'tailwindcss';
@import '@idem/shared-styles/styles.css';
```

`styles.css` imports the font (`fonts/fonts.css`) and the icon classes (`fonts/icons.css`) itself.

## Themes

Two themes, dark and light. The active one is the `.dark` / `.light` class on `<html>`, set by each application from the shared `idem_theme` cookie and defaulting to the browser's `prefers-color-scheme`. Components use semantic tokens, so they need no theme-specific code.

## What it provides

| Kind | Classes / tokens |
| --- | --- |
| Surfaces | `.glass`, `.glass-card`, `.glass-dark`, `.modal-panel`, `.modal-drawer`, `.project-card` |
| Actions | `.inner-button` (primary), `.outer-button` (secondary), `.button-ghost`, `.button-accent`, `.button-icon`, sizes `.button-sm` / `.button-lg` / `.button-xl` |
| Signals | `.tag`, `.status-dot`, `.skeleton`, `.pulse-glow`, `.custom-scrollbar` |
| Forms | Nothing to add: `input[type=…]`, `select`, `textarea`, `label`, `fieldset`, `progress`, `meter` are styled natively |
| Colour tokens | `--color-primary-*`, `--color-secondary-*`, `--color-accent-*` (50–950 + glows), `--color-surface-1/2/3`, `--color-text-primary/secondary/tertiary/disabled`, `--color-success`, `--color-warning`, `--color-danger`, `--color-info` |
| Tailwind utilities | Generated from the tokens: `text-text-primary`, `bg-surface-1`, `text-primary-500`… |
| Type | Font family `Vilevile` (text **and** icons), `--font-size-*` scale |
| Icons | PrimeIcons classes, `<i class="pi pi-user"></i>`, drawn by Vilevile |

## Pitfalls

- Element selectors of the design system are not in an `@layer`, so they win over Tailwind utilities: a `select` with `w-32` stays full width; write `!w-32`.
- `input[type='text']` is styled, `input` alone is not: always write the `type` attribute.
- Never set `letter-spacing` or a `tracking-*` utility: the tracking is built into the font (see [the font README](tools/font/README.md)).
- Use tokens, never raw colours: `text-text-primary`, not `text-white`; `text-primary-500`, not `text-blue-500` or a hex value.

## The font

Vilevile is Jura, extended to weight 900, retracked, carrying PrimeIcons redrawn in IDEM's hand and the letters of Cameroonian languages. How it is built and how to rebuild it: [tools/font/README.md](tools/font/README.md).

## Exception

The Chart editor (`apps/chart`) does not consume this package; it ships its own copy of the font files.

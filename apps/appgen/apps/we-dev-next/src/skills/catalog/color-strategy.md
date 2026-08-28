---
name: color-strategy
description: Distributing the forged palette across the page - where the accent goes, surface layering, dark mode. Does not choose colours; the design system already did.
tier: contextual
priority: 40
triggers: [color, colour, palette, theme, dark mode, brand colors, contrast, vibrant, gradient, tone]
---

# Colour distribution

The palette is decided. What remains is where each role goes, and that is where generated pages fail: they spread the brand colour evenly until nothing stands out.

## Follow the strategy

The design system names one of four:

- **Restrained** — tinted neutrals carry the page, the accent appears on under 10% of the surface. Product default.
- **Committed** — one saturated colour owns 30–60% of the surface. Identity-driven pages.
- **Full palette** — three or four named roles, each used deliberately and repeatedly.
- **Drenched** — the surface *is* the colour; sections differ by lightness within one hue.

Read the strategy and follow it. A restrained system with a colourful hero is not restrained.

## Roles, not decoration

- `surface` — the page. `surface-raised` — anything that sits above it. Two levels of elevation are enough.
- `brand` — identity: logo lockup, active navigation, the primary action.
- `accent` — one thing per screen. If everything is accented, nothing is.
- `ink` / `ink-muted` — body and secondary text. These two are contrast-verified. Do not introduce a third, lighter grey.

## Rules

- **Grey text on a coloured background looks washed out.** Use a lighter step of the background's own hue, or the text colour at reduced opacity.
- **No gradient unless the art direction calls for one**, and never purple-to-blue. A subtle single-hue gradient between two ramp steps is acceptable in a committed or drenched direction.
- Semantic colours (success, warning, danger) are derived by rotating the brand hue, not pulled from Tailwind's defaults. Tailwind's stock `red-500` next to a forged palette looks pasted in.
- Never carry meaning by colour alone.

## Dark mode

Only if asked, or if the direction is already dark. When both exist:

- Dark is not inverted light. Reduce chroma as lightness drops, or colours glow.
- Pure black surfaces with pure white text produce halation. Use the `neutral-950` / `neutral-100` steps from the palette.
- Elevation in dark mode is a lighter surface, not a heavier shadow.
- Drive it with a `dark:` class strategy in `tailwind.config.js` and a toggle that persists to `localStorage`, defaulting to `prefers-color-scheme`.

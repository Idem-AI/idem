---
name: responsive
description: Mobile-first layout for the devices this audience actually uses, and the breakpoint failures generated sites ship with.
tier: contextual
priority: 45
triggers: [responsive, mobile, tablet, breakpoint, adaptive, viewport, screen size, device, touch, small screen]
---

# Responsive

The majority of this audience arrives on a mid-range Android phone over a mobile connection. Mobile is the primary design target, not the degraded one.

## Mobile-first

Write the base styles for small screens, then add `sm:` `md:` `lg:` `xl:`. Never the reverse: `lg:` overrides layered onto desktop defaults is how sites end up broken between 640 and 1024 px.

Design at 360 px width. If it works there, wider is easy.

## Fluid over breakpoints

- Grids: `repeat(auto-fit, minmax(280px, 1fr))` adapts without a single media query.
- Type: `clamp(1.75rem, 5vw, 3.5rem)` beats four breakpoint overrides.
- Spacing: scale section padding with the viewport rather than snapping it.

Reach for breakpoints when the *structure* changes (sidebar becomes a drawer), not when a size changes.

## The failures to check

- **Heading overflow.** Long words plus a large `clamp()` max plus a narrow container overflows on tablet. Test the real copy at 360, 768 and 1280 px. If it overflows, lower the clamp max or rewrite the copy.
- **Horizontal scroll.** Usually a fixed width, a negative margin, or a `100vw` element inside a padded container. The body must never scroll sideways.
- **Tables.** On narrow screens a table becomes a list of labelled rows. Horizontal scroll on a data table is a last resort, and then it needs a visible affordance.
- **Fixed heights** on anything containing text. Content in another language is longer.
- **`100vh`** on mobile is taller than the visible area under browser chrome. Use `100dvh`.

## Touch

Interactive targets at least 44 × 44 px with at least 8 px between them. No hover-only affordances: anything revealed on hover is permanently visible on touch. Sticky bottom bars for primary actions on long pages, respecting `env(safe-area-inset-bottom)`.

## Weight

Images sized to their display width with `loading="lazy"` below the fold and explicit `width`/`height` so nothing shifts as they arrive. Unsplash URLs take sizing parameters: `?w=800&q=75&auto=format`. Use them rather than shipping a 4000 px original.

Prefer system behaviour over JavaScript: CSS scroll snap, `<details>` for disclosure, native `<dialog>`.

---
name: typography
description: Applying the forged type scale well - hierarchy, measure, vertical rhythm. Does not choose fonts; the design system already did.
tier: contextual
priority: 40
triggers: [typography, font, type, heading, text, readability, hierarchy, editorial, serif, lettering]
---

# Typography

The design system already chose the families and the scale. This is about using them so the page has a hierarchy rather than a pile of sizes.

## Hierarchy

Hierarchy comes from **contrast**, not from many steps. Three levels on a page is usually right: display, section heading, body. Everything else is body with a weight or colour change.

- Adjacent steps must differ by at least the scale ratio. Two headings at `text-xl` and `text-lg` read as an accident.
- Combine size with weight. A `text-2xl` at 700 against body at 400 separates cleanly; both at 500 does not.
- Cap the family count at three: display, body, mono. More reads as indecision.

## Measure and rhythm

- Body line length 60–70 characters. `max-w-[68ch]` on prose containers. Full-width body text on a 1440 px screen is unreadable.
- Line height scales inversely with size: 1.6 for body, 1.3 for section headings, 1.05–1.15 for display.
- Tracking: 0 for body, slightly negative for display (`-0.02em` to `-0.03em`), never tighter than `-0.04em` or letters collide.
- `text-wrap: balance` on h1–h3 so headings break evenly; `text-wrap: pretty` on long prose to kill orphans.

## Display type

Hero sizing through `clamp()`, with the maximum at or below 6rem. Larger is shouting, and it overflows on tablet.

Test real headline copy at 360 px. Long single words in French and in African language names overflow narrow containers, and that is a layout bug, not a copy problem.

## What not to do

- No all-caps body copy. Sentences in caps are unreadable at body sizes. Caps are for a short label at most.
- No centred paragraphs longer than two lines.
- No justified text on the web: without hyphenation it produces rivers.
- No type in the accent colour for body copy; the accent is for emphasis, and it rarely holds contrast at body size.
- No text over a busy image without a scrim or a solid panel behind it.

## Loading

The Google Fonts `<link>` from the design system goes in `<head>` with `preconnect` before it. `display=swap` is already in the URL. Set the family on `body` in `index.css` so nothing falls back silently.

---
name: mobile-app-ux
description: How a phone application behaves - one task per screen, bottom tabs, thumb reach, native-feeling feedback, and the website habits that betray a fake app.
tier: core
priority: 85
targets: [mobile-app]
---

# Feels like an app, not a website on a phone

The preview shows the app in a phone frame, 390 px wide. Design for that width only: there is no desktop layout to make.

## Navigation

- **Bottom tab bar, 3 to 5 tabs**, icon above a one-word label. It is the only global navigation: no hamburger menu, no header links, no footer.
- **Pushed screens** (a detail, a form) slide over their tab: `TopBar` with `back`, and the tab bar stays visible.
- **First launch**: a Welcome screen (`/welcome`) shown once (remember it with `useStoredState`), then straight to Home on every later launch.

## Screens

- **One task per screen.** A screen answers one question: what's new, what did I order, how do I pay.
- **Lists are the backbone.** Full-width rows, at least 56 px high, divided by a hairline, tapping the whole row opens the detail. Not grids of cards.
- **The primary action** sits at the bottom of the screen, full width, inside thumb reach — or as a floating round button above the tab bar for "create".
- **Forms**: one column, large inputs (48 px), the right `inputmode` / `type` (`tel`, `email`, `numeric`), the button at the bottom. Long forms split into steps.
- **Choices in a sheet**: a panel sliding up from the bottom with a dimmed backdrop, not a centred modal.

## Touch

- Every tappable target at least **44 × 44 px**. Spacing between targets so a thumb never hits two.
- `active:` states on everything tappable (`active:bg-neutral-100`, `active:scale-[0.98]`): touch has no hover, so `hover:` alone gives no feedback.
- No interaction that needs hover, right-click or a keyboard shortcut.

## States

- **Empty**: what this screen will show, and the one action that fills it.
- **Loading**: skeleton rows in the shape of the list, never a spinner alone on a white screen.
- **Done**: a short confirmation toast near the bottom, then back to where the user was.

## Data

The app runs without a server: seed it with a dozen realistic items in `src/data/`, keep the user's changes with `useStoredState`, and make every list, detail and form actually work on that data. A button that does nothing is a bug.

## What betrays a website

- A hero section, a marketing headline, "Learn more", testimonials, a footer with links.
- A top navigation bar with text links, a sidebar, a hamburger.
- Text-heavy screens, paragraphs wider than a thumb's sweep, tiny tap targets.
- Desktop breakpoints (`md:`, `lg:`) doing the layout work.

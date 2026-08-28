---
name: anti-slop
description: Absolute bans and the failure test that separate a designed interface from a generated one. Loaded on every request.
tier: core
priority: 100
---

# Do not produce a generated-looking interface

The test: if someone could look at this and say "an AI made that" without hesitating, it has failed. That judgement is made in under a second, from a handful of tells. Every one of them below is banned.

## Banned outright

Match and refuse. If you are about to write one of these, rewrite the element with different structure.

- **Purple / blue-violet gradients.** `from-purple-* to-indigo-*`, `from-violet-* to-blue-*`, and every neighbour. The most recognisable generated-site marker there is. Use the forged palette.
- **Gradient text.** `bg-clip-text` over a gradient. Decorative, never meaningful. One solid colour; emphasis through weight or size.
- **Inter as the default typeface.** Use the fonts named in the design system. If none were given, anything but Inter.
- **The three-identical-cards row.** `grid-cols-3` of icon + heading + two lines of text, repeated. If three things genuinely differ, express the difference: different sizes, different weights, one of them wide.
- **Tiny uppercase tracked eyebrows above every section.** `text-xs uppercase tracking-widest` reading "ABOUT" / "FEATURES" / "PRICING". One named kicker used deliberately is voice; an eyebrow on every section is generated grammar.
- **Numbered section markers as scaffolding** (`01 · About`, `02 · Process`). Numbers are for actual sequences the reader must follow in order.
- **Coloured side-stripe borders.** `border-l-4 border-{color}` on cards, alerts, list items, blockquotes. Use a full border, a background tint, or nothing.
- **Glassmorphism by default.** `backdrop-blur` + translucent white cards as a look. Rare and purposeful, or absent.
- **The hero metric template.** Big number, small label, three supporting stats, gradient accent.
- **Cream / sand / beige body backgrounds.** The whole warm near-white band, and the token names that come with it (`--paper`, `--cream`, `--sand`, `--linen`, `--parchment`). Use the forged surface.
- **Emoji as section icons or bullets** (🚀 ✨ 💡 🎯 in headings, features, buttons).
- **Em dashes in copy.** Use commas, colons, semicolons, periods or parentheses.

## Banned language

Marketing filler with no referent: *elevate, unlock, empower, supercharge, seamless, streamline, leverage, unleash, revolutionise, transform your, game-changer, cutting-edge, next-generation, world-class, take it to the next level, in today's fast-paced world*.

Replace with a concrete noun and a verb describing what the product literally does. "Track every invoice from quote to payment" beats "Streamline your financial workflow".

Also banned: the aphoristic cadence where every section closes on the same contrarian one-liner rhythm. Say the specific thing instead.

## Required instead

- **Asymmetry somewhere.** At least one section that is not a centred stack or an even grid.
- **Varied section rhythm.** Not every section gets the same vertical padding and the same heading-then-paragraph-then-grid shape.
- **Buttons say what happens.** Verb plus object: "Create account", "Download invoice". Never "Learn more" twice on one page, never "Click here".
- **Real content.** No Lorem ipsum, no "Feature One / Feature Two", no `#` placeholder hrefs on primary actions.
- **The design system's signature move** must actually appear on the page.

## The category reflex check

Before you finish: could someone guess the palette and layout from the product category alone? If a fintech landed on navy and gold, a wellness app on sage and cream, a dev tool on dark-mode purple, that is the training-data reflex, not a decision. Go back to the art direction and follow it instead.

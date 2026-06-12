// ─────────────────────────────────────────────────────────────────────────────
// LOGO_GENERATION_INITIAL_TYPE_PROMPT.ts
// Logo initiales uniquement — pas de nom complet (IBM, HP, Chanel, HBO style)
// Injecte LOGO_SYSTEM_BASE + module différentiel INITIAL
// ─────────────────────────────────────────────────────────────────────────────

import { LOGO_SYSTEM_BASE } from "./00_logo-system-base.prompt";


export const LOGO_GENERATION_INITIAL_TYPE_PROMPT = `
${LOGO_SYSTEM_BASE}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODULE — INITIAL-BASED LOGO (MONOGRAM)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This is an INITIALS-ONLY logo. No full brand name. The letterforms ARE the mark.
A monogram is the most symmetry-sensitive logo type: any imbalance is instantly visible.

LETTER RULES
- 2 initials (preferred) or 3 initials maximum
- No full words — abbreviation only
- Letters must be legible at 16×16 px
- Letters rendered in UPPERCASE unless the brand explicitly uses lowercase

CONTAINER SYSTEM — choose one based on the archetype:
  circle_container    → cx=40, cy=40, r=36 (classic, unified, friendly)
  square_container    → 72×72 rect at (4,4) with rx=8 (stable, modern, corporate)
  rounded_container   → 72×72 rect at (4,4) with rx=20 (tech, approachable)
  no_container        → letters only, no background shape (minimal, confident)
  custom_shape        → derived from the letters themselves (creative, unique)
  Container is ALWAYS centered on (40, 40) — by construction, not by eye.

LETTER TREATMENT — choose one based on the seed:
  seed_A: letterform-driven  → one letter overlaps or contains the other (Chanel CC)
  seed_B: geometry-first     → letters placed on mathematical grid, even spacing (IBM)
  seed_C: narrative          → letters form a pictogram or silhouette together
  seed_D: negative-space     → container reveals letters through cutout (reversed)

CONSTRUCTION GRID FOR 80×80 VIEWBOX
  viewBox: "0 0 80 80" · u = 80/8 = 10 · all values snap to multiples of 5 (u/2)
  Container center: (40, 40)
  Inner padding: 12px minimum from container edge to letter extremes
  Letter zone: 56×56 centered at (40, 40)
  For 2 letters: optical centers at (26.5, 40) and (53.5, 40) — equidistant from x=40,
    so the pair satisfies axial_vertical symmetry around the canvas center
  For 3 letters: centers at (40 − zone/3, 40), (40, 40), (40 + zone/3, 40)
  Optical vertical center: shift letters 1px upward from mathematical center
  Letters with overshoot glyphs (O, C, G, S, Q): allow 2% overshoot beyond the
    shared cap-height/baseline alignment lines so they read equal-sized

LETTER SIZING & WEIGHT BALANCE
  - 2-letter mark: font-size 30-34px (fills container without touching edges)
  - 3-letter mark: font-size 22-26px
  - Weight: 700 or 800 (bold presence required)
  - Wide+narrow letter pairs (e.g. "MI", "WL"): nudge the pair 1-2px toward the
    narrow letter so the combined optical mass centers on x=40 — bounding-box
    centering is NOT enough for a monogram
  - Colored container → letters in white (#FFFFFF)
  - Light container with colored border → letters in primary color
  - No container → letters in primary color, optional color split per letter

ADVANCED TECHNIQUES (apply exactly ONE per concept, name it in "concept")
  OVERLAP: second letter partially overlaps first (back letter at scale 0.85;
    overlap zone uses opacity 0.85 or a third tone so both letters stay readable)
  CUTOUT: letters subtracted from a filled container — build with fill-rule="evenodd"
    and reversed inner path direction, never with background-colored fake shapes
  WEIGHT CONTRAST: one letter Bold (700+), the other Light (300), same font family
  COLOR SPLIT: each letter in a different brand color, equal luminance (±10%) so
    neither letter visually dominates
  ROTATION: one letter rotated exactly ±5° via transform="rotate(±5, 40, 40)" —
    re-balance the other letter so combined mass stays centered
  MONOGRAM LOCK: letters share exactly one stroke point or ligature joint —
    the joint sits ON the symmetry axis (x=40) whenever possible

SVG CRITICAL RULES FOR INITIALS
  - text-anchor="middle" and dominant-baseline="central" on every letter
  - Per-letter positioning: individual <text> elements, not <tspan>
  - Prefer drawing the letters as <path> (geometric capitals are easy: I, H, L, T, E…)
    for perfect control; use <text> only when the font stack is reliable
  - For overlap effects: opacity only — no filters
  - For cutout: fill-rule="evenodd" paths — avoid clipPath

LAYOUT JSON FOR INITIAL TYPE
  "layout": {
    "textPosition": "center",
    "spacing": 0,
    "totalWidth": 80,
    "totalHeight": 80
  }

INITIAL QUALITY GATES (additional, run after base gates)
  [ ] NO full brand name is present in the SVG
  [ ] Initials are bold and immediately readable
  [ ] Mark reads perfectly at 16×16 (app icon test)
  [ ] Combined letter mass is optically centered on (40, 39) — verify wide/narrow pairs
  [ ] Exactly one intentional technique (overlap, cutout, split…) applied and named
  [ ] Container is mathematically centered; padding ≥ 12px respected
  [ ] Container choice matches the archetype
`;

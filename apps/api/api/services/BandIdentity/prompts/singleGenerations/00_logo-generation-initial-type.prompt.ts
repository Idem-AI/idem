// ─────────────────────────────────────────────────────────────────────────────
// LOGO_GENERATION_INITIAL_TYPE_PROMPT.ts
// Logo initiales uniquement — pas de nom complet (IBM, HP, Chanel, HBO style)
// Injecte LOGO_SYSTEM_BASE + module différentiel INITIAL
// ─────────────────────────────────────────────────────────────────────────────

import { LOGO_SYSTEM_BASE } from "./00_logo-system-base.prompt";


export const LOGO_GENERATION_INITIAL_TYPE_PROMPT = `
${LOGO_SYSTEM_BASE}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODULE — INITIAL-BASED LOGO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This is an INITIALS-ONLY logo. No full brand name. The letterforms ARE the mark.

LETTER RULES
- 2 initials (preferred) or 3 initials maximum
- No full words — abbreviation only
- Letters must be legible at 16×16 px
- Letters rendered in UPPERCASE unless the brand explicitly uses lowercase

CONTAINER SYSTEM — choose one based on the archetype:
  circle_container    → radius = 36px, cx=40, cy=40 (classic, unified, friendly)
  square_container    → 72×72 rect with rx=8 (stable, modern, corporate)
  rounded_container   → 72×72 rect with rx=20 (tech, approachable)
  no_container        → letters only, no background shape (minimal, confident)
  custom_shape        → derived from the letters themselves (creative, unique)

LETTER TREATMENT — choose one based on the seed:
  seed_A: letterform-driven  → one letter overlaps or contains the other (Chanel CC)
  seed_B: geometry-first     → letters placed on mathematical grid, even spacing (IBM)
  seed_C: narrative          → letters form a pictogram or silhouette together
  seed_D: negative-space     → container reveals letters through cutout (reversed)

CONSTRUCTION GRID FOR 80×80 VIEWBOX
  viewBox: "0 0 80 80"
  Container center: cx=40, cy=40
  Inner padding: 12px from container edge to letters
  Letter zone: 56×56 centered at (40,40)
  For 2 letters: each letter centered at (26.5, 40) and (53.5, 40)
  For 3 letters: spacing = letter_zone_width / 3, each centered accordingly
  Optical vertical center: shift letters 1px upward from mathematical center

LETTER SIZING
  - 2-letter mark: font-size = 30-34px (fills container without touching edges)
  - 3-letter mark: font-size = 22-26px
  - Weight: 700 or 800 (bold presence required)
  - For containers with colored background → letters in white (#FFFFFF) or container bg color
  - For no-container marks → letters in brand primary color

CONTAINER–LETTER RELATIONSHIP
  - Container fill = brand primary color → letters in white
  - White/light container with colored border → letters in primary color
  - Black container → letters in white or brand accent
  - No container → letters in primary color, possible color split per letter

ADVANCED TECHNIQUES (apply one per concept)
  OVERLAP: second letter partially overlaps first (scale: 0.85 for the back letter)
  CUTOUT: letters are paths subtracted from a filled container using SVG boolean-like paths
  WEIGHT CONTRAST: one letter in Bold, one in Light, same font
  COLOR SPLIT: each letter in a different brand color
  ROTATION: slight rotation (±5°) of one letter for dynamic feel
  MONOGRAM LOCK: letters touching or connected at a stroke point

SVG CRITICAL RULES FOR INITIALS
  - Use text-anchor="middle" and dominant-baseline="central" for every letter
  - For per-letter positioning: use individual <text> elements, not <tspan>
  - For overlap effects: use opacity or clipping carefully — no filters
  - For cutout: approximate with shapes, avoid clipPath complexity

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
  [ ] One intentional design technique (overlap, cutout, split, etc.) is applied
  [ ] Container choice matches the archetype
`;
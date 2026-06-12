// ─────────────────────────────────────────────────────────────────────────────
// LOGO_GENERATION_ICON_TYPE_PROMPT.ts
// Logo avec icône géométrique + nom de marque complet (Apple, Nike, Airbnb style)
// Injecte LOGO_SYSTEM_BASE + module différentiel ICON
// ─────────────────────────────────────────────────────────────────────────────

import { LOGO_SYSTEM_BASE } from "./00_logo-system-base.prompt";



export const LOGO_GENERATION_ICON_TYPE_PROMPT = `
${LOGO_SYSTEM_BASE}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODULE — ICON-BASED LOGO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This is an ICON + WORDMARK logo. Two distinct elements that form one unified system.

ICON RULES
- 2 shapes maximum (not "2-3" — aim for 2, accept 3 only if structurally necessary)
- The icon must communicate the brand's primary value in under 1 second of viewing
- The icon itself must satisfy the chosen SYMMETRY MODE on its own square canvas
  (an icon that only balances thanks to the wordmark is a broken icon)
- Icon must be extractable and usable standalone as an app icon (40×40 min)
- Icon occupies a square bounding box: icon_size × icon_size
- Icon is positioned LEFT of the brand name

ICON CONSTRUCTION (compute, then draw)
  icon_size   = totalHeight × 0.6          (48px for an 80px mark — breathing room)
  icon_unit   = icon_size / 8              (the icon's own modular grid)
  icon_cx     = icon_size / 2
  icon_cy     = totalHeight / 2 − totalHeight × 0.015   (optical center: 1.5% above)
  All icon shapes defined relative to (icon_cx, icon_cy), snapped to icon_unit/2.
  Internal proportions between the 2 shapes: golden (1:1.618) or rational (1:1.5, 1:2).
  Apply overshoot: curved shapes meeting flat edges extend 2% of icon_size beyond.

WORDMARK RULES
- Full brand name, complete spelling, no abbreviation
- Positioned to the right of the icon
- Left edge of text = icon_size + spacing (spacing = 12px minimum)
- Vertically centered: y = totalHeight / 2, dominant-baseline="central"
- Font size: totalHeight × 0.35 (reads as 28px for an 80px tall mark)
- Weight: 600 or 700 for clean legibility
- Letter-spacing chosen to match the archetype:
    tech_precision / finance_trust / luxury_heritage → letter-spacing: 0.08em
    tech_human / health_care / creative_studio       → letter-spacing: 0em
    energy_motion                                    → letter-spacing: -0.02em

PROPORTION SYSTEM
  totalHeight:   80px (standard) or 64px (compact)
  icon_size:     48px (standard) or 40px (compact)
  spacing:       12px (= 2 × icon_unit — the gap belongs to the grid too)
  text_width:    char_count × font_size × 0.62 + tracking, then × 1.12 safety margin
  totalWidth:    icon_size + spacing + text_width, rounded up to nearest 4px
  The text must NEVER touch or exit the right edge: last glyph ends ≥ 8px before W.

OPTICAL ALIGNMENT ICON ↔ WORDMARK
  - Align the icon's optical mass center with the wordmark's cap-height midline,
    not with the full text bounding box (ascenders/descenders distort centering).
  - Icon visual weight ≈ wordmark visual weight:
      dense filled icon → font weight 600 · open line icon → font weight 700
  - If the icon has a dominant diagonal, it points toward the text (leads the eye
    rightward into the name), never away from it.

ICON–TEXT RELATIONSHIP
  The icon and wordmark must feel like one family:
  - Sharp-angled icon → tight letter-spacing; curved icon → rounded forms / looser spacing
  - Icon corner radius language = implied roundness of the chosen font
  - Icon primary color = wordmark color, OR intentional split: icon in primary,
    wordmark in near-black (#0B1220–#1A1A2E) — never two competing brights

LAYOUT JSON FOR ICON TYPE
  "layout": {
    "textPosition": "right",
    "spacing": 12,
    "totalWidth": <calculated>,
    "totalHeight": 80
  }

ICON QUALITY GATES (additional, run after base gates)
  [ ] Icon works standalone at 40×40 px with no text
  [ ] Icon satisfies the symmetry mode on its own square canvas
  [ ] Icon conveys one specific concept (not generic "tech" or "company")
  [ ] Icon and wordmark share a visual language (weight, geometry, corner radius)
  [ ] text_width × 1.12 fits inside totalWidth; nothing clips at the right edge
  [ ] The mark reads correctly at 300% zoom and at 16px width
`;

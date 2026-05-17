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
- Icon must be extractable and usable standalone as an app icon (40×40 min)
- Icon occupies a square bounding box: icon_size × icon_size
- Icon is positioned LEFT of the brand name, vertically centered with the text baseline

ICON CONSTRUCTION
  Determine icon_size = totalHeight × 0.65 (leave breathing room)
  Icon center_x = icon_size / 2
  Icon center_y = totalHeight / 2
  All icon shapes defined relative to this center point

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
  totalWidth:    icon_size + spacing + estimated_text_width
  icon_size:     48px (standard) or 40px (compact)
  spacing:       12px
  Estimate text_width = brand_name.length × font_size × 0.6 then round up to nearest 4px

VISUAL BALANCE CHECKS
  - Icon visual weight ≈ wordmark visual weight (adjust icon fill density if needed)
  - If icon is very dense (filled shape) → use lighter font weight for wordmark
  - If icon is very open (outline/line) → use heavier font weight for wordmark
  - Vertical optical center: shifted 1-2px above mathematical center for stability

ICON–TEXT RELATIONSHIP
  The icon and wordmark must feel like they belong to the same family:
  - If icon uses sharp angles → wordmark uses tight letter-spacing
  - If icon uses curves → wordmark uses rounded letterforms or looser spacing
  - Icon primary color = wordmark primary color OR intentional complementary split

LAYOUT JSON FOR ICON TYPE
  "layout": {
    "textPosition": "right",
    "spacing": 12,
    "totalWidth": <calculated>,
    "totalHeight": 80
  }

ICON QUALITY GATES (additional, run after base gates)
  [ ] Icon works standalone at 40×40 px with no text
  [ ] Icon conveys one specific concept (not generic "tech" or "company")
  [ ] Icon and wordmark share a visual language (weight, geometry style)
  [ ] The mark reads correctly at 300% zoom and at 16px width
`;
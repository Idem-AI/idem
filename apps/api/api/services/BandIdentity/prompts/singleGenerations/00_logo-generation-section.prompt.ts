// ─────────────────────────────────────────────────────────────────────────────
// LOGO_GENERATION_PROMPT.ts
// Prompt générique — auto-sélectionne le type selon le contexte
// Injecte LOGO_SYSTEM_BASE + logique de sélection de type
// ─────────────────────────────────────────────────────────────────────────────

import { LOGO_SYSTEM_BASE } from "./00_logo-system-base.prompt";


export const LOGO_GENERATION_PROMPT = `
${LOGO_SYSTEM_BASE}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODULE — UNIVERSAL LOGO GENERATOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You have not been given a specific logo type. Select the best format:

TYPE SELECTION LOGIC
  If brand name is 1-3 letters, or is an acronym    → INITIAL type (80×80)
  If brand name is 4-12 letters, simple, meaningful → ICON type   (80px tall, variable width)
  If brand name is long, or has visual typography   → NAME type   (60px tall, variable width)
  If user specified a preference                    → honor it strictly

After selecting, apply the full construction system from the base (modular grid,
symmetry mode, proportion scale, optical corrections) plus the type rules below.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ICON TYPE RULES (if selected)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Icon: 2 shapes maximum, 48×48px box, own grid u=6, symmetric on its own canvas
- Icon optical center: (24, totalHeight/2 − 1)
- Wordmark: right of icon, gap=12px, font-size=28px, weight=700
- totalWidth = 48 + 12 + (chars × 28 × 0.62 × 1.12), rounded up to nearest 4px
- viewBox="0 0 [W] 80" · layout.textPosition = "right"
- Icon must be extractable standalone (app-icon ready)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INITIAL TYPE RULES (if selected)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 2-3 initials only, NO full name, NO separate icon
- viewBox="0 0 80 80" · container centered on (40, 40) by construction
- 2 letters at x = 26.5 and 53.5 (equidistant from the axis) · letters shifted 1px up
- Container: circle (r=36), square/rounded (72×72 at (4,4)), or none — per archetype
- font-size: 30-34px, weight: 700-800 · exactly ONE advanced technique applied
- layout.textPosition = "center"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NAME TYPE RULES (if selected)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Full brand name, typography only, NO icon
- viewBox="0 0 [W] 60" · baseline y=38 · descenders stay inside the viewBox
- totalWidth = ceil((chars × font_size × 0.62 × 1.12 + 40) / 10) × 10
- Apply one typographic technique (color sequence, hidden element, weight contrast…)
- Optical kerning: close AV/TO/LY pairs by 1-2px, open HI/IL pairs by 0.5-1px
- font-size: 30-42px based on name length
- layout.textPosition = "center"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UNIVERSAL QUALITY GATES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [ ] Logo type is correct for the brand name
  [ ] All base quality gates pass (symmetry equations, grid snap, optical corrections)
  [ ] Type-specific rules are followed (width math verified — no clipped text)
  [ ] layout dimensions match viewBox exactly
`;

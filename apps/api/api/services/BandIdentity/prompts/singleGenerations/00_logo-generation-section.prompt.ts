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

After selecting, apply the full rules for that type:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ICON TYPE RULES (if selected)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Icon: 2 shapes maximum, left-aligned, 48×48px bounding box
- Wordmark: right of icon, gap=12px, font-size=28px, weight=700
- viewBox="0 0 [W] 80"
- layout.textPosition = "right"
- Icon must be extractable standalone

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INITIAL TYPE RULES (if selected)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 2-3 initials only, NO full name, NO separate icon
- viewBox="0 0 80 80"
- Container: circle, square, or none based on archetype
- font-size: 30-34px, weight: 700-800
- layout.textPosition = "center"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NAME TYPE RULES (if selected)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Full brand name, typography only, NO icon
- viewBox="0 0 [W] 60"
- Apply one typographic technique (color sequence, hidden element, weight contrast, etc.)
- font-size: 30-42px based on name length
- layout.textPosition = "center"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UNIVERSAL QUALITY GATES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [ ] Logo type is correct for the brand name
  [ ] All base quality gates pass
  [ ] Type-specific rules are followed
  [ ] layout dimensions match viewBox exactly
`;
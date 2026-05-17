/**
 * Shared constraints injected into every pitch deck slide prompt.
 * Enforces a minimalist, premium, pro aesthetic — NO emojis, NO cheesy decoration.
 */
export const PITCH_DECK_SHARED_RULES = `
SLIDE FORMAT (NON-NEGOTIABLE):
- Outermost element MUST use: w-[297mm] h-[167mm] overflow-hidden relative
- Safe padding: p-[14mm] (content never touches edges)
- 16:9 landscape, exactly 297mm x 167mm — do NOT use min-h-screen, aspect-ratio, or viewport units
- All content must fit inside the frame — no scroll, no overflow
- Use the brand's real colors via Tailwind arbitrary values: bg-[#hex], text-[#hex], border-[#hex]

VISUAL STYLE (CRITICAL):
- Strictly minimalist, editorial, investor-grade
- Generous negative space, strong typographic hierarchy
- NO emojis under any circumstances
- NO decorative clip-art, NO stock illustrations, NO generic gradients as centerpiece
- No more than 2 accent colors per slide (primary + one neutral or accent)
- Use thin dividers, subtle grids, elegant numerals — never flashy
- Prefer numbers, data, short sentences over long paragraphs
- Typography: large display for headline, medium for body, small tracked-wide for labels

TECHNICAL RULES:
- Raw HTML + Tailwind CSS utilities only, ONE single minified line (no newlines inside the output)
- PrimeIcons (pi pi-icon-name) are loaded; use them sparingly for bullet markers only (never as hero visuals)
- No custom CSS, no JS, no <style>, no <script>, no external images except the project logo SVG if provided
- WCAG AA contrast
- Replace {{companyName}} with the actual project name
- Do NOT prefix output with the word "html"
`;

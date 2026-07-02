/**
 * Shared constraints injected into every pitch deck slide prompt.
 * Enforces a minimalist, premium, pro aesthetic — NO emojis, NO cheesy decoration.
 */
export const PITCH_DECK_SHARED_RULES = `
<slide_format>
- Outermost element: w-[297mm] h-[167mm] overflow-hidden relative (exactly 297x167mm landscape, no min-h-screen/viewport units)
- Padding: p-[14mm] (no content touching edges, zero scroll/overflow)
- Colors: Brand colors only via bg-[#hex], text-[#hex], border-[#hex]
</slide_format>

<visual_style>
- Minimalist, editorial, investor-grade, generous negative space.
- NO emojis, clip-art, stock illustrations, or decorative gradients.
- Max 2 accent colors per slide (primary + neutral/accent).
- Use thin dividers, subtle grids, and elegant typography (large display headlines, medium body, small tracked-wide labels).
- Prefer data, numbers, and short sentences over long paragraphs.
- Use PrimeIcons (pi pi-icon-name) sparingly for bullets only, never as hero visuals.
</visual_style>

<technical_rules>
- Output raw HTML + Tailwind CSS ONLY in a single minified line. No newlines inside.
- No custom CSS, JS, <style>, <script>, or external images except provided logo.
- Ensure WCAG AA contrast.
- Replace {{companyName}} with the actual project name.
- Do NOT add markdown code blocks (e.g. \`\`\`html) or prefix with "html".
</technical_rules>
`;

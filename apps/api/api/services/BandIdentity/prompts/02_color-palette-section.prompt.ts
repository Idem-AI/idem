export const COLOR_PALETTE_SECTION_PROMPT = `
You are a senior brand identity expert and color theorist. Design a modern, premium "Color Palette" section using ONLY Tailwind CSS utilities in semantic, production-ready HTML.

OBJECTIVE:
Produce a visually sophisticated, minimal yet informative color system presentation that fits STRICTLY within ONE SINGLE A4 portrait page (210mm × 297mm), ready for PDF export in brand guidelines.

STRICT OUTPUT RULES:
1) Output ONLY raw HTML with Tailwind CSS classes (no Markdown fences, no comments, no <style>, no JS).
2) Must use Tailwind utilities only (including arbitrary values like bg-[#hex] for context colors).
3) For icons, use PrimeIcons classes (pi pi-icon-name) - PrimeIcons CSS is automatically available, do NOT import or use CDN.
4) All HTML must be minified into ONE SINGLE LINE with no breaks or extraneous whitespace.
5) The entire section MUST fit within [width:210mm] [height:297mm] with internal safe margins (≥ [padding:12mm]) and MUST NOT overflow vertically.
6) If risk of overflow exists, typography and spacing must scale down responsively (text-base → text-sm, py-8 → py-6, etc.), always preserving clarity.
7) All text in English. Use concise, professional, brand-guidelines tone.
8) Replace placeholders ([PRIMARY_HEX], etc.) with actual project context values.
9) Ensure WCAG AA compliance for all color cards and text overlays.

SECTION CONTENT (MANDATORY):
- Title: "Color Palette"
- Introductory subtitle (max 2 sentences) about consistency, accessibility, and emotional resonance.
- Grid of SIX color cards, arranged compactly but with visual balance:
   1. Primary Brand Color
   2. Secondary Brand Color
   3. Accent Color
   4. Background Light
   5. Background Dark
   6. Text Primary
- Each card includes:
   • Large color preview swatch with gradient overlay  
   • Color name + short subtitle  
   • Exact HEX code (monospace, with copy indicator style)  
   • 1–2 sentence psychology/usage description  
   • "Primary Usage" list (max 3 concise bullets with tiny icons/dots)  
   • Accessibility info: contrast ratio displayed (AA/AAA badge)  
- Final block: “Color Guidelines” → compact 2-column tips (Accessibility + Implementation).

DESIGN PRINCIPLES:
- Layout: clean card grid with consistent heights; responsive but A4-first; no element should push onto a second page.
- Aesthetic: subtle gradients, soft shadows, rounded 2xl corners, crisp spacing. Harmonize neutrals (gray/slate/white) with brand accents (blue/indigo/purple/amber as context).
- Typography: use Tailwind scale responsibly; hierarchy must remain legible in print. Strong h2 title, bold h3 card headings, small but clear body copy.
- Spacing: use Tailwind spacing (gap-6/8, px-6/8, py-6/8). Tighten progressively if needed to fit A4.
- Accessibility: verify AA contrast; all HEX values visible on both screen and print.
- Swatches: use object-contain, consistent h-32 (or scaled down if overflow risk). Keep gradient overlay subtle (from-white/20 to transparent).
- Hover states/micro-interactions: keep subtle (hover:shadow-xl, hover:border-gray-200) for digital view, but ensure print version remains legible.
- Icons: use PrimeIcons for visual elements (pi pi-icon-name classes)

A4 FIT CONSTRAINTS (NON-NEGOTIABLE):
- Outer wrapper: [width:210mm] [height:297mm] with overflow-hidden to guarantee one-page.
- Internal margins: at least 12mm; balance negative space for clean print.
- Grid distribution: 2 columns × 3 rows OR 3 columns × 2 rows, depending on spacing efficiency.
- Final "Color Guidelines" block must remain compact: max 6 bullets total.

QUALITY CHECKLIST (MUST PASS):
- Single HTML line, no line breaks, no comments.
- Section fits A4 portrait without overflow.
- Six complete color cards + one guidelines block.
- Accurate {{project colors}} applied via bg-[#hex].
- Visual balance: modern, minimalist, premium brand-system look.
- Accessible contrast; AA/AAA tags present.
- Print-friendly: no overly faint translucency, all text sharp.

IMPORTANT:
- not add any "html" tag or prefix on output
PROJECT DESCRIPTION:
`;

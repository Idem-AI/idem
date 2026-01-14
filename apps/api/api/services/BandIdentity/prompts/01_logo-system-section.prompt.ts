export const LOGO_SYSTEM_SECTION_PROMPT = `
You are a senior brand systems designer. Produce a comprehensive "Logo System" section as clean, production-ready HTML using Tailwind CSS utilities only.

OBJECTIVE:
Design a visually polished, modern, minimal logo presentation that fits STRICTLY on ONE SINGLE A4 portrait page (210mm × 297mm) for PDF export within brand guidelines.

OUTPUT RULES:
- Output ONLY raw HTML with Tailwind CSS classes (no Markdown fences, no comments, no inline <style>, no JS).
- HTML must be properly indented, readable, and semantically structured.
- All visible text must be written in French.
- Replace all image placeholders (e.g., [PRIMARY_LOGO_URL]) with actual project context URLs.
- No custom CSS or JavaScript; use Tailwind utilities (including arbitrary values) and data URIs if needed.
- For icons, use PrimeIcons classes (pi pi-icon-name) - PrimeIcons CSS is automatically available, do NOT import or use CDN.
- Ensure strong accessibility: clear hierarchy, semantic order, sufficient contrast, focusable semantics when relevant.
- I dont want to have anny html prefix or suffix. just the html code.

PAGE LAYOUT CONSTRAINTS (MANDATORY SINGLE PAGE):
- Wrap the entire section in a container sized with Tailwind arbitrary values to A4 portrait: [width:210mm] [height:297mm] with internal safe margins (≥ [padding:12mm]).
- The content MUST NOT overflow vertically: enforce strict vertical rhythm and height budgeting (use max-h utilities, clamp text sizes, reduce spacing if necessary).
- If vertical overflow risk is detected, progressively tighten spacing and typography (e.g., reduce from text-base to text-sm, from py-8 to py-6 → py-4) while preserving legibility.
- Use \`overflow-hidden\` on the outer container to guarantee a single-page print; avoid content that would create page breaks.
- Utilize responsive-friendly structure but prioritize print-fit at A4; optional \`print:\` variants may be used to fine-tune spacing/size for PDF export.

SECTION CONTENT & ORDER (SEMANTIC):
1) Section title (h2): "Logo & Déclinaisons"
2) Grid of four cards (articles) in a compact, balanced layout that fits A4:
   - Card 1: "Logo principal"
   - Card 2: "Version monochrome"
   - Card 3: "Version négative"
   - Card 4: "Zone de protection"
3) Final block: "Bonnes pratiques" (liste à puces concise)
- Keep a strict, logical reading order: title → grid (1→4) → bonnes pratiques.

DESIGN GUIDELINES:
- Aesthetic: clean card layout with soft shadows, subtle gradients, rounded corners; crisp borders as needed for separation.
- Color system: harmonize whites, grays/slate, blue, and amber for clarity and professionalism. Maintain AA contrast minimum.
- Spacing: use Tailwind spacing scale (e.g., px-8, py-12/16, gap-6/8). Adjust down if required to preserve single-page fit.
- Logos: use \`object-contain\`, \`max-h\` constraints and centered placement. Provide consistent background treatments (e.g., subtle slate/neutral panels) to showcase contrast variants.
- Variant badges: small, color-coded rounded dots or pills to distinguish each variant (e.g., blue for principal, gray for mono, slate for négative, amber for zone).
- Protection zone: illustrate clear margins around the logo using simple shapes or a thin dashed-like effect via SVG data URI (no custom CSS).
- Icons: use PrimeIcons for visual elements (pi pi-icon-name classes)

ACCESSIBILITY & TYPOGRAPHY:
- Use semantic elements: <section>, <header>, <article>, <figure>, <figcaption>, <ul>/<li>, proper heading levels (h2 then h3 for cards).
- Maintain high contrast for text and essential lines; avoid excessive translucency that harms print legibility.
- Typography hierarchy: strong title, clear card titles (h3), concise captions. Avoid lorem ipsum; write short, instructive French copy.
- Keep headlines readable at arm’s length when printed; ensure body text remains clear at typical print size.

GRID & DENSITY STRATEGY (FIT ON A4):
- Use a two-column grid for the four cards (2×2) with consistent heights, or a responsive single-column fallback, but ensure final print remains one page.
- Balance vertical space: uniform card heights with \`max-h\` and internal \`gap\` control; trim descriptions to 1–2 lines maximum.
- Place "Bonnes pratiques" in a compressed but distinct block at the bottom with minimal yet clear spacing.

BONNES PRATIQUES BLOCK:
- Background: soft blue panel (subtle tint) with rounded corners and a clear leading icon (use PrimeIcons, e.g., pi pi-lightbulb).
- Content: concise bullet list (3–6 items), each line short and actionable (ex: "Respecter la zone de protection", "Éviter la distorsion", etc.).

PALETTE & VARIANTS MAPPING (APPLY WITHOUT EXTRA EXPLANATION):
- Principal: neutral/light background, brand primary accent (badges/lines).
- Monochrome: black or dark neutral on white; ensure max contrast.
- Négative: white on dark neutral panel; preserve legibility.
- Zone de protection: show clear spacing guides around the mark.

QUALITY ASSURANCE CHECKLIST (MUST PASS BEFORE RETURNING):
- Fits within [width:210mm] [height:297mm] including safe margins; no vertical overflow; outer wrapper uses \`overflow-hidden\`.
- No custom CSS/JS; only valid Tailwind utilities; semantic HTML; proper indentation.
- All French copy; no placeholder lorem; image URLs replaced from context.
- Logos constrained with \`object-contain\` and appropriate \`max-h\`; badges present and color-coded.
- Contrast meets WCAG AA; print-friendly (shadows/gradients subtle, text sharp).
- Final page looks premium, balanced, and ready for PDF export.

IMPORTANT:
- not add any "html" tag or prefix on output
OUTPUT:
Return ONLY the well-formatted, indented HTML for this section (no extra commentary).
`;

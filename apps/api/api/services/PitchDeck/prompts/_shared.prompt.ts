/**
 * Shared constraints injected into every pitch deck slide prompt.
 * Enforces strict brand adherence, premium professional quality, and investor-grade design.
 */
export const PITCH_DECK_SHARED_RULES = `
<slide_format>
- Outermost element: a single <div> with classes w-[297mm] h-[167mm] overflow-hidden relative (exactly 297×167mm landscape — ONE slide = ONE page).
- Internal padding: p-[14mm] — nothing may touch the edges or overflow.
- The content MUST fit entirely within this single slide (no overflow, no scroll). If content is long, reduce the amount, summarize, or use smaller type — NEVER let content exceed or be cut by the slide.
- No min-h-screen, no viewport units.
</slide_format>

<editor_compatibility>
- The slide is edited afterwards in a visual (Figma-like) editor: put visible text in leaf elements (h1..h6, p, span, li, td), keep a clear block structure, and use NO inline event handlers. Charts already follow the editor-compatible pattern (canvas with unique id + inline new Chart(document.getElementById(...))).
</editor_compatibility>

<brand_enforcement>
CRITICAL — read the BRAND CONTEXT block at the end of this prompt and apply it rigorously:
- PRIMARY COLOR → use bg-[PRIMARY COLOR], text-[PRIMARY COLOR], border-[PRIMARY COLOR] (replace PRIMARY COLOR with the exact hex from BRAND CONTEXT).
- SECONDARY COLOR → use bg-[SECONDARY COLOR], text-[SECONDARY COLOR] for secondary elements.
- ACCENT COLOR → use bg-[ACCENT COLOR], text-[ACCENT COLOR] for highlights, accents, chart emphasis.
- BACKGROUND COLOR → use bg-[BACKGROUND COLOR] for slide backgrounds and card backgrounds.
- TEXT COLOR → use text-[TEXT COLOR] for body text and descriptions.
- PRIMARY FONT → prefer the class font-primary on headings; the renderer binds it to the real brand family. style="font-family: [PRIMARY FONT]" on the outermost slide container also works when the exact name is used.
- SECONDARY FONT → class font-secondary for body text and descriptions.
- HIERARCHY REPLACES DECORATION, and it rests on two contrasts: a light weight (200/300) against a heavy one (700/800) in the same family, and at least a 3x size jump between the slide title and the body. A slide built on one weight and two close sizes needs coloured blocks to be readable — that is the defect, not the fix.
- Brand logo: MANDATORY on every slide. The <logo> block in BRAND CONTEXT lists the ready-to-use URLs and the rule for picking the right declension. Follow it literally — copy the exact URL, never invent one, never paste raw SVG. Render as <img src="THE_EXACT_URL" class="h-8 w-auto object-contain" alt="logo" /> in the SAME corner on every slide, so the deck reads as one document. Ink and background must sit in opposite luminance families: a light-ink logo on a light slide erases the signature.
- The ART DIRECTION block in BRAND CONTEXT governs the grid, the border radius, the rules, the shadows and the image treatment of this deck. Where it contradicts a default habit below (rounded cards, soft borders), the art direction wins.
- ALL colors on the slide MUST come from the brand palette above. Do NOT invent colors, use generic blue/red/green, or use Tailwind default palette (blue-500, gray-800, etc.).
</brand_enforcement>

<visual_quality>
- Investor-grade, world-class design. Slides must look like they were designed by a professional agency.
- Strong visual hierarchy: one dominant element per slide (hero stat, title, chart), supported by secondary content.
- Use generous whitespace and negative space. Avoid cramming content.
- Card elements: the border radius, the rules and the shadows come from the ART DIRECTION block, and are IDENTICAL on every card of the deck. Absent an art direction, use a light fill (bg-[PRIMARY COLOR]/5) and a hairline border, never a soft drop shadow.
- Typography: headlines → text-3xl or text-4xl font-bold; subtitles → text-lg font-medium; body → text-sm; labels → text-xs uppercase tracking-widest. Keep at least three levels with a real gap between them.
- Numbers / KPIs: display in text-4xl or text-5xl font-bold tabular-nums for impact.
- NO emojis. NO cheap icons. NO decorative clip-art. NO placeholder text like "lorem ipsum".
- Use PrimeIcons (pi pi-check, pi pi-arrow-right, pi pi-chart-bar, etc.) very sparingly — only as small supporting icons, never as hero visuals, and NEVER as an icon-in-a-rounded-square repeated in a grid.
- Anti-generic, non negotiable: no purple/indigo gradient, no gradient headline (bg-clip-text), no row of three identically-sized cards, no centered hero stack, no reflexive glassmorphism, no hard-coded font family. These are the tells of a generated deck; an investor recognises them.
- Vary the composition from one slide to the next: two consecutive slides may not use the same layout skeleton.
</visual_quality>

<images_and_visuals>
- For slides where a visual image adds emotional impact or clarity (Cover, Problem, Solution, Product, Team):
  Insert an <img> tag with TWO data attributes for the image sourcing pipeline:
  data-image-query="English keywords for Pexels stock search, specific to the project industry"
  data-image-prompt="Detailed English prompt for AI image generation fallback, photorealistic style, relevant to the project"
  Also include src="https://placehold.co/800x450/[PRIMARY_HEX_WITHOUT_#]/[TEXT_HEX_WITHOUT_#]?text=..." as a fallback placeholder using brand colors.
  Apply classes: w-full h-full object-cover rounded-xl
- Image containers: use a fixed-size div with overflow-hidden rounded-xl, and optionally a gradient overlay (bg-gradient-to-t from-[SECONDARY COLOR] to-transparent) to ensure text legibility.
- Maximum 1 image per slide. Choose quality over quantity.
</images_and_visuals>

<chart_requirements>
- For data-driven slides (Market, Traction, Financials, Business Model, Competition):
  a) Wrap the chart in a sized container: <div class="relative" style="width:100%;height:220px;"><canvas id="chart-[slidename]"></canvas></div>
  b) Follow immediately with an inline <script>:
     new Chart(document.getElementById('chart-[slidename]'), {
       type: 'bar'|'line'|'doughnut'|'radar',
       data: { labels: [...], datasets: [{ label: '...', data: [...], backgroundColor: ['PRIMARY_COLOR','SECONDARY_COLOR','ACCENT_COLOR'], borderColor: ['PRIMARY_COLOR','SECONDARY_COLOR','ACCENT_COLOR'], borderWidth: 1 }] },
       options: { animation: false, responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom', labels: { color: 'TEXT_COLOR', font: { size: 10 } } } }, scales: { x: { ticks: { color: 'TEXT_COLOR', font: { size: 9 } } }, y: { ticks: { color: 'TEXT_COLOR', font: { size: 9 } } } } }
     });
  c) Replace PRIMARY_COLOR, SECONDARY_COLOR, ACCENT_COLOR, TEXT_COLOR with the exact hex values from BRAND CONTEXT.
  d) CRITICAL: Always set animation: false — PDF rendering requires synchronous chart capture.
  e) Do NOT include <script src="..."> for Chart.js — it is preloaded globally.
  f) Use real, plausible numbers that fit the project context. Never use 0 or obviously fake data.
</chart_requirements>

<technical_rules>
- Output ONLY raw HTML + Tailwind CSS in a single minified line. No line breaks inside.
- No markdown code blocks (no \`\`\`html wrapper), no "html" prefix.
- No <style> blocks. No external CSS links.
- Replace {{companyName}} with the actual brand name from BRAND CONTEXT.
- Ensure WCAG AA contrast between text and backgrounds.
- All content MUST be in the language specified in BRAND CONTEXT (French if "fr").
</technical_rules>
`;


/**
 * Shared constraints injected into every pitch deck slide prompt.
 * Enforces strict brand adherence, premium professional quality, and investor-grade design.
 */
export const PITCH_DECK_SHARED_RULES = `
<slide_format>
- Outermost element: a single <div> with classes w-[297mm] min-h-[167mm] relative (16:9 landscape width; height grows with content). Do NOT use a fixed h-[...] nor overflow-hidden, and NEVER truncate content to fit — aim to fill exactly one slide, but content is never clipped if it slightly exceeds.
- Internal padding: p-[14mm] — nothing may touch the edges.
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
- PRIMARY FONT → apply via style="font-family: [PRIMARY FONT]" on the outermost slide container.
- SECONDARY FONT → use style="font-family: [SECONDARY FONT]" for body text / descriptions.
- Brand logo: LOGO URLS in BRAND CONTEXT lists all available logo variants. Pick the right one based on your slide background:
  • Light background slides → use "With text (light bg)" or "Primary (full logo)" URL.
  • Dark background slides → use "With text (dark bg)" URL.
  • Minimal/small usage → use "Icon only (light bg)" or "Icon only (dark bg)" URL.
  Render as <img src="LOGO_URL" class="h-8 w-auto object-contain" alt="logo" /> at the top-left or top-right of each slide. If "No logo available", omit the logo entirely.
- ALL colors on the slide MUST come from the brand palette above. Do NOT invent colors, use generic blue/red/green, or use Tailwind default palette (blue-500, gray-800, etc.).
</brand_enforcement>

<visual_quality>
- Investor-grade, world-class design. Slides must look like they were designed by a professional agency.
- Strong visual hierarchy: one dominant element per slide (hero stat, title, chart), supported by secondary content.
- Use generous whitespace and negative space. Avoid cramming content.
- Card elements: rounded-xl, subtle borders (border border-[SECONDARY COLOR]/10), light fill (bg-[PRIMARY COLOR]/5 or bg-[SECONDARY COLOR]/5).
- Typography: headlines → text-3xl or text-4xl font-bold; subtitles → text-lg font-medium; body → text-sm; labels → text-xs uppercase tracking-widest.
- Numbers / KPIs: display in text-4xl or text-5xl font-bold tabular-nums for impact.
- NO emojis. NO cheap icons. NO decorative clip-art. NO placeholder text like "lorem ipsum".
- Use PrimeIcons (pi pi-check, pi pi-arrow-right, pi pi-chart-bar, etc.) very sparingly — only as small supporting icons, never as hero visuals.
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


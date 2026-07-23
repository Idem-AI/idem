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
- Modern, editorial, high-impact, investor-grade design.
- Slides MUST be vivid, lively, and convey emotion tailored to the project while strictly respecting the brand identity.
- Use strong visual hierarchy, card layouts, contrast overlays, subtle glassmorphism, and generous spacing.
- NO cheap clip-art or cheesy emojis. Use PrimeIcons (pi pi-icon-name) sparingly for bullet points or subtle icons.
</visual_style>

<images_and_visuals>
- Where imagery adds emotion or clarity (Cover background/hero, Problem, Solution/Product mockup, Market visual, Team portraits):
- Insert <img> tags with attributes data-image-query (English keywords for stock search) and data-image-prompt (detailed prompt for fallback AI generation), e.g.:
  <img data-image-query="modern tech workspace team" data-image-prompt="Cinematic high quality photo of a modern innovative startup team collaborating" src="https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=800&q=80" class="w-full h-full object-cover rounded-xl" alt="..." />
- Ensure images fit seamlessly into the layout (object-cover, overlay cards, gradient masks).
</images_and_visuals>

<chart_requirements>
- For slides with metrics or data (Market, Traction, Financials, Business Model, Competition):
- Render charts using Chart.js with a canvas tag inside a container with explicit height (e.g. <div class="relative w-full h-[200px]"><canvas id="chart-[slideName]"></canvas></div>).
- Follow immediately with an inline initialization script:
  <script>new Chart(document.getElementById('chart-[slideName]'), { type: 'bar'|'line'|'doughnut'|'radar', data: { labels: [...], datasets: [{ data: [...], backgroundColor: [...], borderColor: [...] }] }, options: { animation: false, responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#666' } } } } });</script>
- CRITICAL: Always set animation: false in chart options so PDF rendering captures it synchronously.
- Use brand colors (primary, secondary, accent from BRAND CONTEXT) for datasets and chart styling.
- Do NOT include <script src="..."> for Chart.js (it is preloaded).
</chart_requirements>

<technical_rules>
- Output raw HTML + Tailwind CSS ONLY in a single minified line. No newlines inside.
- No markdown code blocks (e.g. \`\`\`html) or "html" prefix.
- Replace {{companyName}} with the actual project name.
</technical_rules>
`;


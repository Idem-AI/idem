# Paginating PDF documents (business plan)

## The problem

Agents produce **one continuous HTML flow per section** (Tailwind + Chart.js). That flow used to be left to Chrome's native pagination, with two visible consequences on the PDF:

- **blocks cut** across a page break (card, table, chart);
- **half-empty pages**: a block that does not fit is pushed whole to the next page and leaves a 30 to 40 % hole at the bottom of the previous one.

CSS alone cannot fix this: `break-inside: avoid` prevents the cut but makes the holes worse, and nothing in CSS can "stretch" a page to fill it.

## The solution

A paginator measures the real flow in the Puppeteer page, then **rebuilds it into exact A4 pages** before printing.

- Code: [`api/services/pdf/flow-pagination.runtime.ts`](../api/services/pdf/flow-pagination.runtime.ts) (browser script exposed as `window.__idemFlow`)
- Called from: [`api/services/pdf.service.ts`](../api/services/pdf.service.ts), only when `multiPage: true`
- Enabled by: `BusinessPlanService.generateBusinessPlanPdf`

### Steps

1. **`prepare()` — deterministic rendering before any measurement**
   - re-runs Tailwind utility generation. `page.setContent()` rewrites the document and detaches the Tailwind CDN observer: classes are only regenerated if `tailwind.config` is reassigned (`tailwind.refresh()` does not exist in this build). An `h-[137px]` probe confirms it is done;
   - waits for `document.fonts.ready`, images, then Chart.js instances;
   - **rasterises each `<canvas>` into a PNG `<img>`** with the same box: a chart becomes movable, clonable and measurable (the viewport uses `deviceScaleFactor: 2`, so PNGs stay sharp in print).

2. **Measurement** — each section is split into "flow lines" (the children of the root container, grouped geometrically to handle grids and flex-wrap). We keep height, real spacing between blocks and "heading" status. Children in `position: absolute` are decorations: they are reproduced on every page.

3. **Plan** — greedy filling with recursive fragmentation: container → lines, table → `<tr>` (repeating the `<thead>`), paragraph → cut at a line (never fewer than 2 lines on either side). An atomic block taller than a page is scaled down, never cropped. A heading is never alone at the bottom of a page (`keep-with-next`, standfirst included).

4. **Balancing** — the greedy plan gives the minimum number of pages; it is replayed with an equal budget per page (`remaining / pages left`), loosening that budget in steps, and the plan whose emptiest page is the fullest is kept. `[100 %, 100 %, 20 %]` becomes `[80 %, 79 %, 74 %]`.

5. **Construction** — each page is a **clone of the AI's root container** (classes, background, decorations kept) at a fixed A4 height with `overflow: hidden`. Measured spaces are reapplied as explicit margins: no surprise from margin collapsing.

6. **Filling** — the remaining space is distributed between lines:
   - never after a heading (a heading is not detached from its text);
   - preferably before a new subheading;
   - capped (12 mm per gap, 26 mm if the page has few blocks);
   - if more than 8 % remains, the *internal* spaces of multi-line blocks (card grid, stack of paragraphs) are loosened: 10 mm max.

7. **Verification** — each built page is measured again; if the real rendering overflows (measurement drift), the last blocks are pushed onto an inserted page. **Nothing is ever cropped.**

The returned report (pages, fill ratio, fragmentations, repairs) is logged; a section leaving a page under 60 % triggers a `warn` — it is a lack of content from the agent, not a layout defect.

## What prompts must guarantee

See [`services/BusinessPlan/prompts/_shared.prompt.ts`](../api/services/BusinessPlan/prompts/_shared.prompt.ts): agents no longer handle any page break, but must produce enough material for a whole number of pages (≈ 550–700 words per full page, or 350 words + a chart). The only defect the engine cannot fix is missing content.

Attributes recognised in the generated HTML:

| Attribute | Effect |
| --- | --- |
| `data-keep-together` | the block is never fragmented (scaled down if too tall) |
| `data-keep-with-next` | the block stays attached to the next block |

## Special cases

- **Cover**: passed in `fixedPageSections`, it is rendered as is on an exact page (full-page composition, never stretched or re-cut).
- **Several root elements**: if the agent forgets the single container, they are wrapped automatically (otherwise everything but the first would be lost).
- **Pitch deck / brand charter** (`multiPage: false`): unchanged, one section = one cropped page. These documents still benefit from `prepare()`.

## Settings

`PdfGenerationOptions.pagination`: `minFillRatio` (0.30), `maxGapAddMm` (12), `balance` (true). The runtime also accepts `maxGapAddHardMm` (26), `maxInnerGapAddMm` (10) and `debug` (traces the plan and the filling page by page in `report.warnings`).

## Network access during rendering

The Chromium page is protected by the render network guard (`utils/render-network-guard.ts`): it can load public resources and the storage/API hosts, but not internal addresses or `file://`. If a logo or font stored on an internal host does not show in a PDF, add that host to `RENDER_ALLOWED_HOSTS`.

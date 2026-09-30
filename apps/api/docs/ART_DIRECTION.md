# Art direction and fighting the generic look

How IDEM produces visual deliverables that belong to the same brand and do not look like machine output. Read it before adding a visual generation or touching a composition prompt.

> **Scope.** This document governs the deliverables generated **for a customer's brand** (charter, social visuals, business plan, deck, website): they follow that brand's own art direction. The illustrations of **IDEM's own interface** (modals, sections, empty states) follow a different, fixed rule: one element of African culture chosen for what the screen means, drawn in line art. See `AGENTS.md` § 4 and `PRODUCT.md`.

## The problem

A model given a vague brief returns the **average of its corpus**. That is the definition of a probabilistic generator, not a lack of talent: ask for "a modern, clean page" and you get the consensual modern clean page — purple-to-blue gradient, Inter, centred hero, three rounded cards with soft shadows, "Elevate your business".

The module had two distinct symptoms and a single cause:

1. **The renderings "smelled of AI".** Every prompt asked for quality with adjectives ("premium", "world-class"), which constrains nothing.
2. **Two deliverables of the same project had no family resemblance.** The charter, social visuals, business plan, deck and website were composed by five prompts, each improvising its own stance.

The common cause: **no visual decision was made at brand level**. There were only atoms (logo, palette, typography), never the grammar that assembles them.

## The mechanism

Three pieces, in this order. None is enough on its own.

```
                    ┌─────────────────────────────┐
                    │  1. ART DIRECTION           │  decided ONCE per brand
                    │  (positive constraint)      │  models/art-direction.model.ts
                    └──────────────┬──────────────┘
                                   │ styleId bounds the space
                    ┌──────────────▼──────────────┐
                    │  2. COMPOSITION SEED        │  drawn per deliverable
                    │  (bounded variety)          │  services/design/designSeed.ts
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │  3. ANTI-SLOP RULES         │  negative constraints
                    │  + DETERMINISTIC LINTER     │  services/design/antiSlop.prompt.ts
                    └─────────────────────────────┘  services/design/slopLint.service.ts
```

### 1. Art direction — the positive constraint

`services/design/artDirection.catalog.ts` holds **20 named styles** (minimalism, maximalism, futuristic, vector art, collage, retro, cyberpunk, pop art, glassmorphism, clay, pixel art, editorial, Y2K, Swiss design, surrealism, bohemian, Victorian, graffiti, aurora, handwritten).

Each entry is written **to be executed by a model**, not to be read: grid, colour behaviour, typographic treatment, border radius, rules, shadows, imagery direction, image-prompt modifier (English), negative prompt, style-specific don'ts.

An agent (`prompts/singleGenerations/art-direction.prompt.ts`) **chooses** a style from the catalogue — it does not invent one — then adapts it to the brand. The output is validated against the catalogue: an unknown `styleId` falls back to `editorial` rather than silently breaking the chain.

Why constrain the choice: left free, a model answers "modern, clean, professional". Three words that constrain nothing and reproduce the average.

The direction is stored on `branding.artDirection` and read back by **every** module.

### 2. The composition seed — bounded variety

`services/design/designSeed.ts` draws a layout archetype, a colour strategy, a typographic mood, a spatial tension, a graphic accent and a density — **within the space allowed by the style** (`seedSpace`). A "Swiss design" charter can therefore not come out as neon on black.

Two modes:

| Mode | Use | Effect |
|---|---|---|
| Deterministic (`entropyKey`) | Charter, business plan, deck | Pages of one document look alike; two projects differ; a regeneration keeps its layout |
| Random (no key) | Social visuals | Two posts of the same brand do not look alike |

The seed is **expanded into instructions** before reaching the model (`describeSeed`). Sending `{"archetype":"D"}` sent nothing: the model does not know what "D" means.

### 3. Don'ts and the linter — negative constraint, then measurement

`antiSlop.prompt.ts` explicitly names the defaults the model would otherwise fall into, at three severity levels. Naming a defect is what removes it; asking for "something original" has no anchor.

`slopLint.service.ts` then **checks** the produced HTML, without spending a token (regular expressions on a string):

- `lintHtml` diagnoses and produces a correction instruction that can be fed back;
- `repairHtml` fixes what has a single answer — an off-charter colour brought back to the nearest charter colour, a hard-coded font brought back to the charter classes, a gradient title flattened, an image without `alt`.

What is a matter of taste is never repaired blindly, only logged: a linter that recomposes is a linter people switch off.

Styles that **claim** a marker are exempt from it: glassmorphism is a defect only for the nineteen other styles.

## The logo

The logo appeared neither in the visuals, nor in the business plan, nor on the generated website. The data was passed — but **without a verb**. A model given a URL without an instruction treats it as context, not as an element to place on the page.

`utils/brand-context.util.ts` produces a single `<logo>` block, shared by the business plan, the deck, the business card and the website, which carries:

- the URLs of **all** variations, a missing variation falling back to the primary logo (a hole in the table leads the model to invent a URL, hence a broken image);
- the **obligation** to place it, with the exact destination in this deliverable;
- the ink/background choice rule, measured on the real area and not on the general mood of the page;
- an explicit absence instruction when the brand has no logo — without it, the model draws one or invents a URL.

Three safety nets downstream:

| Deliverable | Guarantee |
|---|---|
| Social visual | `ensureLogoPresence` replaces an invented URL, or adds a signature if the logo is missing; then `flyerRender` measures size and contrast on the rendered pixels and corrects the variation |
| Pitch deck | Real URLs are protected from stock-photo replacement; `logo-missing` is logged |
| Generated website | The `we-dev-next` linter fails if no variation is referenced |

## Brand fonts

They loaded **nowhere**. `TypographyModel.url` does not hold a stylesheet but a slug (`typography/systeme-premium`) — that is what the agent produces and what the front end uses as an identifier. Yet the four server-side renderers injected it as is into a `<link rel="stylesheet">`: the link loaded nothing, `font-family` fell back to the system font, and **every** deliverable came out in a typeface that was not the charter's, without any error.

`utils/google-fonts.util.ts` now builds the URL at render time, from the families. Two `<link>` per family, deliberately: one without a weight specification (always valid, guarantees loading), the other with the full 100→900 range (allows weight contrast). A single request combining both families would make BOTH fail as soon as one weight is missing from one of them.

The font catalogue offered by the agent was redone at the same time: the first set was **hard-coded** to "Exo 2 / Roboto", identical for every project, and Roboto is on the anti-generic list. The last-resort fallbacks moved from `Inter` / `Montserrat` to `Archivo` / `IBM Plex Sans`.

## Editorial restraint

`services/design/editorialRestraint.prompt.ts` treats a **different** pathology from anti-slop, and both can coexist: a page can be perfectly free of clichés and still unreadable because it is saturated with ornaments and empty sentences.

The cause is identifiable: a model asked to "fill a page" fills it — a card, an icon, a badge, a transition sentence, because producing volume is easier than producing substance. The remedy is not to ask for "less" (one more adjective) but to impose a **criterion**: the subtraction test. Remove the element; if the reader loses no information, no hierarchy and no reading path, it must not exist.

Two concrete consequences:

- the business-plan page quota ("fill to 85 %, a half-empty page is a defect") **produced** the padding we blamed on the rendering. It became an indicative target: fewer pages beats padding;
- the linter now measures accumulation — `icon-overload`, `decorative-shape`, `empty-badge` — because asking for it in the prompt is not enough at the scale of a twelve-page document.

## Component vocabulary

Each style carries a `tailwindRecipe`: the six primitives of a document (page, section title, body text, rule, data block, caption) as exact Tailwind classes, plus the type pairings that serve it.

It answers a precise defect: without given primitives, the model invents a card, a badge, a border at every block — and that accumulated tinkering is what produces useless decoration. A third-party component library would do the opposite of what we want (it imposes ITS look on every brand); per-style recipes give the same benefit — assembling instead of inventing — without uniformising.

## Layout families

Observed on 13 September 2026: whatever the project, the charter and the business plan came out "in one and the same style, with exactly the same layouts". The seed varied **settings** — which colour goes where, the mood of the title, the header ornament — on **a single drawing**. Blocks (key figures, tables, cards, timelines, quotes), the footer and the text column were identical for every project; in portrait, side layouts even all boiled down to "title at the top". The checks were green because they counted draws, not pages.

`services/design/layoutFamilies.ts` now holds **60 named families** (Review, Annual report, Poster, Modular grid, Field notebook, Atlas, Dashboard, Gazette, Manifesto, Monograph, Logbook, World map, Fashion magazine, Directory, White paper, Press kit, Control room, Portfolio, Travel guide…). Each is a complete grammar over **23 visible dimensions**:

| Dimension | Drawings |
|---|---|
| Section opening (portrait) | 13 — number in the margin, bleeding colour block, frame, rotated kicker, chapter opening, title and standfirst side by side, inverted hierarchy (standfirst large), double rules, tab… |
| Footer | 8 — including running title at the top of each page, corner number |
| Text column (paginated portrait) | 5 — full, offset, indexed, narrow, paired |
| Key figures | 11 — row under a rule, register, hero figure, tiles, ruled columns, band, label first, lines, sentence, cartouches, staircase |
| Tables | 11 — including tinted columns, transposed, boxed |
| Cards | 12 — including alternating bands, offset columns, initials, corner number |
| Timelines | 9 — including central spine, numbered steps, chevrons |
| Quotes | 9 — including author alongside, corner brackets, highlighted |
| Assumptions | 7 — including tab, block footnote |
| Prose | 8 — including drop cap, bold lead-in, two columns, indents, essay body, enlarged first paragraph, ruled paragraphs |
| Charts: frame and reading key | 6 — including margin note, numbered legend |
| Charts: ink | 4 — charter, monochrome, highlighted series, line art |
| Standfirst | 5 · Figure typeface | 4 |
| Rhythm between blocks | 3 · Page edge | 4 — none, top bar, side bar, frame |
| Labels · numbering · rules · figure ink · corners · title scale · swatch | 5 · 6 · 5 · 2 · 2 · 3 · 3 |

The last five dimensions added (standfirst, figure typeface, chart ink, rhythm, page edge) answer a precise remark: even with 36 families, "there is always a bit of resemblance between the elements". Figures all came out in bold display, the standfirst always grey under the title, the charts identical, and the page always bare.

Each value is a **distinct rendering function**, never a slider on a common drawing: `familyChrome.ts` for the envelope (opening, footer, column), `familyBlocks.ts` for the blocks, the historical drawings staying in `sectionRenderer.ts` as one family's option among others. The primitives they share — escaping, title fitter, page context, family tone — live in `renderKit.ts`.

The family is a **document invariant**: drawn per deliverable (`buildDocumentSeed`), deterministic, among the families compatible with the art-direction style (`fits`, at least nine per style; the whole catalogue without a direction). Archetype, colour strategy and typographic mood keep varying on top.

In landscape (charter, deck), the archetype **structures** remain: they are calibrated to the millimetre against the overflow of cropped pages. The family sets their footer, labels, corners, swatch and the drawing of each block.

### What is checked

- `check:uniqueness` — at least 55 families; two families always differ on at least nine of the twenty-three dimensions (measured average: 18); each style opens at least thirteen families; each drawing is used by at least two families; forty projects of the same style spread over most of its families.
- `check:render` — 60 families, 60 distinct pages (portrait and landscape); charter respected, content escaped, blocks as direct children of the root, columns carried by the root's padding.
- `check:fit` — each family measured in Chrome (full paginated A4 and two charter slides): no overflow, no overlap, fill. Then the **silhouettes**: the first page in black and white, on a one-centimetre grid; two families must differ by at least 10 % of inked cells. Measured with 60 families: 11 % for the closest pair, 33 % median.

### Adding a family

1. Add the entry to `LAYOUT_FAMILIES`, with its styles (`fits`).
2. `npm run check:uniqueness` says whether it is too close to another on paper; `npm run check:fit`, whether it is on screen.
3. Open `logs/render-preview.html` (group "Layout families") before announcing it: a check says it differs, not that it is beautiful.

A new DRAWING (an eleventh opening, a ninth table) multiplies the variety of every family that adopts it: add it to the type in `layoutFamilies.ts`, implement it in `familyChrome.ts` or `familyBlocks.ts`, then in the vocabulary of `checkUniqueness.ts`.

## What art direction reaches

| Module | What it receives |
|---|---|
| Brand charter | `<art_direction>` block, deterministic seed, don'ts, self-review — on **every** page. Plus an "Art direction" page that must be composed IN the style it describes |
| Social visuals | `<art_direction>` block, seed drawn in the style's space, imposed image treatment, don'ts, the style's negative prompt for image generation |
| Business plan | `<art_direction>` block, deterministic seed, `<logo>` block, `BP_BRAND_RULES` on each section |
| Pitch deck | Same, in slide register |
| Mockups | Rendering modifier (light, material, grading) + negative prompt: the style drives the photo, not the subject |
| Business card | `<art_direction>` block — the medium where the gap shows most |
| Generated website | Art-direction block + logo block + don'ts, in `multiChatPromptService` |

## Checking

```bash
cd apps/api && npm run check:design
```

Pure, no network or model. It covers invariants whose regression would be **silent**: a seed leaving its style's space, an empty direction block, a linter starting to flag compliant HTML (a false positive is the worst defect of a linter: it teaches people to ignore its alerts).

## Adding a style

1. Add the identifier to `ArtDirectionStyleId` (`models/art-direction.model.ts`).
2. Add the entry to `ART_DIRECTION_STYLES`, **with** its `seedSpace`: without it, the style draws from the whole catalogue and loses its coherence.
3. `npm run check:design` validates completeness and seed/style consistency.

No prompt needs to change: they all read the catalogue.

## Adding a visual generation

Three lines are enough, and all three must be there:

```ts
const ad = project.analysisResultModel?.branding?.artDirection;
const seed = buildDesignSeed(ad?.styleId, `my-deliverable:${projectId}`); // key = deterministic
const directives = [
  buildArtDirectionBlock(ad, { medium: 'document' }),
  `<composition_seed>\n${describeSeed(seed)}\n</composition_seed>`,
  ANTI_SLOP_BLOCK,
].join('\n\n');
```

Then, on the output:

```ts
const clean = repairHtml(html, { palette, fonts, expectedLogoUrls, styleId: ad?.styleId, label });
lintHtml(clean.html, { ...sameOptions });
```

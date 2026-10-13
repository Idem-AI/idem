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
                    ┌──────────────────────────────┐
                    │  1. ART DIRECTION            │  decided ONCE per brand
                    │  (positive constraint)       │  branding.artDirection
                    └──────────────┬───────────────┘
                                   │ styleId bounds the space
                    ┌──────────────▼───────────────┐
                    │  2. COMPOSITION BY THE CODE  │  the graphic engine
                    │  (bounded, seeded variety)   │  packages/graphic-engine
                    └──────────────┬───────────────┘
                                   │ the model writes words, never the page
                    ┌──────────────▼───────────────┐
                    │  3. WRITING RULES            │  negative constraints on TEXT
                    │  + MEASURED, REPAIRED RENDER │  contentContract, WRITING_RULES
                    └──────────────────────────────┘  Chromium measurement and repairs
```

### 1. Art direction — the positive constraint

`apps/ivision/core/src/design/artDirection.catalog.ts` (re-exported by
`services/brand/artDirection.catalog.ts`) holds **20 named styles** (minimalism, maximalism,
futuristic, vector art, collage, retro, cyberpunk, pop art, glassmorphism, clay, pixel art, editorial,
Y2K, Swiss design, surrealism, bohemian, Victorian, graffiti, aurora, handwritten): essence, grid,
colour behaviour, typographic treatment, devices, imagery direction, image-prompt modifier (English),
negative prompt, style-specific don'ts.

An agent (`prompts/singleGenerations/art-direction.prompt.ts`) **chooses** a style from the catalogue —
it does not invent one — then adapts it to the brand. The output is validated against the catalogue: an
unknown `styleId` falls back to `editorial` rather than silently breaking the chain. Styles whose ground
must be dark are never offered (light-surface policy). The direction is stored on
`branding.artDirection` and read back by every module.

Why constrain the choice: left free, a model answers "modern, clean, professional". Three words that
constrain nothing and reproduce the average.

### 2. Composition by the code — bounded, seeded variety

Every page, slide, card face and visual is composed by the graphic engine (`@idem/graphic-engine`, see
its README). It does not read the style as prose: it reads it as DATA (`STYLE_DATA` in the engine —
border radius, type-scale ratio, ground, and the space it may draw in: colour strategies, typographic
moods, spatial tensions, densities, graphic accents, type pairings). A "Swiss design" charter can
therefore not come out as neon on black, and `npm run check:design` keeps the engine's table and the
catalogue aligned (same styles, same radius, ratio and ground).

The engine ranks composition patterns by fit to the content, affinity with the style and diversity, and
draws among them with a seed:

| Seed | Use | Effect |
|---|---|---|
| The deliverable's key (`documentDesignKey`) | Charter, business plan, deck | Pages of one document share their typography and differ in layout; two projects differ; a regeneration keeps its layout |
| A new seed per request | Business card regeneration, social visuals | Two proposals of the same brand do not look alike |

Within a document, the plan reserves a distinct composition for each page, two neighbouring pages never
share one, and the layouts of the project's recent documents are avoided (30 days). Above Medium, an art
director picks from a menu of compositions, tunes their bounded parameters (Max) or writes a new tree from
the allowed primitives (Ultra) — always validated, measured and repaired by the code.

### 3. Writing rules — and a measured render

The model never writes HTML, CSS or a colour. It returns BLOCKS (prose, key figures, table, chart,
timeline…) against the engine's output contract (`contentContract`), with one volume instruction
(`volumeDirective`) and the shared writing rules (`WRITING_RULES`): banned vocabulary ("seamless",
"révolutionnaire"…), filler, sentences that would survive a change of company name, and three kinds of
forgery seen in delivered documents — invented reference codes and statuses, numbers nobody computed
(colour breakdowns, contrast ratios), inflated naming. Everything visual is the code's job, so no
prompt repeats it (`npm run check:prompts` makes sure of it).

Then the render is measured in Chromium and repaired by the code: titles fitted to the pixel, a text
too pale on its real background pulled toward the charter's ink, a decor lying on a text removed, the
page brought back to its format, or the next composition. A charter colour cannot be "off-palette": the
compiler writes every style from the brand's tokens.

## The logo

The engine places the logo itself and picks the declension from the luminance of the zone it sits on
(ink for a light ground, light ink for a dark one, a flat behind it when the area is busy). It needs
every declension as a valid image address: `utils/brand-context.util.ts#resolveLogoDeclensions` resolves
them (hosted PNGs first, then SVGs; a missing declension falls back to the primary logo — never a hole,
never raw SVG pasted in a page). A brand without a logo gets a typographic signature in its display
typeface, never an invented logo.

## Brand fonts

They loaded **nowhere**. `TypographyModel.url` does not hold a stylesheet but a slug (`typography/systeme-premium`) — that is what the agent produces and what the front end uses as an identifier. Yet the four server-side renderers injected it as is into a `<link rel="stylesheet">`: the link loaded nothing, `font-family` fell back to the system font, and **every** deliverable came out in a typeface that was not the charter's, without any error.

`utils/google-fonts.util.ts` now builds the URL at render time, from the families. Two `<link>` per family, deliberately: one without a weight specification (always valid, guarantees loading), the other with the full 100→900 range (allows weight contrast). A single request combining both families would make BOTH fail as soon as one weight is missing from one of them.

The font catalogue offered by the agent was redone at the same time: the first set was **hard-coded** to "Exo 2 / Roboto", identical for every project, and Roboto is on the anti-generic list. The last-resort fallbacks moved from `Inter` / `Montserrat` to `Archivo` / `IBM Plex Sans`.

## Light surfaces

Charters, documents, cards and visuals are produced on a light ground. A brand whose palette is dark
keeps light documents; a dark ground is honoured only when explicitly asked for (`allowDark`), and the
ink stays legible either way. This is guaranteed by the engine's tokens, not asked of a model
(`npm run check:design` covers it for the twenty styles).

## What art direction reaches

| Module | What it receives |
|---|---|
| Brand charter, business plan, pitch deck | The engine reads the style (`STYLE_DATA`) and the direction's keywords (agents above Medium); pages composed by the code, specimens (swatches, typefaces, logos, patterns) set by the code with exact values |
| Business card | Same engine, card patterns; a shared template filled with each holder's details |
| Social visuals | Same engine (`flyer-*` canvases); the image models receive the style's rendering modifier and negative prompt |
| Mockups | Rendering modifier (light, material, grading) + negative prompt: the style drives the photo, not the subject |
| Generated website | The appgen design system reads `branding.artDirection` on its own side |

## Checking

```bash
cd apps/api
npm run check:design      # catalogue ↔ engine, light surface, image prompts, logo declensions, brand fonts
npm run check:uniqueness  # palette regions, type registers, and composition variety across projects and pages
npm run check:prompts     # no prompt asks for what the code produces, nor names a provider
npm run check:graphic     # the graphic engine itself, rendered and measured in Chromium
```

## Adding a style

1. Add the identifier to `ArtDirectionStyleId` and the entry to `ART_DIRECTION_STYLES` (catalogue).
2. Add its entry to `STYLE_DATA` in `packages/graphic-engine/src/design-system/tokens/styles.data.ts`:
   radius, type ratio, ground, and the space it may draw in.
3. `npm run check:design` says whether the two tables agree.

No prompt needs to change.

## Adding a visual deliverable

Do not prompt a model for a page. Open a document of the engine with the brand, write the content as
blocks, let the engine compose, measure and repair:

```ts
import { brandFromIdem, createDocument, sectionHtml } from '@idem/graphic-engine';

const { brand, direction } = brandFromIdem({ name, branding, logos: resolveLogoDeclensions(branding.logo) });
const doc = await createDocument({ documentType: 'brand-charter', format: 'slide-16x9', brand, direction, seed: documentKey, creativity });
const page = sectionHtml(await doc.composeSection(content, { index, total }));
```

In the IDEM API, `services/graphic/graphic.service.ts` does this for you (`openGraphicDocument`,
`renderGraphicPage`).

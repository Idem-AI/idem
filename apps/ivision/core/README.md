# iVision core — the creative engine shared by IDEM and iVision

Everything that *creates*: motion-design videos, composed visuals, website reading, model
reproduction. Two hosts run it — the IDEM API (`apps/api`) and the iVision API (`apps/ivision/api`) —
by importing these sources by relative path. There is no build step and no copy: a change here ships
to both.

| Directory | Contents |
| --- | --- |
| `src/runtime` | `configureCore()` and the host ports (logger, storage, vision, image generation, Google GenAI, agent runtime, credit refund) |
| `src/video` | the video service (`MotionVideoService`), storyboard, patterns and capability graph, creative planner, copy, music, sound effects, rendering, pricing, options |
| `engine/src` | the React video engine played in the browser (preview) and in Chromium (MP4), with its live **edit bridge** (`setupEditBridge` in `index.tsx`) |
| `src/visual` | the visual composer (`composeVisual`, which delegates to the poster engine in `src/visual/poster`), image sourcing, `visualContextFromBrand`, and the passes used when IDEM edits a visual |
| `src/site` | the website scanner (`scanWebsite`), palette and typography proposals |
| `src/reference` | model video/image analysis (`analyzeReferenceVideo`: luminance **and** colour cuts, shots, contact sheets, vision in the engine vocabulary) and the reproduction plan (`planFromBlueprint`) |
| `src/design`, `src/brand` | design rules (colour, contrast, grid, anti-slop), art direction, brand kit readers |
| `src/creativity` | the creativity levels (from `packages/shared-models`) and the agent orchestrator |
| `src/render` | network guard of rendering browsers, `safeFetch` (SSRF-safe download), HTML sanitising |

## Plugging a host

```ts
import { configureCore } from '<path>/apps/ivision/core/src/runtime/host';

configureCore({
  logger,                       // winston-like
  apiBaseUrl: () => publicUrl,  // where rendering pages fetch media and sounds
  sfxUrl: (name) => `${publicUrl}/…/sfx/${name}`,
  storage,                      // { uploadFile(content, name, folder, type) → { downloadURL } }
  analyzeImage, generateImage,  // the host's models (purpose tells which one)
  agentCall: (ctx) => call,     // the host's agent runtime
  refundCredits,                // give credits back when a paid render fails
});
```

A port that is used but not plugged throws a clear error (`requirePort`). The video service also takes
a `VideoStore` (where brands and videos live: IDEM projects, iVision brands).

## Visuals — the method grows with the creativity level (`src/visual/poster`)

Every visual (IDEM Communication, brand book, iVision) shares the words and the photo; then the
**method changes with the level — the higher, the more the AI designs, and the more it is checked**.

| Level | Method | Who designs |
| --- | --- | --- |
| Low | rules (`poster.templates.ts`) | the code picks the best code-drawn layout for the intent |
| Medium | rules + variety | among the 3 best layouts |
| High | art direction (`poster.compose.ts`) | the AI picks a layout, **looks at the render** (visual critic) and picks another one that fixes what it saw (2 revisions) |
| Max | AI layout (`poster.layout.ts`) | two AI designers place every element themselves (photo, colour areas, text blocks, logo) as JSON; the code builds it with the measured bricks |
| Ultra | author (`poster.author.ts`) | a creative director invents two concepts; one designer per concept codes the whole poster in HTML/CSS (shapes, SVG, crops) within a contract |

Max and Ultra run the **design loop** (`poster.loop.ts`): write → build and check → render →
measure → visual critique → the designer fixes (3 rounds in Max, 4 in Ultra), best render kept;
the critic then compares the two designs. If a level's method does not succeed, or scores below
6/10, the art-direction method is the safety net (the critic compares), and the result says so
(`parsed.method`, `parsed.fellBack`).

What the AI can never break, at any level (enforced in code):

- **words**: the copywriter's text is validated (no invented format, no figure absent from the
  request, the brand's language); in Ultra a rewritten headline passes the same checks; any other
  visible word, or an approved word repeated in a badge, sends the design back;
- **charter**: colour tokens only (`poster.canvas.ts`) — a hard-coded colour is snapped to the
  nearest token, a neon colour is never a text colour or a large area, the dark token exists only
  when asked for or when the brand's own posters are dark; brand fonts only;
- **resources**: only the photos and logo provided (`{{PHOTO_n}}`, `{{LOGO}}`), no script, no
  external URL;
- **measured render** (`poster.render.ts`): text fitted in its box, no overflow, no overlap, inside
  the safe zone, **contrast read on the pixels** under every text and under the logo (both inks of
  a two-colour logo).

The visual critic (`poster.critic.ts`) rates six criteria (hierarchy, legibility, balance, brand,
finish, originality) — the score is computed by the code, the weakest counting twice — and returns
concrete, spatial fixes. Photo choice: the user's photo, then the brand's photos (classified by
vision: a brand poster is never used as a photo; ranked ≥ 6/10), then stock verified by vision,
then generated, or none. In iVision, a short feedback (« plus sobre ») replays the previous visual
with that feedback and avoids its layout; the chat shows the real stages (`onStage`).

## Rules

- **No host code here**: no MongoDB model, no project shape, no provider SDK, no Express. Ask the host
  through a port or the `VideoStore` contract.
- Dependencies (`package.json`) must be declared by the IDEM API too (its image installs them):
  `npm run check:video:engine --prefix apps/api` checks it.
- Run `npm run check` here (it also renders every poster layout in 3 formats, builds and measures a Max layout and an Ultra authored HTML, and checks the copy, charter and critic rules), then the IDEM video checks (`check:video`, `check:video:creative`,
  `check:video:novelty`, `check:flyer`) after a change.

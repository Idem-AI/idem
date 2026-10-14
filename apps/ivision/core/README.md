# iVision core — the creative engine shared by IDEM and iVision

Everything that *creates*: motion-design videos (Motion Canvas), composed visuals, website reading,
model reproduction. Two hosts run it — the IDEM API (`apps/api`) and the iVision API (`apps/ivision/api`) —
by importing these sources by relative path. There is no build step and no copy: a change here ships
to both.

| Directory | Contents |
| --- | --- |
| `src/runtime` | `configureCore()` and the host ports (logger, storage, vision, image generation, Google GenAI, agent runtime, credit refund) |
| `src/video` | the video service (`MotionVideoService`): request reading (`request/`), director and storyboard (`director/`), the Motion Canvas author and its compact context (`author/`), media, music, sound effects and voice (`assets/`, `audio/`), server rendering (`rendering/`: compiler, Chromium runner, preview page, ffmpeg), pricing, options |
| `motion` | what runs in the browser: the `@idem/motion` kit imported by scene code (`kit/`), the harness around every AI-written scene, the playback engine, the server render driver and the preview player with its **edit bridge** (`runtime/`), and the technical examples given to the author (`examples/`) |
| `src/montage` | editing a filmed talk (Whisper, cuts, captions, overlays): its own HTML overlay renderer (`montage.renderer.ts`) |
| `src/visual` | the visual composer (`composeVisual`: the words, the photo, then the page composed by the graphic engine `@idem/graphic-engine`), image sourcing and classification, `visualContextFromBrand`, and the written edits IDEM applies to a visual |
| `src/site` | the website scanner (`scanWebsite`), palette and typography proposals |
| `src/reference` | model video/image analysis (`analyzeReferenceVideo`: luminance **and** colour cuts, shots, contact sheets, vision) and its summary for the film director (`blueprintForDirector`) |
| `src/design`, `src/brand` | colour and contrast helpers, the art-direction catalogue, brand kit readers, palette and typography constraints |
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

## Visuals — words and photo here, the page in the graphic engine

Every visual (IDEM Communication, brand book, iVision) goes through `composeVisual`
(`src/visual/visual.composer.ts`):

1. **the words** (`visual.copy.ts`): the copywriter writes a headline, what completes it and the
   facts read in the request — validated in code (no invented format, no figure absent from the
   request, the brand's language; typography fixed: elisions, offers, dates). Without a model, a
   deterministic fallback splits the request (preamble as kicker, the rest as headline);
2. **the photo** (`visual.images.ts`): the user's photo first (its subject located for the crop), then
   the brand's photos (classified by vision: a brand poster is never used as a photo), then stock
   verified by vision, then generated — or none;
3. **the page**: composed, measured and repaired by the graphic engine
   (`packages/graphic-engine`, imported as `@idem/graphic-engine`) — `renderSingle` on a `flyer-*`
   canvas, with the brand read by `engineBrand` (colours, fonts, logo declensions, art direction).

The creativity level is the engine's: Low composes with proven layouts (no model call), Medium draws
among the three best, High lets the art director pick (and the visual critic look at the render), Max
also tunes the bounded parameters, Ultra composes a new tree from the allowed primitives — always
validated, measured and repaired by the code (see the engine's README). What the AI can never break,
at any level: the words (validated above), the charter (colour tokens and brand fonts only — the engine
writes every style), the resources (only the photos and logo provided), and the measured render (text
in its box, safe zone, contrast read on the rendered page and repaired toward the charter's ink).

A written edit of a visual (`parseVisualEdit`, `visualEditPrompt`) changes WORDS only: the model
answers in JSON (headline, facts, keep or remove the photo, keep or change the layout); the page is
composed again by the engine with the same seed unless a new layout was asked for. A model that answers
with HTML is refused — it never reaches the visual.

Forms, motifs and the visual kit (rings, arcs, waves, weave, dots…) now live in the engine
(`packages/graphic-engine/src/design-system/kit`): the AI names a form, the code draws it.

## Rules

- **No host code here**: no MongoDB model, no project shape, no provider SDK, no Express. Ask the host
  through a port or the `VideoStore` contract.
- Dependencies (`package.json`) must be declared by the IDEM API too (its image installs them; the
  root `node_modules` is hoisted from `apps/api`). Motion Canvas is pinned to an exact version.
- Run `npm run typecheck` (Node **and** browser code) and `npm run check:motion` here after a video
  change, `npm run check:request` for request fidelity, and `npm run check` for the website scan, model
  video and visuals. The video engine is described in `apps/api/docs/VIDEO_ENGINE.md`. A change to how
  pages are drawn belongs to the graphic engine: `npm run check:graphic-engine` at the repository root.

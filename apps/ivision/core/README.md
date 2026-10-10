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
| `src/visual` | the visual composer (`composeVisual`), code layouts, agents, rendering and measured audit, image sourcing, `visualContextFromBrand` |
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

## Rules

- **No host code here**: no MongoDB model, no project shape, no provider SDK, no Express. Ask the host
  through a port or the `VideoStore` contract.
- Dependencies (`package.json`) must be declared by the IDEM API too (its image installs them):
  `npm run check:video:engine --prefix apps/api` checks it.
- Run `npm run check` here, then the IDEM video checks (`check:video`, `check:video:creative`,
  `check:video:novelty`, `check:flyer`) after a change.

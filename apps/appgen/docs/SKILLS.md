# Skills, design forge and quality pass

How appgen produces interfaces that do not read as machine-made, and why the change made generation cheaper rather than more expensive.

## The problem

A model with no design anchor returns the average of its training data: purple gradient, Inter, three identical cards, uppercase eyebrow above every section. Before this system, appgen sent one monolithic prompt containing technical constraints and no art direction, concatenated into the **last user message** — which also meant the provider's prefix cache never hit, and the Sub-Saharan Africa directives were pasted four times per request.

## Five parts

```
apps/we-dev-next/src/
├── design/
│   ├── color.ts          OKLCH conversions, WCAG contrast, ramp building
│   ├── artDirections.ts  8 mutually distinct directions + font pairings
│   ├── tokenForge.ts     computes the design system from branding + seed
│   └── slopLint.ts       detects the generated-looking markers
├── scaffold/
│   ├── index.ts          buildScaffold(target, projectData) + the prompt notice
│   ├── shared.ts         tailwind/postcss/vite config, base CSS, component kit
│   ├── site.ts  webApp.ts  mobileApp.ts   one starter per build target
├── skills/
│   ├── catalog/*.md      the skills themselves (markdown, editable)
│   ├── registry.ts       loads + caches, exposes tiers 1/2/3
│   └── router.ts         picks skills per request, no LLM call
├── routes/quality.ts     POST /api/quality/lint
├── routes/scaffold.ts    POST /api/scaffold
└── mcp/server.ts         MCP endpoint at /mcp
```

### 1. The token forge — quality that is computed, not requested

`forgeDesignSystem(projectData)` derives, from the project's branding plus a hash of its id:

- an **art direction** out of eight (editorial serif, Swiss grid, terminal dark, committed earth, brutalist block, drenched monochrome, precision product, layered depth), each fixing radius, density, borders, shadows, page cadence and one signature move;
- a **font pairing** on a contrast axis, from a list that deliberately excludes Inter;
- **OKLCH colour ramps** derived from the brand colour, with chroma falloff so the ends do not clip;
- **`ink` and `ink-muted` verified against the surface** — `ensureContrast()` walks lightness until the ratio is met, so the numbers printed in the prompt are measured, not hoped for;
- a Tailwind `theme.extend` block — which the starter below now **writes into `tailwind.config.js` itself**, so the model is handed the token names rather than a config to copy.

The seed is the anti-monoculture mechanism. Two projects with similar briefs get different constraints, so they cannot converge on the same page. The same project always regenerates the same system.

#### Brand guidelines outrank the art direction

When a project has committed brand guidelines, they win outright and the direction is reduced to composition, rhythm and personality:

| Brand supplies | Result |
|---|---|
| `colors.background` | becomes `surface` verbatim; `surface-raised` steps off it rather than being invented |
| `colors.text` | seeds `ink`; verification only moves lightness, so the hue stays on brand |
| `colors.secondary` | exposed as its own token instead of being derived |
| `typography.primaryFont` / `secondaryFont` | used exactly, `fonts.fromBrand` is set |

The background's luminance also filters the direction pool, so a brand with a light background can never be handed a dark direction. `brandDriven` on the result drives an explicit "not negotiable" note at the top of the prompt block.

**Font links are emitted one per family, on purpose.** The Google Fonts css2 endpoint answers 400 for a family it does not host, and it answers for the *whole* request — so a single brand font that is not on Google Fonts would take every other family down with it and silently drop the site to a system stack. The brief also writes the families into `index.css` under `@layer base`, so nothing depends on Tailwind classes being applied everywhere.

### 2. Skills — progressive disclosure, three tiers

Each skill is a markdown file with YAML frontmatter, following the Agent Skills convention:

```markdown
---
name: anti-slop
description: Absolute bans and the failure test…
tier: core            # core = always loaded · contextual = router-selected
priority: 100         # emission order, and tie-break in the router
triggers: [landing, hero, pricing]   # contextual skills only
registers: [marketing]               # optional; omit for both
---
```

| Tier | What loads | When |
|---|---|---|
| 1 | name + description | always, ~100 tokens per skill |
| 2 | the SKILL.md body | when the router selects it |
| 3 | `catalog/references/<skill>.<ref>.md` | on explicit request, via MCP |

**Core (always):** `anti-slop`, `webcontainer-react`, `visual-edit-mode`, `audience-africa`.
**Contextual (max 3, ~2 600 token budget):** `landing-page`, `dashboard-app`, `ecommerce`, `auth-flows`, `forms-inputs`, `copywriting`, `motion`, `typography`, `color-strategy`, `a11y`, `responsive`, `data-viz`.

The router scores keyword triggers against the user's request plus the project's config, features and use-case sections. No model call: selection is free and reproducible.

#### Adding a skill

Drop a `.md` file into `src/skills/catalog/` with the frontmatter above and restart. Nothing else to change. Keep bodies under ~700 tokens; if a skill needs more, split the depth into `catalog/references/<name>.<topic>.md` and cite it from the body.

Tuning knobs: `SKILLS_MAX_CONTEXTUAL` (default 3), `SKILLS_CONTEXTUAL_BUDGET` (default 2600).

### 3. Prompt assembly — where the savings come from

`assembleBuilderPrompt()` returns two halves instead of one string:

```
system  ┌ core skills          identical on every request  → global cache hit
        ├ contextual skills    stable within a session     → session cache hit
        └ language directive   last, so it stays salient
user    ┌ forged design system   every turn (token names, not a config to paste)
        ├ starter notice         every turn, when the workspace carries the starter
        ├ brand logo directive   every turn
        ├ project brief          opening turn only
        └ the task
```

The logo sits outside the project brief deliberately. The brief is only sent on the opening turn, so a logo living inside it vanished from every follow-up and the model quietly stopped rendering it. `ProjectPromptService.buildLogoDirective()` is emitted on every turn instead.

`analysisResultModel.design.sections` (the use-case diagrams) is no longer sent by the client and is read nowhere — not in the brief, not in the router's scoring signal.

Provider-side prompt caching (most hosts apply it implicitly) discounts input tokens when a request shares a prefix with an earlier one, and it matches on the **prefix**, so anything invariant has to come first and stay byte-identical. That is why the router sorts its output deterministically instead of by score.

`streamTextFn` pulls every `system` role message out of the list into the provider's `system` field. The old heuristic that split the user message on a `PROJECT CONTEXT AND REQUIREMENTS:` marker is gone.

Set `DEBUG_PROMPTS=true` to dump the assembled prompt; it is off by default because a builder prompt is tens of kilobytes per request.

### 4. The starter — the files the model stopped writing

Every generation used to open by rewriting the same twenty-odd files: the npm manifest, `vite.config.js`, `postcss.config.js`, `tailwind.config.js` carrying the forged palette, `index.html`, the entry point, and — depending on the target — the service worker, the PWA manifest, the app icon, the Capacitor config, the phone shell, or the PGlite/`pg` switch. Those are **output** tokens, the expensive ones, spent on content we already know byte for byte. And a model copying a palette "verbatim" drops a stop about one time in three, or forgets the `<script type="module">` and ships a blank page with no console error.

`buildScaffold({ target, projectData })` writes them instead, deterministically: same project, same target, same bytes. `POST /api/scaffold` serves the map, the workspace mounts it before the first message, and the project already starts — with the brand's palette, fonts and rhythm in place — before the model has said a word.

| Target | Locked files | Output no longer generated |
|---|---|---|
| `site` | 17 | ≈ 2 260 tokens per generation |
| `web-app` | 24 | ≈ 3 470 tokens per generation |
| `mobile-app` | 24 | ≈ 3 510 tokens per generation |

The starter also ships a component kit (`src/ui/`: Button, Card, Badge, Field, Input, Section, EmptyState, Spinner) wired to the project's tokens, with 44px touch targets and a visible focus ring. The model assembles it instead of writing a button per project — fewer tokens, and no project where the primary button came out Tailwind blue.

**Locked means locked.** `src/utils/scaffoldLock.ts` (client) drops any `file` action aimed at a starter path, during the stream and in `onFinish`, and removes those files from the context sent back to the server. The skill says not to write them; the lock makes it true. `NEVER_REPAIR` in the linter excludes them too, so the quality pass cannot spend a round trip on a file the workspace would discard.

Three situations on open:

- empty workspace → the starter is mounted and noted in `localStorage` for this project and product;
- project reopened and already generated on a starter → only the lock is restored, so follow-up turns keep their hands off the config;
- project generated before the starter existed → nothing is locked; follow-up turns edit the files already in the workspace.

**Nothing is sent before the starter is settled.** Seven paths post a message to the model (typing, the dashboard's automatic launch, « Fix », resume…). They all go through one wrapped `append` that waits on a gate in `scaffoldLock.ts`, which opens once mounting is settled — mounted, unnecessary or failed — and, as a last resort, after 8 s so a mute server cannot block generation. The wrapper also announces the starter version *in the call itself*: the chat body is re-read at render time, and the first send follows the mount by microseconds. Before the gate, the dashboard's automatic launch beat the `/api/scaffold` round trip, the mount was cancelled, and the model wrote its own `index.css` — with invented utilities such as `font-figtree`, which stop PostCSS.

**When mounting genuinely fails** (the 8 s fallback), the skills would be describing files that do not exist. On a first turn without the starter flag the server rebuilds the starter (it is deterministic) and puts the files in the prompt under « STARTER NOT MOUNTED », to be emitted verbatim. That is the old cost — about 4 000 tokens of input and the matching output — but only on that degraded path, and the project comes out whole.

The client sends `scaffold: { version }` with every message; the server **rebuilds** the starter rather than trusting that payload (it is deterministic, so there is nothing to trust) and switches the brief from "paste this config" to "here are the token names". Bump `SCAFFOLD_VERSION` whenever a locked file's content changes.

#### Deleting a generation, to regenerate it from zero

The workspace header offers « Delete and regenerate » once a generation is finished — and also when it is stuck « in progress », which used to be a dead end. It asks for confirmation, then `DELETE /projects/:id/generation?product=site|app` wipes the **code, the conversation and (site only) the old generation marker**. The project, its brand and plan, and the **deployment record** are kept: a regenerated product redeploys to the same published address. The other product is never touched — site and application have separate folders and documents.

After the wipe the starter is unlocked and the mount effect runs again, so the configuration, the brand tokens and the component kit come back on their own and the model only writes the product — the same path as a first generation. The button then reads « Regenerate now ».

Four details that are easy to get wrong, each covered:

- **Legacy ZIPs.** `getProjectCode` falls back to the old ZIP archives when the incremental store is empty, so deleting only the manifest would bring the old site straight back. The whole `…/code/` prefix goes (its trailing `/` keeps it from matching a neighbour like `code-backup/`, and the site's folder and the application's `…/app/code/` are siblings, not nested). A partial failure is reported by MinIO and **raised**, never swallowed.
- **A fresh container.** Mounting only ever writes; the WebContainer does not expose its processes (`npm run dev` outlives the terminal, which only frees the xterm UI); and the disk read-back would pull any file missing from the store back into it. The reset therefore calls `teardown()` and boots a new container, which also drops the PGlite database that would otherwise keep the old schema (`CREATE TABLE IF NOT EXISTS`). Dependencies reinstall, in parallel with generation (see the pre-warm above).
- **Uploads in flight.** A push reads the manifest, diffs, then writes. `cancelPendingCodeSync()` makes unwritten pushes abandon themselves and `waitForCodeSync()` waits for the ones writing, *before* the server delete — otherwise one could land afterwards and put part of the old project back.
- **Server first.** If the delete fails nothing changes locally; emptying the workspace first would bring the old code back on the next open for no visible reason. A restore point (« Before deletion ») is saved beforehand, as the user's safety net for what is irreversible server-side.

#### The page plan — small tasks instead of one large one

Writing a landing page in one pass means holding layout, responsive behaviour, imports, exports and copy at the same time. A small model fails at one of the five, and the failure is total: one forgotten import and the preview is dead.

So the work is cut into pieces a small model actually completes:

1. **`idem.plan.json`** — which sections, in what order, which libraries. A dozen lines.
2. **`src/content/<name>.js`** — one plain data object per section. No JSX, no imports.
3. **`src/App.jsx`** — composed by `utils/pageComposer.ts`, in code.

The step where mistakes used to kill the preview — imports, order, composition — is no longer anyone's job. It is deterministic. And the model's output drops from ~300 tokens of JSX per section to ~20 of data.

Degradation is graceful by design: a section the kit does not have is dropped, a section whose content file is missing is dropped (an empty section is more visible than a shorter page), an unsafe import path is ignored. The worst case is a shorter page, never a dead one. The escape hatch remains: a product that needs a map or a configurator gets a hand-written component and composes `App.jsx` itself.

#### The section kit — layout belongs to the code

`scaffold/sections.ts` ships Nav, Hero, Features, Steps, Testimonials, Pricing, Faq, Cta and Footer, written once in the project's own tokens: responsive, 44px targets, one `<h1>` per page, `aria-labelledby` per section, reading measure capped. Headings are `clamp()`-sized rather than scale steps — an editorial direction reaches 90px, which is five lines of hero in half a column.

Anti-monoculture still holds: each section's **default variant** comes from the art direction drawn for the project, so two projects do not get the same page even from the same brief, and the model never has to think about it. The kit is mounted but **not locked** — "make the hero full-bleed" must still be possible.

#### The library catalog — the agent chooses, the code installs

`scaffold/libraries.ts` is a menu: Motion, shadcn/ui, Magic UI, Aceternity, Embla, Recharts, React Hook Form + Zod, Tabler Icons, Cobe. Each entry says what it brings and when to take it. The model **names** ids in the plan; the code turns them into commands. Choosing from a menu is within reach of a small model; writing an integration is not.

The starter is shadcn-compatible out of the box: `components.json` (with the `@magicui` and `@aceternity` registries), `jsconfig.json` and the `@` to `src/` alias in Vite, plus `cn` at `@/lib/utils` where the ecosystem expects it. `cssVariables: false` with `baseColor: neutral` is deliberate — installed components dress themselves in `neutral-*`, and our neutral ramp is already tinted with the project brand colour, so a component lands on-brand with no variable mapping and no token collision. Verified end to end: `npx shadcn@latest add @magicui/globe` writes `src/components/ui/globe.jsx`, installs `cobe`, and the project builds.

#### The compile gate — what the model gets wrong, fixed by code

`utils/compileGate.ts` runs between the end of generation and the preview, with no model call. It repairs the failures that kill a preview outright:

| Failure | What the gate does |
|---|---|
| imports a file it never wrote | creates it, rendering nothing, and reports it |
| same file under another extension (`App.jsx` vs `App.tsx`) | rewrites the import rather than stubbing over the real file |
| imports a package that is not installed | installs it when it is in the catalog |
| imports a package that does not exist | local shim: a Proxy that answers any name with a neutral component |
| imports an icon Lucide does not have | routes `lucide-react` through a guard that falls back instead of returning `undefined` |
| `@apply font-figtree` | drops the token from the `@apply` list |
| default import of a file with no default export | appends one |
| scaffold placeholder left over next to the real file | deletes the placeholder |

Shims and the icon guard expose **one default export only**, and imports are rewritten to a default import plus destructuring: Rollup resolves named exports statically at build time, so a Proxy with named imports compiles in dev and fails the build — the kind of difference only a real build reveals.

Verified on a deliberately broken generation carrying every failure at once: it builds (1991 modules, exit 0).

### 5. Quality pass — deterministic first, model only if needed

After generation completes, the client posts the parsed file map to `POST /api/quality/lint`. The linter is regex over text and costs nothing. It catches:

`missing-bootstrap-script` (blank page, no console error) · `logo-missing` · `purple-gradient` · `gradient-text` · `inter-default` · `side-stripe-border` · `uppercase-eyebrow` (2+ occurrences) · `glassmorphism` · `light-gray-body` · `stock-palette` · `buzzwords` · `em-dash` · `emoji-in-ui` · `placeholder-content` · `dead-link` · `img-without-alt` · `identical-card-grid`

`logo-missing` takes `expectedLogo` (a rendition or a list of them: hosted URLs, inline SVG) and checks that a fingerprint of any one — the filename, or a path's `d` attribute for inline markup — appears somewhere in the generated code. Deterministic, and tolerant of the model picking the dark variant over the light one.

### Insecure asset URLs in the preview (local only)

The WebContainer preview is served on an HTTPS origin. In production the bucket is HTTPS too, so a generated `<img src="https://…/logo.png">` loads normally and nothing below runs.

In development `MINIO_PUBLIC_URL` is `http://localhost:9000`, and a browser silently blocks an `http://` image inside an HTTPS page as mixed content: no request, no console error the app can see, just a logo that never appears. That is why generated sites showed no logo even though the URL was in the prompt and the model used it correctly.

The fix lives in [`webcontainer/insecureAssets.ts`](../apps/we-dev-client/src/components/WeIde/services/webcontainer/insecureAssets.ts) and runs from `mountFileSystem`, next to the existing `ensureHtmlEntryScript` guard:

1. Scan the text files for `http://…{png,jpg,webp,gif,avif,svg}` URLs.
2. Resolve each through `GET /api/assets/inline` (server-side, so no CORS to configure) into a data URI, cached per URL.
3. Substitute **only in the copy handed to `instance.mount()`**.

The file store keeps the original URL, and the file store is what `codeSync` pushes to the bucket — so no image bytes are ever duplicated into stored project code, and the asset stays referenced by URL exactly as it should be. The content hash is computed on the transformed text, so the read-back from the container does not push the substitution into the store either.

The trigger is the `http:` scheme, which never occurs in production, so there is no flag to remember to switch off. `/api/assets/inline` refuses HTTPS URLs outright and only fetches hosts on an allowlist (`ASSET_INLINE_ALLOWED_HOSTS`, plus the configured bucket host and `localhost:9000`), which keeps it from becoming an open proxy.

When `shouldRepair` is true (any error, or four or more warnings), the response carries a `repairPrompt` containing **only the offending files** plus the exact fixes — roughly 2 000 tokens instead of regenerating the project. Capped at one repair per conversation.

**The repair payload never enters the transcript.** The client appends a one-line message (`chat.quality_pass`) and passes the checklist out of band through `append(msg, { body: { qualityRepair } })`; the chat route forwards it to `handleBuilderMode`, which uses it as the request. The count shown is `repairCount` — issues inside the files actually being repaired — not the raw violation total, which is much larger and alarming for no reason.

## The MCP endpoint

`/mcp` speaks Streamable HTTP, stateless, and is implemented directly against the [spec](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports) with no SDK dependency: one JSON-RPC request in, one JSON response out. GET and DELETE answer 405, which the spec permits for servers with no server-initiated stream and no sessions.

| Tool | Purpose |
|---|---|
| `list_skills` | tier 1 — names, descriptions, tiers, token costs |
| `get_skill` | tier 2 — one skill body |
| `get_skill_reference` | tier 3 — a bundled deep dive |
| `forge_design_tokens` | a complete design system for a project name plus optional brand colours |
| `lint_ui` | violations plus a repair prompt for a file map |

```bash
claude mcp add --transport http appgen-skills http://localhost:3000/mcp
```

appgen's own generation path does **not** go through this endpoint — the builder imports the registry directly, so the critical path pays no network round trip. The endpoint exists so Claude Code, Cursor or `apps/api` reuse the same catalog instead of forking a second copy.

Origin is validated against localhost plus `MCP_ALLOWED_ORIGINS` (comma-separated) to block DNS rebinding.

## Cost

| | Before | After |
|---|---|---|
| Static prompt | ~6 000 tk, full price, never cached | ~3 200 tk as a stable prefix, 90% off on a hit |
| Audience directives | duplicated ×4 | ×1, in the cached prefix |
| Design system | asked of the model, variable | computed in TS, ~450 tk injected |
| Config files (output) | rewritten every generation, 2 300–3 500 tk | written by `scaffold/`, 0 tk |
| Opening brief | the dashboard prompt duplicated the skills, then was discarded server-side | only the plan and the brand-book art direction, and they now reach the model |
| Quality fix | full regeneration | targeted pass ~2 000 tk, capped at one |

## Build note

Skills are markdown, so `tsc` does not carry them into `dist/`. `pnpm build` runs `scripts/copy-skills.mjs` afterwards. Without that step the server boots with an empty catalog and generates un-skilled prompts silently, which is why `loadSkills()` also runs at startup in `server.ts` rather than lazily on the first request.

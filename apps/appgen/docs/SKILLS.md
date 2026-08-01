# Skills, design forge and quality pass

How appgen produces interfaces that do not read as machine-made, and why the change made generation cheaper rather than more expensive.

## The problem

A model with no design anchor returns the average of its training data: purple gradient, Inter, three identical cards, uppercase eyebrow above every section. Before this system, appgen sent one monolithic prompt containing technical constraints and no art direction, concatenated into the **last user message** — which also meant Gemini's implicit cache (90% off repeated prefixes) never hit, and the Sub-Saharan Africa directives were pasted four times per request.

## Four parts

```
apps/we-dev-next/src/
├── design/
│   ├── color.ts          OKLCH conversions, WCAG contrast, ramp building
│   ├── artDirections.ts  8 mutually distinct directions + font pairings
│   ├── tokenForge.ts     computes the design system from branding + seed
│   └── slopLint.ts       detects the generated-looking markers
├── skills/
│   ├── catalog/*.md      the skills themselves (markdown, editable)
│   ├── registry.ts       loads + caches, exposes tiers 1/2/3
│   └── router.ts         picks skills per request, no LLM call
├── routes/quality.ts     POST /api/quality/lint
└── mcp/server.ts         MCP endpoint at /mcp
```

### 1. The token forge — quality that is computed, not requested

`forgeDesignSystem(projectData)` derives, from the project's branding plus a hash of its id:

- an **art direction** out of eight (editorial serif, Swiss grid, terminal dark, committed earth, brutalist block, drenched monochrome, precision product, layered depth), each fixing radius, density, borders, shadows, page cadence and one signature move;
- a **font pairing** on a contrast axis, from a list that deliberately excludes Inter;
- **OKLCH colour ramps** derived from the brand colour, with chroma falloff so the ends do not clip;
- **`ink` and `ink-muted` verified against the surface** — `ensureContrast()` walks lightness until the ratio is met, so the numbers printed in the prompt are measured, not hoped for;
- a Tailwind `theme.extend` block the model pastes verbatim.

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
user    ┌ forged design system   every turn
        ├ brand logo directive   every turn
        ├ project brief          opening turn only
        └ the task
```

The logo sits outside the project brief deliberately. The brief is only sent on the opening turn, so a logo living inside it vanished from every follow-up and the model quietly stopped rendering it. `ProjectPromptService.buildLogoDirective()` is emitted on every turn instead.

`analysisResultModel.design.sections` (the use-case diagrams) is no longer sent by the client and is read nowhere — not in the brief, not in the router's scoring signal.

Gemini's implicit cache discounts input tokens by 90% when a request shares a prefix with an earlier one, and it matches on the **prefix**, so anything invariant has to come first and stay byte-identical. That is why the router sorts its output deterministically instead of by score.

`streamTextFn` pulls every `system` role message out of the list into the provider's `system` field. The old heuristic that split the user message on a `PROJECT CONTEXT AND REQUIREMENTS:` marker is gone.

Set `DEBUG_PROMPTS=true` to dump the assembled prompt; it is off by default because a builder prompt is tens of kilobytes per request.

### 4. Quality pass — deterministic first, model only if needed

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
| Quality fix | full regeneration | targeted pass ~2 000 tk, capped at one |

## Build note

Skills are markdown, so `tsc` does not carry them into `dist/`. `npm run build` runs `scripts/copy-skills.mjs` afterwards. Without that step the server boots with an empty catalog and generates un-skilled prompts silently, which is why `loadSkills()` also runs at startup in `server.ts` rather than lazily on the first request.

# AppGen server API

Base URL: `http://localhost:3000` in development. Calls from the editor send the IDEM cookies (`credentials: 'include'`); server-to-server callers can send `Authorization: Bearer <token>` (IDEM session or Supabase access token).

**Auth** column: `IDEM` = `requireIdemUser` (identity checked with the IDEM API `/auth/me`); `—` = no identity required (the route calls no model and costs nothing).

| Method | Route | Auth | Role |
|---|---|---|---|
| `GET` | `/` | — | Service info and endpoint list |
| `GET` | `/health` | — | Liveness |
| `GET` | `/metrics` | — | Prometheus metrics (keep private) |
| `POST` | `/api/chat` | IDEM + billing | Generate or edit code (streamed) |
| `POST` | `/api/enhancedPrompt` | IDEM | Rewrite a user prompt |
| `POST` | `/api/deploy` | IDEM | Deploy a zipped build to Netlify |
| `POST` | `/api/handoff` | IDEM | Store a generation context for iDeploy / the dashboard |
| `GET` | `/api/handoff/:id` | — | Read it once (the id is the secret) |
| `GET` | `/api/model` | — | Public model list |
| `GET` | `/api/model/config`, `/api/model/default` | — | Model configuration / default model |
| `POST` | `/api/quality/lint` | — | Design lint of generated files |
| `POST` | `/api/quality/security` | — | Security lint of generated files |
| `POST` | `/api/design/forge` | — | Forge the design system for a project |
| `POST` | `/api/scaffold` | — | Preconfigured starter for a build target |
| `GET` | `/api/assets/inline` | — | Development: bucket image as a data URI |
| `POST` | `/mcp` | origin check | MCP endpoint (skills, forge, linter) |

## `POST /api/chat`

Generates or edits the project. The response is a **stream** (Vercel AI SDK data stream).

```json
{
  "messages": [{ "role": "user", "content": "A booking site for a hair salon in Douala" }],
  "model": "qwen/qwen3-coder-next",
  "mode": "builder",
  "language": "en",
  "projectId": "…",
  "projectData": { "…": "IDEM project, used for branding and the design system" },
  "scaffold": { "version": "1" },
  "workspace": { "…": "current files, for edits" },
  "qualityRepair": false
}
```

| Field | Notes |
|---|---|
| `mode` | `builder` (default, writes files) or `chat` (answers only) |
| `language` | `en` or `fr`; otherwise taken from `Accept-Language`, then English |
| `model` | A key from `/api/model`; defaults to the first configured model |
| `qualityRepair` | Set by the client when it sends the repair prompt from `/api/quality/lint` |
| `scaffold` | Present once the editor has mounted the starter (`/api/scaffold`). The server then tells the model the configuration is already written and only names the available tokens; absent, the full build contract goes out as before |

Before generating, the server calls `POST /billing/consume` on the IDEM API. A builder request with a single message is billed as `initial_generation`; everything else as an edit. On refusal the server answers with the billing payload (usually `402`) instead of a stream; the editor shows the offer to top up.

## `POST /api/enhancedPrompt`

`{ "text": "…" }` (non-empty, at most 5000 characters) → `{ "code": 0, "text": "improved prompt" }`, or `{ "code": -1 }` on failure.

It uses the current default model (`/api/model/default`), served by OpenRouter.

## `POST /api/deploy`

`multipart/form-data` with `file` (a `.zip` of the build, at most 50 MB) and optional `siteId`.

- Without `siteId`, or if the site no longer exists or belongs to someone else, a new Netlify site is created with the caller's owner prefix.
- With a `siteId` owned by the caller, the site is redeployed.

The response contains the site URL and id. Requires `NETLIFY_TOKEN`.

## Hand-off

`POST /api/handoff` with the generation context → `{ "success": true, "handoffId": "…", "expiresAt": "…" }`. The entry expires after **15 minutes** (set by the server) and is deleted on the first `GET /api/handoff/:id`. Entries live in memory: a restart drops them.

## Quality

Both routes take `{ "files": { "path": "content", … } }`.

- `/api/quality/lint` also accepts `expectedLogo`. It returns the violations, error and warning counts, a ready-to-send `repairPrompt` and `shouldRepair` (true when there is an error or at least 4 warnings). No model is called.
- `/api/quality/security` returns the security findings and a `repairPrompt`.

## `POST /api/design/forge`

`{ "projectData": { … }, "overrides": { … } }` → `{ system, brief, catalog }`:

- `system`: palette, type scale and art direction computed for the project (from its brand when there is one);
- `brief`: the exact text the model will receive;
- `catalog`: the art directions and options, so the client can offer overrides and replay the forge.

## `POST /api/scaffold`

`{ "projectData": { … }, "product": "site|app", "platform": "web|mobile", "language": "fr" }` → the preconfigured starter for that build target:

```json
{
  "version": "1",
  "target": "site",
  "files": { "package.json": "…", "tailwind.config.js": "…", "src/ui/Button.jsx": "…" },
  "locked": ["package.json", "tailwind.config.js", "…"],
  "commands": { "install": "npm install", "start": "npm run dev" }
}
```

The editor mounts `files` before the first message, so the project starts — with the brand's palette and fonts already applied — before the model writes anything. `locked` are the files written by code: the editor drops any attempt by the model to rewrite them and keeps them out of the context it sends back. Pure computation, no model call, so no credit is consumed. See [SKILLS.md](../../../docs/SKILLS.md#4-the-starter--the-files-the-model-stopped-writing).

## `GET /api/assets/inline?url=…`

Development only. The WebContainer preview runs on HTTPS and blocks `http://localhost:9000` images as mixed content; this route returns the image as a data URI. Only the bucket host and `ASSET_INLINE_ALLOWED_HOSTS` are accepted, with a size limit.

## `POST /mcp`

Stateless MCP server over Streamable HTTP (JSON-RPC in, JSON out; `GET` and `DELETE` answer `405`). Tools: `list_skills`, `get_skill`, `get_skill_reference`, `forge_design_tokens`, `lint_ui`. Requests with a browser `Origin` not in `MCP_ALLOWED_ORIGINS` are rejected; non-browser clients send no origin and are accepted.

AppGen itself does not go through this endpoint: the builder imports the registry directly.

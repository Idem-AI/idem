# AppGen server API

Base URL: `http://localhost:3000` in development. Calls from the editor send the IDEM cookies (`credentials: 'include'`); server-to-server callers can send `Authorization: Bearer <Firebase ID token>`.

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
| `GET` | `/api/assets/inline` | — | Development: bucket image as a data URI |
| `POST` | `/mcp` | origin check | MCP endpoint (skills, forge, linter) |

## `POST /api/chat`

Generates or edits the project. The response is a **stream** (Vercel AI SDK data stream).

```json
{
  "messages": [{ "role": "user", "content": "A booking site for a hair salon in Douala" }],
  "model": "glm-5.2",
  "mode": "builder",
  "language": "en",
  "projectId": "…",
  "projectData": { "…": "IDEM project, used for branding and the design system" },
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

Before generating, the server calls `POST /billing/consume` on the IDEM API. A builder request with a single message is billed as `initial_generation`; everything else as an edit. On refusal the server answers with the billing payload (usually `402`) instead of a stream; the editor shows the offer to top up.

## `POST /api/enhancedPrompt`

`{ "text": "…" }` (non-empty, at most 5000 characters) → `{ "code": 0, "text": "improved prompt" }`, or `{ "code": -1 }` on failure.

> Known gap: this route still calls DeepSeek (`@ai-sdk/deepseek`, which reads `DEEPSEEK_API_KEY`) instead of the configured GLM models, and that key is neither in `.env.example` nor in the secrets manifest. Without it the route always answers `code: -1`.

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

## `GET /api/assets/inline?url=…`

Development only. The WebContainer preview runs on HTTPS and blocks `http://localhost:9000` images as mixed content; this route returns the image as a data URI. Only the bucket host and `ASSET_INLINE_ALLOWED_HOSTS` are accepted, with a size limit.

## `POST /mcp`

Stateless MCP server over Streamable HTTP (JSON-RPC in, JSON out; `GET` and `DELETE` answer `405`). Tools: `list_skills`, `get_skill`, `get_skill_reference`, `forge_design_tokens`, `lint_ui`. Requests with a browser `Origin` not in `MCP_ALLOWED_ORIGINS` are rejected; non-browser clients send no origin and are accepted.

AppGen itself does not go through this endpoint: the builder imports the registry directly.

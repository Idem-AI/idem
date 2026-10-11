# AppGen server (`we-dev-next`)

Express 5 server (ESM, TypeScript) behind the AppGen editor. It streams code generation from the LLM, checks the generated code, forges the design system, deploys to Netlify and stores hand-offs to iDeploy.

Despite its name, this is not a Next.js app anymore: it is the Express port of the original `we-dev-next`.

- API reference: [docs/API.md](docs/API.md)
- Skills catalogue: [../../docs/SKILLS.md](../../docs/SKILLS.md)
- AppGen overview: [../../README.md](../../README.md)

## Run

```bash
cp .env.example .env    # fill OPENROUTER_API_KEY at least
pnpm install
pnpm dev                # tsx watch, http://localhost:3000
```

| Script | Role |
|---|---|
| `pnpm dev` | Watch mode (`tsx watch src/main.ts`) |
| `pnpm build` | `tsc` to `dist/`, then copy the skills catalogue (`scripts/copy-skills.mjs`) |
| `pnpm start` | `node dist/main.js` |
| `pnpm lint` | ESLint |

The IDEM API must be reachable at `IDEM_API_URL` (default `http://localhost:3001`): every generation checks the session and the billing there.

## Start-up

[`src/main.ts`](src/main.ts) is the entry point. It loads secrets first (`loadSecretsFromManager`), then **dynamically** imports [`src/server.ts`](src/server.ts). The order matters: model clients read `process.env` when their module loads, and ESM hoists static imports.

With `USE_SECRET_MANAGER=true`, every variable of the Infisical project `appgen` is loaded (the manifest [`src/config/secrets.manifest.ts`](src/config/secrets.manifest.ts) lists the required and expected ones; environment `INFISICAL_ENVIRONMENT`, machine identity `INFISICAL_CLIENT_ID` / `INFISICAL_CLIENT_SECRET`). A value already present in the environment is never overwritten. `secret-loader.ts` is shared byte for byte with the API and iDeploy API; CI checks the copies stay identical.

## Layout

```
src/
├── main.ts             entry: secrets, then server
├── server.ts           Express app, middleware, routes
├── config/             models (modelConfig.ts), prompts, secrets
├── middleware/         auth (requireIdemUser), CORS, metrics, errors
├── routes/             chat, deploy, enhancedPrompt, model, handoff, quality, design, assets
├── handlers/           chat and builder handlers (streaming, tool calls)
├── services/           AI client, billing, project prompt
├── design/             design token forge, art directions, colour, slop and security linters
├── skills/             skills catalogue and router (see docs/SKILLS.md)
├── mcp/                MCP endpoint exposing skills, forge and linter
├── tools/              workspace tools offered to the model
└── utils/              stream helpers, token handling, parsing, logging
```

## Models

Declared in [`src/config/modelConfig.ts`](src/config/modelConfig.ts):

| Key | Role |
|---|---|
| `qwen/qwen3-coder-next` | Default: code generation and tool calls (Apache-2.0) |
| `deepseek/deepseek-v4-flash` | Alternative to compare (MIT) |
| `qwen/qwen3.5-122b-a10b` | Fallback when the main model is saturated (not in the selector) |

Every model is served by OpenRouter (`OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`) and has open weights, so they can be self-hosted later by pointing the base URL to a vLLM/SGLang server. `GET /api/model` returns the public part of this list; keys and URLs never leave the server.

**Changing the default model without a restart.** It starts from `APPGEN_DEFAULT_MODEL` and can be changed at any time:

```bash
curl -X POST $APPGEN/api/model/default -H "x-admin-key: $MODEL_ADMIN_KEY" \
  -H 'content-type: application/json' -d '{"modelKey":"deepseek/deepseek-v4-flash"}'
```

The chosen model comes first in the selector and in the fallback chain. A model whose key is missing is never offered. The state is per instance (call each instance, or set the env var). Without `MODEL_ADMIN_KEY` the route is closed.

## Security

- **Identity**: `requireIdemUser` ([`src/middleware/auth.ts`](src/middleware/auth.ts)) forwards the caller's IDEM cookies or Bearer token to `GET /auth/me` on the IDEM API and attaches `{ uid, email }` to the request. Headers such as `x-user-id` are ignored.
- **Billing** ([`src/services/billingService.ts`](src/services/billingService.ts)): fails closed. No credentials, a billing error or an unreachable API means the generation is refused.
- **CORS**: only `CORS_ALLOWED_ORIGINS` may call with credentials; the variable is required in production. The MCP endpoint has its own list, `MCP_ALLOWED_ORIGINS`, and rejects browser origins not on it (DNS-rebinding protection).
- **Netlify deploys**: all sites live on IDEM's Netlify account; each site name carries an owner prefix derived from the IDEM uid, so a user cannot overwrite another user's site by sending its `siteId`.
- **Asset inlining** (`/api/assets/inline`): development helper, restricted to the bucket host and `ASSET_INLINE_ALLOWED_HOSTS`, with a size limit.
- **Hand-offs**: expiry is set by the server (15 minutes), read once.

## Configuration

See [`.env.example`](.env.example) and [docs/CONFIGURATION.md](../../../../docs/CONFIGURATION.md). Main variables:

| Variable | Role |
|---|---|
| `PORT` | Default `3000` |
| `IDEM_API_URL` | IDEM API (sessions, billing) |
| `CORS_ALLOWED_ORIGINS` | Front-end origins, comma-separated (required in production) |
| `MCP_ALLOWED_ORIGINS` | Browser origins allowed on `/mcp` |
| `OPENROUTER_BASE_URL`, `APPGEN_DEFAULT_MODEL` | Model provider and starting default |
| `NETLIFY_DEPLOY_URL` | Netlify API |
| `MINIO_PUBLIC_URL`, `ASSET_BASE_URL`, `ASSET_INLINE_ALLOWED_HOSTS` | Asset inlining |
| `USE_SECRET_MANAGER`, `INFISICAL_SITE_URL`, `INFISICAL_ENVIRONMENT`, `INFISICAL_PROJECT_ID`, `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET` | Infisical |
| Secrets: `OPENROUTER_API_KEY`, `MODEL_ADMIN_KEY`, `NETLIFY_TOKEN`, `DEPLOY_OWNER_SECRET`, `SCREENSHOTONE_API_KEY` | Local `.env` only; Infisical in production |

Optional tuning (defaults in code): `AI_MAX_RETRIES`, `PLAN_MAX_TOOL_STEPS`, `SKILLS_CONTEXTUAL_BUDGET`, `SKILLS_MAX_CONTEXTUAL`, `DEBUG_PROMPTS`.

## Observability

- `GET /health`: liveness (used by the Docker health check).
- `GET /metrics`: Prometheus metrics (`prom-client`). Keep it off the public ingress.
- Request logs via `morgan`; generation steps via `ChatLogger`.

## Docker

`Dockerfile/prod/Dockerfile.appgen-server` at the repository root: multi-stage build, `CMD ["node", "dist/main.js"]`, health check on `/health`.

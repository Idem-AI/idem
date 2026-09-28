# AppGen

AppGen is IDEM's application generator. The user describes an app in a chat; AppGen generates a React/Vite project, runs it **in the browser** (WebContainer), lets the user edit it, and hands it off to iDeploy or deploys it to Netlify.

AppGen started as a fork of the open-source We0 / bolt.new code base (MIT, see [LICENSE](LICENSE)). It has since been rebuilt around IDEM: IDEM sessions, IDEM billing, GLM models, a design system forge and a skills catalogue.

| Part | Path | Stack | Port (dev) |
|---|---|---|---|
| Client (editor) | [`apps/we-dev-client`](apps/we-dev-client/README.md) | React 18, Vite, WebContainer, CodeMirror, Zustand | 5173 |
| Server | [`apps/we-dev-next`](apps/we-dev-next/README.md) | Express 5 (ESM), Vercel AI SDK | 3000 |

Further reading:

- [Server API reference](apps/we-dev-next/docs/API.md)
- [Skills catalogue](docs/SKILLS.md)
- Monorepo overview: [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)

## How it fits in IDEM

```
Browser (we-dev-client, appgen.idem.africa)
   │  cookies of .idem.africa
   ▼
we-dev-next ──► IDEM API  /auth/me          who is calling
            ──► IDEM API  /billing/consume  may they generate? (debits credits)
            ──► GLM / OpenAI-compatible provider  (code generation, streamed)
            ──► Netlify                      (optional deploy)
```

- **Authentication**: the server never decodes tokens itself. `requireIdemUser` forwards the caller's IDEM cookies (or Bearer token) to `GET /auth/me` on the IDEM API and trusts only its answer. Users sign in on the IDEM dashboard.
- **Billing**: every generation calls `POST /billing/consume` on the IDEM API. Billing **fails closed**: no identity, an unreachable billing API or an error means no generation. The first generation of a project and later edits are billed as different actions (`initial_generation` vs edits); the price list lives in the API ([BILLING.md](../api/docs/BILLING.md)).
- **Hand-off**: `POST /api/handoff` stores a generation context for 15 minutes so iDeploy or the dashboard can pick it up once.

## Getting started

Prerequisites: Node 24, pnpm (`npm i -g pnpm`), and the IDEM API running on port 3001 (see [Getting started](../../docs/GETTING_STARTED.md)).

```bash
# Server
cd apps/appgen/apps/we-dev-next
cp .env.example .env         # fill GLM_API_KEY at least
pnpm install
pnpm dev                     # http://localhost:3000

# Client
cd apps/appgen/apps/we-dev-client
cp .env.example .env
pnpm install
pnpm dev                     # http://localhost:5173
```

From `apps/appgen`, `pnpm dev:next` and `pnpm dev:client` do the same.

Sign in on the dashboard (`http://localhost:4200`) first: AppGen relies on the IDEM session cookies.

## Configuration

- Server: [`apps/we-dev-next/.env.example`](apps/we-dev-next/.env.example). Secrets (`GLM_API_KEY`, `THIRD_API_KEY`, `NETLIFY_TOKEN`, `DEPLOY_OWNER_SECRET`, `SCREENSHOTONE_API_KEY`) are read from Google Secret Manager in production under `appgen--<VARIABLE>`; the list is [`src/config/secrets.manifest.ts`](apps/we-dev-next/src/config/secrets.manifest.ts).
- Client: [`apps/we-dev-client/.env.example`](apps/we-dev-client/.env.example). Only `REACT_APP_*` variables reach the bundle, and **the bundle is public**: never put a secret there.

Details: [docs/CONFIGURATION.md](../../docs/CONFIGURATION.md).

## Production

| Image | Dockerfile |
|---|---|
| Server | `Dockerfile/prod/Dockerfile.appgen-server` (runs `node dist/main.js`) |
| Client | `Dockerfile/prod/Dockerfile.appgen-client` (multi-stage build, served with `vite preview`) |

The server requires `CORS_ALLOWED_ORIGINS` in production (the origins allowed to call it with IDEM cookies). See [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md).

## License

MIT. The original copyright notice is kept in [LICENSE](LICENSE).

# AppGen editor (`we-dev-client`)

The browser editor of AppGen: chat with the generator, code editor, file tree, terminal and live preview. Generated projects run **inside the browser** with StackBlitz WebContainer; nothing is executed on IDEM servers.

Stack: React 18, Vite 5, Zustand, CodeMirror 6, xterm, Tailwind, i18next (`en`, `fr`, `zh` in `src/locale`).

AppGen overview: [../../README.md](../../README.md) · Server API: [../we-dev-next/docs/API.md](../we-dev-next/docs/API.md)

## Run

```bash
cp .env.example .env
pnpm install
pnpm dev          # http://localhost:5173
```

| Script | Role |
|---|---|
| `pnpm dev` | Vite dev server on port 5173 |
| `pnpm build` | Production build to `dist/` |
| `pnpm start` | `vite preview` on `0.0.0.0` (used by the Docker image) |
| `pnpm tsc` | Type check |

Sign in on the IDEM dashboard first: the editor uses the IDEM session cookies. `getCurrentUser` calls `GET /auth/profile` on the IDEM API with `credentials: 'include'`.

## Configuration

Only variables prefixed with `REACT_APP_` are injected into the bundle (see `publicEnv` in [`vite.config.ts`](vite.config.ts)). **The bundle is public: never put a secret in these variables.** Any other variable in `.env` is ignored by the build.

| Variable | Role |
|---|---|
| `REACT_APP_BASE_URL`, `REACT_APP_NEXT_API_BASE_URL` | AppGen server (`we-dev-next`) |
| `REACT_APP_IDEM_API_BASE_URL` | IDEM API (profile, projects, billing) |
| `REACT_APP_IDEM_MAIN_APP_URL` | IDEM dashboard (sign-in) |
| `REACT_APP_IDEPLOY_URL` | iDeploy (deploy button) |

## WebContainer requirements

WebContainer needs cross-origin isolation. The Vite **dev** server sends:

```
Cross-Origin-Embedder-Policy: credentialless
Cross-Origin-Opener-Policy: same-origin
```

`vite preview` (used by the production image, port 4173) does **not** set them: the reverse proxy in front of `appgen.idem.africa` must add both headers, or the preview will not boot. The preview server only accepts the hosts listed in `preview.allowedHosts`. Images loaded over plain `http` (the local MinIO bucket) are blocked in the HTTPS preview; the server's `/api/assets/inline` works around it in development.

## Layout

```
src/
├── api/          calls to the AppGen server and the IDEM API (chat, auth, billing, design, persistence)
├── components/   AiChat, WeIde (editor), Workspace, DeployModal, ChecksPanel, ThemePanel, Settings, …
├── stores/       Zustand slices (chat, history, billing, theme, terminal, MCP, user)
├── hooks/, lib/, utils/, types/
└── locale/       en.json, fr.json, zh.json
```

Chat history is kept in the browser (`appgen-chat-history`, Zustand `persist`).

## Docker

`Dockerfile/prod/Dockerfile.appgen-client` at the repository root: the builder stage copies the root `.env` (only `REACT_APP_*` values reach the bundle) and runs `pnpm build`; the final stage keeps only `dist/` and dependencies, and serves on port 4173 with `pnpm start`. The `.env` never reaches the pushed image.

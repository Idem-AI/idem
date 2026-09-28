# IDEM Chart

The diagram editor of IDEM (`chart.idem.africa`): edit and preview Mermaid diagrams (flowcharts, sequence, class, Gantt…) generated for a project, export them as SVG or PNG, and share view links.

It is a fork of the open-source [Mermaid Live Editor](https://github.com/mermaid-js/mermaid-live-editor) (MIT, see [LICENSE](LICENSE)), adapted to load and save diagrams of IDEM projects.

Stack: SvelteKit (static adapter), Mermaid, Tailwind, Vitest and Playwright. Package manager: **pnpm**.

## Run

```bash
corepack enable pnpm
cd apps/chart
pnpm install
pnpm dev            # http://localhost:3000
```

Sign in on the IDEM dashboard first: the editor reads the IDEM session cookie (`GET /auth/profile` with `credentials: 'include'`) and loads projects from the IDEM API.

| Script | Role |
|---|---|
| `pnpm dev` | Dev server on port 3000 |
| `pnpm build` / `pnpm preview` | Static build / preview it |
| `pnpm lint`, `pnpm lint:fix`, `pnpm format` | Prettier and ESLint |
| `pnpm test:unit`, `test:unit:coverage` | Vitest |
| `pnpm test:e2e` | Playwright |
| `pnpm test` | Unit, then end-to-end tests |

## Routes

| Route | Role |
|---|---|
| `/edit/[projectId]` | Edit the diagrams of an IDEM project |
| `/view` | Read-only view of a shared diagram |
| `/` | Editor entry |

## Configuration

Variables are read at build time from `.env` (not committed; use `.env.local` for local overrides). Vite exposes variables prefixed with `VITE_` or `MERMAID_` to the browser, so **none of them may hold a secret**.

| Variable | Default | Role |
|---|---|---|
| `VITE_API_BASE_URL` | — | IDEM API (profile, projects) |
| `VITE_MERMAID_RENDERER_URL` | `https://mermaid.ink` | PNG/SVG rendering service; empty disables those links |
| `VITE_MERMAID_KROKI_RENDERER_URL` | `https://kroki.io` | Kroki instance; empty disables the Kroki link |
| `VITE_MERMAID_ANALYTICS_URL`, `VITE_MERMAID_DOMAIN` | empty | Plausible analytics; empty disables analytics |
| `VITE_MERMAID_IS_ENABLED_MERMAID_CHART_LINKS` | empty | `true` shows the upstream Mermaid Chart links and banner |

The production Dockerfile accepts the same settings as build arguments without the `VITE_` prefix (`MERMAID_RENDERER_URL`, …). If you enable or disable the renderer, Kroki or analytics, update the privacy modal (`Privacy.svelte`) to match.

## Legacy authentication package

The chart still imports `@idem/shared-auth-client` for its auth store, team types and project permission guard. That package is marked legacy: its token endpoints no longer exist on the API, and the chart is its last user. Moving the chart to plain cookie calls (as the other front ends do) would let the package be removed. See [docs/PACKAGES.md](../../docs/PACKAGES.md).

## Production

`Dockerfile/prod/Dockerfile.chart` builds the static site with pnpm and serves it with nginx (`apps/chart/nginx.conf`). See [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md).

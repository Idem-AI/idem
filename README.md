# IDEM — the African AI that builds companies

[![License: Apache 2.0 + Commons Clause](https://img.shields.io/badge/License-Apache%202.0%20%2B%20Commons%20Clause-orange.svg)](./LICENSE)
[![npm workspaces](https://img.shields.io/badge/npm-workspaces-cb3837.svg)](https://docs.npmjs.com/cli/using-npm/workspaces)
[![Node 24](https://img.shields.io/badge/Node-24-339933.svg)](./.nvmrc)

IDEM is a sovereign pan-African AI platform. From a short description of an idea, it produces a brand identity, a business plan and financial model, a pitch deck, legal documents, communication material and diagrams, generates a web application, stress-tests the business in simulation, and deploys the result on servers in Africa.

This repository is the monorepo that contains every IDEM application and shared package.

## Applications

| App | Path | Stack | Role |
|---|---|---|---|
| API | [`apps/api`](apps/api/README.md) | Express, TypeScript, MongoDB, Redis, MinIO | Authentication, projects, AI generation, PDFs, billing and payments |
| Console | [`apps/main-dashboard`](apps/main-dashboard/README.md) | Angular 20 | The signed-in application (`console.idem.africa`) |
| Landing | [`apps/landing`](apps/landing/README.md) | Angular 20, prerendered, EN/FR | Public site (`idem.africa`) |
| Simulator | [`apps/simulation`](apps/simulation/README.md) | Angular 22 | Business stress tests and scenarios |
| AppGen | [`apps/appgen`](apps/appgen/README.md) | React/Vite + Express | Application generator running in the browser |
| iDeploy API | [`apps/ideploy-api`](apps/ideploy-api/README.md) | Express, TypeScript, PostgreSQL, BullMQ | Deployment platform back end |
| iDeploy web | [`apps/ideploy-web`](apps/ideploy-web/README.md) | Angular 20 | Deployment platform front end |
| Chart | [`apps/chart`](apps/chart/README.md) | SvelteKit | Mermaid diagram editor |

Shared packages (`packages/`): design system, models and pricing, loader, product tours, trusted-by logos. See [docs/PACKAGES.md](docs/PACKAGES.md).

## Documentation

| Document | Content |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the apps, data stores and authentication fit together |
| [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) | Local setup, Docker Compose, ports |
| [docs/CONFIGURATION.md](docs/CONFIGURATION.md) | Environment variables and Google Secret Manager |
| [docs/SECURITY.md](docs/SECURITY.md) | Security model and rules for contributors |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | CI/CD, images, production checklist |
| [docs/PACKAGES.md](docs/PACKAGES.md) | Shared packages |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Workflow, conventions, git hooks |
| [AGENTS.md](AGENTS.md) | Design rules (read before building any screen) |

Each application has its own README, and some have a `docs/` folder for deeper topics.

## Quick start

```bash
nvm use                       # Node 24
npm install                   # all npm workspaces (also installs the git hooks)
cp .env.example .env.dev && ln -sf .env.dev .env
docker compose -f docker-compose.dev.yml up -d mongodb redis minio postgres mailpit soketi
npm run dev:api               # then dev:dashboard, dev:landing, dev:ideploy-web, …
```

AppGen and Chart use pnpm. The full procedure, per-app `.env` files and ports are in [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md).

## Git hooks

- **pre-commit** scans staged files for keys, tokens and secret files, and blocks the commit if it finds one.
- **pre-push** builds every app touched by the pushed commits and blocks the push if a build fails.

Run them by hand with `npm run check:secrets` and `npm run check:builds`. Details in [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

Please report vulnerabilities privately, as described in [SECURITY.md](SECURITY.md). Never open a public issue for a security problem.

## License

[Apache License 2.0 with Commons Clause](LICENSE): you may use, study, modify and self-host IDEM, but you may not sell it, or offer it as a paid hosted service or paid support. For commercial licensing, contact the maintainers. The brand typeface and forked components keep their own licences (see [NOTICE](NOTICE), `apps/appgen/LICENSE`, `apps/chart/LICENSE`, `packages/shared-styles/fonts/OFL.txt`).

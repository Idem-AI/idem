# IDEM documentation

IDEM turns a business idea into the assets a founder needs: brand identity, business plan, pitch deck, legal documents, diagrams, a generated application and its deployment. This folder documents the monorepo as a whole; each application documents its own internals in its `README.md` and `docs/` folder.

## Start here

| Document | Read it to… |
| --- | --- |
| [Architecture](ARCHITECTURE.md) | understand the applications, how they talk to each other, and where data lives |
| [Getting started](GETTING_STARTED.md) | run the platform locally |
| [Configuration and secrets](CONFIGURATION.md) | set environment variables and manage secrets with Infisical |
| [Security](SECURITY.md) | know the security rules every change must respect |
| [Deployment](DEPLOYMENT.md) | understand CI, Docker images and how production is deployed |
| [Observability](OBSERVABILITY.md) | write logs, debug with Grafana, act on alert e-mails, run the log stack in production |
| [Mobile applications in iCode](ICODE_MOBILE_APPS.md) | understand how iCode generates, previews and publishes a mobile application (React + Capacitor) |
| [Contributing](../CONTRIBUTING.md) | follow the workflow, commit rules and git hooks |

## Applications

| Application | Directory | Documentation |
| --- | --- | --- |
| API (central backend) | `apps/api` | [README](../apps/api/README.md) · [docs](../apps/api/docs) |
| Main dashboard | `apps/main-dashboard` | [README](../apps/main-dashboard/README.md) · [docs](../apps/main-dashboard/docs) |
| Landing site | `apps/landing` | [README](../apps/landing/README.md) · [docs](../apps/landing/docs) |
| AppGen (application generator) | `apps/appgen` | [README](../apps/appgen/README.md) · [docs](../apps/appgen/docs) |
| iDeploy API | `apps/ideploy-api` | [README](../apps/ideploy-api/README.md) |
| iDeploy web | `apps/ideploy-web` | [README](../apps/ideploy-web/README.md) |
| Simulator | `apps/simulation` | [README](../apps/simulation/README.md) |
| Chart editor | `apps/chart` | [README](../apps/chart/README.md) |
| Shared packages | `packages/*` | [Packages](PACKAGES.md) |

## Conventions for this documentation

- Written in English.
- A document describes what the code does **today**. When a behaviour changes, update the document in the same pull request.
- Plans, migration notes and one-off reports do not belong here: put them in the pull request or the issue.
- Never paste a real secret, token or password in a document, even as an example: the repository is public. The pre-commit hook blocks it.

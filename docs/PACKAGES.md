# Shared packages

Code shared between applications lives in `packages/`. Applications consume the sources through TypeScript path aliases or npm workspaces; only `shared-models`, `shared-auth-client` and `shared-tour` have a build step (`npm run prepare:packages` builds the first two).

| Package | Used by | What it provides |
| --- | --- | --- |
| [`@idem/shared-models`](../packages/shared-models/README.md) | API, iDeploy API, dashboard, landing | Types shared by front and back ends (users, teams, projects) and the **pricing configuration** (`pricing.config.json` + schema), the single source of prices per country |
| [`@idem/shared-styles`](../packages/shared-styles/README.md) | Every front end | The design system: tokens, surfaces (`.glass-card`…), buttons (`.inner-button`, `.outer-button`), natively styled form elements, the Vilevile brand font and icons |
| [`@idem/shared-loader`](../packages/shared-loader/README.md) | Dashboard, landing, simulator, iDeploy web | `<idem-loader>`, the only loading indicator of the platform |
| [`@idem/shared-seo`](../packages/shared-seo/README.md) | Landing (runtime); dashboard, simulator, iCode, iDeploy (generated `<head>`) | Single source of IDEM SEO: organisation, promise, services and their place in the journey, cross-domain JSON-LD, share-image URLs. See `docs/SEO.md` |
| [`@idem/shared-tour`](../packages/shared-tour/README.md) | Dashboard, simulator, iDeploy web | Framework-agnostic guided tours (`startTour`, `isTourActive`) |
| [`@idem/shared-trusted-by`](../packages/shared-trusted-by/README.md) | Landing, simulator, AppGen, iDeploy web | The "They trust us" partner band: one partner list, one stylesheet, an Angular and a React renderer |
| [`@idem/shared-auth-client`](../packages/shared-auth-client/README.md) | Chart editor | Legacy teams and project-permissions client (see its README) |

## Rules

- **Use the design system, do not reproduce it.** Before writing a style, look for the class in `packages/shared-styles/styles.css`: the inventory and the rules are in [`AGENTS.md`](../AGENTS.md). A local `.card`, `.btn` or spinner is a defect, even if it looks right.
- **One loader:** `<idem-loader>` from `@idem/shared-loader/angular`. No local spinner classes.
- **Prices** are defined once, in `packages/shared-models/src/pricing/pricing.config.json`; the API reads it at runtime and the admin panel can override prices in the database (see [Billing](../apps/api/docs/BILLING.md)).
- A change in a package rebuilds its consumers in the pre-push hook.

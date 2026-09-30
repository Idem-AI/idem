# @idem/shared-models

Types and data shared by IDEM's front ends and back ends.

| Path | Contents |
| --- | --- |
| `src/auth/` | `UserModel`, team, invitation and project-team models |
| `src/projects/` | `ProjectModel` |
| `src/pricing/pricing.config.json` | **The price list**: every offer in every supported country. Single source of truth for prices |
| `src/pricing/pricing.schema.json` | JSON Schema of the price list |
| `src/pricing/pricing.ts`, `defaults.ts` | Typed access to the price list |

```ts
import { UserModel, ProjectModel } from '@idem/shared-models';
```

## Prices

Prices are defined per country, never converted from the CFA franc (see `docs/BILLING.md` in `apps/api`). The API reads `pricing.config.json` at runtime and reloads it when it changes; the admin panel can override a price in the database, and overrides win over the file. `PRICING_CONFIG_PATH` points the API at another file.

## Build

```bash
npm run build --workspace=@idem/shared-models   # or: npm run prepare:packages
```

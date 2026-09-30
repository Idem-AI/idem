# Caching

The API uses two kinds of cache:

- **Redis** ([`services/cache.service.ts`](../api/services/cache.service.ts)), shared between instances, for anything expensive to recompute: web research, font catalogues, section digests, generated briefs, entitlements.
- **In-process maps** in [`services/pdf.service.ts`](../api/services/pdf.service.ts) for rendered HTML and PDFs. They live in one API process and disappear on restart.

Redis is also used outside the cache service by rate limiting, billing locks and the iDeploy SSO tokens; those keys do not use the `idem:` prefix and are not affected by the cache endpoints below.

## Redis cache service

```ts
import { cacheService } from '../services/cache.service';

const fonts = await cacheService.getOrSet('catalog', () => fetchFonts(), {
  prefix: 'fonts',
  ttl: 24 * 60 * 60, // seconds
});
```

| Method | Role |
|---|---|
| `get(key, { prefix })` / `set(key, value, { prefix, ttl })` | Read / write a JSON value |
| `getOrSet(key, factory, options)` | Read, or compute, store and return |
| `delete(key, options)` / `exists(key, options)` | Single key |
| `deletePattern(pattern)` | Delete every key matching a glob (after the `idem:` prefix) |
| `expire(key, ttl)` / `getTTL(key)` | Change / read the remaining TTL |
| `invalidateUserCache(userId)` / `invalidateProjectCache(projectId)` | Delete `user:<id>:*` / `project:<id>:*` |
| `getStats()` | Key count, memory, hit and miss rates (per process) |
| `clear()` | Delete every `idem:*` key |

Keys are built as `idem:<prefix>:<key>`. The default TTL is **1 hour**. Values are stored as JSON; a value that fails to parse is treated as a miss.

All methods catch Redis errors, log them and behave like a miss (`get` returns `null`, `set` returns `false`). **A Redis outage slows the API down but does not break it.** Code must therefore never rely on the cache for correctness.

### What is cached

| Data | Prefix | TTL | Where |
|---|---|---|---|
| Web research results (sources + digest) | `ai` | 7 days (`IDEM_RESEARCH_CACHE_TTL`, seconds) | `services/research/research-team.service.ts` |
| Google Fonts, Fontshare, Fontsource catalogues | per service | 24 hours | `services/google-fonts.service.ts`, `fontshare.service.ts`, `fontsource.service.ts` |
| Downloaded font files for logo lockups | per service | 30 days | `services/BandIdentity/lockup/fontLoader.service.ts` |
| Billing entitlements | per service | 60 seconds | `services/billing/entitlements.service.ts` |
| Projects | `project` | default | `services/project.service.ts` (invalidated on every update) |

Other generators (branding, pitch deck, business plan, legal docs, communication, simulation, section digests, cover briefs) use the same service with their own prefixes; see the `cacheService` calls in each file.

**Invalidation rule**: a service that writes data it also caches deletes the cached key in the same code path (see `project.service.ts`). Do not rely on the TTL to hide stale data.

## PDF service cache (in process)

| Cache | TTL | Content |
|---|---|---|
| `htmlCache` | 30 minutes | Rendered HTML for a document |
| `pdfCache` | 1 hour | Final PDF buffer |
| `resourcesCache` | process lifetime | Static resources inlined into pages (CSS, scripts) |

A cleanup runs every 15 minutes. Because these maps are per process, two API replicas can each render the same PDF once; that is acceptable for the current volume.

## Admin endpoints

All `/cache` routes are **admin only** (`requireAdminAccess`, see `middleware/super-user.middleware.ts`). They used to be public, which let anyone empty the cache; do not relax this.

| Method | Route | Effect |
|---|---|---|
| `GET` | `/cache/stats` | Redis statistics |
| `DELETE` | `/cache/clear` | Delete every `idem:*` key |
| `DELETE` | `/cache/user/:userId?` | Invalidate a user's keys (the caller if omitted) |
| `DELETE` | `/cache/project/:projectId` | Invalidate a project's keys |
| `DELETE` | `/cache/pattern` | Body `{ "pattern": "…" }`: delete matching keys |
| `GET` | `/cache/key` | Check a key and its TTL |
| `PUT` | `/cache/ttl` | Change a key's TTL |
| `GET` | `/cache/pdf/stats` | PDF cache statistics |
| `DELETE` | `/cache/pdf/clear`, `/cache/pdf/clear-all` | Clear expired / all PDF entries |
| `DELETE` | `/cache/pdf/project/:projectId`, `/cache/pdf/user/:userId?` | Clear PDF entries for a project / user |
| `DELETE` | `/cache/pdf/age` | Clear PDF entries older than a given age |

The exact request and response shapes are in the OpenAPI annotations of [`routes/cache.routes.ts`](../api/routes/cache.routes.ts) (served at `/api-docs` in development).

## Configuration

| Variable | Default | Role |
|---|---|---|
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | — | Redis password (Infisical in production, project `api`) |
| `REDIS_DB` | `0` | Database index |
| `IDEM_RESEARCH_CACHE_TTL` | `604800` | Research cache TTL, in seconds |

## Operational notes

- `clear()`, `deletePattern()` and `getStats()` use `KEYS`, which blocks Redis while it scans. That is fine at the current key count; switch to `SCAN` before the keyspace grows large.
- Hit and miss rates are counted per process and reset on restart.
- To force a regeneration while debugging, delete the specific key or prefix (`DELETE /cache/pattern` with `ai:*`, for example) rather than clearing everything.

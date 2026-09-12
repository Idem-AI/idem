# AI Coding Agent Instructions for Idem

Welcome! This file guides AI agents through the Idem codebase. Read this first to become productive quickly.

## Project Overview

**Idem** is an AI-powered software development lifecycle platform built as a **monorepo** using **npm workspaces**. It transforms ideas into complete software projects through AI generation of business plans, branding, UML diagrams, and deployable applications.

### Core Applications (npm workspaces)

| App | Tech | Purpose | Port |
|-----|------|---------|------|
| `apps/main-dashboard` | Angular 20 | Main AI-powered SDLC UI | 4200 |
| `apps/chart` | Svelte 5 | Interactive Mermaid diagram editor | 5173 |
| `apps/appgen` | React/Next.js | AI application generator | 3000 |
| `apps/api` | Express/TypeScript | Backend API (Firebase auth, AI services) | 3001 |
| `apps/ideploy` | Laravel/PHP | Deployment platform (Coolify-based) | 8000 |

## Critical Architecture Patterns

### 1. **Centralized Authentication via Cookies** 

**Why this matters:** Both Express API (`apps/api`) and Laravel (`apps/ideploy`) must share authentication via HTTP-only cookies. This is complex in production.

**Key Files:**
- `apps/api/api/controllers/auth.controller.ts` - Session/refresh token logic
- `apps/api/api/index.ts` (lines 83-104) - CORS + credentials configuration
- `apps/ideploy/CLAUDE.md` - Laravel integration notes

**Pattern:**
```typescript
// apps/api/api/controllers/auth.controller.ts line 57
sameSite: isProduction ? 'none' : 'lax',  // Must pair with secure: true
secure: isProduction,                      // HTTPS only in production
httpOnly: true,                           // Block JavaScript access
```

**Common Production Issues:**
- ❌ `SameSite=None` without `Secure=true` → cookies blocked
- ❌ CORS `origin` not in `CORS_ALLOWED_ORIGINS` env var → credentials rejected
- ❌ Cookie domain mismatch (e.g., `api.example.com` vs `ideploy.example.com`) → not shared
- ✅ Solution: Use shared parent domain or explicit `Domain` attribute

**Debug Steps:**
1. Check `CORS_ALLOWED_ORIGINS` in production `.env`
2. Verify all domains use HTTPS
3. Test cookie sharing: `curl -v -b cookies.txt https://api.example.com/...` then read `cookies.txt`
4. Check browser DevTools → Application tab → Cookies for `session` and `refreshToken`

### 2. **npm Workspaces Structure**

**Key File:** `package.json` (root) defines workspaces:
```json
"workspaces": ["apps/*", "packages/*"]
```

**Package Sharing:**
- `packages/shared-models/` - TypeScript types used by API + frontend
- `packages/shared-auth-client/` - Firebase auth utilities
- `packages/shared-styles/` - TailwindCSS config + shared components

**Build Order:** Always respect workspace dependencies:
1. Build `shared-*` packages first
2. Then build apps that depend on them

### 3. **Docker Compose for Local Development**

**Key Files:**
- `docker-compose.dev.yml` - Local multi-service setup
- `docker-compose.prod.yml` - Production deployment (no dev tools)

**Critical Services:**
- `postgres:15` - Primary database (connected to ideploy)
- `redis:7` - Cache + queue broker
- `ideploy` - Laravel Coolify platform
- `api`, `main-dashboard`, `chart`, `appgen` - Node apps

**Network Isolation:** All services use `idem-dev` bridge network. Cross-service communication uses container names (e.g., `postgres`, `redis`).

### 4. **Firebase Authentication Flow**

**Phases:**
1. Client signs in via Google/GitHub → gets Firebase `idToken`
2. Client sends `idToken` → `POST /sessionLogin` (Express API)
3. API creates session cookie + refresh token → returns both
4. Client uses session cookie for subsequent requests
5. ideploy/Laravel can read the same cookie (if domain allows)

**Why it breaks in production:**
- Firebase project ID mismatch between frontend + backend
- CORS preflight requests fail (missing credentials header)
- Cookie not sent on cross-domain requests (see SameSite issue above)

### 5. **Laravel (ideploy) Key Patterns**

**Important Files:**
- `apps/ideploy/CLAUDE.md` - Full development guide
- `apps/ideploy/app/Models/` - Eloquent models (Application, Server, Service, Database, Team, etc.)
- `apps/ideploy/app/Actions/` - Domain-specific business logic (not just CRUD)
- `apps/ideploy/app/Livewire/` - Full-stack components (backend + Alpine.js frontend)

**Running Tests in Docker:**
```bash
# Database-dependent tests (must be in container)
docker exec ideploy php artisan test

# Pure unit tests (can run locally)
./vendor/bin/pest tests/Unit
```

**Queue System:** Uses Laravel Horizon + Redis. Critical jobs:
- `ApplicationDeploymentJob` - Handles Git webhooks → Docker deployment
- `ServerCheckJob` - Health monitoring
- `ServerConnectionCheckJob` - SSH availability

### 6. **Shared Models Package**

**Located in:** `packages/shared-models/src/`

**Purpose:** Single source of truth for types used across API + frontend.

**Example Usage:**
```typescript
// apps/api uses:
import { User, Team, Project } from '@idem/shared-models';

// apps/main-dashboard uses same types:
import { User, Team, Project } from '@idem/shared-models';
```

**When updating:** Changes here require rebuild:
```bash
npm run build:shared  # Rebuild the package
npm run build:api    # Rebuild dependents
npm run build:main-dashboard
```

## Developer Workflows

### Local Development
```bash
# 1. Install dependencies (all workspaces)
npm install

# 2. Start Docker infrastructure
docker-compose -f docker-compose.dev.yml up

# 3. Run dev servers
npm run dev:api              # Express on 3001
npm run dev:main-dashboard   # Angular on 4200
npm run dev:appgen           # React on 3000
npm run dev:chart            # Svelte on 5173

# 4. In another terminal, run Laravel
cd apps/ideploy
php artisan serve  # Inside Docker: docker exec ideploy php artisan serve
```

### Building for Production
```bash
# Respect workspace build order:
npm run build         # Builds all workspaces
# OR selective:
npm run build:shared
npm run build:api
npm run build:main-dashboard
```

### Debugging Authentication Issues
1. **Frontend:** Chrome DevTools → Application → Cookies → check `session` cookie exists
2. **API Logs:** Check `apps/api/api/config/logger.ts` output for "Session cookie created" or errors
3. **CORS Preflight:** Network tab → check for `OPTIONS` requests + `Access-Control-Allow-Credentials: true`
4. **Laravel Session:** Check `apps/ideploy/.env` for session configuration matching cookie settings

## File Organization Reference

```
idem/
├── .github/
│   └── copilot-instructions.md      ← You are here
├── apps/
│   ├── api/                         ← Express API (auth, AI services)
│   │   ├── api/
│   │   │   ├── index.ts             ← App setup (CORS, cookies, routes)
│   │   │   ├── controllers/         ← Business logic
│   │   │   ├── routes/              ← API endpoints
│   │   │   ├── services/            ← External integrations (Firebase, OpenAI)
│   │   │   ├── config/              ← Logger, Swagger, Redis
│   │   │   └── models/              ← Data interfaces
│   │   ├── CLAUDE.md                ← Detailed Express patterns
│   │   └── package.json
│   ├── ideploy/                     ← Laravel/Coolify deployment platform
│   │   ├── app/
│   │   │   ├── Models/              ← Core domain models
│   │   │   ├── Actions/             ← Domain logic (not typical Controllers)
│   │   │   ├── Jobs/                ← Queue jobs (deployment, monitoring)
│   │   │   ├── Livewire/            ← Full-stack components
│   │   │   └── Http/Middleware/     ← HTTP middleware
│   │   ├── CLAUDE.md                ← Detailed Laravel patterns
│   │   └── Dockerfile               ← Production image (PHP 8.4)
│   ├── main-dashboard/              ← Angular 20 main UI
│   ├── chart/                       ← Svelte diagram editor
│   └── appgen/                      ← React AI app generator
├── packages/
│   ├── shared-models/               ← TypeScript types (used by API + frontend)
│   ├── shared-auth-client/          ← Firebase utilities
│   └── shared-styles/               ← TailwindCSS + shared components
├── documentation/
│   ├── AUTHORIZATION_README.md      ← Detailed auth system
│   ├── AUTHORIZATION_SYSTEM.md      ← Implementation details
│   └── SHARED_AUTH_ARCHITECTURE.md  ← Cross-app auth patterns
├── scripts/
│   ├── dev-start.sh                 ← Start all services
│   ├── dev-stop.sh                  ← Stop all services
│   ├── dev-rebuild.sh               ← Rebuild Docker images
│   └── README.md                    ← Available scripts
├── docker-compose.dev.yml           ← Local environment
├── docker-compose.prod.yml          ← Production deployment
└── package.json                     ← Workspace root
```

## Project-Specific Conventions

### TypeScript
- ✅ All source files use `.ts` extensions (even in tests)
- ✅ Use explicit types, avoid `any`
- ✅ Express Request handlers use `CustomRequest` interface for typed `req.user`

### Error Handling
**Express (`apps/api`):**
```typescript
// Use AppError class for consistency
throw new AppError('User not found', 404);
```

**Laravel (`apps/ideploy`):**
```php
// Use custom exceptions in Actions
throw new \RuntimeException('Deployment failed: ' . $reason);
```

### Logging
**Express:** Uses Winston logger in `apps/api/api/config/logger.ts`
```typescript
logger.info('User logged in', { userId, timestamp: new Date() });
```

**Laravel:** Uses Laravel's built-in logger (check `storage/logs/`)

### Environment Variables
- Development: `.env.local` or `.env.development`
- Production: `.env` (in CI/CD pipeline)
- **Never commit `.env`** - use `.env.example` as template

## External Dependencies & Integration Points

### Firebase (Authentication)
- **Files:** `apps/api/api/config/` and `apps/main-dashboard/src/auth/`
- **Issue:** If auth breaks, check Firebase project ID matches across frontend + backend
- **Test:** Use Firebase Emulator Suite locally

### OpenAI & Google Gemini (AI Services)
- **Files:** `apps/api/api/services/` (aiService, etc.)
- **Keys:** `OPENAI_API_KEY`, `GEMINI_API_KEY` in `.env`
- **Rate Limiting:** Already implemented in `apps/api`

### Redis (Cache + Queues)
- **Dev:** Docker service in `docker-compose.dev.yml`
- **Prod:** External managed service (check `.env`)
- **Files:** `apps/api/api/config/redis.config.ts`, Laravel Horizon config

### PostgreSQL
- **Schema:** Managed by `apps/ideploy/database/migrations/`
- **Local:** Docker service, accessible at `postgres:5432`
- **Dev Creds:** User=`coolify`, Password=`password` (see `docker-compose.dev.yml`)

## Testing Strategy

### Express API
```bash
npm run test:api  # Runs Jest tests
```

### Laravel
```bash
# Inside Docker (requires database)
docker exec ideploy php artisan test

# Locally (unit tests only, no database)
cd apps/ideploy && ./vendor/bin/pest tests/Unit
```

### Frontend (Angular, Svelte, React)
```bash
npm run test:main-dashboard
npm run test:chart
npm run test:appgen
```

## Performance & Optimization Notes

1. **Large Monorepo:** Be mindful of install times. Use `npm ci` in CI/CD instead of `npm install`
2. **Docker Builds:** Leverage layer caching by keeping Dockerfile structure stable
3. **Redis:** Already used for caching AI responses + Laravel queues
4. **Image Processing:** `apps/api` uses Sharp (optimized C++ binding) - don't replace with pure JS

## Quick Troubleshooting

| Issue | Likely Cause | Fix |
|-------|-------------|-----|
| "Session cookie created but not sent" | CORS not including credentials | Check `credentials: true` + allow origin in `CORS_ALLOWED_ORIGINS` |
| "Cannot read property 'user' of undefined" (Laravel) | Cookie not shared across domains | Use shared parent domain or explicit `Domain` in cookie options |
| "Port 3001 already in use" | API already running | `lsof -i :3001` then `kill -9 <PID>` |
| "Docker image build fails" | Outdated Dockerfile or missing deps | Run `docker-compose -f docker-compose.dev.yml build --no-cache` |
| Tests fail with "database not found" | Running outside Docker | Run tests inside Docker: `docker exec ideploy php artisan test` |

---

**Last Updated:** January 20, 2026  
**Maintained by:** Idem Team  
**For updates:** Check `documentation/` folder and individual app `CLAUDE.md` files.

# @idem/shared-auth-client

> **Legacy.** Only the Chart editor (`apps/chart`) imports this package, for its team and project-permission screens. It calls `/api/teams`, `/api/invitations` and `/api/projects/:id/teams`, which the current API (`apps/api`) does not expose, so those screens do not work. Do not build new features on it: authentication in IDEM is the API's session cookie (see [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md#authentication)).

## Contents

| Entry | Provides |
| --- | --- |
| `AuthClient` | `fetch` wrapper (Bearer token from a `getAuthToken` callback) for the team, invitation and project-team endpoints |
| `createAuthStore`, `createProjectPermissionsStore` | Svelte stores (used by `apps/chart`) |
| `useAuth`, `useProjectPermissions` | React hooks (unused) |
| `AuthService`, `ProjectPermissionsService` | Angular services (unused) |

## Build

```bash
npm run build --workspace=@idem/shared-auth-client   # or: npm run prepare:packages
```

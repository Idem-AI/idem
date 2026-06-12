# Technical Documentation — Authentication System

This document describes the complete architecture of the authentication and authorization system of the Idem project, from the identity provider to route protections in each application.

---

## 🏗️ Overview — The Session Cookie as the Core Mechanism

The system relies on a **Firebase session cookie** mechanism (`HttpOnly`, shared across `*.idem.africa`) as the source of truth on the server-side. This is not a simple JWT stored client-side: it's an opaque session created by the Firebase Admin SDK, verifiable by any backend service on the same domain.

```
┌─────────────────────────────────────────────────────────────────┐
│  Firebase Authentication (Google, GitHub, Email/Password)       │
│  → Issues an ID Token (short-lived JWT, ~1h)                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │ ID Token (Bearer)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  POST /auth/sessionLogin  (apps/api)                            │
│  → admin.auth().createSessionCookie(idToken, { expiresIn: 14d })│
│  → Set-Cookie: session=<opaque>; HttpOnly; SameSite=None;       │
│    Secure; Domain=.idem.africa; MaxAge=14d                      │
│  → Set-Cookie: refreshToken=<uuid>; HttpOnly; MaxAge=30d        │
└──────────┬──────────────────────────────────────────────────────┘
           │ Shared session cookie (automatically sent
           │ on all *.idem.africa subdomains)
           ▼
┌──────────────────────────┬──────────────────────────────────────┐
│  API (api.idem.africa)   │  iDeploy (ideploy.idem.africa)       │
│  authenticate()          │  → POST /auth/verify-session         │
│  verifySessionCookie()   │    → API verifies cookie and returns │
│                          │      the user profile                │
└──────────────────────────┴──────────────────────────────────────┘
```

**Why a session cookie and not a Bearer JWT?**
- The Firebase session cookie is `HttpOnly` → inaccessible to client-side JavaScript (protected against XSS).
- It is automatically shared across `*.idem.africa` → the API, iDeploy, and other services receive it without any action from the frontend.
- The Firebase Admin SDK can revoke a session cookie server-side, unlike a JWT.
- Its duration (14 days) is much longer than an ID Token (1h).

---

## 🔄 Complete Login Flow

```
Client (Dashboard)              API (apps/api)              Firebase Admin
      │                              │                             │
      │  1. signInWithEmailAndPassword / Google / GitHub          │
      │─────────────────────────────────────────────────────────► │
      │◄───────────────────────── ID Token (JWT ~1h) ─────────── │
      │                              │                             │
      │  2. POST /auth/sessionLogin                               │
      │     { token: idToken, user: {...} }                       │
      │─────────────────────────────►│                             │
      │                              │ createSessionCookie(token)  │
      │                              │────────────────────────────►│
      │                              │◄─── sessionCookie (opaque) ─│
      │                              │                             │
      │                              │  generateRefreshToken()     │
      │                              │  → stored in DB (Firestore  │
      │                              │    or MongoDB)              │
      │                              │                             │
      │◄── Set-Cookie: session=...   │                             │
      │◄── Set-Cookie: refreshToken= │                             │
      │    HTTP 200 { success: true }│                             │
      │                              │                             │
      │  3. All subsequent requests                               │
      │     Cookie: session=<opaque> automatically sent           │
      │─────────────────────────────►│                             │
      │                              │  verifySessionCookie()      │
      │                              │────────────────────────────►│
      │                              │◄──── decodedToken (uid,...) ─│
      │◄────────────────── Authenticated response ────────────── │
```

---

## 🛡️ `authenticate` Middleware (API Backend)

**File**: [`apps/api/api/services/auth.service.ts`](file:///Users/pharaon/Documents/pharaon/idem/apps/api/api/services/auth.service.ts)

This is the central middleware protecting all API routes. It applies the verification strategy in this priority order:

**1. Session Cookie (high priority)**
- Reads the `session` cookie sent automatically by the browser.
- Calls `admin.auth().verifySessionCookie(cookie, true)` — the second parameter `true` also checks for revocation on the Firebase side.
- If valid → attaches `req.user` (UID, email, etc.) and moves to the next handler.

**2. Auto-refresh if the session cookie is expired**
- If `verifySessionCookie` fails **and** a `refreshToken` cookie is present:
  - Validates the refresh token in the database.
  - Creates a new Firebase `customToken` via `admin.auth().createCustomToken(userId)`.
  - Generates a new session cookie and sends it back in `Set-Cookie`.
  - Authenticates the current request with this new cookie.

**3. Bearer Token (fallback)**
- If no session cookie: reads the `Authorization: Bearer <idToken>` header.
- Calls `admin.auth().verifyIdToken(idToken)`.
- Mainly used by machine-to-machine calls or during development.

**4. Rejection**
- If no mechanism succeeds → `HTTP 401 Unauthorized`.

---

## 🍪 Cookies Table

| Cookie | Value | HttpOnly | Secure | SameSite | Domain | Duration |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `session` | Firebase Session Cookie (opaque) | ✅ | prod only | `None` (prod) / `Lax` (dev) | `.idem.africa` (prod) | 14 days |
| `refreshToken` | UUID generated by the API | ✅ | prod only | `None` (prod) / `Lax` (dev) | — | 30 days |
| `authToken` | Firebase ID Token (JWT) | ❌ | — | — | — | 55 min (local expiration) |
| `authTokenExpiry` | Expiration timestamp for `authToken` | ❌ | — | — | — | 1 day |
| `currentUser` | JSON of the Firebase `User` object | ❌ | — | — | — | 30 days |
| `idem_session_active` | `1` or `0` | ❌ | — | — | — | 30 days |

> The `session` cookie is the only one truly used server-side to authenticate requests. The others are client-side helpers (token caching, cross-tab synchronization).

---

## 🔑 Authentication Endpoints (API)

**File**: [`apps/api/api/routes/auth.routes.ts`](file:///Users/pharaon/Documents/pharaon/idem/apps/api/api/routes/auth.routes.ts)
**Controller**: [`apps/api/api/controllers/auth.controller.ts`](file:///Users/pharaon/Documents/pharaon/idem/apps/api/api/controllers/auth.controller.ts)

| Method | Route | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/sessionLogin` | ❌ (ID Token in body) | Creates the session cookie + refresh token |
| `POST` | `/auth/refresh` | ❌ (refreshToken cookie) | Renews the session cookie from the refresh token |
| `POST` | `/auth/logout` | ✅ | Revokes the refresh token and clears cookies |
| `POST` | `/auth/logout-all` | ✅ | Revokes all refresh tokens for the user |
| `GET` | `/auth/refresh-tokens` | ✅ | Lists active refresh tokens (without their value) |
| `POST` | `/auth/verify-session` | ❌ (session cookie) | Verifies the session cookie — used by iDeploy Laravel |
| `POST` | `/auth/ideploy-token` | ✅ | Generates a one-time SSO token for iDeploy |
| `POST` | `/auth/ideploy-token/validate` | ❌ (IDEPLOY_SHARED_SECRET) | Validates the SSO token — called by the Laravel backend |

---

## 📦 Shared Package: `@idem/shared-auth-client`

**Location**: [`packages/shared-auth-client`](file:///Users/pharaon/Documents/pharaon/idem/packages/shared-auth-client)

This package provides a unified authentication interface that works with the three frontend frameworks: **Angular** (dashboard), **React** (appgen), and **Svelte** (chart).

### Structure

```
packages/shared-auth-client/src/
├── core/
│   └── AuthClient.ts          # Base class — authenticated HTTP client
├── angular/
│   └── auth.service.ts        # AuthService + ProjectPermissionsService (Angular)
├── react/
│   └── useAuth.ts             # useAuth + useProjectPermissions (React hooks)
├── svelte/
│   └── authStore.ts           # createAuthStore + createProjectPermissionsStore (Svelte)
└── index.ts                   # Unified exports
```

### `AuthClient` (core)

[`AuthClient.ts`](file:///Users/pharaon/Documents/pharaon/idem/packages/shared-auth-client/src/core/AuthClient.ts) is the core class. It handles:
- Automatically adding the `Bearer <token>` to every outgoing HTTP request.
- Delegating to a `getAuthToken()` function provided during instantiation (decoupling the identity provider).

**Configuration:**
```typescript
const authClient = new AuthClient({
  apiBaseUrl: 'https://api.idem.africa',
  getAuthToken: async () => {
    const user = getAuth().currentUser;
    return user ? await user.getIdToken() : null;
  },
});
```

**Available API:**

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `createTeam(data)` | `POST /api/teams` | Create a team |
| `getMyTeams()` | `GET /api/teams/my-teams` | Retrieve the user's teams |
| `getTeam(teamId)` | `GET /api/teams/:teamId` | Retrieve a team |
| `addTeamMember(teamId, data)` | `POST /api/teams/:teamId/members` | Add a member |
| `updateMemberRole(teamId, userId, role)` | `PUT /api/teams/:teamId/members/role` | Modify role |
| `removeMember(teamId, memberId)` | `DELETE /api/teams/:teamId/members/:memberId` | Remove a member |
| `createInvitation(data)` | `POST /api/invitations` | Create an email invitation |
| `acceptInvitation(token, tmpPwd, newPwd)` | `POST /api/invitations/accept` | Accept an invitation |
| `getInvitationByToken(token)` | `GET /api/invitations/:token` | Retrieve an invitation |
| `resendInvitation(id)` | `POST /api/invitations/:id/resend` | Resend an invitation |
| `addTeamToProject(projectId, teamId, roles)` | `POST /api/projects/:id/teams` | Associate a team with a project |
| `getProjectTeams(projectId)` | `GET /api/projects/:id/teams` | Project teams |
| `updateProjectTeamRoles(projectId, teamId, roles)` | `PUT /api/projects/:id/teams/roles` | Modify a team's roles |
| `removeTeamFromProject(projectId, teamId)` | `DELETE /api/projects/:id/teams/:teamId` | Dissociate a team |
| `getProjectPermissions(projectId)` | `GET /api/projects/:id/permissions` | Current user's permissions |
| `checkProjectAccess(projectId)` | `GET /api/projects/:id/access` | Check access |

---

## 🅰️ Angular — Main Dashboard

**Application**: `apps/main-dashboard`

### Authentication Services

#### 1. `AuthService` (local module)
[`apps/main-dashboard/src/app/modules/auth/services/auth.service.ts`](file:///Users/pharaon/Documents/pharaon/idem/apps/main-dashboard/src/app/modules/auth/services/auth.service.ts)

Main service managing the user session lifecycle via Firebase Auth.

| Method | Description |
| :--- | :--- |
| `login(email, password)` | Email/Password login via `signInWithEmailAndPassword` |
| `loginWithGithub()` | GitHub OAuth popup (fallback `signInWithRedirect` on mobile) |
| `loginWithGoogle()` | Google OAuth popup (fallback `signInWithRedirect` on mobile) |
| `logout()` | Firebase `signOut` + clear cookies + backend `POST /auth/logout` |
| `getCurrentUser()` | Returns the current Firebase user, or reconstructs it from the `currentUser` cookie |
| `user$` | Firebase `user(this.auth)` observable emitting state changes |

**`postLogin` Flow (called after each successful login):**
1. Calls `TokenService.refreshToken()` → obtains the Firebase JWT (ID Token).
2. `POST /auth/sessionLogin { token, user }` → the API creates the **Firebase session cookie** and the **refresh token**.
3. Saves the `User` object in the `currentUser` cookie (client-side).
4. Activates the `idem_session_active=1` sentinel cookie (cross-tab synchronization).

**Global logout synchronization:**  
A `setInterval` monitors `idem_session_active` every 3 seconds. If this cookie changes to `0` (from another tab or service), a local logout is triggered.

#### 2. `TokenService`
[`apps/main-dashboard/src/app/shared/services/token.service.ts`](file:///Users/pharaon/Documents/pharaon/idem/apps/main-dashboard/src/app/shared/services/token.service.ts)

Service responsible for the lifecycle of the **client-side Firebase JWT** (the ID Token, distinct from the session cookie). Its role is to provide a fresh token for the `Authorization: Bearer` header of requests via `AuthInterceptor`.

| Method | Description |
| :--- | :--- |
| `getToken()` | Synchronous read from the `BehaviorSubject` |
| `getTokenAsync()` | Returns cache if valid, otherwise calls Firebase (`getIdToken(true)`) |
| `refreshToken(user?)` | Forces Firebase token renewal |
| `clearToken()` | Clears token from `authToken` / `authTokenExpiry` cookies and the `BehaviorSubject` |
| `waitForAuthReady()` | Promise resolving when Firebase Auth is initialized |

**Caching Strategy**:
- The token (valid for 1h) is cached in the `authToken` cookie + expiration in `authTokenExpiry` (55 min).
- On initialization, the token is reloaded from cookies if not expired.
- On expiration → `getIdToken(true)` forces renewal with Firebase.

> ⚠️ This client-side token is mainly used to populate the `Authorization: Bearer` header of API calls. It does not replace the session cookie, which is the actual server authentication mechanism.

#### 3. `AuthInterceptor` (HTTP)
[`apps/main-dashboard/src/app/shared/interceptors/auth.interceptor.ts`](file:///Users/pharaon/Documents/pharaon/idem/apps/main-dashboard/src/app/shared/interceptors/auth.interceptor.ts)

Functional HTTP interceptor injecting `Authorization: Bearer <token>` on all outgoing requests (with exceptions).

**Execution Logic:**
1. Skip if SSR (server-side).
2. Skip if authentication endpoint (`/auth/login`, `/auth/register`, `/auth/refresh`).
3. Skip if the request already has an `Authorization` header (e.g., iDeploy calls with their own token).
4. Wait for Firebase Auth ready (`waitForAuthReady()`).
5. **Fast path**: uses the cached token from `BehaviorSubject`.
6. On 401/403: forces a token refresh and replays the request.
7. **Slow path**: if no cache, calls `getTokenAsync()` (Firebase directly).

> The API therefore receives both the **session cookie** (sent automatically by the browser) and the **Bearer token** (injected by the interceptor). The API's `authenticate` middleware prioritizes the session cookie.

#### 4. `AuthSyncService`
[`apps/main-dashboard/src/app/shared/services/auth-sync.service.ts`](file:///Users/pharaon/Documents/pharaon/idem/apps/main-dashboard/src/app/shared/services/auth-sync.service.ts)

Checks the `idem_auth_sync` key in `localStorage` (placed by the landing page after login). Allows Firebase to synchronize the session state between applications sharing the same Firebase domain (`lexis-ia.firebaseapp.com`). Firebase synchronization is passive (5 min timeout).

### Navigation Guards

#### `authGuard`
Protects all routes requiring authentication. If unauthenticated → `GET /login?returnUrl=<url>`.

#### `publicGuard`
Prevents a logged-in user from accessing `/login`.
- If `?redirect=ideploy` → generates an SSO token via `POST /auth/ideploy-token` and redirects to `ideploy.idem.africa/auth/idem?token=<token>`.
- Otherwise → redirects to `/console`.

#### `projectEditGuard`, `projectDeleteGuard`, `projectDeployGuard`
Permission guards based on `ProjectPermissionsService`. They verify `canEdit`, `canDelete`, `canDeploy` respectively via `GET /api/projects/:id/permissions`.

---

## 🔗 Dashboard → iDeploy SSO (one-time token via Redis)

The SSO flow relies on Redis for temporary token storage:

```
1. publicGuard detects ?redirect=ideploy
2. Dashboard → POST /auth/ideploy-token (with session cookie)
3. API verifies identity via the session cookie (authenticate middleware)
4. API generates a UUID token, stores { uid, email, displayName } in Redis
   Key: "ideploy:token:<uuid>", TTL: 5 minutes
5. API → { success: true, token: "<uuid>" }
6. Dashboard → window.location.href = ideploy.idem.africa/auth/idem?token=<uuid>
7. iDeploy → POST /auth/ideploy-token/validate { token } (with X-IDEPLOY-SECRET header)
8. API reads Redis → returns user data → deletes the key (single-use)
9. iDeploy creates the Laravel session for this user
```

---

## ⚛️ React — Appgen

### `useAuth` Hook
[`packages/shared-auth-client/src/react/useAuth.ts`](file:///Users/pharaon/Documents/pharaon/idem/packages/shared-auth-client/src/react/useAuth.ts)

```typescript
const { teams, loading, error, refetchTeams, createTeam, inviteUser } = useAuth(authClient);
```

Returns a reactive state (`useState`) of the user's teams. Automatically calls `authClient.getMyTeams()` on mount.

### `useProjectPermissions` Hook
```typescript
const { permissions, loading, hasPermission } = useProjectPermissions(authClient, projectId);
```

Returns the `RolePermissions` for a given project.

---

## 🔷 Svelte — Chart Editor

### `createAuthStore` Store
[`packages/shared-auth-client/src/svelte/authStore.ts`](file:///Users/pharaon/Documents/pharaon/idem/packages/shared-auth-client/src/svelte/authStore.ts)

```typescript
const authStore = createAuthStore(authClient);
// $authStore → { teams, loading, error }
```

Writable Svelte store automatically initialized (calling `fetchTeams()` on creation).

### `createProjectPermissionsStore` Store
```typescript
const permissionsStore = createProjectPermissionsStore(authClient, projectId);
// $permissionsStore.hasPermission('canDeploy') → boolean (derived store)
```

---

## 🔑 Shared Data Models

Defined in [`@idem/shared-models`](file:///Users/pharaon/Documents/pharaon/idem/packages/shared-models) and re-exported by `@idem/shared-auth-client`.

### `RolePermissions`

| Key | Type | Description |
| :--- | :--- | :--- |
| `canEdit` | `boolean` | Can modify the project |
| `canDelete` | `boolean` | Can delete the project |
| `canDeploy` | `boolean` | Can trigger a deployment |

### `TeamRole`
A member's role in a team: `'owner'`, `'admin'`, `'member'`.

### `CreateInvitationDTO`
```typescript
{
  email: string;
  displayName: string;
  invitationType: 'team';
  teamId: string;
  teamRole: TeamRole;
}
```

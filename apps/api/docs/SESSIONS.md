# Sessions and refresh tokens

All IDEM front ends sign in with Firebase Authentication, then exchange the Firebase ID token for **two httpOnly cookies** issued by the API. Front ends never store a token in JavaScript.

| Cookie | Content | Lifetime | Options |
|---|---|---|---|
| `session` | Firebase session cookie | 14 days | `httpOnly`, `secure` in production, `SameSite=Lax`, `domain=.idem.africa` in production |
| `refreshToken` | Random 64-byte token (hex) | 30 days | same options |

`SameSite=Lax` works because every IDEM app is a sub-domain of `idem.africa`: the cookies are same-site for all of them. Cross-site state-changing requests are rejected separately by `rejectCrossSiteRequests` (`middleware/security.middleware.ts`).

Code:

- [`services/sessionCookie.service.ts`](../api/services/sessionCookie.service.ts): cookie options, session minting, session restore.
- [`services/refreshToken.service.ts`](../api/services/refreshToken.service.ts): refresh token issue, validation, revocation.
- [`services/auth.service.ts`](../api/services/auth.service.ts): the `authenticate` middleware.
- [`controllers/auth.controller.ts`](../api/controllers/auth.controller.ts), [`routes/auth.routes.ts`](../api/routes/auth.routes.ts), [`routes/user.routes.ts`](../api/routes/user.routes.ts).

## Refresh tokens

- Generated with `crypto.randomBytes(64)`, sent to the browser only as a cookie.
- **Stored hashed** (SHA-256, `hashRefreshToken`) in the user document (`refreshTokens[]`), with expiry, creation date, last use, device and IP. A database leak does not expose usable tokens.
- At most **5 tokens per user**: the oldest is dropped when a new device signs in.
- Expired tokens are removed on validation.
- Never returned in a response body. `GET /auth/refresh-tokens` lists the active sessions' metadata, not the tokens.

## Flows

### Sign-in

1. The front end signs in with Firebase and gets an ID token.
2. `POST /auth/sessionLogin` with the ID token. The API verifies it, derives the user from the **verified** token (never from the request body), creates the session cookie and a refresh token, and sets both cookies.

### Authenticated request

The `authenticate` middleware:

1. verifies the `session` cookie (`verifySessionCookie(…, true)`, which also checks revocation);
2. if it is missing or expired, tries to **restore** it from the `refreshToken` cookie: a valid refresh token mints a new session cookie (custom token → ID token through the Identity Toolkit, which needs `FIREBASE_API_KEY`) and sets it on the response;
3. otherwise, accepts a Firebase ID token in `Authorization: Bearer …` (used by server-to-server callers and tests);
4. otherwise answers `401`/`403`.

### Explicit refresh

`POST /auth/refresh` validates the `refreshToken` cookie and sets a new `session` cookie. Front ends call it when a request fails with `401`.

### Sign-out

- `POST /auth/logout` (authenticated): revokes the current refresh token and clears both cookies.
- `POST /auth/logout-all` (authenticated): revokes every refresh token of the user.

## Identity endpoints

| Endpoint | Auth | Returns | Used by |
|---|---|---|---|
| `GET /auth/profile` | session | full profile of the caller | dashboard, landing |
| `GET /auth/me` | session or Bearer | `{ uid, email }` only | satellite servers (AppGen `requireIdemUser`) |
| `POST /auth/verify-session` | session cookie or Bearer | public profile (`toPublicProfile`) | external services checking a session |

Satellite servers forward the caller's cookies (or Bearer token) to `/auth/me` and trust only the answer; they never decode the cookie themselves.

## iDeploy single sign-on

iDeploy runs on its own host and uses a short-lived one-time token:

1. The dashboard calls `POST /auth/ideploy-token` (authenticated). The API stores a random token in Redis (`ideploy:token:<token>`, **5 minutes**) bound to the user.
2. The browser is redirected to iDeploy with that token.
3. The iDeploy backend calls `POST /auth/ideploy-token/validate` with the `x-ideploy-secret` header. The header is compared in constant time with `IDEPLOY_SHARED_SECRET`; if that variable is not set, validation **fails closed**. The token is deleted on first use.

## Configuration

| Variable | Role |
|---|---|
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Admin SDK: verify ID tokens, create session cookies |
| `FIREBASE_API_KEY` | Needed to restore a session from a refresh token |
| `IDEPLOY_SHARED_SECRET` | Shared secret for iDeploy SSO validation |
| `NODE_ENV=production` | Enables `secure` and the `.idem.africa` cookie domain |

In production these values come from Google Secret Manager (`api--…`), see [Configuration](../../../docs/CONFIGURATION.md).

## Troubleshooting

- **Signed out after 14 days despite activity**: the restore path failed. Check `FIREBASE_API_KEY` and the API logs (`Error restoring session from refresh token`).
- **Cookies not sent locally**: in development the cookies have no domain and are not `secure`; the front end must call the API on the same host name (`localhost` vs `127.0.0.1` matters) with `withCredentials: true`.
- **All sessions invalid after a Firebase key rotation**: expected; session cookies are signed by Firebase. Refresh tokens remain valid and restore sessions transparently.

# Sessions and refresh tokens

Sign-in goes through a **self-hosted Supabase auth server** (GoTrue, `infra/supabase-auth`): e-mail and password, Google, LinkedIn. The dashboard exchanges the Supabase access token for **two httpOnly cookies** issued by the API. Every other IDEM app relies on those cookies.

| Cookie | Content | Lifetime | Options |
|---|---|---|---|
| `session` | JWT signed by the API (`SESSION_SECRET`, HS256) | 14 days | `httpOnly`, `secure` in production, `SameSite=Lax`, `domain=.idem.africa` in production |
| `refreshToken` | Random 64-byte token (hex) | 30 days | same options |

`SameSite=Lax` works because every IDEM app is a sub-domain of `idem.africa`: the cookies are same-site for all of them. Cross-site state-changing requests are rejected separately by `rejectCrossSiteRequests` (`middleware/security.middleware.ts`).

Code:

- [`services/identity/supabaseAuth.client.ts`](../api/services/identity/supabaseAuth.client.ts): Supabase access-token verification, admin API.
- [`services/identity/identity.service.ts`](../api/services/identity/identity.service.ts): links an auth account to the IDEM user.
- [`services/sessionCookie.service.ts`](../api/services/sessionCookie.service.ts): cookie options, session minting and verification, revocation.
- [`services/refreshToken.service.ts`](../api/services/refreshToken.service.ts): refresh token issue, validation, revocation.
- [`services/auth.service.ts`](../api/services/auth.service.ts): the `authenticate` middleware.
- [`controllers/auth.controller.ts`](../api/controllers/auth.controller.ts), [`routes/auth.routes.ts`](../api/routes/auth.routes.ts), [`routes/user.routes.ts`](../api/routes/user.routes.ts).

## IDEM uid and auth accounts

The IDEM `uid` is the key of projects, credits, payments and iDeploy users. It never changes:

- accounts created before the move to Supabase keep their original `uid`;
- new accounts get the Supabase user id as `uid`.

The Supabase account is only a way in, stored as `authId` on the user. On `POST /auth/sessionLogin`, the API resolves the user in this order:

1. `authId` already known → that user;
2. `app_metadata.idem_uid` (set by the import script, not editable by the user) → the imported account;
3. same e-mail address, **confirmed by the auth server**, on an account without `authId` → that account (`authMigration.linkedBy = 'verified-email'`);
4. otherwise a new account.

An unconfirmed address never takes over an existing account: the API answers `403 email_not_verified`. The auth server requires e-mail confirmation (`GOTRUE_MAILER_AUTOCONFIRM=false`).

## Importing existing accounts

The previous identity provider cannot be read any more: no password hash or OAuth identity can be exported. `npm run auth:import` (simulation) then `npm run auth:import -- --apply` creates, for every IDEM user without `authId`, a Supabase account with the same e-mail address, **confirmed**, **without password**, with `app_metadata.idem_uid`, and stores `authId`. The script is idempotent.

When those users come back:

- **Google, LinkedIn** with the same address: the auth server links the identity to the imported account; the original `uid` is kept.
- **E-mail and password**: « Choose my password » on the login page sends a link; following it proves ownership of the address and sets the password.

## Refresh tokens

- Generated with `crypto.randomBytes(64)`, sent to the browser only as a cookie.
- **Stored hashed** (SHA-256, `hashRefreshToken`) in the user document (`refreshTokens[]`), with expiry, creation date, last use, device and IP. A database leak does not expose usable tokens.
- At most **5 tokens per user**: the oldest is dropped when a new device signs in.
- Expired tokens are removed on validation.
- Never returned in a response body. `GET /auth/refresh-tokens` lists the active sessions' metadata, not the tokens.

## Flows

### Sign-in

1. The dashboard signs in with Supabase (`@supabase/auth-js`, PKCE) and gets an access token.
2. `POST /auth/sessionLogin` with `{ token }`. The API verifies the signature (`SUPABASE_JWT_SECRET`), resolves the IDEM user (see above), creates the session cookie and a refresh token, sets both cookies and returns the public profile.

OAuth, confirmation and password links come back to `/login` with a `code`; the dashboard exchanges it, then calls `sessionLogin`. A password-recovery link only opens the form to choose a new password; the IDEM session starts once it is saved.

### Authenticated request

The `authenticate` middleware:

1. verifies the `session` cookie (signature, expiry, revocation);
2. if it is missing or invalid, **restores** it from the `refreshToken` cookie and sets a new `session` cookie on the response;
3. otherwise accepts `Authorization: Bearer …`: an IDEM session token (server-to-server callers, tests) or a Supabase access token of an account already linked (the dashboard sends it on every request);
4. otherwise answers `401`/`403`.

### Explicit refresh

`POST /auth/refresh` validates the `refreshToken` cookie and sets a new `session` cookie. Front ends call it when a request fails with `401`.

### Sign-out

- `POST /auth/logout` (authenticated): revokes the current refresh token and clears both cookies.
- `POST /auth/logout-all` (authenticated): revokes every refresh token and sets `sessionsRevokedAt`: every `session` cookie and Supabase access token issued before is rejected (checked with a 30-second cache).

## Identity endpoints

| Endpoint | Auth | Returns | Used by |
|---|---|---|---|
| `GET /auth/profile` | session (restored from the refresh token if needed) | public profile, `emailVerified`, `isSuperUser` | dashboard, simulator, chart, iDeploy |
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
| `SUPABASE_AUTH_URL` | Root URL of GoTrue as seen from the API (no `/auth/v1`) |
| `SUPABASE_JWT_SECRET` | Shared with GoTrue (`AUTH_JWT_SECRET`): verifies access tokens, signs short-lived `service_role` tokens for the admin API |
| `SESSION_SECRET` | Signs the `session` cookie. Required in production; derived from `SUPABASE_JWT_SECRET` in development only |
| `IDEPLOY_SHARED_SECRET` | Shared secret for iDeploy SSO validation |
| `NODE_ENV=production` | Enables `secure` and the `.idem.africa` cookie domain |

In production the secrets come from Google Secret Manager (`api--SUPABASE_JWT_SECRET`, `api--SESSION_SECRET`), see [Configuration](../../../docs/CONFIGURATION.md). The auth server itself is described in [`infra/supabase-auth/README.md`](../../../infra/supabase-auth/README.md).

`npm run check:auth` exercises the whole flow against a running auth server and a throw-away MongoDB database.

## Troubleshooting

- **`401` on `sessionLogin` with « Not an authenticated user token »**: `SUPABASE_JWT_SECRET` differs from GoTrue's `AUTH_JWT_SECRET`, or the token is a `service_role`/anonymous one.
- **`403 email_not_verified`**: an IDEM account exists with this address, but the auth server has not confirmed it. The user must open the confirmation link, or use « Choose my password ».
- **Cookies not sent locally**: in development the cookies have no domain and are not `secure`; the front end must call the API on the same host name (`localhost` vs `127.0.0.1` matters) with `withCredentials: true`.
- **All sessions invalid after rotating `SESSION_SECRET`**: expected. Refresh tokens remain valid and restore sessions transparently.

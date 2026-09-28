# GitHub integration

Lets a user connect their GitHub account with OAuth and push a project's generated files to a repository.

This is the **API's** integration (`/github/*` on `api.idem.africa`). iDeploy has its own GitHub integration in `apps/ideploy-api`, which is used for deployments; do not confuse the two.

Code: [`routes/github.routes.ts`](../api/routes/github.routes.ts), [`controllers/github.controller.ts`](../api/controllers/github.controller.ts), [`services/github.service.ts`](../api/services/github.service.ts) (Octokit).

## Setup

1. On GitHub: **Settings › Developer settings › OAuth Apps › New OAuth App**.
   - Homepage URL: `https://idem.africa`
   - Authorization callback URL: `https://api.idem.africa/github/auth/callback` (locally `http://localhost:3001/github/auth/callback`)
2. Set the variables:

| Variable | Secret | Role |
|---|---|---|
| `GITHUB_CLIENT_ID` | no | OAuth app client id |
| `GITHUB_CLIENT_SECRET` | yes (`api--GITHUB_CLIENT_SECRET`) | OAuth app client secret |
| `GITHUB_REDIRECT_URI` | no | Must match the callback URL registered on GitHub |
| `GITHUB_STATE_SECRET` | yes (`api--GITHUB_STATE_SECRET`) | HMAC key for the OAuth `state` |

If `GITHUB_STATE_SECRET` is not set, the service falls back to `JWT_SECRET`, then `API_SIGNING_SECRET`, then a random per-process key. With a per-process key, authorisations in progress fail after a restart or when the callback lands on another replica: set the variable in production.

## Flow

1. The front end calls `GET /github/auth/url` (authenticated). The API returns the GitHub authorisation URL with scopes `repo user:email` and a signed `state`.
2. The user authorises the app on GitHub, which redirects to `GET /github/auth/callback?code=…&state=…`.
3. The callback **requires the IDEM session** (the `session` cookie is sent on this top-level navigation because it is `SameSite=Lax`). The API:
   - verifies the `state` signature and expiry;
   - checks that the user inside the `state` is the **signed-in user**; otherwise it refuses;
   - exchanges the code for an access token and stores it in the user's `githubIntegration`.
4. The front end can then list repositories, read the GitHub profile and push files.

### The `state` parameter

`state = base64url(payload) + "." + HMAC-SHA256(payload)`, where the payload is `{ userId, exp, nonce }`:

- valid for **10 minutes**;
- signature compared in constant time;
- bound to the session in step 3, so a `state` generated for one account cannot attach a GitHub account to another (login CSRF).

## Endpoints

All endpoints require authentication.

| Method | Route | Role |
|---|---|---|
| `GET` | `/github/auth/url` | Authorisation URL |
| `GET` | `/github/auth/callback` | OAuth callback (see above) |
| `POST` | `/github/projects/:projectId/push` | Create the repository if needed and commit files |
| `GET` | `/github/repositories` | The user's repositories |
| `GET` | `/github/user` | The connected GitHub profile |
| `DELETE` | `/github/disconnect` | Remove the stored GitHub token |

### Push

```http
POST /github/projects/{projectId}/push
Content-Type: application/json

{
  "repositoryName": "my-project",
  "description": "Generated with IDEM",
  "isPrivate": true,
  "commitMessage": "Initial commit",
  "files": { "README.md": "# My project", "index.html": "<!DOCTYPE html>…" }
}
```

The service creates the repository if it does not exist (public by default: send `isPrivate: true` for a private one), then builds blobs, a tree and a single commit on the default branch. The response contains the repository URL and the list of pushed files.

Errors: `401` without a session, `400` if GitHub is not connected or GitHub rejects the operation.

## Known limitations

- The GitHub access token is stored **in clear** in the user document (`githubIntegration.accessToken`). Encrypting it at rest is a pending improvement; until then, treat MongoDB backups as sensitive.
- The callback answers JSON, so the browser ends on a JSON page after authorisation. A redirect to the dashboard would be friendlier.
- No IDEM front end currently calls these endpoints; iDeploy uses its own integration.

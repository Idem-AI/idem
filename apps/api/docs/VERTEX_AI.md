# Vertex AI (Gemini backend)

GLM is the default text provider (see [AI routing](AI_ROUTING.md)). When a Gemini model is used — fallback chains, image generation, research — the API calls it through **Vertex AI** by default, so the usage is billed on the project's Google Cloud account rather than on a Google AI Studio key.

Models do not change. `ai.config.ts` remains the single source of truth for model choice, token budgets and fallback chains: only the backend serving those models changes.

## Setup

### 1. Google Cloud

Vertex reuses the **existing Firebase service account**. A Firebase project is a Google Cloud project: same identity, same project, same bill. Nothing to create — only the permission to call Vertex is missing.

```bash
gcloud services enable aiplatform.googleapis.com --project=<PROJECT>

# The Firebase service account, the one in FIREBASE_CLIENT_EMAIL
gcloud projects add-iam-policy-binding <PROJECT> \
  --member="serviceAccount:<FIREBASE_CLIENT_EMAIL>" \
  --role="roles/aiplatform.user"
```

`roles/aiplatform.user` is enough for `generateContent`, streaming, image generation and context caching. Do not grant `roles/owner`.

### 2. Environment variables

**No variable to add.** Vertex reads the Firebase ones, which are already required:

| Variable | Role |
|---|---|
| `FIREBASE_PROJECT_ID` | Google Cloud project, hence the one billed for Vertex |
| `FIREBASE_CLIENT_EMAIL` | Service account that signs the calls |
| `FIREBASE_PRIVATE_KEY` | Its private key; escaped `\n` accepted |

In production these come from Google Secret Manager (`api--FIREBASE_*`), see [Configuration](../../../docs/CONFIGURATION.md).

Two optional, Vertex-specific variables:

| Variable | Role |
|---|---|
| `GEMINI_BACKEND` | `vertex` (default) or `ai-studio` to roll back |
| `GOOGLE_CLOUD_LOCATION` | Vertex region. Default `global` |

`GEMINI_API_KEY` is not needed in Vertex mode. It is only read when `GEMINI_BACKEND=ai-studio`.

### 3. Authentication

The Firebase service account signs Vertex calls — no second account, no second secret to rotate. There is deliberately **no fallback** to another set of variables or to Application Default Credentials: a single explicit identity beats a cascading resolution where, during an incident, nobody knows which one was used.

If the three Firebase variables are incomplete, building the client fails with a message naming them.

At start-up, the API logs the resolved backend:

```
Gemini backend: Vertex AI (project=idem-prod, region=global,
                auth=Firebase service account (firebase-adminsdk-…@idem-prod.iam.gserviceaccount.com),
                no context cache)
```

If the configuration is incomplete, the line goes to `console.error` at boot instead of failing in the middle of a generation.

## Choosing the region

The default is **`global`**: the request goes to the closest available region, which gives the best resilience and model coverage.

Accepted trade-off: the global endpoint **does not serve context caching**. The research team (`services/research/research-team.service.ts`) used it to share a prefix between its calls; it now sends that prefix inline, so it is billed again as input tokens on each call.

This is explicit: `contextCache` is declared `false` in the registry when the region is `global`, and `createContextCache` checks that guard before calling the API. Without it, each generation would attempt a `caches.create` bound to fail and swallowed by its `catch` — a wasted round trip, for a cause invisible in the logs.

To get context caching back, set a region:

```bash
GOOGLE_CLOUD_LOCATION=us-central1   # or europe-west1, europe-west4…
```

`contextCache` then switches back to `true` automatically. In that case, check that the models in `ai.config.ts` are available in the chosen region: preview model coverage varies, and it is the first thing to check if a model answers 404.

## Rolling back

```bash
GEMINI_BACKEND=ai-studio
GEMINI_API_KEY=<key>
```

No code change. Both paths are supported by the factory.

## Where it is implemented

Two files, and only one of them changes.

**`api/config/ai-providers.config.ts` — the declaration.** Its "Gemini backend" block declares the mode, project, region, authentication and the capabilities that follow. It is the **only place to touch** for a future switch: another region, another project, back to AI Studio, a new backend.

**`api/config/google-genai.client.ts` — the execution.** The factory decides nothing: it builds the client from what the registry declares and reads no environment variable. This guarantees that an infrastructure change does not leak into business code.

Capabilities follow the backend: `getProvider()` recomputes `contextCache` from the region, and all code already goes through the `providerSupports()` guard. A capability that disappears with a backend is therefore declared in the same place as the backend itself.

Services that used to build their own client go through the factory:

- `services/prompt.service.ts` (main path)
- `services/brandMockup.service.ts`
- `services/BandIdentity/logoAnalysis.service.ts`
- `services/Communication/imageSourcing.service.ts`

Building a `GoogleGenAI` directly anywhere else would send that call to AI Studio without any warning.

Guards that used to test `process.env.GEMINI_API_KEY` to decide whether a generation was possible now use `isGeminiConfigured()`, which asks the active backend.

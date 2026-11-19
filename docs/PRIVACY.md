# Privacy and data governance

What IDEM does with user data, enforced in code. The rules live in one file, [`apps/api/api/config/data-governance.ts`](../apps/api/api/config/data-governance.ts); this page explains them. `npm run check:privacy` (in `apps/api`) fails if the code drifts from them.

Legal bases below are technical proposals pending legal review (Cameroon law n° 2024/017 of 23 December 2024; GDPR for European users).

## Principles

| Principle | What the code guarantees |
|---|---|
| Ownership | Projects belong to their author. Every read and write is scoped to the authenticated user (`users/<uid>/projects`, iDeploy `team_id`). See [SECURITY.md](SECURITY.md). |
| No training | No project content is used to train or fine-tune a model. `idem-ml` has no collection pipeline. The `AI_RESEARCH` purpose requires a separate consent and is not implemented. |
| Providers do not keep data | Every model request leaves through the Privacy Guard, which forces OpenRouter's `data_collection: "deny"`. |
| Minimal analytics | Usage records (`ai_usage_events`) hold metadata only: feature, model, tokens, cost, status, duration. Never a prompt or an output. |
| Logs are not a copy of projects | Log lines keep the shape of business documents, never their content. |
| Admin access is traced | The admin panel records every write and every read of user content. |

## Classification

| Level | Meaning | Examples |
|---|---|---|
| L0 | Public, published by the user | Published site, social posts, Builders showcase |
| L1 | Internal | Preferences, usage metadata, technical logs |
| L2 | Confidential | Ideas, business plans, finances, brand work, conversations, uploaded files |
| L3 | Highly sensitive | Session tokens, secrets, payment data |

Model calls are treated as L2 by default. L3 data is never sent to a model: the guard refuses it.

## Purposes

| Code | Proposed legal basis | Consent | Max level | Status |
|---|---|---|---|---|
| `SERVICE_DELIVERY` | contract | no | L2 | active |
| `ACCOUNT_SECURITY` | legitimate interest | no | L3 | active |
| `BILLING` | contract | no | L3 | active |
| `LEGAL_OBLIGATION` | legal obligation | no | L3 | active |
| `PRODUCT_ANALYTICS` | legitimate interest | no | L1 | active |
| `PRODUCT_IMPROVEMENT` | legitimate interest | no | L1 | active |
| `AI_RESEARCH` | consent | yes | L2 | not implemented |
| `MARKETING` | consent | yes | L1 | not implemented |

A call made to deliver the service is never reused for another purpose.

## Privacy Guard

[`apps/api/api/services/privacy/privacy-guard.ts`](../apps/api/api/services/privacy/privacy-guard.ts) runs on the final body of every model request (chat, tool loops, streams, web research, image, video, speech), after all option merges:

1. the processor must be in the registry and accept the data level;
2. the declared purpose must allow that level without consent;
3. for OpenRouter, `provider.data_collection` is set to `"deny"` last, over whatever the caller set. It cannot be relaxed: `OPENROUTER_DATA_COLLECTION` is ignored.

`OPENROUTER_ZDR=on` additionally restricts routing to zero-data-retention endpoints (fewer hosts, less resilience). AppGen applies the same policy in `apps/appgen/apps/we-dev-next/src/services/aiService.ts`.

Before 18 November 2026 the policy lived in a provider default that was spread shallowly with each call's options, so any caller setting its own `provider` (the creative orchestrator always did) silently dropped it.

The guard decides from declared metadata, never from prompt content, and logs nothing about the prompt.

Adding a model call: send the body through `guardModelRequest(...)`. `check:privacy` scans the API sources and fails on an unguarded send.

## Processors

| Processor | Role | Max level | Notes |
|---|---|---|---|
| OpenRouter and its hosts | All models | L2 | `data_collection: deny` on every request |
| IDEM self-hosted inference | Models on our machines | L2 | Request logging must stay off |
| Supabase GoTrue, MinIO, MongoDB, Postgres, Redis | Auth, files, data | L3 | Self-hosted |
| pawaPay | Mobile money | L3 | |
| SMTP provider | Transactional e-mail | L1 | Contract to obtain |
| Meta (WhatsApp, Facebook), LinkedIn, X | Messages and publishing chosen by the user | L1 / L0 | |
| GitHub | Repositories the user connects | L2 | |
| Pexels | Stock photos (keywords only) | L1 | |
| Domain registrar | Domain purchase (WHOIS data) | L1 | |
| Google Analytics 4 | Public landing site only | L1 | |

Each entry records retention, training use, contract status and the date it was last checked.

## Logs

The shared log format (`config/log-format.ts`, identical in every back end) redacts:

- secrets, tokens, cookies: removed;
- e-mail addresses: domain only; phone numbers: last two digits; names: length only;
- free text (`*description`, `prompt`, `messages`, `result`, `output`, `transcript`…): first 80 characters;
- business documents (`analysisResultModel`, `businessPlan`, `sections`, `chat`, `revisions`, `project`…) and any content passed as an object or array: replaced by their shape (`[contenu métier : 12 clés]`).

Never pass a whole project, request body or model output to the logger. Log identifiers, counts and durations.

## Encryption

| Where | How | State |
|---|---|---|
| Browser ↔ IDEM | HTTPS (Let's Encrypt), HSTS from `helmet` | done |
| Services ↔ databases | Same host (`localhost`, Docker network): nothing crosses a network | done; TLS required the day a database moves to another machine |
| IDEM ↔ processors | HTTPS | done |
| User secrets in the database | AES-256-GCM, `apps/api/api/utils/crypto.util.ts`, an AAD per use (one account's value cannot be decrypted as another's) | GitHub tokens (since 18 Nov 2026, prefix `enc:v1:`), social tokens, WhatsApp phones, payment phones, deployment variables |
| Session refresh tokens | Hashed | done |
| Backups leaving the server | `age` for a public key; the private key is kept offline ([infra/backup](../infra/backup/README.md#encryption)) | done once `BACKUP_AGE_RECIPIENT` is set; until then each run logs `backup.unencrypted` |
| Databases and files on disk | Disk encryption of the host (LUKS) | to check on the server: MongoDB Community and MinIO without KMS do not encrypt by themselves |

The key is `SENSITIVE_VARS_ENCRYPTION_KEY` (required in production; the built-in development key is refused when `NODE_ENV=production`).

**Rotating the key**

1. Put the new key in `SENSITIVE_VARS_ENCRYPTION_KEY`, the old one in `SENSITIVE_VARS_ENCRYPTION_KEY_PREVIOUS` and in `SENSITIVE_VARS_HASH_SALT` (keeps phone look-ups working), restart.
2. `npm run privacy:reencrypt` (report), then `npm run privacy:reencrypt -- --apply`.
3. When the report shows nothing under the old key, remove `SENSITIVE_VARS_ENCRYPTION_KEY_PREVIOUS`.

Deployment variables use their own copy of the code (`DeploymentService`) and do not follow this rotation yet.

The same script encrypts GitHub tokens stored in clear before 18 November 2026: run it once after deploying.

## Admin access

`idem-admin` stores an audit entry in `admin_audit_log` (kept one year, TTL index) for every write and every read of user content: project details, sections, chat, revisions, user profile, user export. Entries hold the admin, the path, the target user or project, the status and an optional reason sent as `X-Admin-Reason`. Request and response bodies are not stored. Super admins can read the log at `GET /admin/audit-log`.

## Retention

| Data | Rule |
|---|---|
| Account | Erased 180 days after the deletion request (signing in again during the grace period cancels it) |
| Projects | "Delete" archives the project; 30 days later (`PROJECT_PURGE_AFTER_DAYS`) it is erased with its revisions, chats, generations and files |
| Usage metadata | Kept, detached from the account and the project when they are erased |
| Payments, invoices, ledger | 10 years (accounting obligation), kept after account deletion with e-mail and phone removed |
| Consent records | Account lifetime + 5 years |
| Logs | Size-based rotation; Loki per its config |
| Backups | 14 days (`RETENTION_DAYS`), so an erased account leaves the backups within 14 days |
| Admin audit | 1 year |

## Erasure

[`apps/api/api/services/privacy/data-lifecycle.service.ts`](../apps/api/api/services/privacy/data-lifecycle.service.ts) runs every hour (billing scheduler, one instance at a time) and executes what the retention table promises.

- **Discovery, not a list.** Every collection of the database is swept with the subject's identifiers (`userId`, `uid`, `ownerId`, `projectId`, `brandId`, `_id`, and the e-mail address for lists kept by address). A collection added later is covered without changing this code. What must survive is declared: accounting proofs (`RETAINED_COLLECTIONS`, contact fields removed), usage metadata (`ANONYMIZED_COLLECTIONS`, detached) and platform data (`UNTOUCHED_COLLECTIONS`).
- **Everything else**: MinIO prefixes `users/<uid>/` and `projects/<id>/`, Redis keys holding the identifier as a whole segment, the GoTrue account.
- **Verified.** After erasing, the job counts again. The account or project document is erased last, only when nothing remains; otherwise the report is `incomplete` (logged as an error) and the next run resumes.
- **Proof.** Each run writes a report to `data_purge_reports`: what was erased, kept and detached, per collection.
- **Not automatic:** running iDeploy applications, databases and servers are counted in the report and removed by the team.

`DATA_PURGE_MODE`: `dry-run` (default: reports only, nothing is touched), `enforce`, `off`. Manual runs: `npm run privacy:purge -- --due | --user <uid> | --project <uid>:<projectId> [--now] [--apply]`.

## The published texts

The public texts match this page, and the code checks that they do.

| Text | Address | What it adds |
|---|---|---|
| Privacy policy | `/privacy-policy` | The whole of this page, written for a reader: controller, purposes and legal bases, the four levels, what we never do, the AI detail, recipients, transfers, retention, rights, erasure, the 13 countries served and their authority |
| Terms of service | `/terms-of-service` | The contract. Replaces the version that still carried `[Jurisdiction]` and `[Arbitration Organization]` in production |
| Cookies and trackers | `/cookie-policy` | Every cookie by name, and how to refuse the landing's audience measurement — which is not preceded by a consent screen, as stated |
| Sub-processors | `/subprocessors` | The `PROCESSORS` registry, published |
| Per-service addenda | `/privacy/{icode,ideploy,ivision,idomain,simulator}`, `/terms/{icode,ideploy,ivision,idomain}` | What one service does that the others do not: a GitHub token, a surveyed site, a visitor's IP seen by the firewall, a voice, WHOIS data, an imported business plan |

They are written once, in both languages, in `apps/landing/src/app/shared/legal/`
and rendered by one page. The registry of what exists and where
(`packages/shared-footer/src/legal.ts`) is read by the six applications' footers,
so a text cannot be reachable from one application and not another.

`npm run check:legal` fails if a declared document has no content, if a content
is not declared, if a path has no route, if it is missing from the sitemap, or —
the one that matters most — if a processor in `data-governance.ts` is not
published on the sub-processors page.

## Not implemented yet

- Self-service data export (requests go to `legal@idem.africa` and are answered by hand).
- Consent and preference centre (only needed once `AI_RESEARCH` or `MARKETING` is enabled).
- Admin MFA, and a required reason before reading project content.
- A dedicated `privacy@` alias: privacy requests currently go to `legal@idem.africa`.
- The company's RCCM number and postal address, which the policy names only as "IDEM S.A.S., Douala, Cameroon".

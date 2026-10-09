# Observability — logs, Grafana and alerts

The back ends (`idem-api`, `ideploy-api`, `appgen`, `ivision-api`) write one JSON line per event. Grafana Alloy ships those lines to Loki, Grafana displays them, and Grafana e-mails the team when something critical happens.

This document covers the whole process: the log format, how to write logs, how to debug with Grafana, what to do when an alert arrives, and how the stack runs in production.

```
                       local                                    production
┌──────────────┐  logs/combined.log   ┌───────┐        stdout (Docker)          ┌───────┐
│ idem-api     │ ───────────────────► │       │ ◄────────────────────────────── │       │
│ ideploy-api  │ ───────────────────► │ Alloy │ ──► Loki ──► Grafana ──► SMTP ──► e-mail
│ appgen       │ ───────────────────► │       │                                 │       │
│ ivision-api  │ ───────────────────► │       │                                 │       │
└──────────────┘                      └───────┘                                 └───────┘
```

| What | Where |
| --- | --- |
| Log format (identical copies, checked by CI) | `apps/api/api/config/log-format.ts`, `apps/ideploy-api/api/config/log-format.ts`, `apps/appgen/apps/we-dev-next/src/config/log-format.ts`, `apps/ivision/api/src/config/log-format.ts` |
| Logger of each service | `config/logger.ts` in each service |
| Request context (`requestId`, user, job) | `utils/trace.util.ts` (api, ideploy-api, ivision-api), `src/utils/trace.ts` (appgen) |
| HTTP logging | `middleware/request-trace.middleware.ts` (api, ideploy-api, ivision-api), `src/middleware/requestTrace.ts` (appgen) |
| Local stack | `infra/observability/docker-compose.yml` |
| Production stack | `infra/observability/docker-compose.prod.yml` |
| Collection | `infra/observability/alloy/config.alloy` (files, local), `config.prod.alloy` (Docker stdout, production) |
| Dashboard | `infra/observability/grafana/dashboards/idem-logs.json` |
| Alert rules, e-mail, routing | `infra/observability/grafana/provisioning/alerting/` |

## 1. The log line

Every line, in every service, has the same shape:

```json
{
  "timestamp": "2026-09-30T15:21:21.667Z",
  "level": "error",
  "message": "payment.fulfillment_failed",
  "event": "payment.fulfillment_failed",
  "alert": "critical",
  "service": "idem-api",
  "environment": "production",
  "version": "1.0.0",
  "host": "3f2a9c1d7e44",
  "pid": 1,
  "requestId": "0b6c7f2e-…",
  "userId": "u_…",
  "projectId": "p_…",
  "transactionId": "tx_…",
  "error": {
    "type": "MongoServerError",
    "message": "write conflict",
    "code": 112,
    "stack": "MongoServerError: write conflict\n    at …",
    "cause": { "type": "…", "message": "…" },
    "upstream": { "status": 502, "method": "POST", "url": "https://api.pawapay.io/deposits", "body": { "…": "…" } }
  }
}
```

| Field | Present | Meaning |
| --- | --- | --- |
| `timestamp` | always | ISO 8601, UTC, milliseconds |
| `level` | always | `error`, `warn`, `info`, `http`, `debug` |
| `message` | always | human-readable text; for structured events, the event name |
| `service`, `environment`, `version`, `host`, `pid` | always | which process wrote the line (`version` comes from `APP_VERSION`, otherwise the package version) |
| `event` | almost always | dotted, stable name that classifies the line: `http.request_end`, `payment.fulfilled`, `job.failed`, `chat.model_call`, `console`… |
| `requestId` | inside a request or a job | same value from the first to the last line of a request, **across services** and into iDeploy workers |
| `userId`, `projectId` (api, appgen), `teamId`, `queue`, `jobId`, `jobName` (ideploy-api), `job` (api) | when known | added automatically from the request context |
| `error` | on errors | always a serialised object, whatever way the error was passed |
| `alert` | rarely | `"critical"` sends an e-mail at once (see [Alerts](#5-alerts)) |

What the format guarantees, whatever the call site:

- **No lost error.** `logger.error('x', err)`, `logger.error('x', { error })`, `logger.error(err)` and `console.error('x', err)` all produce the same `error` object: type, message, code, HTTP status, stack (25 lines), `cause` chain, and for a failed outgoing HTTP call (axios) the upstream status, method, URL and response body.
- **No secret.** Values of keys such as `password`, `token`, `authorization`, `cookie`, `apiKey`, `secret`, `accessToken`, `refreshToken`, `privateKey`, `otp`, `cvv` become `[REDACTED]`, at any depth. Phone numbers (`phone`, `phoneNumber`, `msisdn`) keep their last two digits only. Numbers are never redacted (`inputTokens` is a counter).
- **Bounded lines.** Strings are cut at 4,000 characters, objects at 6 levels and 100 keys, arrays at 50 items, and the whole line at 64 KB: above that, the heaviest fields are replaced by a preview. Loki rejects lines above 256 KB.
- **Nothing escapes.** Remaining `console.log/warn/error` calls go through the logger (`event: "console"`) with the request context. Process crashes are logged before the process dies.

### What is logged automatically

| Event | Service | Content |
| --- | --- | --- |
| `http.request_start`, `http.request_end` | all | method, path, route pattern (`/project/:projectId/branding`), status, duration, IP, user agent, request and response sizes. Level `error` for 5xx, `warn` for 4xx. `/health` and `/metrics` are logged at `debug` unless they fail |
| `http.request_aborted` | all | the client left before the response (closed tab, SSE stream cut, proxy timeout) |
| `http.unhandled_error` | all | error that reached the global Express handler, with its stack |
| `process.start`, `process.shutdown` | all | port, Node version, log level, signal, uptime |
| `process.uncaught_exception`, `process.unhandled_rejection` | all | **critical** |
| `startup.mongodb_failed`, `startup.storage_failed`, `startup.failed` | idem-api | **critical** |
| `payment.*` | idem-api | every step of a payment; `payment.fulfillment_failed`, `payment.refund_failed`, `payment.signature_rejected` are **critical** |
| `billing.job_failed`, `billing.job_done` | idem-api | scheduled billing jobs; each run has its own `requestId` and a `job` field |
| `ai.*`, `chronicle.*`, `coherence.*`, `advisor.*` | idem-api | AI decisions, see [apps/api/docs/TRACING.md](../apps/api/docs/TRACING.md) |
| `http.audit` | idem-api | sensitive routes (`/auth`, `/admin`, `/github`) |
| `job.started`, `job.completed`, `job.retry`, `job.failed`, `job.stalled`, `job.worker_error` | ideploy-api | every BullMQ job: attempt, duration, time spent waiting; `job.failed` only once all attempts are used |
| `auth.error` | ideploy-api | session or token verification failed on an infrastructure error |
| `chat.*` | appgen | every generation step (`ChatLogger`: `chat.model_call`, `chat.step_end`…) |
| `auth.idem_api_unreachable`, `auth.idem_api_error` | appgen | the central API does not answer: every AppGen user gets a 401 |

The API also keeps local copies filtered by topic: `logs/ai-trace.log` (AI and HTTP events) and `logs/payments.log` (payments, billing, e-mails, beta; longer retention). They are **not** shipped: every line they hold is already in `combined.log`.

## 2. Writing logs

```ts
import logger, { logCritical } from '../config/logger';

logger.info('Project exported', { event: 'project.exported', projectId, format: 'pdf', durationMs });
logger.warn('Logo import fell back to text', { event: 'brand.logo_fallback', projectId, reason });
logger.error('PDF export failed', { event: 'project.export_failed', projectId, error });

// Only when someone must act now:
logCritical('payment.fulfillment_failed', { transactionId, depositId, error });
```

In AppGen, keep using `ChatLogger.info(step, message, data)`; the step becomes the event `chat.<step>`.

Rules:

1. **Give an `event`.** Dotted, lower case, stable: `<domain>.<what_happened>`. It is what Grafana filters and counts; changing it breaks queries and alerts.
2. **Put the error in `error`**, the object itself, not `error.message`. The format extracts everything useful.
3. **Prefer named fields to sentences.** `{ projectId, durationMs }` can be filtered and aggregated; `"project p_42 took 1200ms"` cannot.
4. **Never log a full request body, a document or a prompt.** Log an identifier, a size or a preview (`previewValue()` in `apps/api/api/utils/ai-trace.util.ts`).
5. **Pick the level for the reader at 3 a.m.** `error`: something failed and a user or the business is affected. `warn`: unexpected but handled. `info`: a step of a flow. `debug`: detail only useful while developing.
6. **`logCritical` is for money, data or the whole service.** A customer paid and got nothing, a callback signature is invalid, the database is unreachable, the process crashed. A single failed generation or a deployment broken by the customer's code is not critical. Every critical line sends an e-mail.

You never need to pass `requestId`, `userId`, `projectId` or `jobId`: the request context adds them. When code learns the project a request is about, call `setTraceProjectId(projectId)` (api, appgen) so every following line carries it.

### Correlation across services

- Every HTTP response carries an `X-Request-Id` header. An incoming `X-Request-Id` (from another IDEM service) is reused when it looks sane (8–80 characters, `[A-Za-z0-9._-]`); otherwise a new UUID is generated.
- Outgoing calls between services forward it: AppGen → API (`/auth/me`, `/billing/consume`), iDeploy → API (`/auth/profile`), API → AppGen (`/api/design/forge`). When you add a call to another IDEM service, spread `traceHeaders()` into its headers.
- iDeploy jobs: `queue.add()` stores the current `requestId` in the job data (`__trace`), and the worker restores it. The logs of a deployment carry the `requestId` of the click that started it.
- Background jobs without a request (API billing scheduler) get their own id, `job-<uuid>`, through `runJobWithTrace(name, fn)`.

### Configuration

Environment variables read by each service:

| Variable | Default | Effect |
| --- | --- | --- |
| `LOG_LEVEL` | `info` | `debug` also shows health probes, billing job runs and 404s of iDeploy |
| `LOG_FORMAT` | `json` when `NODE_ENV=production`, `pretty` otherwise | console output: one JSON line, or readable text with the stack under the line |
| `LOG_DIR` | `logs` | directory of the log files |
| `LOG_MAX_STRING` | `4000` | longest string kept in a field |
| `LOG_MAX_LINE` | `64000` | longest line; heavier fields are reduced to a preview |
| `LOG_HTTP_ERROR_BODY` | `false` | adds the (redacted) request body to `http.request_end` for 4xx/5xx; for a short debugging session only |
| `APP_VERSION` | package version | written in every line; set it to the deployed commit to tell releases apart |

## 3. Local stack

```bash
npm run obs:up      # Loki, Alloy, Grafana, Mailpit
npm run obs:demo    # demo traffic + one critical incident
npm run obs:down
```

| Tool | URL | Use |
| --- | --- | --- |
| Grafana | http://localhost:3300 (admin / admin) | dashboard **IDEM · Journaux**, Explore, alerts |
| Mailpit | http://localhost:8025 | receives the alert e-mails sent locally |
| Alloy | http://localhost:12345 | collection status |

Grafana runs on 3300 because AppGen uses 3000. Start the services as usual (`npm run dev:api`, `npm run dev:ideploy-api`, `npm run dev:appgen-next`): Alloy reads their `logs/combined.log` and their lines appear within seconds. `docker-compose.dev.yml` mounts the same directories, so containers work the same way.

`infra/observability/scripts/emit-test-logs.mjs` writes demo lines to `infra/observability/test-logs/` without starting any service:

```bash
node infra/observability/scripts/emit-test-logs.mjs                # 2 minutes of traffic
node infra/observability/scripts/emit-test-logs.mjs --critical     # + an unfulfilled payment → e-mail
node infra/observability/scripts/emit-test-logs.mjs --burst-5xx    # + ten 5xx → e-mail
```

Alert e-mails reach Mailpit within about a minute. `docker compose down -v` in `infra/observability` wipes everything.

## 4. Debugging with Grafana

The home dashboard, **IDEM · Journaux**, has filters for service, environment, level, `requestId` and free text, and these panels: requests, error lines, 5xx rate, p95 latency, critical events, failed iDeploy jobs; log volume by level; requests by status class; errors per service; p50/p95 latency per service; most frequent errors (service, event, error type, message); slowest routes; critical events; filtered logs.

**A user reports an error.** Get the `requestId`: the `X-Request-Id` response header (browser network tab), or the alert e-mail. Paste it in the `requestId` filter: every line of that request, in every service, in order. In Explore, clicking a `requestId` inside a line does the same ("Suivre cette requête").

**"It has been broken since this morning."** Set the time range, look at *Errors per service* for the start of the problem and at *Most frequent errors* for its cause, then filter the logs on that event.

**A payment.** Search the transaction in Explore, then compare with its timeline in the admin panel:

```logql
{service="idem-api"} | json | transactionId="tx_…" or depositId="dep_…"
```

**Useful queries (Explore, data source Loki):**

```logql
# Everything a request did, all services
{service=~".+"} | request_id="<requestId>"

# One user's errors
{service=~".+", level="error"} | json | userId="<uid>"

# Failed deployments and why
{service="ideploy-api"} | json | event="job.failed" | line_format "{{.jobId}} {{.error_message}}"

# Errors from one upstream provider
{service=~".+", level="error"} | json | error_upstream_url=~".*pawapay.*"

# p95 latency per route
quantile_over_time(0.95, {service="idem-api"} | json | event="http.request_end" | unwrap durationMs [5m]) by (route)
```

Loki labels: `service`, `env`, `level` (and `container` in production). `request_id` is structured metadata: filtering on it does not decode the lines. Everything else is inside the JSON line and is extracted with `| json`; nested fields are flattened with `_`: `error_message`, `error_type`, `error_upstream_status`.

## 5. Alerts

Rules, routing and the e-mail template are provisioned from `infra/observability/grafana/provisioning/alerting/` and cannot be edited in the Grafana UI: change the files and restart Grafana. Rules are evaluated every minute on Loki.

| Rule | Severity | Fires when |
| --- | --- | --- |
| Événement critique | critical | any line with `alert="critical"` in the last 5 minutes; one alert per service, event, `requestId` and error message |
| Erreurs serveur (5xx) | critical | more than 5 responses 5xx in 5 minutes on one service |
| Erreur sur un paiement | critical | an `error` line `payment.*` or `billing.*` in 10 minutes (critical payment events are covered by the first rule) |
| AppGen ne joint plus l'API | critical | more than 3 failed session checks from AppGen to the API in 5 minutes |
| Pic d'erreurs | warning | more than 30 error lines in 10 minutes on one service |
| Déploiements en échec | warning | more than 3 iDeploy jobs failed for good in 15 minutes |

Routing (`policies.yaml`): **critical** alerts are e-mailed within about 10 seconds of firing, one e-mail per rule, environment, service and event, repeated every hour while they last, followed by a resolution e-mail. **Warnings** are grouped over 5 minutes and repeated every 12 hours. If Loki cannot be queried, Grafana sends a `DatasourceError` alert.

The e-mail gives the environment, service, event, error message, `requestId`, a link that opens the dashboard filtered on that request, and a link to the rule. Recipients: `ALERT_EMAIL_TO` (several addresses separated by `;`).

### What to do when an alert arrives

| Alert | First checks |
| --- | --- |
| Événement critique · `payment.fulfillment_failed` | The customer paid and got nothing. Open the transaction timeline in the admin panel; replay the fulfilment or credit the customer by hand. Then find the cause through the `requestId` link. |
| Événement critique · `payment.signature_rejected` | Either the pawaPay signing key is misconfigured (all callbacks rejected: check the secret) or someone forges callbacks (a few rejections from unknown IPs). Payments are not credited while it lasts; the reconciler catches up once fixed. |
| Événement critique · `payment.refund_failed` | Refund blocked at pawaPay. Check its status in the pawaPay dashboard and retry from the admin panel. |
| Événement critique · `startup.*` | The API started without MongoDB (and exited) or without object storage. Check the database/MinIO containers and credentials, then restart the API. |
| Événement critique · `process.*` | A crash. The stack is in the e-mail's `requestId` link. `unhandled_rejection` makes the API and iDeploy exit, `uncaught_exception` makes AppGen exit; Docker restarts them according to their restart policy. Look for a restart loop: `docker ps` shows the uptime. |
| Erreurs serveur (5xx) | Dashboard, filter the service and level `error`: *Most frequent errors* names the cause. Common causes: a dependency down (database, Redis, AI provider), a bad deployment (compare with the deploy time; roll back if needed, see [Deployment](DEPLOYMENT.md)). |
| Erreur sur un paiement | Filter `event=~"payment.*"`: a pawaPay error (`pawapay_error`, with the upstream status) or a billing job failure (`billing.job_failed`). Check the pawaPay status page and the admin panel. |
| AppGen ne joint plus l'API | `curl https://api.idem.africa/health` from the server; check `IDEM_API_URL` in AppGen's environment; check that the API container is up. |
| Pic d'erreurs | Same as 5xx. If the errors are all the same `event: "console"` line, it is noise from a library: turn it into a real event or lower its level. |
| Déploiements en échec | Filter `event="job.failed"`: a customer's build error repeated by several teams is unusual; SSH timeouts, Docker or Redis errors point at the infrastructure. |

When an alert is noisy for a known reason, silence it in Grafana (Alerting → Silences) for a set time rather than editing the rule.

### Adding or changing a rule

Edit `rules.yaml` (queries are LogQL, `sum by (env, service, …)` so that the e-mail shows where it happens), test the query in Explore, then `docker compose restart grafana` (local) or the production command below. Keep critical rules for situations where somebody must act now; everything else belongs on the dashboard.

## 6. Production

### How it works

The production server runs the application containers from `/root/application/docker-compose.prod.yml` and keeps a checkout of this repository in `/root/idem`, updated by every deploy workflow (see [Deployment](DEPLOYMENT.md)). The observability stack runs next to them from that checkout, with `infra/observability/docker-compose.prod.yml`:

| Container | Role | Exposed |
| --- | --- | --- |
| `idem-obs-loki` | stores logs, 30 days | no (internal network only) |
| `idem-obs-alloy` | reads the **stdout** of `idem-api`, `ideploy-api`, `appgen-server` (and their `-staging` twins) through the Docker socket | status page on `127.0.0.1:12345` |
| `idem-obs-grafana` | dashboard and alerts, sends e-mails over SMTP | `127.0.0.1:3300`, published over HTTPS by the reverse proxy |

Why stdout and not the log files: in production the services print JSON on stdout (`NODE_ENV=production`), and their `logs/` directory lives inside the container, which is replaced on every deployment. Docker keeps stdout; Alloy reads it with no change to the application Compose file and no shared volume. Lines that are not JSON (an npm banner, a crash before the logger loads) are kept with `level="unknown"`.

The stack is independent from the applications: stopping it loses no application log (Docker keeps them) and restarting it resumes where Alloy stopped.

### Prerequisites

- A DNS name for Grafana pointing at the server, for example `monitoring.idem.africa`, and a TLS certificate for it.
- An SMTP account allowed to send from `ALERT_EMAIL_FROM` (SPF/DKIM aligned with the domain), with STARTTLS.
- Disk: Loki compresses well; count a few GB for 30 days at the current traffic, and watch it the first week (`docker system df -v | grep loki_data`).
- **Docker log rotation.** Docker keeps container stdout in `/var/lib/docker/containers/*/*-json.log`, without limit by default. Now that the services log every request in JSON, set a limit for all containers in `/etc/docker/daemon.json`:

  ```json
  { "log-driver": "json-file", "log-opts": { "max-size": "50m", "max-file": "5" } }
  ```

  then `systemctl restart docker` (restarts every container: do it in a maintenance window) — or add the same `logging:` block to each service of `/root/application/docker-compose.prod.yml`. Alloy has already shipped the lines to Loki; the Docker files are only a buffer.

### First installation

On the server, as the user that runs the deployments:

```bash
# 0. What is already running? An older monitoring stack (idem-admin,
#    docker-compose.monitoring.yml: idem-grafana, idem-loki, idem-promtail…)
#    must not keep shipping these logs, see "Known gaps".
docker ps --format '{{.Names}}\t{{.Ports}}' | grep -Ei 'grafana|loki|promtail|alloy|tempo'

# 1. The application code must be deployed (merge to main): check that each
#    service prints JSON lines.
docker logs --tail 3 idem-api
docker logs --tail 3 ideploy-api
docker logs --tail 3 appgen-server

# 2. Configuration (never committed).
cd /root/idem && git pull
cd infra/observability
cp .env.prod.example .env.prod && chmod 600 .env.prod
vi .env.prod          # GRAFANA_ROOT_URL, GRAFANA_ADMIN_PASSWORD, ALERT_EMAIL_TO, SMTP_*

# 3. Start.
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
```

If port 3300 is taken (the older stack published Tempo on 3300), set `GRAFANA_PORT` in `.env.prod`.

4\. **Publish Grafana over HTTPS.** Example for nginx with a certbot certificate; adapt to the reverse proxy of the server:

```nginx
server {
    listen 443 ssl http2;
    server_name monitoring.idem.africa;

    ssl_certificate     /etc/letsencrypt/live/monitoring.idem.africa/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/monitoring.idem.africa/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3300;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Grafana Live (real-time panels) uses a WebSocket.
    location /api/live/ {
        proxy_pass http://127.0.0.1:3300;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

5\. **Verify**, in this order:

```bash
# Alloy sees the three containers (SSH tunnel: ssh -L 12345:127.0.0.1:12345 <server>,
# then http://localhost:12345 → loki.source.docker.idem → targets).
docker logs idem-obs-alloy 2>&1 | grep -i error | tail

# Loki receives the three services.
docker exec idem-obs-grafana wget -qO- 'http://loki:3100/loki/api/v1/label/service/values'
```

- Open `GRAFANA_ROOT_URL`, log in with the admin account; the **IDEM · Journaux** dashboard shows data for the three services.
- Alerting → Contact points → `idem-email` → **Test**: the e-mail must arrive in `ALERT_EMAIL_TO`. If not, `docker logs idem-obs-grafana | grep -i smtp`.
- Alerting → Alert rules: six rules in folder IDEM, state *Normal*.
- Call any API route with a header `X-Request-Id: prod-check-0001` and find the request in the dashboard with that `requestId`.

6\. **Accounts.** Create one Grafana account per person (Administration → Users), role *Viewer* or *Editor*; keep the admin password in the team's password manager, not in daily use.

### Updating

Every deploy workflow runs `git pull` in `/root/idem`, so the files of `infra/observability` are current on the server, but the running stack does not reload them by itself:

| Change | Apply with |
| --- | --- |
| dashboard (`grafana/dashboards/*.json`) | nothing: Grafana reloads it within 30 seconds |
| alert rules, contact point, template, routing (`grafana/provisioning/alerting/`) | `docker compose -f docker-compose.prod.yml --env-file .env.prod restart grafana` |
| `alloy/config.prod.alloy` | `… restart alloy` |
| `loki/loki.yaml` | `… restart loki` (Alloy buffers and retries meanwhile) |
| image versions, `docker-compose.prod.yml`, `.env.prod` | `… up -d` |

Upgrade images one at a time, after reading their release notes; Loki and Grafana migrate their storage on start.

### Operating

- **Retention:** 30 days (`retention_period` in `loki/loki.yaml`). Payment disputes arrive weeks later; lower it only if disk requires.
- **Backups:** not needed for Grafana (dashboards, rules and data sources are provisioned from git; only user accounts and silences live in `grafana_data`). Loki data is only worth backing up if logs have legal value.
- **Disk:** `docker system df -v` shows the size of `idem-observability_loki_data`.
- **Staging** runs on the same server: its containers are collected too, with `env="staging"`, and its alerts are e-mailed with `(staging)` in the subject. To mute staging, add a route with `object_matchers: [['env', '=', 'staging']]` and a mute timing in `policies.yaml`.
- **Turning it off:** `docker compose -f docker-compose.prod.yml --env-file .env.prod down`. The applications are not affected; `docker logs` still works.

### Known gaps

- CI does not set `APP_VERSION`: every line shows the package version (`1.0.0`). Passing the commit (`--build-arg` in the deploy workflows, `ARG`/`ENV APP_VERSION` in `Dockerfile/prod/*`) would tie each line to a release.
- The monitoring stack in the `idem-admin` repository (`docker-compose.monitoring.yml`: Prometheus, Loki, Promtail, Tempo, Alertmanager) was written for development. Its Promtail replaces each JSON line with its `message` field (`output` stage), which throws away `requestId`, `error` and every other field. It must not ship these services' logs; its Prometheus metrics and alerts can be connected to this Grafana as an extra data source instead.
- The log files inside production containers are lost at each deployment; only stdout is kept.
- `log-format.ts` exists in three copies because each service is compiled on its own; the `security.yml` workflow fails if they differ.

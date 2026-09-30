# Observability stack

Loki, Grafana Alloy and Grafana for the logs of `idem-api`, `ideploy-api` and `appgen`, with alert e-mails. The full documentation — log format, writing logs, debugging, alert runbook, production procedure — is in [docs/OBSERVABILITY.md](../../docs/OBSERVABILITY.md).

## Local

```bash
npm run obs:up      # from the repository root
npm run obs:demo    # demo traffic + one critical incident
npm run obs:down
```

Grafana http://localhost:3300 (admin / admin) · Mailpit http://localhost:8025 (alert e-mails) · Alloy http://localhost:12345.

## Production

```bash
cp .env.prod.example .env.prod && chmod 600 .env.prod   # then fill it in
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

Prerequisites, reverse proxy, verification and updates: [docs/OBSERVABILITY.md#6-production](../../docs/OBSERVABILITY.md#6-production).

## Files

| File | Role |
| --- | --- |
| `docker-compose.yml` | local stack: Loki, Alloy (reads `apps/*/logs/combined.log`), Grafana, Mailpit |
| `docker-compose.prod.yml` | production stack: Loki, Alloy (reads container stdout), Grafana; SMTP from `.env.prod` |
| `.env.example`, `.env.prod.example` | settings; the real `.env` / `.env.prod` are never committed |
| `loki/loki.yaml` | storage, 30-day retention, line size limits |
| `alloy/config.alloy`, `alloy/config.prod.alloy` | collection: JSON parsing, labels `service`, `env`, `level`, metadata `request_id` |
| `grafana/provisioning/datasources/loki.yaml` | Loki data source; a `requestId` in a line links to all lines of that request |
| `grafana/provisioning/dashboards/`, `grafana/dashboards/idem-logs.json` | the **IDEM · Journaux** dashboard |
| `grafana/provisioning/alerting/` | alert rules, e-mail contact point and template, routing |
| `scripts/emit-test-logs.mjs` | demo log lines written to `test-logs/`, to test without running the services |

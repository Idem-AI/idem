# Mobile Money collection (pawaPay)

This document describes the payment collection chain: what it guarantees, how it fails, and how to find a transaction when a customer calls.

The business model and the catalogue are described in [BILLING.md](./BILLING.md).

## What the system guarantees

1. **No payment is lost.** The transaction is written to the database, with its `depositId`, **before** the first call to pawaPay. A network cut in the middle of initiation therefore never creates a ghost payment: its status is re-read with the same identifier.
2. **Nothing is delivered on the word of a callback.** A callback says "go and look"; only the answer of `GET /deposits/{id}` is authoritative.
3. **Nothing is delivered twice.** Three locks, from nearest to furthest: the conditional `fulfillment.state` transition, the unique index `one_purchase_per_payment`, and callback idempotency.
4. **A collected payment always ends up delivered**, or the incident becomes visible: reconciliation retries, and the `payment_fulfillment_failures_total` metric alerts.
5. **Everything is traced.** Each step produces an event in the database, a log line correlated by `requestId`, and a metric.

## The nominal path

```
User                 IDEM API                    pawaPay              Operator
    │                    │                          │                     │
    ├─ POST /billing/checkout                       │                     │
    │                    ├─ price computed on the server                  │
    │                    ├─ predict-provider ──────▶│                     │
    │                    ├─ active-conf ───────────▶│  (operator open?)   │
    │                    ├─ transaction CREATED in the database           │
    │                    ├─ POST /deposits ────────▶├─ request ──────────▶│
    │◀─ 202 { reference } │                          │                     │
    │                    │                          │          PIN ◀──────┤
    │  (waiting screen)  │                          │                     │
    │                    │◀─ callback ──────────────┤◀────────────────────┤
    │                    ├─ GET /deposits/{id} ────▶│                     │
    │                    ├─ delivery (credits, subscription, invoice)     │
    ├─ GET /billing/payments/{reference} ─▶ COMPLETED                     │
```

If the callback does not arrive — a frequent case — the reconciler re-reads the status after 30 s, then 1, 2, 5, 10 minutes, then every 30 minutes up to 24 h. The path ends the same way, just later.

## Statuses

| Status | Meaning | Next |
| --- | --- | --- |
| `CREATED` | Written on our side, not yet submitted | Re-read in 15 s if the call failed |
| `ACCEPTED` | pawaPay took the request; the subscriber must confirm | Scheduled re-read |
| `SUBMITTED` / `PROCESSING` | At the operator | Scheduled re-read |
| `IN_RECONCILIATION` | pawaPay is checking on its side | Nothing to do |
| `COMPLETED` | Collected | Delivery |
| `FAILED` | Failure after acceptance | Explained failure message |
| `REJECTED` | Refused at initiation | Explained failure message |
| `NOT_FOUND` | Never reached pawaPay (after 15 min of grace) | Failure |
| `EXPIRED` | No final status after 24 h | Failure, alert |

**`NOT_FOUND` is not an immediate failure.** pawaPay can answer this a few seconds after initiation, while the transaction propagates: concluding at once would show a failure to a subscriber who is typing their PIN.

## Callback security

The `/billing/webhooks/pawapay/deposits` endpoint is not authenticated — pawaPay cannot carry our session. Three protections replace it:

| Layer | Role | Setting |
| --- | --- | --- |
| IP allow list | Discards noise before parsing | `PAWAPAY_CALLBACK_IPS` |
| RFC 9421 signature | Proves origin and integrity | `PAWAPAY_CALLBACK_SIGNATURE` |
| Status re-read | Last-resort guarantee | — always on |

The third is why `PAWAPAY_CALLBACK_SIGNATURE=log` is acceptable at launch: while signing is not enabled on pawaPay's side, a fake callback can at worst trigger a useless re-read.

Switch to `enforce` **after** enabling signed callbacks in the pawaPay dashboard, and after checking in the logs that `payment.callback_signature_invalid` no longer appears.

## Finding a transaction

Every entry point leads to the same record in the admin panel (**Payments → detail**):

- **the reference** given to the customer (`PAY-2026-09-000123`);
- **the `depositId`** (pawaPay identifier);
- **the operator identifier** (`providerTransactionId`), the one on the subscriber's SMS;
- **the e-mail** of the account;
- **the full phone number** — compared by hash, never stored in clear.

From the command line:

```bash
# The whole life of a payment, in order
grep '"reference":"PAY-2026-09-000123"' logs/payments.log | jq .

# What failed today
grep '"event":"payment.status_changed"' logs/payments.log | jq 'select(.status!="COMPLETED")'
```

In MongoDB:

```js
db.payment_transactions.findOne({ reference: 'PAY-2026-09-000123' })
db.payment_events.find({ depositId: '<depositId>' }).sort({ at: 1 })
db.payment_callbacks_raw.find({ depositId: '<depositId>' })   // the raw callback, replayable
```

## Diagnosis: where it stopped

| Last event | What happened | Action |
| --- | --- | --- |
| `created` only | The call to pawaPay never left | Check `api--PAWAPAY_API_TOKEN` and connectivity |
| `pawapay_error` (undetermined) | No answer received, outcome unknown | Nothing: the re-read will decide |
| `pawapay_response` then silence | The subscriber did not confirm | The final status will come, or it will expire |
| `status_changed` FAILED | Refused by the operator | Read `failureCode`; the user-facing message is already computed |
| `fulfillment_failed` | **Collected but not delivered** | Replay the delivery; this is the most serious incident |
| `callback_received` with nothing after | Processing interrupted | The raw callback is in the database, replayable |

## Admin actions

All go through the internal API (key `INTERNAL_API_KEY`, header `x-api-key`) and are logged:

```bash
# Force a status check
curl -X POST -H "x-api-key: $INTERNAL_API_KEY" \
  https://api.idem.africa/billing/internal/payments/PAY-2026-09-000123/recheck

# Ask pawaPay to send the callback again
curl -X POST -H "x-api-key: $INTERNAL_API_KEY" \
  https://api.idem.africa/billing/internal/payments/PAY-2026-09-000123/resend-callback

# Replay a failed delivery
curl -X POST -H "x-api-key: $INTERNAL_API_KEY" \
  https://api.idem.africa/billing/internal/payments/PAY-2026-09-000123/fulfill

# Refund (reason required)
curl -X POST -H "x-api-key: $INTERNAL_API_KEY" -H 'Content-Type: application/json' \
  -d '{"reason":"Duplicate payment","adminId":"…"}' \
  https://api.idem.africa/billing/internal/payments/PAY-2026-09-000123/refund
```

## Configuration

| Variable | Role |
| --- | --- |
| `PAWAPAY_API_TOKEN` | API token. Missing ⇒ no collection possible. The only pawaPay variable that is a secret: in production it is read from Secret Manager as `api--PAWAPAY_API_TOKEN` |
| `PAWAPAY_ENV` | `sandbox` (default) or `production` |
| `PAWAPAY_CALLBACK_SIGNATURE` | `enforce`, `log` (default) or `off` |
| `PAWAPAY_CALLBACK_IPS` | Override of the allow list (proxy, tunnel) |
| `PAWAPAY_PUBLIC_KEY` | Fallback public key, PEM format |
| `PAYMENTS_ENABLED` | `false` closes the till. Missing or `true`: the database setting decides |
| `IDEPLOY_DB_*` | iDeploy's PostgreSQL database — reading resources, writing the paid plan |

Database settings (`billing_settings`, editable from the admin panel): `paymentsEnabled` (emergency stop), `enforcement`, `graceDays`, `reminderDays`, `enabledCountries`.

**Two emergency stops, on purpose.** The database setting closes the till without redeploying, which is the usual action. `PAYMENTS_ENABLED=false` closes it without depending on MongoDB or the panel — that is, on the day they are the problem. Both go through `billingSettingsService.isPaymentsEnabled()`: reading the raw setting elsewhere would silently bypass the second one.

The allow list of return addresses after payment is not an environment variable: it is coded in `billing-checkout-page.ts`. Widening what protects against an open redirect must cost a deployment and a review, not a `.env` edit.

## Open countries

**Twenty countries**, each with its own price list: see [pricing](BILLING.md#pricing).

The seven franc-zone countries (CMR, CIV, SEN, BEN, BFA, COG, GAB) share the catalogue price: XAF and XOF are at parity, so the displayed price is the price paid, with no conversion. The thirteen others have a price decided market by market, never a conversion: a converted price follows an exchange rate, whereas a price is decided by looking at what people already pay locally.

What we open commercially is one thing; what can collect money right now is another. `paymentCountriesService.available()` crosses both: priced countries, and those `GET /active-conf` declares provisioned. A country without a price list is never offered, and an offer without a local price is refused (`price_unavailable`) rather than sold at a guessed amount.

## What is locked on the server

Disabled buttons in the interface are a convenience; these checks are the guarantee. They live in `middleware/billing.middleware.ts`:

| Check | Where | Effect |
| --- | --- | --- |
| `requireCredits(engine, action)` | 35 generation routes (branding, business plan, pitch deck, forecast, legal kit, communication, cards, diagrams, advisor) | Reserves credits **before** generation and refunds them if it fails |
| `requireProjectAccess()` | `POST /appgen/handoff`, `POST /github/projects/:projectId/push` | Requires a Project Pass or an iCode subscription that includes it — "generating is free, owning is paid" |
| `requireFeature(key)` | exports without watermark, premium models, white label | Reserves a capability to the plan that sells it |
| `POST /billing/consume` | called by services that generate elsewhere (AppGen) | Applies the same price list, remotely |

### iCode: the engine lives elsewhere, the price list stays here

AppGen generates in `we-dev-next` (a separate Express server), not in this API. That service decides nothing: before generating, it calls `POST /billing/consume` **forwarding the user's credentials** (session cookie or Bearer token), and returns the refusal as is. Duplicating the price list there would have made it drift from here, and customers' money would have paid for the difference.

The check sits just before the mode is chosen, the last moment when nothing has left: no header sent, no model call. After the stream starts, it would be too late to refuse — and the inference cost would already be spent.

Two kinds of actions are distinguished, following "generating is free, owning is paid":

- **initial generation**: free but capped (3/day on Discovery, unlimited from Starter). The daily counter lives in Redis with expiry — a free quota is not a security control, so Redis being unavailable means "allowed";
- **modifications**: 1 credit for a message, 2 for a build, 3 for a premium action.

If the billing API cannot be reached, or rejects the credentials, `we-dev-next` **refuses** the generation: a billing outage must not become free, anonymous generation.

Each check respects the `enforcement` setting: `off` (nothing), `log` (measures without blocking, the starting mode), `enforce` (real debit).

The price list follows **deliverables**, not calls: the first generation of a charter costs 60 credits, its variations are included, and any new batch of visuals costs 10. "Included" entries appear on the statement at zero credits — the user sees what they got, and the system knows the inclusion was used.

### iSimulate: paid per run, one run per payment

A simulation is not billed in credits but per unit: it chains several agents and external research for a few minutes, a cost too concentrated to fit a monthly plan.

`requireSimulationPayment()` guards the two launch routes (from an IDEM project, and from an imported business plan). The check comes **after** consent and input validation: there is no point reserving a payment for a request that will be rejected on a missing field.

The reservation happens in two steps, and that is not a detail:

1. `reserveForSimulation()` sets a token on the payment through a conditional update — it only succeeds if the payment has not been consumed yet. Checking then launching would let two simultaneous requests pass the check and start two expensive runs for one payment;
2. once the run is created, `attachSimulationPayment()` swaps the token for its identifier. If the launch fails, `releaseSimulationPayment()` gives the payment back to its owner rather than charging for a simulation that never ran.

Premium beta testers are exempt, and the `enforcement` setting applies here as elsewhere. During the product beta (`IS_BETA` on the application side), the front end does not offer payment: IDEM covers the cost.

### iDeploy: the plan lives in another database

iDeploy stores its data in PostgreSQL (the schema inherited from Coolify, now served by `apps/ideploy-api`). Writing its plan at payment time would make collection depend on that second database being available: a thirty-second outage, and a charged customer would end up without the plan they just bought, with no trace of what is missing.

The intent is therefore written in `billing_sync_jobs` — in the database that just accepted the payment — then applied by the `ideploy-sync` task (every minute), which retries with an increasing delay. The payment remains the source of truth; propagation is a consequence that can take its time.

| When | What is written |
| --- | --- |
| Delivery of an iDeploy subscription or renewal | The plan and the end of the paid period |
| Purchase of a deployment pack | Credits **added** to the balance, without touching the plan |
| Expiry or cancellation | Back to the `hobby` plan, end date cleared, already-paid credits kept |

The two databases share no identifier: the e-mail is the only link between an IDEM account and an iDeploy team. When no team matches — a customer can pay before opening their deployment space — the task retries for several hours, then sets the job aside with a readable reason. `GET /billing/internal/sync-jobs` shows it, `POST /billing/internal/sync-jobs/:jobId/retry` replays it once the account exists.

## Monitoring

**Logs**: every payment event is shipped to Loki/Grafana like the rest of the API logs (`{service="idem-api"} | json | event=~"payment.*"`); `fulfillment_failed`, `refund_failed` and `signature_rejected` are critical and e-mailed at once (see [Observability](../../../docs/OBSERVABILITY.md)). `logs/payments.log` is a local copy with longer retention. Each line carries `event`, `reference`, `depositId`, `provider`, `status`, `failureCode`, `durationMs`, and the `requestId` that ties the payment to the rest of the request.

**Metrics**: `payments_initiated_total`, `payments_completed_total`, `payments_failed_total{failure_code}`, `payment_time_to_final_seconds`, `pawapay_api_requests_total`, `pawapay_api_duration_seconds`, `payment_callbacks_total{result}`, `payments_pending_stuck`, `payment_fulfillment_failures_total`, `credits_debited_total{engine,action}`, `emails_sent_total{template,status}`, `billing_job_runs_total{job,result}`.

**Alerts** (`idem-admin/monitoring/prometheus/alert-rules.yml`, group `payments_health`) — nine rules, two of them without a threshold because any non-zero value is an incident:

| Alert | Severity | Trigger |
| --- | --- | --- |
| `PaymentFulfillmentFailure` | critical | A customer paid and received nothing |
| `PaymentCallbackSignatureInvalid` | critical | Invalid callback signature |
| `PawapayApiErrors` | critical | More than 10 % of calls in error |
| `PaymentReconcilerNotRunning` | critical | Reconciliation no longer runs |
| `PaymentsStuck` | warning | Payment without a final status for 30 min |
| `PaymentSuccessRateLow` | warning | Success below 60 % (minimum volume 5) |
| `PaymentCallbackIpRejected` | warning | Callback from an unknown IP |
| `BillingJobFailing` | warning | A scheduled task fails |
| `TransactionalEmailsFailing` | warning | More than 20 % of e-mails failing |

**Grafana dashboard**: `IDEM — Payments` (uid `idem-payments`) — funnel, success per operator, failure reasons, pawaPay latency, callback outcomes, and the Loki log filtered on `payment.*`.

## Checks

```bash
npm run check:billing           # the catalogue matches the business plan
npm run check:payments          # signature, IP list, state machine, encryption
npm run check:payments:sandbox  # end to end on the sandbox (network + database)
```

The third uses pawaPay's test numbers and checks the most important point: **replaying a delivery does not credit twice**.

## Going to production

1. pawaPay production account, token created and stored in Secret Manager as `api--PAWAPAY_API_TOKEN` (`npm run secrets -- push api …` or `rotate api PAWAPAY_API_TOKEN`). It is declared in `api/config/secrets.manifest.ts`.
2. `PAWAPAY_ENV=production`.
3. Callback URL declared: `https://api.idem.africa/billing/webhooks/pawapay/deposits`.
4. Signing enabled on pawaPay's side, then `PAWAPAY_CALLBACK_SIGNATURE=enforce`.
5. Production IPs allowed by the network team (see the list in `pawapay-signature.ts`).
6. A real end-to-end payment, on a small amount, checked in the admin panel.
7. Alerts active: delivery failure, stuck payments, invalid signature.

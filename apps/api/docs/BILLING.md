# Billing

A transcription of the business model published on `apps/landing/src/app/pages/pricing-page/`. That page is the commercial source of truth: any change must be reflected in `api/models/billing.model.ts`.

> **Payment collection is live.** Mobile Money goes through pawaPay: see [PAYMENTS.md](./PAYMENTS.md) for the full chain (initiation, reconciliation, idempotent delivery, traceability). This document describes what is sold; the other one describes how the money comes in.
>
> Not yet enforced: charging credits on generation routes runs in `log` mode by default (the `enforcement` setting). See "What remains to be done".

## Three structuring principles

### 1. The reference currency is the CFA franc

Prices are in XAF, not in dollars. Amounts are stored as **integers** (the CFA franc has no subdivision).

Inference, on the other hand, is billed in USD by the providers. The reconciliation therefore goes through `amountUsd`, **frozen when each invoice is issued** with the `xafPerUsd` rate applied: converting afterwards would retroactively change past revenue with the exchange rate.

The rate can be overridden without redeploying:

```bash
XAF_USD_RATE=577   # default, aligned with the public page (2,999 F ≈ $5.2)
```

### 2. Three engines, three SEPARATE credit counters

`business`, `appgen`, `ideploy`. **A Business credit does not pay for an AppGen generation.** The ledger is therefore indexed by `(userId, engine)`, never by `userId` alone, and one customer can subscribe to all three at once — that is the point of bundles.

The `one_active_subscription_per_user_engine` index is on the pair: it forbids two active subscriptions on the *same* engine, not on different engines.

### 3. Revenue is not only subscriptions

One-off packs, credit top-ups, Project Pass, 24 h / 7 d passes, managed options and bundles weigh as much as recurring revenue. `BillingProductKind` tells them apart, and the panel explicitly separates recurring from one-off — only the former feeds MRR.

## Pricing

Prices no longer live in the code. They come from two sources, in this order:

1. **Admin panel overrides** (collection `pricing_overrides`);
2. **`packages/shared-models/src/pricing/pricing.config.json`**, versioned in the repository.

A price absent from both is not a price: the sale is refused.

### The file

A single file describes the 42 offers and the 20 countries: the catalogue price in CFA francs, the "IDEM project" price of simulations, and the local price list of each country outside the franc zone. The seven franc-zone countries have no price list — they apply the catalogue price; editing them separately would make seven countries at fixed parity diverge.

`pricing.schema.json` goes with it: the editor autocompletes and flags mistakes while typing.

The API **reloads it from disk** when its modification date changes: fixing a price needs no restart. A file that becomes invalid breaks nothing — the last valid configuration stays in service and the incident is logged (`billing.pricing_file_invalid`). `PRICING_CONFIG_PATH` moves the file in production.

### Overrides

The admin panel ("Prices") never writes to the file: it sets overrides in the database, one per price, with a mandatory reason and an append-only history (`pricing_changes`). A price is therefore fixed in seconds, reread six months later with its reason, and reverted to the file in one click.

Effective prices are copied to `billing_products.priceXaf` at start-up then every minute (`pricing-sync` task): all the code that already read the catalogue sees the price actually applied, without knowing it.

**A running subscription does not change price.** The amount is frozen on the subscription when it is taken; a new price list only applies to later payments.

### Endpoints

| Method | Path | Role |
| --- | --- | --- |
| GET | `/billing/pricing` | Effective pricing, public (active offers) |
| GET | `/billing/internal/pricing` | Defaults, overrides, effective prices and anomalies |
| PUT | `/billing/internal/pricing` | Applies a batch `{changes, reason}` |
| GET | `/billing/internal/pricing/history` | History of changes |

The batch is validated as a whole before any write: unknown product, franc-zone country, `idemPrice` on an offer that has none, negative amount — the errors come back together, and nothing is written.

### Anomalies

`pricingWarnings()` flags without refusing: an offer without a local price, a price list that inverts (a Cabinet cheaper than an Essential), a price above the CFA zone or below the floor of delivered trade-offs (55 % of the CFA price, in dollars). A deliberately low price is legitimate; an inverted list is almost always a typo.

The exchange rates in the file are used **only** for this display. No price is ever computed with them.

### When the API is unavailable

The dashboard bundles the same file at build time. If the catalogue does not load, it shows the last catalogue received, then the bundled prices, and says so on screen: amounts are indicative, the API is what charges.

## Offer

### IDEM Business

| Product | Price | Credits |
| --- | --- | --- |
| Discovery | 0 F | 5/month (watermarked previews) |
| Essential | 2,999 F/month | 150/month |
| Growth | 7,999 F/month | 500/month (16 F per credit) |
| Cabinet | 19,999 F/month | 1,500/month (13.3 F per credit) |

One-off packs: Identity 1,999 F (80 cr) · Strategy 2,999 F (155 cr) · Compliance 2,499 F (120 cr) · Full Business 4,999 F (265 cr, −33 %). Options: Social Starter 1,999 F/month · Social Pro 4,999 F/month.

### IDEM AppGen

| Product | Price | Credits |
| --- | --- | --- |
| Discovery | 0 F | 3 generations/day |
| Starter | 2,999 F/month | 150/month |
| Pro | 9,999 F/month | 550/month |
| Studio | 24,999 F/month | 1,500/month, 5 seats |

Project Pass 999 F (30 cr, unlocks one project) · 24 h pass 500 F (25 cr) · 7-day pass 1,499 F (90 cr).

### iDeploy

Hobby 0 F · Deploy Starter 2,999 F · Deploy Pro 9,999 F · Deploy Scale 24,999 F, plus eight managed options (WAF, autoscaling, backups, monitoring, database, logs, static IP, sovereign hosting) from 499 to 1,999 F.

### Top-ups (Business & AppGen, separate counters, same prices)

Boost 500 F/25 cr (20 F) · Standard 999 F/55 cr (18 F) · Growth 2,499 F/145 cr (17 F) · Power 4,999 F/320 cr (15.6 F).

### Bundles

Launch Pack 7,499 F (−17 %) · IDEM Complete 29,999 F (−21 %). Their credit split per engine is in `BUNDLE_CREDIT_SPLIT`: a global total would not be enough to credit separate counters.

### Business price list (cost of a deliverable, in credits)

Revision 1 · Flyer 2 · Business card 10 · Editorial calendar 15 · Pitch deck 35 · 3-year forecast 40 · Logo + charter 60 · Business plan 70.

### Cross-cutting rules

- **Yearly**: 2 months free (−16.67 %), payable in 1 or 3 instalments.
- **Credit rollover**: 2 months (`expiresAt` on each grant entry).
- **Loyalty bonus**: +5 % per consecutive period, capped at +30 %.
- **Overage**: bandwidth 25 F/GB, deployment 100 F (pack of 10 for 900 F).

## Collections

| Collection | Role |
| --- | --- |
| `billing_products` | Catalogue (all types). Seeded at start-up. |
| `billing_subscriptions` | Subscriptions, one per (user, engine). |
| `billing_purchases` | One-off purchases: packs, top-ups, passes, options. |
| `billing_invoices` | Issued invoices, XAF + frozen USD equivalent. |
| `credit_ledger` | Append-only ledger, per engine. |
| `billing_counters` | Invoice numbering sequences. |
| `credit_balances` | Current balance per (user, engine). Debited with a conditional `$inc` — see below. |
| `billing_sync_jobs` | Queue propagating plans to iDeploy, with attempts and abandonment reason. |
| `pricing_overrides` | Prices changed from the panel, one document per price. They win over the file. |
| `pricing_changes` | Append-only history of price changes, with their reason. |

### Invariants guaranteed by the database

Three indexes protect against double billing at engine level, not only in the code:

- `one_active_subscription_per_user_engine` — no two active subscriptions on the same engine, even under concurrent requests.
- `one_project_pass_per_project` — a Project Pass unlocks a project once; buying it again would be a billing error.
- `one_invoice_per_subscription_period` — replaying the renewal does not produce a second invoice.

### Other design choices

- **Ledger rather than balance**: append-only, each entry carries `balanceAfter`. It justifies a balance, replays a dispute and links a credit consumption to the corresponding AI generation (`aiUsageEventId`) — so the billed price can be compared to the real token cost, deliverable by deliverable.
- **O(1) balance**: read from the engine's last entry, not by summing every `delta`.
- **Atomic numbering**: `INV-2026-08-000123` comes from a `$inc` counter; a `countDocuments` would give the same number to two concurrent issues.

## Service API

```ts
// Catalogue
await billingService.seedProducts();                  // idempotent, never overwrites
await billingService.listProducts({ engine: 'appgen' });

// Subscriptions (per engine)
await billingService.subscribe(userId, 'appgen-starter');
await billingService.subscribe(userId, 'business-growth', { interval: 'year', installments: 3 });
await billingService.getActiveSubscriptions(userId);
await billingService.cancelActiveSubscription(userId, 'appgen');
await billingService.renewDueSubscriptions();          // scheduled task

// One-off purchases
await billingService.purchase(userId, 'pack-identity');
await billingService.purchase(userId, 'recharge-power', { engine: 'appgen' });
await billingService.purchase(userId, 'appgen-project-pass', { projectId });
await billingService.hasProjectPass(userId, projectId);
await billingService.chargeOverage(userId, 'bandwidth_gb', 12);

// Credits (per engine)
await billingService.getAllCreditBalances(userId);
await billingService.debitBusinessAction(userId, 'business_plan', { projectId });

// Payment collected (called by the orchestrator, never by a route)
await billingService.applyRenewalPayment(subscriptionId, paymentTransactionId);
await billingService.markInvoicePaid(invoiceId, { provider: 'pawapay' });
```

## The credit balance is no longer in the ledger

`credit_ledger` remains the append-only history, but the **current balance** lives in `credit_balances`, one document per (user, engine), handled by `creditLedgerService`.

This move fixed a real flaw: the old `debitCredits()` read the balance, checked it, then wrote. Two generations started in the same second read the same balance and only one was billed. The balance check is now **the filter of the update** (`{ balance: { $gte: cost } }` + `$inc`), hence atomic in MongoDB — the database does not run as a replica set, so it is the only guarantee available, and it is enough here.

Older accounts have no balance document: it is rebuilt from the ledger on first access. No migration to run.

## Credit enforcement on generation routes

`middleware/billing.middleware.ts` (`requireCredits`) reserves credits before generation and refunds them if it fails, on generation routes, AppGen project unlocking and plan capabilities. The `enforcement` setting has three modes: `off`, `log` (measures what would be blocked without blocking) and `enforce`. In `enforce` mode the check fails closed: if billing cannot be verified, the request is refused (503) rather than generated for free.

## What is in place

- **Payment collection** — `purchase()`, `subscribe()` and `applyRenewalPayment()` are called by the orchestrator once the payment is confirmed with pawaPay, and reconciliation runs as a scheduled task.
- **Renewals** — reminders at D-3 and D0, 3 days of grace, then back to the free plan (`subscription-renewal.service.ts`, hourly task).
- **Rollover expiry** — daily task on grants that reach their term.
- **Premium beta** — tester list, CSV import, invitations and granting of top plans until the date set in the panel.
- **Simulation** — billed per run: a payment opens one run, and only one (atomic reservation, see [PAYMENTS.md](./PAYMENTS.md)).
- **iDeploy propagation** — the paid plan is pushed into the other database through the `billing_sync_jobs` queue, with replay from the panel.

## What remains to be done

1. **Switching to `enforce`** — credit enforcement runs in `log` mode: it measures what would be blocked, without blocking. The switch is made in the settings, after reading the figures.
2. **Yearly instalments** — `installments` is stored and validated (1 or 3), but no schedule is generated: a single invoice covers the period.
3. **Depth of Simulation tiers** — the Essential and In-depth offers are in the catalogue but **inactive**: today a run does the same thing whatever the tier, only the presence of the report varies. Activating them means differentiating the pipeline — a product decision, not a rename.
4. **IDEM Builders referral** — the 20 credits to the referrer and the referee on the first paid delivery are not implemented.

## Profitability

`GET /admin/billing/profitability` crosses `billing_invoices` (XAF revenue) and `ai_usage_events` (USD inference cost), broken down by engine and product kind.

**Scope of the calculation**: the AI cost is an estimate and covers inference only — no hosting, no iDeploy infrastructure, no overheads. The margin is a gross margin on inference cost, not an accounting result. The endpoints return this reminder in `disclaimer` and the panel shows it.

See also [AI_USAGE_TRACKING.md](./AI_USAGE_TRACKING.md).

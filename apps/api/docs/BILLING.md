# Billing

The business model **« Créer, Garder, Faire tourner, Grandir »** (create, keep, run, grow), as implemented. Its source of truth is `api/models/offer.model.ts` (every price, cap and rule); the narrative is in `Idem-bp/business model/07-modele-economique.md`, and the public page `apps/landing/src/app/pages/pricing-page/` shows the same figures.

> **Payment collection is live.** Mobile Money goes through pawaPay: see [PAYMENTS.md](./PAYMENTS.md) for the full chain (initiation, reconciliation, idempotent delivery, traceability). This document describes what is sold; the other one describes how the money comes in.
>
> Not yet enforced: billing on generation routes runs in `log` mode by default (the `enforcement` setting). See "What remains to be done".

## Three structuring principles

### 1. The reference currency is the CFA franc

Prices are in XAF, not in dollars. Amounts are stored as **integers** (the CFA franc has no subdivision).

Inference, on the other hand, is billed in USD by the providers. The reconciliation therefore goes through `amountUsd`, **frozen when each invoice is issued** with the `xafPerUsd` rate applied: converting afterwards would retroactively change past revenue with the exchange rate.

The rate can be overridden without redeploying:

```bash
XAF_USD_RATE=577   # default, aligned with the public page (2,999 F ≈ $5.2)
```

### 2. One wallet, in francs, for every service

Mobile Money pays for **one thing only: a wallet top-up** (`wallet-topup`, 100 F to 500,000 F in steps of 50 F, +5 % bonus from 5,000 F, +10 % from 10,000 F). Everything else is bought **from the wallet**, in francs: final versions, monthly passes, packs, iCode changes, iDeploy meter days, iVision exports, simulations, domains.

The wallet is the ledger account `wallet` (`credit_balances` / `credit_ledger`, same atomic conditional `$inc` as before). Three prepaid accounts sit next to it: `appgen` (included iCode changes), `icode_pass` (prepaid Project Passes, from packs) and `vitrine_days` (prepaid Showcase days). The historical `business` credits are **converted lazily** to the wallet at 13 F per credit, on the first wallet read.

Outside the CFA zone, the local price of a top-up is the country's reference price (3,000 F of balance, the price of the Croissance pass) applied pro rata — so 3,000 F costs exactly the published local tier (650 KES, 4,900 NGN…).

### 3. Each service keeps its own unit, linked by the wallet

IDEM sells the **deliverable** (free draft, paid final version capped by the Business Kit); iCode the **change**; iDeploy the **day of running** (one meter per application); iVision the **export**; iSimulate the **run**. Monthly caps turn pay-as-you-go into a pass automatically (Croissance 3,000 F, Créateur 2,000 F): a user never pays more than the pass. Packs combine services.

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

All amounts below are in `api/models/offer.model.ts`. `GET /billing/offers` returns them (public).

### Create — free drafts

Every IDEM deliverable is first generated as a **draft**, free and with no time limit (fair use). The billing middleware sets `generationMode = 'draft'` on the AI context: text models priced above $1/M output tokens are swapped for `deepseek/deepseek-v4-flash` (`IDEM_DRAFT_TEXT_MODEL`), grounded web research is skipped, images use the default FLUX model and AI-filmed clips are refused. A draft can be read in IDEM; its **files** (PDF, PPTX, ZIP, print renders) require the final version (`requireOwnership`, 402 `deliverable_locked`).

### Keep — final versions, capped by the Business Kit

| Deliverable | Final version |
| --- | ---: |
| Logo + brand guidelines | 1,500 F |
| Business plan (sourced market data) | 2,000 F |
| Pitch deck | 1,000 F |
| OHADA legal kit | 1,500 F |
| 3-year forecast | 1,000 F |
| Business cards | 500 F |
| **Sum** | 7,500 F |
| **Business Kit cap, per project** | **2,500 F** |

Purchases on a project are summed under the cap key `kit:<projectId>`; the payment that reaches 2,500 F unlocks the whole Kit. A final version includes 30 days of free edits; afterwards an edit costs 100 F (relayout: business plan 500 F, deck 300 F) and a full regeneration half the deliverable price. **Signature** (+1,000 F per deliverable) runs the most powerful models (`creativity = ultra`); otherwise the creativity gauge only chooses the model, never the price (`CREATIVITY_MULTIPLIER` is 1 everywhere).

### Run — communication, iCode, iDeploy, iVision

- **Communication**, per piece: visual 100 F, carousel 200 F, motion video 300 F (re-export 100 F), AI-filmed shot +1,000 F (unused shots refunded), editorial calendar 500 F, communication plan 500 F, strategy 1,000 F, talking-head video 1,500 F. Monthly cap `croissance:YYYY-MM` at 3,000 F, which grants **IDEM Croissance** until the end of the month.
- **Passes**: IDEM Croissance 3,000 F/month (unlimited communication and edits, one Showcase meter, 20 iCode changes, one simulation per quarter), IDEM Entreprise 7,500 F/month (Croissance + one Application meter + iVision Créateur, domains at cost), iVision Créateur 2,000 F/month (every HD export). Yearly = 10 months. Stored as `billing_purchases` of kind `day_pass`, code `pass-<code>`. **7 days of Croissance are granted at signup.**
- **iCode**: initial generation free (usage quota); **Project Pass 1,000 F** (code, GitHub, deploy, 30 changes); a change 25 F (premium model 75 F or 3 included changes); pack of 100 changes 2,000 F. `/billing/consume` debits included changes first, then the wallet.
- **iDeploy meters**, one per application (`deploy_meters`), charged daily: Veille 0 F (free 7 days after creation, then asleep), Vitrine 10 F, Application 50 F, Application+ 150 F, Boutique 0 F + 4 % per sale; daily options 15 to 70 F. Coverage order: beta or legacy paid plan → pass (Croissance covers the oldest Showcase, Entreprise the oldest Application) → prepaid Showcase days → wallet. Unpaid → asleep (e-mail), woken automatically by the next top-up, archived after 30 days. Domains: .africa 6,500 F (renewal 8,000 F), .com 8,900 F, at cost in packs; orders are queued for manual registration (`domain_orders`) until the registrar connectors are live.
- **iVision**: creation free and signed « Créé avec iVision »; HD export without the mark 100 F (visual) or from 300 F (video, priced by scope with the same code as IDEM), capped by Créateur.

### Grow, packs and codes

- **Pack Lancement** 5,000 F (Business Kit + one Project Pass + 90 Showcase days) · **+ domain** 9,900 F · **À plusieurs** 20,000 F (5 Pack Lancement codes).
- **IDEM codes** (`idem_codes`, `IDEM-XXXXX-XXXXX`): wallet codes or Pack Lancement codes, sold by agents (8 % commission) or offered; a code is claimed atomically, once.
- **iSimulate**: free pre-analysis; full simulation 1,500 F from an IDEM project, 2,500 F from an imported business plan; bank report +2,000 F; re-run 500 F; in-depth 7,500 / 9,500 F.

### Migration from the credit model

`npm run billing:migrate-offer` (dry run) then `-- --apply`: seeds `wallet-topup`, takes the old products off sale, and ends paid subscriptions at their term (an active paid subscription is treated as Croissance until then). Old credits convert lazily; deliverables already paid in credits are adopted as owned on first read; beta testers keep everything.

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
| `deliverable_unlocks` | Final versions owned, one per (user, project, deliverable), with tier (`final`/`signature`) and source. |
| `idem_codes` | Wallet and Pack Lancement codes, with agent and redemption. |
| `domain_orders` | Domain orders awaiting registration, then registered / failed / refunded. |
| `deploy_meters` | One iDeploy meter per application: tier, options, status, last charged day. Its desired state is written to the iDeploy Postgres table `idem_app_meters`, applied by the `idem-meters` job of `ideploy-api`. |

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
// Wallet
await walletService.topUp(userId, 5000);                               // +250 F bonus
await walletService.spend(userId, { priceXaf, label, action, cap });    // conditional debit, cap-aware
await walletService.refund(userId, amountXaf, { action, capKey });

// Offers bought from the wallet
await offerService.buy(userId, { kind: 'unlock', projectId, deliverable: 'business_plan' });
await offerService.buy(userId, { kind: 'pass', code: 'croissance', interval: 'month' });
await offerService.buy(userId, { kind: 'pack', code: 'lancement', projectId });
await offerService.buy(userId, { kind: 'icode_project_pass', projectId });
await offerService.redeemCode(userId, 'IDEM-ABCDE-FGHIJ', projectId);

// Ownership and meters
await ownershipService.status(userId, projectId);                       // drafts, finals, Kit progress
await deployMeterService.runDaily();                                     // scheduled hourly, idempotent per day
```

HTTP: `GET /billing/offers`, `GET /billing/wallet`, `POST /billing/offers/buy`, `GET /billing/projects/:projectId/ownership`, `POST /billing/codes/redeem`, `GET /billing/codes`, `POST /billing/domains/order`, `GET /billing/domains`, `GET|PUT /billing/deploy/meters[/:appUuid]`, `POST /billing/deploy/meters/:appUuid/wake`, `GET /billing/access/appgen/:projectId`. A top-up goes through `POST /billing/checkout` with `productCode: 'wallet-topup'`, `amountXaf` and an optional `then` purchase made right after the money is collected. Internal (service key): `POST /billing/internal/codes`, `GET /billing/internal/codes/agents/:agentId`, `GET /billing/internal/domains`, `POST /billing/internal/domains/:orderId/settle`, `POST /billing/internal/meters/run`.

`npm run check:offer` plays the rules end to end (top-ups and bonuses, credit conversion, Kit cap, Signature, Croissance cap, passes, Project Pass, codes, refusals) against a throwaway database.

## The credit balance is no longer in the ledger

`credit_ledger` remains the append-only history, but the **current balance** lives in `credit_balances`, one document per (user, engine), handled by `creditLedgerService`.

This move fixed a real flaw: the old `debitCredits()` read the balance, checked it, then wrote. Two generations started in the same second read the same balance and only one was billed. The balance check is now **the filter of the update** (`{ balance: { $gte: cost } }` + `$inc`), hence atomic in MongoDB — the database does not run as a replica set, so it is the only guarantee available, and it is enough here.

Older accounts have no balance document: it is rebuilt from the ledger on first access. No migration to run.

## Billing on generation routes

`middleware/billing.middleware.ts` (`requireCredits`, unchanged signature on the ~45 routes) translates each historical action through `services/billing/action-policy.ts` — deliverable, edit, unit content or free helper — and decides: draft (free), final (already paid), Signature, paid unit (wallet debit with the monthly cap) or included (pass, beta). It debits **before** generating and refunds on failure; the 402 body carries the price, the balance, what is missing and the suggested top-up (`topupXaf`). The `enforcement` setting has three modes: `off`, `log` (measures what would be blocked without blocking) and `enforce`. In `enforce` mode the check fails closed: if billing cannot be verified, the request is refused (503) rather than generated for free.

## AI usage quotas

Credits price a deliverable; they do not bound the **pace** of generation, nor the free AI helpers. Usage quotas do both. They replace the old global counter (`users.quota`, 50 requests/day for everything, removed — `npm run db:drop-legacy-quota -- --apply` cleans existing documents).

- **Groups** (`models/usage-quota.model.ts`) — every billed action belongs to one group: AI helpers (free), AI edits, creations, flagship deliverables, videos, iCode initial generations, iCode edits, simulations.
- **Windows** — day (UTC), ISO week (Monday) and month, each with its own limit per tier. The tier comes from the plan of the group's engine (`free`, `starter`, `growth`, `top`, plus `beta` for complimentary access); AI helpers and simulations use the best plan of the account.
- **Counters** — `usage_quota_counters`, one document per (user, group, period), incremented with a conditional `findOneAndUpdate` (atomic without a replica set), purged by TTL a week after the period ends. A failed generation gives its slot back (`finish` ≥ 400, `refundRequestCredits`, `/billing/refund` from iVision).
- **AI spend cap** — every model call adds its cost (tokens, web search results, images, clips, voice) to the account's day/week/month spend. Past the cap of the tier, generations are refused: this stops the worst case (a run of generations at their ceiling cost) before it costs more than the plan earns. The amount is never shown to users; the dashboard shows a capacity percentage.
- **Generation budget** — each generation gets a cost budget from its envelope (`config/generation-budgets.ts`): above the soft limit it is logged (`generation_over_budget_total`), above the hard limit it is stopped in `enforce` mode (`billing_settings.generationBudget`).
- **Where it applies** — `requireCredits` reserves the slot of the action's group before debiting (included actions too); `requireQuota(group, { envelope })` guards free AI routes (onboarding, prompt, occasions, studio, video helpers, coherence, deployment assistant, logo analysis, simulation analysis and runs); `chargeForService` covers iVision and iCode site media; `/billing/consume` covers AppGen.
- **Refusal** — HTTP 429 `quota_exceeded` with the group, the window, the reset date (`Retry-After`) and the next plan. The dashboard opens the paywall on it; iVision and AppGen relay it as is.
- **Modes** — same `enforcement` setting as credits: `off` (nothing counted), `log` (counted, never refused, would-be refusals measured by `usage_quota_refusals_total{enforced="false"}`), `enforce`.
- **Settings** — limits and caps are overridden without redeploying through `billing_settings.usageQuotas` (`PUT /billing/internal/settings`). `GET /billing/quotas` gives a user their status; `GET /billing/internal/quotas/:userId` and `POST /billing/internal/quotas/reset` serve the admin panel.

Per-feature costs, per-creativity-level prices and margins, and the quota matrix are generated from the code into [QUOTAS.md](./QUOTAS.md) (`npm run quotas:matrix`); `npm run check:quotas` fails if a billed action has no envelope or group.

## What is in place

- **Payment collection** — pawaPay Mobile Money top-ups, reconciliation as a scheduled task, invoice of kind `recharge` for each top-up.
- **The wallet model** — drafts, final versions and the Kit cap, Signature, monthly caps granting passes, passes, packs, codes, Project Pass, iCode changes, iVision paid exports with the signed free download, AI-filmed shots ordered and refunded when unused.
- **iDeploy meters** — daily charging, sleep, automatic wake on top-up, archive after 30 days, low-balance and asleep e-mails; `ideploy-api` applies start/stop every 5 minutes.
- **Welcome** — 7 days of IDEM Croissance at signup.
- **Premium beta** — unchanged: beta testers have everything included.

## What remains to be done

1. **Switching to `enforce`** — billing and usage quotas run in `log` mode until the figures are read (`billing.enforcement_shadow`, `usage_quota_refusals_total`, `generation_over_budget_total`), after the 6-week pilot.
2. **Boutique** — the meter tier exists, but merchant checkout and the 4 % commission collection are not built.
3. **Domains** — registrar connectors (Domain Name API, Openprovider) and automatic renewal; orders are settled by hand meanwhile. The domain included in the yearly Entreprise pass is not applied automatically.
4. **iDeploy** — wake-on-visit for Veille, per-application traffic metering (day upgraded to the next meter), SMS/WhatsApp alerts.
5. **Third-party payers** — bank-paid financing files (10,000 F) and cohort invoicing are not in the code.
6. **Signed free video download in iVision** — free visuals download with the mark; free videos are watched online only.
7. **Legal** — validate with a lawyer that the non-refundable, non-transferable services balance stays outside e-money regulation (BEAC / BCEAO).

## Profitability

`GET /admin/billing/profitability` crosses `billing_invoices` (XAF revenue) and `ai_usage_events` (USD inference cost), broken down by engine and product kind.

**Scope of the calculation**: the AI cost is an estimate and covers inference only — no hosting, no iDeploy infrastructure, no overheads. The margin is a gross margin on inference cost, not an accounting result. The endpoints return this reminder in `disclaimer` and the panel shows it.

See also [AI_USAGE_TRACKING.md](./AI_USAGE_TRACKING.md).

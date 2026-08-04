# Facturation

Structure de facturation de la plateforme, dérivée de l'offre publiée sur la
landing page (`apps/landing/src/app/components/pricing/pricing.html`).

> **Aucun prestataire de paiement n'est branché.** Tout ce qui précède
> l'encaissement est fonctionnel — catalogue, souscription, crédits, émission de
> factures — mais rien n'est débité. L'objectif de cette étape est de permettre
> au panel admin de mesurer dès maintenant le chiffre d'affaires et de le
> comparer au coût des tokens.

## Offre reprise de la landing page

| Plan | Prix | Crédits | Palier `users.subscription` |
| --- | --- | --- | --- |
| Free | 0 $ | 10 (une seule fois) | `free` |
| Starter | 15 $/mois | 150/mois | `pro` |
| Pro | 50 $/mois | 600/mois | `pro` |
| Enterprise | négocié | négocié | `enterprise` |

Barème de crédits par action, également repris de la landing page :

| Action | Crédits |
| --- | --- |
| Logo | 7 |
| Business Plan | 20 |
| Full App | 30 |
| Projet complet | 64 |

**Écart assumé** : la landing vend `Free / Starter / Pro`, alors que
`users.subscription` ne connaît que `free / pro / enterprise`. La
correspondance est portée par `BillingPlanModel.subscriptionTier`, ce qui permet
de faire évoluer le catalogue commercial sans migrer la collection `users`.

## Collections

| Collection | Rôle |
| --- | --- |
| `billing_plans` | Catalogue. Amorcé au démarrage depuis `DEFAULT_PLANS`. |
| `billing_subscriptions` | Un abonnement par utilisateur, historique conservé. |
| `billing_invoices` | Factures émises, montant converti en USD (`amountUsd`). |
| `credit_ledger` | Grand livre append-only des mouvements de crédits. |
| `billing_counters` | Séquences de numérotation des factures. |

### Invariants garantis par la base

Deux index protègent contre la double facturation — au niveau du moteur, pas
seulement dans le code applicatif :

- `one_active_subscription_per_user` (partiel unique) : impossible d'avoir deux
  abonnements `active`/`trialing` pour un même utilisateur, même sous requêtes
  concurrentes.
- `one_invoice_per_subscription_period` (unique) : rejouer la tâche de
  renouvellement ne produit pas de seconde facture pour la même période.

### Choix de conception

- **Grand livre plutôt que solde** : `credit_ledger` est append-only et chaque
  écriture porte `balanceAfter`. Un solde seul ne permettrait pas de justifier
  un litige ni de relier une consommation à la génération IA correspondante
  (`aiUsageEventId`).
- **Solde en O(1)** : lu depuis la dernière écriture (`balanceAfter`), pas par
  une somme de tous les `delta` sur un livre qui ne fait que grandir.
- **Numérotation atomique** : `INV-2026-08-000123` vient d'un compteur
  `$inc`, pas d'un `countDocuments` — deux émissions concurrentes obtiendraient
  sinon le même numéro.
- **`amountUsd` dénormalisé** : le CA doit être agrégeable même avec plusieurs
  devises ; `fxRateToUsd` conserve le taux appliqué.

## API du service

```ts
// Catalogue
await billingService.seedPlans();                    // idempotent, n'écrase jamais
await billingService.listPlans();

// Abonnements
await billingService.subscribe(userId, 'starter');   // + crédite les crédits du plan
await billingService.cancelActiveSubscription(userId);
await billingService.renewDueSubscriptions();        // à appeler par une tâche planifiée

// Factures
await billingService.issueInvoice({ ... });
await billingService.markInvoicePaid(invoiceId);     // point d'entrée d'un futur webhook

// Crédits
await billingService.getCreditBalance(userId);
await billingService.grantCredits(userId, 150, 'plan_grant');
await billingService.debitCredits(userId, 'logo', { projectId });
```

## Ce qui reste à faire pour encaisser

1. **Prestataire de paiement** — les champs `provider`, `providerCustomerId`,
   `providerSubscriptionId`, `providerInvoiceId` sont en place. Brancher
   Stripe / Paystack / Flutterwave et appeler `markInvoicePaid()` depuis le
   webhook.
2. **Tâche de renouvellement** — `renewDueSubscriptions()` n'est appelée par
   aucun planificateur ; elle est prête et idempotente.
3. **Débit bloquant des crédits** — `debitCredits()` renvoie
   `{ allowed: false }` quand le solde est insuffisant, mais **aucun appelant ne
   l'invoque encore**. Le brancher consiste à l'appeler avant la génération et à
   propager `allowed`. Attention : `appendLedgerEntry()` relit le solde juste
   avant d'écrire, donc deux débits concurrents peuvent calculer le même
   `balanceAfter` — à l'activation, passer par une transaction ou un compteur
   atomique sur l'utilisateur.
4. **Taux de change** — `fxRateToUsd` est à 1 par défaut. À alimenter si des
   plans sont vendus en XAF/EUR.

## Rentabilité

Le panel admin croise `billing_invoices` (revenu) et `ai_usage_events` (coût
d'inférence) : `GET /admin/billing/profitability`.

Les deux sont en USD et datés au jour, donc directement comparables.

**Périmètre du calcul** : le coût IA est une estimation (tarifs publics
appliqués aux compteurs des fournisseurs) et ne couvre que l'inférence — ni
hébergement, ni stockage, ni charges de structure. La marge affichée est une
marge brute sur coût d'inférence, pas un résultat comptable. Les endpoints
renvoient ce rappel dans le champ `disclaimer`, et le panel l'affiche.

Voir aussi [AI_USAGE_TRACKING.md](./AI_USAGE_TRACKING.md).

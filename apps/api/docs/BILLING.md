# Facturation

Transcription du modèle économique publié sur
`apps/landing/src/app/pages/pricing-page/`. Cette page est la source de vérité
commerciale : toute évolution doit être répercutée dans
`api/models/billing.model.ts`.

> **Aucun encaissement n'a lieu.** Mobile Money (MTN MoMo, Orange Money) et
> carte sont déclarés comme moyens de paiement, mais rien n'est débité. Tout ce
> qui précède l'encaissement — catalogue, souscription, crédits, achats,
> émission de factures — est fonctionnel, pour que le panel admin mesure dès
> maintenant le chiffre d'affaires face au coût des tokens.

## Trois principes structurants

### 1. La devise de référence est le F CFA

Les prix sont en XAF, pas en dollars. Les montants sont stockés en **entiers**
(le franc CFA n'a pas de subdivision).

Le coût d'inférence, lui, est facturé en USD par les fournisseurs. Le
rapprochement se fait donc via `amountUsd`, **figé à l'émission** de chaque
facture avec le taux `xafPerUsd` appliqué : reconvertir a posteriori ferait
varier rétroactivement le CA passé au gré du change.

Le taux est surchargeable sans redéploiement :

```bash
XAF_USD_RATE=577   # défaut, aligné sur la page publique (2 999 F ≈ 5,2 $)
```

### 2. Trois moteurs, trois compteurs de crédits SÉPARÉS

`business`, `appgen`, `ideploy`. **Un crédit Business ne paie pas une génération
AppGen.** Le grand livre est donc indexé par `(userId, engine)`, jamais par
`userId` seul, et un même client peut être abonné aux trois simultanément —
c'est même l'objet des bundles.

L'index `one_active_subscription_per_user_engine` porte sur le couple : il
interdit deux abonnements actifs sur le *même* moteur, pas sur des moteurs
différents.

### 3. Le revenu n'est pas que de l'abonnement

Packs à l'unité, recharges de crédits, Project Pass, passes 24 h / 7 j, options
managées et bundles pèsent autant que le récurrent. `BillingProductKind` les
distingue, et le panel sépare explicitement récurrent et ponctuel — seul le
premier alimente le MRR.

## Offre

### IDEM Business

| Produit | Prix | Crédits |
| --- | --- | --- |
| Discovery | 0 F | 5/mois (aperçus filigranés) |
| Essential | 2 999 F/mois | 150/mois |
| Growth | 7 999 F/mois | 500/mois (16 F le crédit) |
| Cabinet | 19 999 F/mois | 1 500/mois (13,3 F le crédit) |

Packs à l'unité : Identity 1 999 F (80 cr) · Strategy 2 999 F (155 cr) ·
Compliance 2 499 F (120 cr) · Full Business 4 999 F (265 cr, −33 %).
Options : Social Starter 1 999 F/mois · Social Pro 4 999 F/mois.

### IDEM AppGen

| Produit | Prix | Crédits |
| --- | --- | --- |
| Discovery | 0 F | 3 générations/jour |
| Starter | 2 999 F/mois | 150/mois |
| Pro | 9 999 F/mois | 550/mois |
| Studio | 24 999 F/mois | 1 500/mois, 5 sièges |

Project Pass 999 F (30 cr, débloque un projet) · Passe 24 h 500 F (25 cr) ·
Passe 7 j 1 499 F (90 cr).

### iDeploy

Hobby 0 F · Deploy Starter 2 999 F · Deploy Pro 9 999 F · Deploy Scale
24 999 F, plus huit options managées (WAF, autoscaling, sauvegardes,
monitoring, base, logs, IP statique, hébergement souverain) de 499 à 1 999 F.

### Recharges (Business & AppGen, compteurs séparés, même tarif)

Boost 500 F/25 cr (20 F) · Standard 999 F/55 cr (18 F) · Growth 2 499 F/145 cr
(17 F) · Power 4 999 F/320 cr (15,6 F).

### Bundles

Launch Pack 7 499 F (−17 %) · IDEM Complete 29 999 F (−21 %). Leur répartition
de crédits par moteur est portée par `BUNDLE_CREDIT_SPLIT` : un total global ne
suffirait pas à créditer des compteurs séparés.

### Barème Business (coût d'un livrable, en crédits)

Révision 1 · Flyer 2 · Carte de visite 10 · Calendrier éditorial 15 ·
Pitch deck 35 · Prévisionnel 3 ans 40 · Logo + charte 60 · Business plan 70.

### Règles transverses

- **Annuel** : 2 mois offerts (−16,67 %), payable en 1 ou 3 échéances.
- **Report de crédits** : 2 mois (`expiresAt` sur chaque écriture d'octroi).
- **Bonus de fidélité** : +5 % par période consécutive, plafonné à +30 %.
- **Hors forfait** : bande passante 25 F/Go, déploiement 100 F (pack de 10 à
  900 F).

## Collections

| Collection | Rôle |
| --- | --- |
| `billing_products` | Catalogue (tous types confondus). Amorcé au démarrage. |
| `billing_subscriptions` | Abonnements, un par (utilisateur, moteur). |
| `billing_purchases` | Achats ponctuels : packs, recharges, passes, options. |
| `billing_invoices` | Factures émises, XAF + équivalent USD figé. |
| `credit_ledger` | Grand livre append-only, par moteur. |
| `billing_counters` | Séquences de numérotation des factures. |

### Invariants garantis par la base

Trois index protègent contre la double facturation au niveau du moteur, pas
seulement dans le code :

- `one_active_subscription_per_user_engine` — pas deux abonnements actifs sur le
  même moteur, même sous requêtes concurrentes.
- `one_project_pass_per_project` — un Project Pass débloque un projet une fois ;
  le racheter serait une erreur de facturation.
- `one_invoice_per_subscription_period` — rejouer le renouvellement ne produit
  pas de seconde facture.

### Autres choix de conception

- **Grand livre plutôt que solde** : append-only, chaque écriture porte
  `balanceAfter`. Permet de justifier un solde, de rejouer un litige et de
  relier une consommation de crédits à la génération IA correspondante
  (`aiUsageEventId`) — donc de comparer le prix facturé au coût réel en tokens,
  livrable par livrable.
- **Solde en O(1)** : lu depuis la dernière écriture du moteur, pas par une
  somme de tous les `delta`.
- **Numérotation atomique** : `INV-2026-08-000123` vient d'un compteur `$inc` ;
  un `countDocuments` donnerait le même numéro à deux émissions concurrentes.

## API du service

```ts
// Catalogue
await billingService.seedProducts();                  // idempotent, n'écrase jamais
await billingService.listProducts({ engine: 'appgen' });

// Abonnements (par moteur)
await billingService.subscribe(userId, 'appgen-starter');
await billingService.subscribe(userId, 'business-growth', { interval: 'year', installments: 3 });
await billingService.getActiveSubscriptions(userId);
await billingService.cancelActiveSubscription(userId, 'appgen');
await billingService.renewDueSubscriptions();          // tâche planifiée

// Achats ponctuels
await billingService.purchase(userId, 'pack-identity');
await billingService.purchase(userId, 'recharge-power', { engine: 'appgen' });
await billingService.purchase(userId, 'appgen-project-pass', { projectId });
await billingService.hasProjectPass(userId, projectId);
await billingService.chargeOverage(userId, 'bandwidth_gb', 12);

// Crédits (par moteur)
await billingService.getAllCreditBalances(userId);
await billingService.debitBusinessAction(userId, 'business_plan', { projectId });

// Paiement (point d'entrée du futur webhook)
await billingService.markInvoicePaid(invoiceId, { provider: 'mtn_momo' });
```

## Ce qui reste à faire pour encaisser

1. **Prestataire de paiement** — `provider`, `providerCustomerId`,
   `providerSubscriptionId`, `providerPaymentId`, `providerInvoiceId` sont en
   place. Brancher MTN MoMo / Orange Money / carte et appeler
   `markInvoicePaid()` depuis le webhook.
2. **Tâche de renouvellement** — `renewDueSubscriptions()` n'est appelée par
   aucun planificateur ; elle est prête et idempotente.
3. **Débit bloquant des crédits** — `debitCredits()` renvoie
   `{ allowed: false }` sur solde insuffisant, mais **aucun appelant ne
   l'invoque encore**. À l'activation : appeler avant la génération et propager
   `allowed`. Attention, `appendLedgerEntry()` relit le solde juste avant
   d'écrire — deux débits concurrents peuvent calculer le même `balanceAfter`.
   Passer alors par une transaction ou un compteur atomique par
   (utilisateur, moteur).
4. **Péremption du report** — `expiresAt` est posé sur chaque octroi, mais
   aucune tâche ne périme encore les crédits au-delà de 2 mois.
5. **Échéancier annuel** — `installments` est stocké et validé (1 ou 3), mais
   aucun échéancier n'est généré : une seule facture couvre la période.

## Rentabilité

`GET /admin/billing/profitability` croise `billing_invoices` (revenu XAF) et
`ai_usage_events` (coût d'inférence USD), avec ventilation par moteur et par
nature de produit.

**Périmètre du calcul** : le coût IA est une estimation et ne couvre que
l'inférence — ni hébergement, ni infrastructure iDeploy, ni charges de
structure. La marge est donc une marge brute sur coût d'inférence, pas un
résultat comptable. Les endpoints renvoient ce rappel dans `disclaimer` et le
panel l'affiche.

Voir aussi [AI_USAGE_TRACKING.md](./AI_USAGE_TRACKING.md).

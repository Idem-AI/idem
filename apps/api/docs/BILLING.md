# Facturation

Transcription du modèle économique publié sur
`apps/landing/src/app/pages/pricing-page/`. Cette page est la source de vérité
commerciale : toute évolution doit être répercutée dans
`api/models/billing.model.ts`.

> **L'encaissement est branché.** Le Mobile Money passe par pawaPay : voir
> [PAYMENTS.md](./PAYMENTS.md) pour la chaîne complète (initiation,
> réconciliation, livraison idempotente, traçabilité). Ce document-ci décrit ce
> qui est vendu ; l'autre décrit comment l'argent rentre.
>
> Ce qui n'est pas encore actif : l'application du barème en crédits sur les
> routes de génération (réglage `enforcement`, en mode `log` par défaut), les
> relances de renouvellement et la bêta premium. Voir « Ce qui reste à faire ».

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

## Tarification

Les prix ne vivent plus dans le code. Ils viennent de deux sources, dans cet
ordre :

1. **Les surcharges du panel admin** (collection `pricing_overrides`) ;
2. **`packages/shared-models/src/pricing/pricing.config.json`**, versionné dans
   le dépôt.

Un prix absent des deux n'est pas un prix : la vente est refusée.

### Le fichier

Un seul fichier décrit les 42 offres et les 20 pays : le prix catalogue en
F CFA, le prix « projet IDEM » des simulations, et la grille locale de chaque
pays hors zone franc. Les sept pays de la zone franc n'ont pas de grille — ils
appliquent le prix catalogue, les éditer séparément ferait diverger sept pays à
parité fixe.

`pricing.schema.json` l'accompagne : l'éditeur complète et signale les fautes
pendant la saisie.

L'API le **relit sur disque** quand sa date de modification change : corriger un
prix ne demande pas de redémarrage. Un fichier devenu invalide ne casse rien —
la dernière configuration valide reste en service et l'incident est journalisé
(`billing.pricing_file_invalid`). `PRICING_CONFIG_PATH` déplace le fichier en
production.

### Les surcharges

Le panel admin (« Prix ») n'écrit jamais dans le fichier : il pose des
surcharges en base, une par prix, avec un motif obligatoire et un historique
append-only (`pricing_changes`). Un prix se corrige donc en quelques secondes,
se relit six mois plus tard avec sa raison, et revient au fichier d'un clic.

Les prix effectifs sont recopiés sur `billing_products.priceXaf` au démarrage
puis chaque minute (tâche `pricing-sync`) : tout le code qui lisait déjà le
catalogue voit le prix réellement appliqué, sans le savoir.

**Un abonnement en cours ne change pas de prix.** Le montant est figé sur
l'abonnement à la souscription ; une nouvelle grille ne vaut que pour les
paiements suivants.

### Endpoints

| Méthode | Chemin | Rôle |
| --- | --- | --- |
| GET | `/billing/pricing` | Tarification effective, publique (offres actives) |
| GET | `/billing/internal/pricing` | Défauts, surcharges, effectif et anomalies |
| PUT | `/billing/internal/pricing` | Applique un lot `{changes, reason}` |
| GET | `/billing/internal/pricing/history` | Historique des changements |

Le lot est validé en entier avant toute écriture : produit inconnu, pays de la
zone franc, `idemPrice` sur une offre qui n'en a pas, montant négatif — les
fautes reviennent ensemble, et rien n'est écrit.

### Anomalies

`pricingWarnings()` signale sans refuser : une offre sans prix local, une grille
qui s'inverse (un Cabinet moins cher qu'un Essentiel), un prix au-dessus de la
zone CFA ou sous le plancher des arbitrages livrés (55 % du prix CFA, en
dollars). Un prix bas volontaire est légitime ; une grille inversée est presque
toujours une faute de frappe.

Les taux de change du fichier servent **uniquement** à cet affichage. Aucun prix
n'est jamais calculé avec.

### Quand l'API est indisponible

Le dashboard embarque ce même fichier au build. Si le catalogue ne se charge
pas, il affiche le dernier catalogue reçu, puis à défaut les prix embarqués, et
le dit à l'écran : les montants sont indicatifs, c'est l'API qui facture.

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
| `credit_balances` | Solde courant par (utilisateur, moteur). Débité par `$inc` conditionnel — voir plus bas. |
| `billing_sync_jobs` | File de propagation des plans vers iDeploy, avec tentatives et motif d'abandon. |
| `pricing_overrides` | Prix modifiés depuis le panel, un document par prix. Priment sur le fichier. |
| `pricing_changes` | Historique append-only des changements de prix, avec leur motif. |

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

// Paiement encaissé (appelé par l'orchestrateur, jamais par une route)
await billingService.applyRenewalPayment(subscriptionId, paymentTransactionId);
await billingService.markInvoicePaid(invoiceId, { provider: 'pawapay' });
```

## Le solde de crédits n'est plus dans le grand livre

Le livre `credit_ledger` reste l'historique append-only, mais le **solde
courant** vit dans `credit_balances`, un document par (utilisateur, moteur),
manipulé par `creditLedgerService`.

Ce déplacement corrige une faille réelle : l'ancien `debitCredits()` lisait le
solde, vérifiait, puis écrivait. Deux générations lancées dans la même seconde
lisaient le même solde et une seule était facturée. Le contrôle de solde est
désormais **le filtre de la mise à jour** (`{ balance: { $gte: cost } }` +
`$inc`), donc atomique côté MongoDB — la base ne tournant pas en replica set,
c'est la seule garantie disponible, et elle suffit ici.

Les comptes antérieurs n'ont pas de document de solde : il est reconstruit
depuis le livre au premier accès. Aucune migration à lancer.

## Ce qui reste à faire

L'encaissement Mobile Money est branché (voir [PAYMENTS.md](./PAYMENTS.md)) :
`purchase()`, `subscribe()` et `applyRenewalPayment()` sont appelés par
l'orchestrateur une fois le paiement confirmé auprès de pawaPay, et la
réconciliation tourne en tâche planifiée.

Sont désormais en place :

- **Application du barème** — `middleware/billing.middleware.ts` réserve les
  crédits avant la génération et les rembourse si elle échoue, sur les routes de
  génération, le déblocage de projet AppGen et les capacités de plan.
- **Renouvellements** — rappels à J-3 et J0, tolérance de 3 jours, puis retour
  au plan gratuit (`subscription-renewal.service.ts`, tâche horaire).
- **Péremption du report** — tâche quotidienne sur les octrois arrivés à terme.
- **Bêta premium** — liste des testeurs, import CSV, invitations et octroi des
  plans haut de gamme jusqu'à la date décidée dans le panel.
- **Simulation** — facturée à l'acte : un règlement ouvre une exécution, et une
  seule (réservation atomique, voir [PAYMENTS.md](./PAYMENTS.md)).
- **Propagation iDeploy** — le plan payé est poussé dans l'autre base par la
  file `billing_sync_jobs`, avec rejeu depuis le panel.

Restent à faire :

1. **Passage en `enforce`** — l'application du barème tourne en mode `log` :
   elle mesure ce qui serait bloqué, sans bloquer. Le basculement se fait dans
   les réglages, après lecture des chiffres.
2. **Échéancier annuel** — `installments` est stocké et validé (1 ou 3), mais
   aucun échéancier n'est généré : une seule facture couvre la période.
3. **Profondeur des niveaux de Simulation** — les offres Essentielle et
   Approfondie sont au catalogue mais **inactives** : aujourd'hui une exécution
   fait la même chose quel que soit le niveau, seule la présence du rapport
   varie. Les activer suppose de différencier le pipeline — une décision
   produit, pas un renommage.
4. **Parrainage IDEM Builders** — les 20 crédits au parrain et au filleul à la
   première livraison payante ne sont pas implémentés.

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

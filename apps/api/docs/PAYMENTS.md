# Encaissement Mobile Money (pawaPay)

Ce document décrit la chaîne d'encaissement : ce qu'elle garantit, comment elle
échoue, et comment retrouver une transaction quand un client appelle.

Le modèle économique et le catalogue sont décrits dans [BILLING.md](./BILLING.md).

## Ce que le système garantit

1. **Aucun paiement n'est perdu.** La transaction est écrite en base, avec son
   `depositId`, **avant** le premier appel à pawaPay. Une coupure réseau au
   milieu de l'initiation ne crée donc jamais de paiement fantôme : on relit son
   statut avec le même identifiant.
2. **Rien n'est livré sur la foi d'un callback.** Un callback dit « va
   regarder » ; seule la réponse de `GET /deposits/{id}` fait foi.
3. **Rien n'est livré deux fois.** Trois verrous, du plus proche au plus
   lointain : la transition conditionnelle `fulfillment.state`, l'index unique
   `one_purchase_per_payment`, et l'idempotence des callbacks.
4. **Un paiement encaissé finit toujours livré**, ou l'incident devient visible :
   la réconciliation retente, la métrique `payment_fulfillment_failures_total`
   alerte.
5. **Tout est tracé.** Chaque étape produit un événement en base, une ligne de
   log corrélée par `requestId`, et une métrique.

## Le parcours nominal

```
Utilisateur          API IDEM                    pawaPay              Opérateur
    │                    │                          │                     │
    ├─ POST /billing/checkout                       │                     │
    │                    ├─ prix calculé côté serveur                     │
    │                    ├─ predict-provider ──────▶│                     │
    │                    ├─ active-conf ───────────▶│  (opérateur ouvert ?)
    │                    ├─ transaction CREATED en base                   │
    │                    ├─ POST /deposits ────────▶├─ demande ──────────▶│
    │◀─ 202 { reference } │                          │                     │
    │                    │                          │      code secret ◀──┤
    │  (écran d'attente) │                          │                     │
    │                    │◀─ callback ──────────────┤◀────────────────────┤
    │                    ├─ GET /deposits/{id} ────▶│                     │
    │                    ├─ livraison (crédits, abonnement, facture)      │
    ├─ GET /billing/payments/{reference} ─▶ COMPLETED                     │
```

Si le callback n'arrive pas — cas fréquent —, le réconciliateur relit le statut
toutes les 30 s, puis 1, 2, 5, 10 minutes, puis toutes les 30 minutes jusqu'à
24 h. Le parcours aboutit de la même façon, simplement plus tard.

## Statuts

| Statut | Sens | Suite |
| --- | --- | --- |
| `CREATED` | Écrite chez nous, pas encore soumise | Relecture dans 15 s si l'appel a échoué |
| `ACCEPTED` | pawaPay a pris la demande ; l'abonné doit valider | Relecture programmée |
| `SUBMITTED` / `PROCESSING` | Chez l'opérateur | Relecture programmée |
| `IN_RECONCILIATION` | pawaPay vérifie de son côté | Rien à faire |
| `COMPLETED` | Encaissé | Livraison |
| `FAILED` | Échec après acceptation | Message d'échec expliqué |
| `REJECTED` | Refus à l'initiation | Message d'échec expliqué |
| `NOT_FOUND` | Jamais parvenue à pawaPay (après 15 min de grâce) | Échec |
| `EXPIRED` | Sans statut final après 24 h | Échec, alerte |

**`NOT_FOUND` n'est pas un échec immédiat.** pawaPay peut répondre ainsi
quelques secondes après l'initiation, le temps de propager la transaction :
conclure tout de suite afficherait un échec à un abonné en train de taper son
code.

## Sécurité du callback

L'endpoint `/billing/webhooks/pawapay/deposits` n'est pas authentifié — pawaPay
ne peut pas porter notre session. Trois protections le remplacent :

| Couche | Rôle | Réglage |
| --- | --- | --- |
| Liste blanche d'IP | Écarte le bruit avant analyse | `PAWAPAY_CALLBACK_IPS` |
| Signature RFC 9421 | Prouve l'origine et l'intégrité | `PAWAPAY_CALLBACK_SIGNATURE` |
| Relecture du statut | Garantie de dernier ressort | — inconditionnelle |

La troisième est la raison pour laquelle `PAWAPAY_CALLBACK_SIGNATURE=log` est
tenable au démarrage : tant que la signature n'est pas activée côté pawaPay, un
faux callback ne peut au pire que provoquer une relecture inutile.

Passer à `enforce` **après** avoir activé les callbacks signés dans le tableau
de bord pawaPay, et vérifié dans les logs que `payment.callback_signature_invalid`
n'apparaît plus.

## Retrouver une transaction

Toutes les entrées mènent à la même fiche dans le panel admin
(**Paiements → détail**) :

- **la référence** donnée au client (`PAY-2026-09-000123`) ;
- **le `depositId`** (identifiant pawaPay) ;
- **l'identifiant opérateur** (`providerTransactionId`), celui qui figure sur le
  SMS de l'abonné ;
- **l'e-mail** du compte ;
- **le numéro de téléphone** complet — comparé par empreinte, jamais stocké en
  clair.

En ligne de commande :

```bash
# Toute la vie d'un paiement, dans l'ordre
grep '"reference":"PAY-2026-09-000123"' logs/payments.log | jq .

# Ce qui a échoué aujourd'hui
grep '"event":"payment.status_changed"' logs/payments.log | jq 'select(.status!="COMPLETED")'
```

Dans MongoDB :

```js
db.payment_transactions.findOne({ reference: 'PAY-2026-09-000123' })
db.payment_events.find({ depositId: '<depositId>' }).sort({ at: 1 })
db.payment_callbacks_raw.find({ depositId: '<depositId>' })   // le brut, rejouable
```

## Diagnostic : où ça s'est arrêté

| Dernier événement | Ce qui s'est passé | Action |
| --- | --- | --- |
| `created` seul | L'appel à pawaPay n'est jamais parti | Vérifier `PAWAPAY_API_TOKEN` et la connectivité |
| `pawapay_error` (indéterminé) | Réponse non reçue, issue inconnue | Rien : la relecture tranchera |
| `pawapay_response` puis silence | L'abonné n'a pas validé | Le statut final viendra, ou expirera |
| `status_changed` FAILED | Refus de l'opérateur | Lire `failureCode` ; le message français est déjà calculé |
| `fulfillment_failed` | **Encaissé mais non livré** | Rejouer la livraison ; c'est l'incident le plus grave |
| `callback_received` sans suite | Traitement interrompu | Le callback brut est en base, rejouable |

## Actions d'administration

Toutes passent par l'API interne (clé `INTERNAL_API_KEY`, en-tête `x-api-key`)
et sont journalisées :

```bash
# Forcer la vérification du statut
curl -X POST -H "x-api-key: $INTERNAL_API_KEY" \
  https://api.idem.africa/billing/internal/payments/PAY-2026-09-000123/recheck

# Redemander le callback à pawaPay
curl -X POST -H "x-api-key: $INTERNAL_API_KEY" \
  https://api.idem.africa/billing/internal/payments/PAY-2026-09-000123/resend-callback

# Rejouer une livraison échouée
curl -X POST -H "x-api-key: $INTERNAL_API_KEY" \
  https://api.idem.africa/billing/internal/payments/PAY-2026-09-000123/fulfill

# Rembourser (motif obligatoire)
curl -X POST -H "x-api-key: $INTERNAL_API_KEY" -H 'Content-Type: application/json' \
  -d '{"reason":"Double paiement constaté","adminId":"…"}' \
  https://api.idem.africa/billing/internal/payments/PAY-2026-09-000123/refund
```

## Configuration

| Variable | Rôle |
| --- | --- |
| `PAWAPAY_API_TOKEN` | Jeton d'API. Absent ⇒ aucun encaissement possible |
| `PAWAPAY_ENV` | `sandbox` (défaut) ou `production` |
| `PAWAPAY_CALLBACK_SIGNATURE` | `enforce`, `log` (défaut) ou `off` |
| `PAWAPAY_CALLBACK_IPS` | Surcharge de la liste blanche (proxy, tunnel) |
| `PAWAPAY_PUBLIC_KEY` | Clé publique de secours, au format PEM |
| `PAYMENTS_ENABLED` | `false` ferme la caisse. Absent ou `true` : c'est le réglage en base qui décide |
| `IDEPLOY_DB_*` | Base PostgreSQL d'iDeploy — lecture des ressources, écriture du plan payé |

Réglages en base (`billing_settings`, modifiables depuis le panel admin) :
`paymentsEnabled` (arrêt d'urgence), `enforcement`, `graceDays`, `reminderDays`,
`enabledCountries`.

**Deux arrêts d'urgence, et c'est voulu.** Le réglage en base ferme la caisse
sans redéploiement, ce qui est le geste courant. `PAYMENTS_ENABLED=false` la
ferme sans dépendre de MongoDB ni du panel — c'est-à-dire le jour où ce sont
justement eux qui posent problème. Les deux passent par
`billingSettingsService.isPaymentsEnabled()` : lire le réglage brut ailleurs
ferait silencieusement sauter le second.

La liste blanche des adresses de retour après paiement n'est pas une variable
d'environnement : elle est codée dans `billing-checkout-page.ts`. Élargir ce qui
protège d'une redirection ouverte doit coûter un redéploiement et une revue, pas
l'édition d'un fichier `.env`.

## Pays ouverts

**Vingt pays**, chacun avec sa propre grille de prix : voir
[la tarification](BILLING.md#tarification).

Les sept pays de la zone franc (CMR, CIV, SEN, BEN, BFA, COG, GAB) partagent le
prix catalogue : XAF et XOF sont à parité, le prix affiché est donc le prix
payé, sans conversion. Les treize autres ont un prix arbitré marché par marché,
jamais une conversion : un prix converti suit un taux de change, alors qu'un
prix se décide en regardant ce que les gens paient déjà sur place.

Ce que nous ouvrons commercialement est une chose ; ce qui encaisse à l'instant
T en est une autre. `paymentCountriesService.available()` croise les deux : les
pays tarifés, et ceux que `GET /active-conf` déclare provisionnés. Un pays sans
grille n'est jamais proposé, et une offre sans prix local est refusée
(`price_unavailable`) plutôt que vendue à un montant deviné.

## Ce qui est verrouillé côté serveur

Les boutons grisés dans l'interface sont du confort ; ces contrôles-ci sont la
garantie. Ils vivent dans `middleware/billing.middleware.ts` :

| Contrôle | Où | Effet |
| --- | --- | --- |
| `requireCredits(engine, action)` | 35 routes de génération (branding, business plan, pitch deck, prévisionnel, kit juridique, communication, cartes, diagrammes, conseiller) | Réserve les crédits **avant** la génération et les rembourse si elle échoue |
| `requireProjectAccess()` | `POST /appgen/handoff`, `POST /github/projects/:projectId/push` | Exige un Project Pass ou un abonnement iCode qui l'inclut — « générer est gratuit, posséder se paie » |
| `requireFeature(clé)` | exports sans filigrane, modèles premium, marque blanche | Réserve une capacité au plan qui la vend |
| `POST /billing/consume` | appelé par les services qui génèrent ailleurs (AppGen) | Applique le même barème, à distance |

### iCode : le moteur vit ailleurs, le barème reste ici

AppGen génère dans `we-dev-next` (serveur Express distinct), pas dans cette
API. Ce service ne décide donc rien : avant de générer, il appelle
`POST /billing/consume` **en relayant le jeton de l'utilisateur**, et renvoie
le refus tel quel. Dupliquer le barème là-bas l'aurait fait diverger d'ici, et
c'est l'argent des clients qui en aurait payé l'écart.

Le contrôle est posé juste avant le choix du mode, dernier instant où rien
n'est parti : aucun en-tête envoyé, aucun appel au modèle. Après le début du
flux, il serait trop tard pour refuser — et le coût d'inférence serait déjà
engagé.

Deux natures d'actions y sont distinguées, conformément à « générer est
gratuit, posséder se paie » :

- **génération initiale** : gratuite mais plafonnée (3/jour en Découverte,
  illimitée à partir de Starter). Le compteur journalier vit dans Redis avec
  expiration — un quota gratuit n'est pas un contrôle de sécurité, donc Redis
  indisponible vaut autorisation ;
- **modifications** : 1 crédit pour un message, 2 pour un build, 3 pour une
  action premium.

Si l'API de facturation est injoignable, `we-dev-next` autorise la génération.
Empêcher de travailler parce qu'un service auxiliaire est tombé coûterait plus
cher que quelques générations non facturées.

Chacun respecte le réglage `enforcement` : `off` (rien), `log` (mesure sans
bloquer, le mode de départ), `enforce` (débit réel).

Le barème suit les **livrables** et non les appels : la première génération
d'une charte coûte 60 crédits, ses déclinaisons sont incluses, et toute relance
de visuels en coûte 10. Les écritures « incluses » apparaissent au relevé à
zéro crédit — l'utilisateur voit ce qu'il a obtenu, et le système sait que
l'inclusion a été consommée.

### iSimulate : payé à l'acte, une exécution par règlement

Une simulation n'est pas facturée en crédits mais à l'unité : elle enchaîne
plusieurs agents et de la recherche externe pendant quelques minutes, un coût
trop concentré pour tenir dans un forfait mensuel.

`requireSimulationPayment()` garde les deux routes de lancement (depuis un
projet IDEM, et depuis un business plan importé). Le contrôle se place **après**
l'accord et la validation des entrées : inutile de réserver un paiement pour
une requête qui sera refusée sur un champ manquant.

La réservation se fait en deux temps, et ce n'est pas un détail :

1. `reserveForSimulation()` pose un jeton sur le paiement par une mise à jour
   conditionnelle — elle n'aboutit que si le règlement n'est pas déjà consommé.
   Vérifier puis lancer laisserait deux requêtes simultanées passer le contrôle
   et démarrer deux exécutions coûteuses pour un seul encaissement ;
2. l'exécution créée, `attachSimulationPayment()` échange le jeton contre son
   identifiant. Si le lancement échoue, `releaseSimulationPayment()` rend le
   règlement à son propriétaire plutôt que de lui facturer une simulation qui
   n'a jamais tourné.

Les bêta-testeurs premium en sont exemptés, et le réglage `enforcement` vaut
ici comme ailleurs. Pendant la bêta produit (`IS_BETA` côté application), le
front ne propose pas le paiement : IDEM prend le coût à sa charge.

### iDeploy : le plan vit dans une autre base

iDeploy est une application Laravel sur PostgreSQL. Écrire son plan au moment
du paiement rendrait l'encaissement dépendant de la disponibilité de cette
seconde base : une coupure de trente secondes, et un client débité se
retrouverait sans le plan qu'il vient d'acheter, sans trace de ce qui manque.

L'intention est donc inscrite dans `billing_sync_jobs` — dans la base qui vient
d'accepter le paiement — puis appliquée par la tâche `ideploy-sync` (toutes les
minutes) qui réessaie avec un délai croissant. Le paiement reste la source de
vérité ; la propagation est une conséquence qui peut prendre son temps.

| Moment | Ce qui est inscrit |
| --- | --- |
| Livraison d'un abonnement ou d'un renouvellement iDeploy | Le plan et l'échéance de la période payée |
| Achat d'un pack de déploiements | Des crédits **ajoutés** au solde, sans toucher au plan |
| Expiration ou résiliation | Retour au plan `hobby`, échéance effacée, crédits déjà payés conservés |

Les deux bases n'ont pas d'identifiant commun : l'e-mail est le seul lien entre
un compte IDEM et une équipe iDeploy. Quand aucune équipe ne correspond — un
client peut payer avant d'avoir ouvert son espace de déploiement — la tâche
réessaie pendant plusieurs heures, puis met le travail de côté avec un motif
lisible. `GET /billing/internal/sync-jobs` le montre,
`POST /billing/internal/sync-jobs/:jobId/retry` le rejoue une fois le compte
créé.

## Monitoring

**Logs** : `logs/payments.log` (canal dédié, collecté par Promtail avec les
autres). Chaque ligne porte `event`, `reference`, `depositId`, `provider`,
`status`, `failureCode`, `durationMs`, et le `requestId` qui relie le paiement
au reste de la requête.

**Métriques** : `payments_initiated_total`, `payments_completed_total`,
`payments_failed_total{failure_code}`, `payment_time_to_final_seconds`,
`pawapay_api_requests_total`, `pawapay_api_duration_seconds`,
`payment_callbacks_total{result}`, `payments_pending_stuck`,
`payment_fulfillment_failures_total`, `credits_debited_total{engine,action}`,
`emails_sent_total{template,status}`, `billing_job_runs_total{job,result}`.

**Alertes** (`idem-admin/monitoring/prometheus/alert-rules.yml`, groupe
`payments_health`) — neuf règles, dont deux sans seuil parce que toute valeur
non nulle est un incident :

| Alerte | Gravité | Déclenchement |
| --- | --- | --- |
| `PaymentFulfillmentFailure` | critique | Un client a payé sans rien recevoir |
| `PaymentCallbackSignatureInvalid` | critique | Signature de callback invalide |
| `PawapayApiErrors` | critique | Plus de 10 % d'appels en erreur |
| `PaymentReconcilerNotRunning` | critique | La réconciliation ne tourne plus |
| `PaymentsStuck` | avertissement | Paiement sans statut final depuis 30 min |
| `PaymentSuccessRateLow` | avertissement | Réussite sous 60 % (volume minimal de 5) |
| `PaymentCallbackIpRejected` | avertissement | Callback d'une IP inconnue |
| `BillingJobFailing` | avertissement | Une tâche planifiée échoue |
| `TransactionalEmailsFailing` | avertissement | Plus de 20 % d'e-mails en échec |

**Tableau Grafana** : `IDEM — Paiements` (uid `idem-payments`) — entonnoir,
réussite par opérateur, motifs d'échec, latence pawaPay, issue des callbacks,
et le journal Loki filtré sur `payment.*`.

## Contrôles

```bash
npm run check:billing           # le catalogue est conforme au business plan
npm run check:payments          # signature, liste d'IP, machine d'états, chiffrement
npm run check:payments:sandbox  # bout en bout sur le bac à sable (réseau + base)
```

Le troisième utilise les numéros de test pawaPay et vérifie le point le plus
important : **rejouer une livraison ne crédite pas deux fois**.

## Mise en production

1. Compte pawaPay en production, jeton créé et déposé dans Secret Manager.
2. `PAWAPAY_ENV=production`.
3. URL de callback déclarée : `https://api.idem.africa/billing/webhooks/pawapay/deposits`.
4. Signature activée côté pawaPay, puis `PAWAPAY_CALLBACK_SIGNATURE=enforce`.
5. IP de production autorisées par l'équipe réseau (voir la liste dans
   `pawapay-signature.ts`).
6. Un paiement réel de bout en bout, sur un petit montant, vérifié dans le
   panel admin.
7. Alertes actives : échec de livraison, paiements bloqués, signature invalide.

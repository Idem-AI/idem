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

Réglages en base (`billing_settings`, modifiables depuis le panel admin) :
`paymentsEnabled` (arrêt d'urgence), `enforcement`, `graceDays`, `reminderDays`,
`enabledCountries`.

## Pays ouverts

La zone franc uniquement au lancement : **CMR, CIV, SEN, BEN, BFA, COG, GAB**.
XAF et XOF partagent la parité fixe avec l'euro, donc le prix affiché est le
prix payé, sans conversion ni risque de change. Ouvrir un marché hors zone
franc suppose une grille de prix dédiée (coefficient de pouvoir d'achat) :
`convertFromXaf()` lève explicitement plutôt que d'appliquer un taux implicite.

Ce que nous ouvrons commercialement est une chose ; ce qui fonctionne à
l'instant T en est une autre, et vient toujours de `GET /active-conf`.

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

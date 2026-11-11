# @idem/shared-promotions

Campagnes, codes promo, bonus de recharge et crédits du jour. **Un seul calcul** (`engine.ts`) sert
à l'API IDEM (au débit du portefeuille) et aux écrans (prix barrés) : ce qu'on affiche est ce qu'on encaisse.

## Où c'est branché

| Endroit | Rôle |
|---|---|
| `apps/api/.../services/billing/promotion.service.ts` | lecture, réservation des limites, journal, coupons, crédits du jour, création de la bêta gratuite au démarrage |
| `walletService.spend` / `walletService.topUp` | toute dépense passe par la promotion ; bonus de recharge |
| `usageQuotaService` | limites d'usage élargies (jamais réduites) par les crédits du jour |
| `GET /billing/promotions` | public (session lue si présente) : ce que les écrans barrent |
| `POST /billing/promotions/claim`, `/billing/codes/redeem` | saisie d'un code promo (même champ que les codes IDEM) |
| `/billing/internal/promotions*` | panel admin (`idem-admin` → page **Promotions**) |

Écrans : landing (offres + tarifs), console (forfaits, packs, barre des livrables, bandeau),
iDeploy (compteurs), iCode (tarifs), iVision (export HD), iSimulate (niveaux).

```ts
// Angular
provideIdemPromotions({ apiUrl: environment.services.api.url });
<idem-promo-price item="pack.lancement" [xaf]="5000" />
<idem-promo-text [text]="'10 F par jour'" item="ideploy.meter" [xaf]="10" />
<idem-promo-banner />

// React
const { promotions } = usePromotions(apiUrl);
<PromoText promotions={promotions} item="icode.project_pass" xaf={1000} text="1 000 F" />
```

## Règles

- Un article absent de `items.ts` n'est jamais remisé. Ajouter un service payant = ajouter son article
  et sa traduction dans `itemOfSpend`.
- Exclusives : la plus avantageuse gagne ; cumulables : appliquées ensuite sur le reste.
- Un plafond (Kit, Croissance) est réduit dans la même proportion qu'une remise en % ; un achat gratuit
  ne compte pas pour le plafond.
- Pendant une remise gratuite, les droits prépayés (modifications incluses, Pass prépayé) ne sont pas consommés.
- Une promotion lancée ne s'efface pas : on y met fin (et on la duplique pour la relancer).

Contrôles : `npm run check:promotions` (racine, calcul pur) et `npm run check:promotions --prefix apps/api`
(de bout en bout, base jetable).

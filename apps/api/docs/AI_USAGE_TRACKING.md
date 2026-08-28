# Traçage de la consommation IA

Toute génération IA de la plateforme est journalisée, en entrée **et** en sortie,
dans la collection MongoDB `ai_usage_events` : un document par appel de modèle.

> Avant cette mise en place, seul le proxy AppGen appelait
> `tokenTrackingService` : l'intégralité du pipeline de génération IDEM
> (`prompt.service.ts`) ne relevait aucun token, et ne lisait même pas les
> métadonnées d'usage renvoyées par les fournisseurs.

## Ce qui est tracé

| Dimension | Champ | Exemple |
| --- | --- | --- |
| Utilisateur | `userId` | uid Firebase |
| Projet | `projectId` | id du projet |
| Fonctionnalité | `feature` | `branding`, `businessPlan`, `design`, `appgen`… |
| Élément | `element` | `logo`, `typography`, `colors`, nom d'étape de génération |
| Nature | `operation` | `generate`, `regenerate`, `edit`, `variant`, `analysis`, `chat`, `appgen` |
| Lot de propositions | `batchId`, `variantCount` | les 4 logos d'un même geste |
| Modèle | `provider`, `modelName` | `gemini` / `gemini-3-flash-preview` |
| Tokens | `inputTokens`, `outputTokens`, `cachedInputTokens`, `totalTokens` | mesurés |
| Coût | `estimatedCostUsd` | estimation USD |
| Fiabilité | `tokensEstimated`, `pricingEstimated` | voir « Fiabilité » plus bas |
| Résultat | `status`, `errorMessage`, `durationMs` | `success` / `error` |
| Corrélation | `requestId`, `source`, `promptType` | rapprochement avec les logs |
| Période | `day` (`YYYY-MM-DD`) | dénormalisé pour les agrégations |

**Les régénérations, les éditions et les propositions non retenues sont
comptées.** Une génération de 4 logos écrit 4 événements partageant un `batchId` :
le coût réel d'un « choix de logo » est la somme du lot, pas celui de la seule
proposition conservée.

**Les échecs sont comptés aussi.** Un modèle qui répond puis casse au parsing a
été facturé ; un repli sur un modèle secondaire produit deux événements. Les
masquer sous-estimerait le coût réel.

## Comment le contexte remonte

Le problème : `prompt.service.ts` est le point de passage unique de tous les
appels de modèle, mais il ne sait pas *ce qu'il génère*. Faire descendre
`projectId` / `feature` / `element` à travers la vingtaine de services de
génération aurait demandé de modifier toutes leurs signatures.

La solution suit l'idiome déjà en place dans le dépôt (`request-language.ts`,
`trace.util.ts`, `revision-context.util.ts`) : un `AsyncLocalStorage`.

```
requête HTTP
  └─ aiUsageContextMiddleware        → feature + operation déduits de la route
       └─ service métier
            └─ withAiUsage({ element, projectId })   → affine
                 └─ promptService.runPrompt()
                      └─ aiUsageService.record()     → lit le contexte
```

Trois niveaux de précision, du plus général au plus précis (le plus précis gagne) :

1. **middleware** — `feature` et `operation` déduits du chemin de la route ;
2. **service** — `withAiUsage()` / `setAiUsageContext()` / `openAiUsageBatch()` ;
3. **appel** — surcharges explicites passées à `aiUsageService.record()`.

### Instrumenter une nouvelle fonctionnalité

Le plus souvent : **rien à faire**. Les générations par sections passent par
`generic.service.ts`, déjà instrumenté — l'élément prend le nom de l'étape.

Pour un élément nommé ou un lot de propositions :

```ts
// Élément identifiable
return withAiUsage({ element: 'businessCard', operation: 'generate' }, () =>
  this.generate(project)
);

// Plusieurs propositions parmi lesquelles l'utilisateur choisira
openAiUsageBatch({ userId, projectId, feature: 'branding', element: 'logo' });
```

Ajouter un segment de route dans `FEATURE_BY_SEGMENT`
(`utils/ai-usage-context.util.ts`) si la nouvelle route n'est pas reconnue.

## Fiabilité des chiffres

Deux drapeaux distinguent le mesuré de l'approximatif — le panel admin les
affiche, un total mêlant les deux ne doit pas passer pour une facture :

- **`tokensEstimated`** — le fournisseur n'a pas renvoyé de métadonnées d'usage
  (certaines passerelles openai-compatible les omettent). Les tokens sont alors
  estimés à ~4 caractères par token. Approximatif, mais préférable à un zéro qui
  rendrait la consommation invisible.
- **`pricingEstimated`** — le modèle est absent de `config/ai-pricing.config.ts`
  et le tarif par défaut a été appliqué.

Les tokens de raisonnement des modèles « thinking » (`thoughtsTokenCount`) sont
ajoutés aux tokens de sortie : les ignorer sous-estimerait fortement le coût.
Les tokens servis par le cache de contexte Gemini sont comptés à part et
facturés au tarif cache réduit.

## Tarifs

`config/ai-pricing.config.ts`, en USD par million de tokens. Résolution par
préfixe le plus long : `gemini-3-flash-preview-0842` hérite du tarif
`gemini-3-flash` au lieu de retomber sur le défaut.

Corriger un tarif sans redéployer :

```bash
AI_PRICING_OVERRIDES='{"gemini-3-flash":{"input":0.25,"output":2}}'
```

## Rétention

Un document par appel de modèle : la collection devient vite la plus grosse de
la base. Un index TTL la purge automatiquement.

```bash
AI_USAGE_TTL_DAYS=400   # 0 = conservation illimitée
```

Les compteurs journaliers de `token_usage` (qui alimentent les plafonds de
`token-tracking.service.ts`) ne sont pas purgés. Ils sont mis à jour par
`aiUsageService.record()` via un `$inc` + upsert **atomique** : une génération de
4 variantes lance 4 écritures concurrentes, et le read-modify-write d'origine
perdait silencieusement des incréments.

## Garantie de non-régression

`aiUsageService.record()` n'échoue jamais : toute erreur est journalisée puis
avalée. Un incident MongoDB sur `ai_usage_events` ne doit pas faire échouer une
génération que l'utilisateur attend. Même principe pour le rollup journalier,
dont l'échec ne perd pas l'événement détaillé déjà écrit.

## Exploitation côté admin

Le panel admin (dépôt privé) lit cette collection en lecture seule. Voir
`idem-admin/apps/api/docs/API.md`, section « Consommation IA » :

- `GET /admin/ai-usage` — dashboard sur une période
- `GET /admin/ai-usage/users/:userId` — consommation d'un utilisateur
- `GET /admin/ai-usage/projects/:projectId` — consommation par élément de projet
- `GET /admin/ai-usage/variant-batches` — coût des choix multi-propositions
- `GET /admin/ai-usage/events` — journal détaillé, un appel par ligne

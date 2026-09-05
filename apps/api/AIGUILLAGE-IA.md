# Aiguillage des modèles IA

Comment décider **quel fournisseur et quel modèle** sert chaque génération, sans
toucher au code.

---

## Le principe : trois niveaux

Du plus général au plus précis. **Le plus précis l'emporte.**

| # | Niveau | Où | Portée |
|---|---|---|---|
| 1 | Ce que la feature déclare | `config/ai.config.ts` | le défaut |
| 2 | `AI_DEFAULT_PROVIDER` | `.env` | **tout**, traduit par rôle |
| 3 | `AI_OVERRIDES` | `.env` | **une génération** précise |

Le point qui rend la bascule utilisable : le niveau 2 **traduit les modèles par
RÔLE**, il ne les remplace pas par un modèle unique. Une section déclarée sur le
modèle de raisonnement reste sur le modèle de raisonnement du nouveau
fournisseur ; un digest reste mécanique. **Le routeur XS/M/S continue de
travailler** — ce qui est précisément ce qu'on veut observer pendant un test.

---

## Basculer sur Gemini (Google AI Studio)

À ajouter dans `apps/api/.env` :

```bash
# ── Fournisseur global ───────────────────────────────────────────────────────
AI_DEFAULT_PROVIDER=GEMINI

# ── Backend Gemini : AI Studio (clé API) plutôt que Vertex (compte de service)
GEMINI_BACKEND=ai-studio
GEMINI_API_KEY=votre_clé_ai_studio

# ── Le cache de préfixe de Z.ai ne s'applique plus : Gemini a le sien, avec un
#    tarif différent. Sans cette ligne, le tableau de bord facturerait les tokens
#    cachés au tarif GLM.
# GLM_CACHED_INPUT_RATIO=
```

Puis **avant de démarrer** :

```bash
cd apps/api
npm run check:provider
```

Le script rejoue la traduction sur les 41 configurations du catalogue et refuse
de valider si l'une d'elles atterrirait sur un modèle que Gemini ne sert pas.

### Modèles retenus

| Rôle | Modèle | Sert |
|---|---|---|
| `mechanical` (XS) | `gemini-3.5-flash-lite` | digests, plans, vérifications, réparations |
| `writing` (M) | `gemini-3.6-flash` | rédaction, le gros du volume |
| `reasoning` (S) | `gemini-3.1-pro-preview` | **business plan, charte, pitch deck**, finance, logo, direction artistique |
| `vision` | `gemini-3.6-flash` | lecture d'image |
| `image` | — | non servi (voir plus bas) |

⚠️ Le rôle `reasoning` est sur `pro` **par le `.env`**, pas par le code : le défaut
de `ai-providers.config.ts` reste `gemini-3.8-flash`, retenu pour la vitesse. La
ligne qui décide est

```bash
IDEM_GEMINI_REASONING_MODEL=gemini-3.1-pro-preview
```

et la commenter suffit à revenir au `flash`.

### Ce qui part réellement sur le modèle de raisonnement

Déclarer `modelName: GLM_MODELS.reasoning` sur une feature ne suffisait pas, et
c'est contre-intuitif : une section rendue par GABARIT est **dépinglée d'office**
(`generic.service.ts`, `pinModel: step.template ? false : …`), et un `baseConfig`
non épinglé ne dicte pas l'étage. Ces sections repartaient donc toujours à
l'étage de leur TÂCHE — `draft` → M, la rédaction — quoi qu'ait déclaré la
feature. Or le gabarit couvre 21 pages sur 24 : le modèle déclaré ne servait
qu'aux trois couvertures.

L'étage de départ est désormais déclaré, et transmis :

| Où | Quoi |
|---|---|
| `ai.config.ts` | `tier: 'S'` sur `businessPlan`, `pitchDeck`, `branding.brandIdentity` |
| `generic.service.ts` | `tier: step.aiConfig?.tier` passé à `runAgent` |

Un étage reste PORTABLE là où un nom de modèle ne l'est pas : sur GLM il vaut
`glm-5.2`, sur Gemini il se traduit par le rôle `reasoning`.

À l'inverse, `branding.colors` et `branding.typography` sont **descendues** à
l'étage de rédaction. Elles coupent le raisonnement (`thinkingBudget: 0`, le code
ayant repris la décision qu'il servait), et un `pro` refuse de ne pas raisonner :
il aurait prélevé ~350 tokens de réflexion sur leurs 6 000 de budget, pour une
délibération devenue sans objet. `npm run check:provider` refuse cette
combinaison.

**La famille 2.5 est retirée aux nouveaux comptes.** Vérifié par appel réel :
`gemini-2.5-flash` et `gemini-2.5-pro` répondent tous deux `404 — no longer
available to new users`, en renvoyant vers les 3.x.

**Le critère de choix est le RAISONNEMENT, pas la puissance.** Les tokens de
réflexion se décomptent de `maxOutputTokens` : sur un budget serré, la réflexion
consomme l'enveloppe et la réponse revient VIDE — pas une erreur, pas une
troncature visible, rien. Mesuré sur le cas réel de l'étage XS (JSON, 1 024
tokens) :

| Modèle | Sans consigne | `thinkingBudget: 0` traduit |
|---|---|---|
| `gemini-3.5-flash-lite` | 0 token de réflexion | 0 |
| `gemini-3.6-flash` | **461** | **0** |
| `gemini-3.1-pro-preview` | 386 | 349 — plancher `low` |

D'où l'affectation : `flash-lite` à l'étage mécanique (il ne réfléchit pas), et
`pro` réservé aux rôles où la réflexion est justement ce qu'on achète — il
**refuse** de ne pas raisonner (« only works in thinking mode »).

**Trois dialectes pour une seule intention.** La configuration dit
`thinkingBudget: 0` ; le code le traduit (`config/ai-providers.config.ts`,
`buildGeminiThinkingConfig`) :

```
famille 2.5   thinkingConfig: { thinkingBudget: 0 }
3.x flash     thinkingConfig: { thinkingLevel: 'minimal' }
3.x pro       thinkingConfig: { thinkingLevel: 'low' }     ← son plancher
GLM           extraBody: { thinking: { type: 'disabled' } }
```

### Où le raisonnement est COUPÉ, et pourquoi

Le raisonnement n'est pas une qualité en soi : c'est un achat. Il se justifie là
où le **code n'a pas repris la décision** — partout ailleurs, il ne change plus
la sortie, mais se décompte de `maxOutputTokens` et se paie en latence.

Ce que le code a repris, et qui n'a donc plus à être délibéré :

| Décision | Reprise par | Effet |
|---|---|---|
| la mise en page | le gabarit (`sectionRenderer`) | 21 pages sur 24 |
| la conformité de charte | le linter (`slopLint`) | toutes |
| la structure d'une page | l'étape de plan (M5 ①) | toutes les sections |
| l'unicité chromatique | 648 régions tirées | `branding.colors` |
| l'unicité typographique | les registres tirés | `branding.typography` |

Ce qui le garde : `branding.logo` (géométrie SVG paramétrique — sans réflexion le
modèle approxime au lieu d'énumérer), `finance.autofill` (36 mois de séries qui
doivent s'additionner), `branding.artDirection` (un arbitrage par projet, qui se
propage partout), et les **pages laissées en composition libre** — les trois
couvertures et les neuf pages de charte hors gabarit, où le modèle compose
vraiment.

**Mesuré sur une génération complète : 34 appels raisonnaient, il en reste 11
(68 % coupés).** Sur `gemini-3.6-flash`, chaque appel coupé économise les 461
tokens de réflexion mesurés plus haut, soit ~9 700 tokens par génération — et
le temps de les produire.

La coupure des sections sous gabarit est posée sur le CHEMIN
(`templatedLlmOptions`, dans `config/ai.config.ts`), pas dans les configurations :
les trois features concernées sont mixtes — sections templatées d'un côté,
couverture libre de l'autre — et couper au niveau de la feature dégraderait
justement la page qui n'a aucun filet. Elle émet les **deux dialectes**, faute
de quoi elle ne survivrait pas à une bascule de fournisseur.

---

Envoyer le mauvais dialecte n'est pas bénin : `thinkingBudget: 0` sur un 3.x
renvoie `400 INVALID_ARGUMENT`, et `thinkingLevel: 'minimal'` sur un `pro`
renvoie `400 — not supported for this model`.

Chaque rôle est surchargeable sans toucher au code :

```bash
IDEM_GEMINI_REASONING_MODEL=gemini-3.8-flash
IDEM_GEMINI_WRITING_MODEL=gemini-3.5-flash
```

### La sonde réelle

Aucune analyse statique ne détecte un modèle retiré : le nom est correct, la
documentation le mentionne, et le 404 arrive en pleine génération, loin de sa
cause, après que la chaîne de repli s'est épuisée sur des modèles eux aussi
indisponibles.

```bash
AI_PROBE=1 npm run check:provider
```

Un appel par modèle déclaré — table des rôles **et** chaîne de repli, car c'est
elle qui sert au pire moment. Coût négligeable, à lancer après tout changement
de fournisseur ou de modèle.

### Ce qui dégrade sans GLM

| Fonctionnalité | Comportement |
|---|---|
| Génération d'image (mockups de charte, visuels) | dégradée — gardée par `isGlmConfigured()`, la page est omise plutôt que produite vide |
| Analyse d'image (vision) | dégradée, même garde |
| Recherche web | **bascule sur le grounding natif Google Search** — fonctionne |

Les deux premières passent par `services/glm-media.service.ts`, qui vise des
endpoints propres à Z.ai. Elles ne cassent pas la génération : les appelants les
gardent derrière `isGlmConfigured()`.

---

## Surcharger une génération précise

`AI_OVERRIDES` est un objet JSON. La clé est le **`promptType` de l'appel**.

```bash
# Tout sur Gemini, sauf le logo qui reste sur GLM
AI_DEFAULT_PROVIDER=GEMINI
AI_OVERRIDES='{"Logo Concept":{"provider":"GLM"}}'

# Une seule section sur le modèle de raisonnement
AI_OVERRIDES='{"Financial Plan":{"role":"reasoning"}}'

# Épingler un modèle précis, pour reproduire un défaut
AI_OVERRIDES='{"Market":{"provider":"GEMINI","modelName":"gemini-3.8-flash"}}'

# Tout le socle mécanique au plus bas, sections inchangées
AI_OVERRIDES='{"section-digest":{"role":"mechanical"},"section-planner":{"role":"mechanical"}}'

# Joker : tout ce qui n'a pas d'entrée propre
AI_OVERRIDES='{"*":{"role":"writing"},"Cover Page":{"role":"reasoning"}}'
```

### `role` ou `modelName` ?

**Préférez `role`.** Une surcharge par rôle survit à un changement de
fournisseur ; un nom de modèle devient faux. `modelName` est l'échappatoire pour
épingler une version précise — utile pour reproduire un problème, à ne pas
laisser en place.

### Correspondance des clés

Trois formes, de la plus précise à la plus large :

1. **exacte** — `"Financial Plan"`
2. **par préfixe** — `"Logo Concept"` couvre `Logo Concept 1`, `Logo Concept 2`…
   Indispensable : plusieurs générations numérotent leur étape. Entre deux
   préfixes qui correspondent, le plus long gagne.
3. **`*`** — le reste

Pour connaître les clés disponibles :

```bash
npm run check:provider     # section 6 : « Clés adressables »
```

Et pour savoir ce qui s'est réellement passé à l'exécution, le journal le dit à
chaque appel :

```
Aiguillage: surcharge "Logo Concept → GLM/glm-5.2" (promptType=Logo Concept 1)
Aiguillage: bascule globale GLM/glm-4.7 → GEMINI/gemini-3.6-flash
```

---

## Revenir en arrière

Retirer `AI_DEFAULT_PROVIDER` du `.env` suffit : chaque feature reprend le
fournisseur qu'elle déclare. Aucune migration, aucun code à modifier.

---

## Ce que la bascule ne change pas

Le rendu par gabarit, l'unicité par graine, les contrastes calculés, la
réparation déterministe et le contrôle de charte sont produits par du **code**.
Ils sont donc identiques sur GLM, Gemini ou GPT — c'est tout l'objet du
dispositif. Les cinq harnais le vérifient sans appeler un modèle :

```bash
npm run check:all
```

Ce qui change avec le fournisseur, c'est ce que le modèle apporte : l'angle, le
choix des faits, la formulation. C'est exactement ce qu'on veut mesurer d'un
fournisseur à l'autre.

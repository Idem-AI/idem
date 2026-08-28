# Architecture d'orchestration IA

Comment IDEM fait travailler plusieurs modèles ensemble, et pourquoi c'est
construit ainsi. À lire avant d'ajouter une génération, un agent ou un modèle.

## Le principe

> **L'orchestrateur est du code déterministe. Un agent n'est justifié que là où
> le chemin n'est pas connu à l'avance.**

Générer un business plan de 9 sections, c'est un plan connu à l'avance → c'est un
**workflow**. Répondre à « pourquoi mon déploiement casse ? », ce n'est pas un
plan connu → c'est un **agent**.

Transformer chaque génération en essaim d'agents autonomes coûterait 3 à 10× plus
cher en tokens, pour une latence non bornée et un résultat non reproductible —
donc infacturable proprement, alors que le produit vend des crédits.

| Flux | Modèle d'exécution |
|---|---|
| Business plan, pitch deck, branding, docs légaux | Graphe déterministe + digests |
| Business plan sourcé, prévisions financières | Équipe de recherche (`research/`) |
| Chat advisor, édition de section | Agent à outils (Context Engine) |
| iCode, debug de déploiement | Agent (chemin inconnu par nature) |
| Cohérence inter-artefacts | Critique événementiel (`coherence/`) |

## Les briques

```
services/agents/
├── agent-runtime.ts        Exécution d'un agent: routage, escalade, budget, trace
├── run-budget.ts           Plafond de consommation d'un run (module pur)
├── deliverable-graph.ts    Qui dépend de qui, par livrable
├── section-digest.service.ts   Réduction d'une section à ses faits
├── quality-gate.ts         Contrôle déterministe d'une sortie (module pur)
├── section-verifier.service.ts Réparation bornée d'une sortie défaillante
└── text-extract.ts         Extraction du texte utile (module pur)

config/
├── ai.config.ts            Réglages par feature et par section
└── model-router.ts         Étages de modèles XS / M / S
```

### 1. Le runtime d'agent

Tout appel IA à rôle passe par `runAgent()`. Un agent est une **déclaration** :

```ts
const result = await runAgent(
  {
    role: 'section-writer',
    task: 'draft',              // → étage de départ
    baseConfig: { ... },        // modèle imposé par la feature (prioritaire)
    tools: CONTEXT_TOOL_DECLARATIONS,
    toolExecutor: createContextToolExecutor(userId, projectId),
    validate: qualityValidator({ format: 'html' }),
  },
  { messages, userId, projectId, element: 'Financial Plan', budget }
);
```

Le runtime fournit, pour tout le monde et une seule fois : boucle d'outils,
repli sans outils si elle échoue, escalade d'un cran si le contrôle échoue,
décompte du budget, ventilation du coût par élément, trace `agent.*`.

### 2. Les graphes de livrables

Les dépendances entre sections vivent dans `deliverable-graph.ts`, pas dans les
services. Elles sont validées (cycles, noms inconnus) et mesurées : la
**profondeur du graphe est le multiplicateur de latence** du livrable.

Les graphes actuels font 3 vagues. Ajouter une dépendance « logique mais
accessoire » coûte potentiellement une vague entière — s'en tenir aux liens qui
évitent une vraie contradiction.

```
Business plan   V1 Cover Page · Opportunity · Target Audience · Products & Services
                V2 Company Summary · Marketing & Sales · Financial Plan
                V3 Goal Planning · Appendix

Pitch deck      V1 Cover · Problem · Market · Team · Business Model
                V2 Solution · Product · Competition · Financials
                V3 Traction · Ask
```

### 3. Les digests

Une dépendance ne transporte **pas** le texte de la section amont, mais son
digest : les faits, les chiffres, les noms, sans balisage. Réduction typique
15 à 30×.

L'ancien comportement — concaténer le texte intégral de toutes les étapes
précédentes — faisait croître le prompt de la n-ième section avec la somme des
n−1 précédentes. Sur 9 sections de ~12k tokens, la facture d'entrée dépassait
celle du contenu produit.

Trois modes, via `IPromptStep.contextMode` :

- `digest` (défaut dès qu'il y a des dépendances) ;
- `full` — texte intégral, à réserver aux cas où les noms exacts comptent
  (Mermaid : un résumé perdrait les noms de nœuds à réutiliser) ;
- `none`.

### 4. Le routeur de modèles

Trois étages, surchargeables par variable d'environnement
(`IDEM_TIER_XS_MODEL`, `IDEM_TIER_M_MODEL`, `IDEM_TIER_S_MODEL`) :

| Étage | Pour quoi | Défaut |
|---|---|---|
| **XS** | résumé, vérification, réparation, classification, extraction | `gemini-2.5-flash` |
| **M** | rédaction, structuration | `gemini-3-flash-preview` |
| **S** | stratégie, chiffres, création visuelle | `gemini-3.1-pro-preview` |

Une section se route en déclarant `tier` dans `ai.config.ts` :

```ts
'Cover Page': { tier: 'M', llmOptions: { maxOutputTokens: 9000 } },
```

Règles de priorité, du plus fort au plus faible : `modelName` déclaré sur la
section → `tier` de la section → `tier` de la feature → `modelName` de la
feature. Une décision explicite n'est jamais écrasée par le routeur.

**L'escalade** : un agent ne réessaie que si son `validate` échoue, et d'un seul
cran. Sans contrôle de sortie, pas d'escalade — on ne paie jamais deux fois pour
rien.

### 5. Le contrôle de sortie

Trois paliers, du gratuit vers le payant :

1. **Grille déterministe** (`quality-gate.ts`) — troncature, balises
   déséquilibrées, bloc de code résiduel, gabarit non rempli, fuite du prompt
   interne, bavardage de modèle, dérive de devise. Coût : zéro.
2. **Réparation déterministe** — retrait des fences et de la phrase d'intro.
   Coût : zéro.
3. **Réparation IA** — une seule passe, au tier bas, uniquement sur ce que le
   code ne sait pas corriger, et seulement si le contenu est assez court pour
   que ce soit rentable.

Au-delà, la section est livrée **avec un drapeau** plutôt que de dépenser en
aveugle. Pas de débat entre agents, pas de boucle critique → réécriture.

### 6. Le budget de run

Chaque livrable ouvre un `RunBudget` (dérivé des budgets de sortie déclarés,
avec un facteur 3 pour l'entrée et une escalade). Un run normal ne l'atteint
jamais ; un run qui dérape s'arrête au lieu de creuser.

C'est une **estimation** (≈ 4 caractères/token) qui sert de coupe-circuit. La
facturation reste `aiUsageService`, alimenté par les compteurs réels du
fournisseur.

## Ajouter une génération

```ts
const steps: IPromptStep[] = [
  { stepName: 'Section A', promptConstant: PROMPT_A },
  { stepName: 'Section B', promptConstant: PROMPT_B },
];

const configuredSteps = withGraph(AI_CONFIG.maFeature, steps, MON_GRAPHE, {
  format: 'html',
  minChars: 300,
  currency: project.analysisResultModel?.finance?.meta?.currency,
});

await this.processStepsWithStreaming(configuredSteps, project, callback, promptConfig, 'ma_feature', userId);
```

`withGraph` pose les dépendances, le mode de contexte, l'accès aux outils et les
réglages IA de chaque section. Il n'y a rien d'autre à câbler.

## Vérifier le socle

```bash
npm run check:agents
```

Exerce les parties pures — graphes, grille de qualité, routeur, budget,
extraction — sans réseau ni base. À lancer après toute modification de
`services/agents/` ou `config/model-router.ts`.

## Suivre ce qui se passe

Les événements sont tracés dans `logs/ai-trace.log` (voir `TRACING.md`) :

| Événement | Sens |
|---|---|
| `agent.start` / `agent.end` | rôle, étage, tours d'outils, tokens estimés, durée |
| `agent.escalation` | un contrôle a échoué, on monte d'un étage |
| `agent.digest_built` | ratio de réduction obtenu sur une section |
| `agent.budget_exhausted` | un run a atteint son plafond |
| `quality.gate_failed` | défauts détectés sur une sortie |
| `quality.repaired_deterministic` | corrigé sans appel modèle |
| `quality.repaired_by_model` | corrigé par la passe de réparation |
| `quality.flagged` | livré avec défauts subsistants |

## Où NE PAS ajouter d'agent

- Une génération dont l'enchaînement est connu : c'est un graphe.
- Une vérification exprimable en code : c'est la grille déterministe.
- Un choix de modèle : c'est le routeur.
- Une boucle « et si on redemandait au modèle » sans borne : non.

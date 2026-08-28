# Context Engine + Chronicle — la « cohérence infinie » d'IDEM

> Système de connaissance projet pour les agents IA : chaque agent récupère la
> bonne donnée, au bon moment, au bon grain — et peut interroger l'historique
> complet des modifications comme un dépôt git.

## 1. Le problème

La promesse d'IDEM est une **cohérence infinie** entre toutes les applications :
l'IA connaît tout du projet, ou sait quoi chercher, où et quand. Avant ce
système :

- chaque feature IA assemblait son contexte à la main (l'advisor n'injectait que
  la fiche projet — jamais le branding, le business plan ni les finances) ;
- aucun function calling : le modèle ne pouvait rien aller chercher lui-même ;
- aucune trace de **qui** (utilisateur ou IA) avait modifié **quoi** et
  **quand** : une donnée mise à jour par l'utilisateur pouvait contredire ce que
  l'IA croyait savoir, sans aucun moyen de le détecter.

## 2. Méthodologie — recherche croisée

Quatre corpus de sources convergent vers la même architecture :

| Corpus | Enseignement clé |
|---|---|
| [Anthropic — Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | Ne pas pré-charger tout le contexte : maintenir des **identifiants légers** (une « carte ») et faire du **just-in-time retrieval** via des tools. Stratégie hybride : petit noyau toujours en contexte + le reste à la demande. |
| [Anthropic — Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents) | Peu d'outils bien nommés (namespace), descriptions prescriptives, réponses **token-efficientes** (résumé par défaut, `detail=full` à la demande, pagination/troncature), erreurs en langage naturel. |
| [Pattern MongoDB — Document Versioning](https://www.mongodb.com/docs/manual/data-modeling/design-patterns/data-versioning/document-versioning/) + [Zep/Graphiti — bi-temporal knowledge graph](https://blog.getzep.com/content/files/2025/01/ZEP__USING_KNOWLEDGE_GRAPHS_TO_POWER_LLM_AGENT_MEMORY_2025011700.pdf) | Historique dans une **collection séparée** (document courant intact), snapshots + deltas, indexes sur (docId, version, date), éviter le micro-versioning. Modèle **bi-temporel** : un fait est valide de sa création jusqu'à sa **supersession** — on n'efface jamais, on invalide. |
| Industrie ([Replit checkpoints/App History](https://blog.replit.com/inside-replits-snapshot-engine), Lovable, v0) | Un **checkpoint après chaque interaction IA** + restauration en un clic est devenu le standard UX des produits de génération. La restauration crée un nouvel état (l'historique reste intact), façon `git revert`. |

Divergences tranchées :

- **Event sourcing complet vs versioning de documents** : l'event sourcing
  (rejouer des événements métier) est plus puissant mais exige de réécrire
  toutes les écritures. Le pattern *Document Versioning* s'insère dans
  l'existant via un seul point de passage (le repository) → retenu.
- **Base spécialisée (Dolt, TerminusDB, XTDB) vs MongoDB existant** : aucune
  nouvelle infrastructure ; MongoDB + snapshots/deltas RFC 6902 couvre 100 % du
  besoin → retenu.
- **RAG vectoriel vs recherche agentique** : à l'échelle d'UN projet (quelques
  centaines de Ko structurés), la recherche plein-texte + navigation par
  sections est plus fiable et moins coûteuse que des embeddings. Le RAG
  sémantique reste une extension possible (phase 4).

## 3. Architecture

```
                        ┌──────────────────────────────┐
        agents IA ────▶ │  PromptService.runPromptWithTools  (boucle Gemini FC) │
   (advisor, à venir:   └──────────────┬───────────────┘
    branding, BP, …)                   │ tools project_*
                        ┌──────────────▼───────────────┐
   dashboard / apps ──▶ │        CONTEXT ENGINE         │
   (REST /project/…)    │  carte · sections · recherche │
                        └───────┬───────────────┬──────┘
                                │               │
                     ┌──────────▼─────┐  ┌──────▼──────────────┐
                     │ context-registry│  │ CHRONICLE            │
                     │ (12 sections)   │  │ log·show·diff·at·restore │
                     └──────────┬─────┘  └──────▲──────────────┘
                                │               │ record (hook)
                        ┌───────▼───────────────┴──────┐
                        │ MongooseRepository (écritures projet)│
                        │  projects  +  project_revisions      │
                        └──────────────────────────────┘
```

### 3.1 Context Engine (lecture just-in-time)

- **`context-registry.ts`** — source de vérité unique : 12 sections
  (`overview`, `branding`, `businessPlan`, `pitchDeck`, `legalDocs`, `design`,
  `landing`, `architectures`, `development`, `communication`, `finance`,
  `deployments`), chacune avec sa description orientée agent et son extracteur.
- **`context-engine.service.ts`** :
  - `getProjectMap` — le « sommaire » : existence, taille, version courante,
    dernier auteur (user/IA) et date par section. C'est le noyau compact injecté
    en contexte (progressive disclosure) ;
  - `getSection(detail, path)` — résumé token-efficient par défaut (chaînes
    longues tronquées, tableaux échantillonnés), contenu intégral sur un chemin
    précis à la demande ;
  - `searchProject` — recherche plein-texte → `section + chemin + extrait`,
    pour que l'agent sache ensuite *quoi* demander et *où*.

### 3.2 Chronicle (versioning interrogeable comme git)

- Collection **`project_revisions`** (pattern MongoDB Document Versioning) :
  une révision = un commit sur une section. Champs : `version` monotone par
  (projet, section) — l'index unique sert de verrou optimiste —, `author`
  (user/ai/system + uid), `source` (route d'origine), `summary` (message de
  commit auto-généré), `changedPaths`, `patch` (delta RFC 6902), `snapshot`
  (v1 + toutes les 10 versions + patchs volumineux), `sizeBytes`, `createdAt`.
- **Modèle bi-temporel light** (Zep/Graphiti) : une version est valide de son
  `createdAt` jusqu'au `createdAt` de la suivante. Rien n'est effacé.
- **`version-history.service.ts`** : `record` (commit), `log`, `show`
  (reconstruction snapshot + deltas), `diff`, `versionAt`/`stateAt` (checkout
  temporel), `latestVersions`.
- **Capture automatique** : hook dans `MongooseRepository.create/update`
  (`project-revision-hook.ts`) — point de passage unique de toutes les
  écritures projet. Aucun service métier modifié. Les sections conversationnelles
  (`advisorConversation`, `activeChatMessages`) sont exclues (anti
  micro-versioning).
- **Attribution** : middleware `revisionContextMiddleware` (AsyncLocalStorage,
  même pattern que `request-language.ts`) — auteur `user` par défaut, `ai` sur
  les routes de génération, surcharge possible par service via
  `markRevisionAsAI()` / `setRevisionNote()`.
- **`json-patch.util.ts`** : diff/apply RFC 6902 maison (add/remove/replace,
  pointeurs RFC 6901), zéro dépendance, format d'historique stable et auditable.

### 3.3 Boucle agentique (Gemini function calling)

`PromptService.runPromptWithTools` — même choke point que `runPrompt` (quota,
directive de langue, fallback modèle) :

1. envoie `systemInstruction` + conversation + `functionDeclarations` ;
2. exécute les `functionCalls` retournés (y compris parallèles) via
   l'exécuteur lié côté serveur à `(userId, projectId)` — l'agent **ne peut
   pas** accéder à un autre projet, la sécurité est structurelle ;
3. renvoie les `functionResponse` au modèle, jusqu'à la réponse finale
   (max 8 tours, puis réponse forcée sans outils) ;
4. un seul incrément de quota par message, quel que soit le nombre de tours.

### 3.4 Les 7 outils exposés aux agents (`context-tools.ts`)

| Outil | Équivalent git | Usage |
|---|---|---|
| `project_get_map` | `ls` + `git status` | Quelles données existent, versions, fraîcheur |
| `project_get_section` | `cat` | Contenu (résumé ou intégral, sous-chemin) |
| `project_search` | `grep` | Localiser une info sans connaître la section |
| `project_history_log` | `git log` | Qui a changé quoi, quand |
| `project_history_show` | `git show` | État exact à une version |
| `project_history_diff` | `git diff v1..v2` | Ce qui a changé entre deux versions |
| `project_state_at_date` | `git checkout @{date}` | État à une date (donnée modifiée depuis par l'utilisateur) |

### 3.5 API REST (dashboard + autres apps)

Routes `context.routes.ts`, montées sur `/project` :

- `GET /project/context/:projectId/map`
- `GET /project/context/:projectId/section/:section?detail=&path=`
- `GET /project/context/:projectId/search?q=`
- `GET /project/history/:projectId?section=&limit=`
- `GET /project/history/:projectId/:section/version/:version`
- `GET /project/history/:projectId/:section/diff?from=&to=`
- `GET /project/history/:projectId/:section/at?date=`
- `POST /project/history/:projectId/:section/restore` `{ version }`

### 3.6 Premier agent branché : l'advisor

`advisor.service.ts` utilise désormais la stratégie hybride : fiche synthétique
toujours en contexte + `ADVISOR_TOOLS_GUIDE` + les 7 outils. En cas d'échec de
la boucle agentique, repli automatique sur le flow simple (résilience).

## 4. Pièges identifiés et évités

- **Index sur champ Mixed volumineux** : l'index de reconstruction des
  snapshots est *partiel* (`partialFilterExpression`) — on n'indexe jamais la
  valeur du snapshot (limite de taille des clés d'index MongoDB).
- **Micro-versioning** : sections conversationnelles exclues ; pas de baseline
  v1 pour une section vide ; une révision n'est créée que si le diff est non
  vide (les Dates/ISO sont normalisées avant comparaison).
- **L'historique ne casse jamais l'écriture métier** : `record()` attrape tout.
- **Réponses d'outils bornées** (30 000 caractères) + résumés par défaut :
  le contexte de l'agent ne peut pas exploser.
- **Écritures concurrentes** : index unique (projectId, section, version) +
  retry — jamais deux révisions avec le même numéro.

## 4 bis. Coherence Guard — synchronisation intelligente entre artefacts

Cas réel à l'origine de ce module : l'utilisateur demande « quel est mon modèle
de revenu » ; le business plan contient la réponse (abonnements 5–20 €/mois +
commissions 5 %), mais le module Finance est vide — et l'advisor répondait
depuis le seul module Finance (« aucun produit enregistré »). Deux problèmes :

1. **Court-circuit** : la détection d'intention finance répondait AVANT la
   boucle agentique. → Corrigé : les intentions de *lecture* passent désormais
   par la boucle agentique, qui croise `project_finance_summary` **et**
   `project_get_section('businessPlan')` (règle de croisement obligatoire dans
   le prompt système). Le flux de *mutation* avec confirmation reste intact.
2. **Désynchronisation** : business plan et prévisions financières décrivent la
   même réalité économique mais vivaient sans lien. → Le **Coherence Guard** :

- **Règles déclaratives** (`coherence-rules.ts`) : chaque règle lie deux
  sections et décrit son « contrat de cohérence » (v1 : businessPlan↔finance,
  overview↔businessPlan ; extensible : branding↔landing…).
- **Détection automatique** : le hook Chronicle, après chaque commit de
  section, programme un audit IA (debounce 8 s) de chaque règle touchée.
  L'audit compare les deux sections (résumés bornés) et rend un verdict JSON
  (cohérent / incohérences + actions). Pas de quota utilisateur consommé.
- **Alertes** : collection `coherence_alerts` — une seule alerte ouverte par
  (projet, règle), les précédentes sont marquées `superseded`.
- **Application EXPLICITE, jamais silencieuse** : la proposition
  `finance_autofill` réutilise l'autofill Finance existant (attribution `ai`
  dans Chronicle) après confirmation de l'utilisateur. Principe produit :
  *détection automatique, application confirmée* — on n'écrase jamais les
  données utilisateur sans son accord.
- **Anti-boucle** : les écritures issues d'un apply (`/coherence/` dans la
  source) ne redéclenchent pas d'audit.
- **Exposition** : REST (`GET /project/coherence/:projectId`, `POST …/check`,
  `POST …/:alertId/apply`, `POST …/:alertId/dismiss`) + outil agent
  `project_coherence_alerts` (l'advisor signale les désynchronisations en
  conversation et propose les actions).
- Désactivable via `COHERENCE_CHECKS_ENABLED=false`.

## 5. Feuille de route

1. **Fait** — socle : registry, Context Engine, Chronicle, hook repository,
   boucle FC Gemini, 9 outils, API REST, advisor branché, Coherence Guard
   (businessPlan↔finance).
2. **Étendre aux autres agents** : injecter la carte + outils dans les
   générations branding / business plan / communication / déploiement (chaque
   génération devient « consciente » des autres artefacts → cohérence
   inter-artefacts réelle).
3. **UI dashboard** : timeline de versions par section (log), diff visuel,
   bouton « Restaurer cette version » (l'API existe déjà).
4. **Extensions** : résumés de section pré-calculés en cache Redis ;
   RAG sémantique si les projets grossissent ; serveur MCP exposant les mêmes
   outils aux apps externes (ideploy, appgen) ; politique de rétention
   (TTL/archivage des vieilles révisions).

## 6. Sources

- Anthropic — [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- Anthropic — [Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
- Anthropic — [Building effective agents](https://www.anthropic.com/research/building-effective-agents)
- MongoDB — [Document Versioning Pattern](https://www.mongodb.com/docs/manual/data-modeling/design-patterns/data-versioning/document-versioning/) · [Building with Patterns: Document Versioning](https://www.mongodb.com/company/blog/building-with-patterns-the-document-versioning-pattern)
- Zep — [A Temporal Knowledge Graph Architecture for Agent Memory](https://arxiv.org/html/2501.13956v1) · [Graphiti](https://neo4j.com/blog/developer/graphiti-knowledge-graph-memory/)
- Replit — [Inside Replit's Snapshot Engine](https://blog.replit.com/inside-replits-snapshot-engine) · [App History powered by Neon branches](https://neon.com/blog/replit-app-history-powered-by-neon-branches)
- Google — [Function calling with the Gemini API](https://ai.google.dev/gemini-api/docs/function-calling) · [js-genai SDK](https://github.com/googleapis/js-genai)
- IETF — [RFC 6902 (JSON Patch)](https://datatracker.ietf.org/doc/html/rfc6902) · [RFC 6901 (JSON Pointer)](https://datatracker.ietf.org/doc/html/rfc6901)

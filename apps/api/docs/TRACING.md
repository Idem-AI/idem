# Traçage en temps réel — comment observer ce que fait l'IA

> Basé sur le système de logging existant (Winston). Aucune nouvelle
> infrastructure : un fichier de log dédié + une corrélation automatique.

## 1. Ce qui a été ajouté

### Corrélation automatique (`requestId`)

Chaque requête HTTP reçoit un identifiant unique (`requestId`), généré par
[request-trace.middleware.ts](../api/middleware/request-trace.middleware.ts) et
propagé via `AsyncLocalStorage` (même mécanisme que la langue et le contexte de
révision). Le logger ([config/logger.ts](../api/config/logger.ts)) l'injecte
**automatiquement dans CHAQUE ligne de log existante** — `requestId`, `userId`
(dès l'authentification) et `projectId` (dès qu'une route/tool/service le
connaît) — sans avoir touché aux ~200 appels `logger.info/warn/error(...)`
déjà présents dans la codebase.

L'ID est aussi renvoyé en en-tête `X-Request-Id` de la réponse HTTP.

### Affichage console (terminal `npm run dev`)

Le format console montre les métadonnées **inline** pour les événements de
traçage — c'est le moyen le plus direct de suivre en temps réel dans le
terminal où tourne l'API :

```
23:01:22 info: ai.agentic_turn · req=bb5282b4 turn=2 decision=tool_calls tools=[{"name":"project_finance_summary"}] userId=user123 projectId=proj456
23:01:22 info: ai.tool_call_end · req=bb5282b4 tool=project_finance_summary durationMs=42 ok=true …
23:01:22 info: chronicle.commit · req=bb5282b4 section=businessPlan version=3 authorType=user …
```

Les logs texte classiques (qui portent déjà tout dans leur message) restent
affichés tels quels. Seuls les événements `logAIEvent` (avec un champ `event`)
reçoivent le suffixe `· clé=valeur …`.

### Un fichier dédié : `logs/ai-trace.log`

En plus des fichiers existants (`combined.log`, `error.log`), un nouveau
fichier isole uniquement les événements de traçage IA/Chronicle/Coherence/HTTP
(reconnus par leur champ `event`, namespacé) :

```
tail -f apps/api/logs/ai-trace.log | jq .
```

Chaque ligne est un JSON avec au minimum : `timestamp`, `level`, `message`
(= le nom de l'événement), `event`, `requestId`, `userId`, `projectId` (si
connus), et les champs spécifiques à l'événement.

## 2. Les événements tracés

| Événement | Où | Ce qu'il montre |
|---|---|---|
| `http.request_start` / `http.request_end` | toute requête | méthode, route, code retour, durée |
| `ai.agentic_loop_start` / `ai.agentic_loop_end` | `PromptService.runPromptWithTools` | modèle, nombre de tours utilisés, durée totale |
| `ai.agentic_turn` | chaque tour de la boucle Gemini | l'IA a-t-elle appelé des outils ou donné sa réponse finale ? avec quels arguments ? |
| `ai.tool_call_start` / `ai.tool_call_end` | chaque appel d'outil (`project_*`) | quel outil, avec quels arguments, résultat (aperçu), succès/erreur, durée |
| `chronicle.commit` | chaque révision enregistrée | projet, section, version, auteur (user/ai/system), chemins modifiés |
| `chronicle.query` | `log` / `show` / `diff` / `stateAt` | ce que l'IA (ou le dashboard) est allé chercher dans l'historique |
| `coherence.scheduled` | après une écriture projet | quelle règle de cohérence va être auditée, dans combien de temps |
| `coherence.verdict` | fin de l'audit IA | cohérent ou non, nombre d'incohérences, autofill recommandé |
| `coherence.alert_created` | une alerte est créée | règle, nombre d'incohérences, proposition d'autofill |
| `advisor.message_received` / `advisor.finance_intent` / `advisor.tool_loop_fallback` / `advisor.reply_ready` | chaque message advisor | intention détectée, repli éventuel, longueur/durée de la réponse |

## 3. Exemple : suivre une question de bout en bout

Pour la question « quel est mon modèle de revenu ? » vous verrez dans
`ai-trace.log` (même `requestId`) :

```
http.request_start        { method: POST, path: /project/advisor/:id/messages }
advisor.message_received  { messageLength: 32 }
advisor.finance_intent    { isFinanceIntent: false, kind: "none" }
ai.agentic_loop_start     { modelName: "gemini-3-flash-preview", toolCount: 9 }
ai.agentic_turn           { turn: 1, decision: "tool_calls", tools: [{name:"project_get_map"}] }
ai.tool_call_start        { tool: "project_get_map" }
ai.tool_call_end          { tool: "project_get_map", durationMs: 42, ok: true }
ai.agentic_turn           { turn: 2, decision: "tool_calls", tools: [{name:"project_finance_summary"},{name:"project_get_section", args:{section:"businessPlan"}}] }
ai.tool_call_start        { tool: "project_finance_summary" }
ai.tool_call_end          { tool: "project_finance_summary", ok: true }
ai.tool_call_start        { tool: "project_get_section" }
ai.tool_call_end          { tool: "project_get_section", ok: true }
ai.agentic_turn           { turn: 3, decision: "final_answer", finalTextLength: 480 }
ai.agentic_loop_end       { turnsUsed: 3, durationMs: 4210 }
advisor.reply_ready       { replyLength: 480, durationMs: 4530 }
http.request_end          { statusCode: 200, durationMs: 4550 }
```

Filtrer sur un seul `requestId` :

```bash
grep '"requestId":"<id>"' apps/api/logs/ai-trace.log | jq .
```

## 4. Étendre le traçage à une nouvelle fonctionnalité

Pour tracer un nouveau service, il suffit d'appeler le helper existant — pas
besoin de nouveau transport ni de nouvelle configuration :

```ts
import { logAIEvent, previewValue } from '../../utils/ai-trace.util';

logAIEvent('branding.generation_start', { projectId, style });
// ...
logAIEvent('branding.generation_end', { projectId, durationMs, resultPreview: previewValue(result) });
```

Le nom de l'événement doit commencer par un des préfixes reconnus par le
filtre (`http.`, `ai.`, `chronicle.`, `coherence.`, `advisor.`) pour apparaître
dans `ai-trace.log` — sinon, ajouter le préfixe dans `AI_TRACE_PREFIXES`
([config/logger.ts](../api/config/logger.ts)). Le `requestId`/`userId`/
`projectId` sont injectés automatiquement, inutile de les passer.

Pour connecter le `projectId` dès le début d'un service, appeler
`setTraceProjectId(projectId)` (utils/trace.util.ts) une fois qu'il est connu —
tous les logs suivants de la requête l'auront.

## 5. Désactivation / niveau de verbosité

- `LOG_LEVEL` (env) contrôle le niveau global (défaut `info`) — tous les
  événements de traçage sont au niveau `info`.
- Les fichiers tournent automatiquement (5 fichiers de 10 Mo pour
  `ai-trace.log`, comme les autres logs).

## 6. Piège: fichiers de log inscriptibles

Winston ouvre les fichiers de `logs/` en écriture au démarrage. Si un fichier
appartient à un autre utilisateur (typiquement un lancement Docker **en root**
qui laisse `combined.log`/`error.log` possédés par `root`), le process de dev
lancé en tant qu'utilisateur normal **ne peut plus écrire** dedans — l'échec
est silencieux (`exitOnError: false`) et le fichier reste figé. Symptôme: le
fichier ne bouge plus alors que l'API tourne.

Correctif: rendre les fichiers inscriptibles par l'utilisateur qui lance l'API
(`sudo chown "$USER" logs/*.log`), ou les renommer pour que Winston les
recrée au prochain démarrage (`mv logs/combined.log logs/combined.log.bak`).
Vérifier avec `ls -la logs/` que les fichiers actifs appartiennent bien à
l'utilisateur courant.

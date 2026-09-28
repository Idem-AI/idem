# Context Engine + Chronicle — IDEM's "infinite coherence"

> A project-knowledge system for AI agents: each agent retrieves the right data, at the right moment, at the right granularity — and can query the full history of changes like a git repository.

## 1. The problem

IDEM's promise is **infinite coherence** across all applications: the AI knows everything about the project, or knows what to look for, where and when. Before this system:

- each AI feature assembled its context by hand (the advisor only injected the project sheet — never the branding, business plan or finances);
- no function calling: the model could not fetch anything itself;
- no trace of **who** (user or AI) changed **what** and **when**: data updated by the user could contradict what the AI believed it knew, with no way of detecting it.

## 2. Method — cross-checked research

Four bodies of sources converge on the same architecture:

| Source | Key lesson |
|---|---|
| [Anthropic — Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | Do not preload the whole context: keep **lightweight identifiers** (a "map") and do **just-in-time retrieval** through tools. Hybrid strategy: a small core always in context + the rest on demand. |
| [Anthropic — Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents) | Few, well-named tools (namespaced), prescriptive descriptions, **token-efficient** answers (summary by default, `detail=full` on demand, pagination/truncation), errors in natural language. |
| [MongoDB pattern — Document Versioning](https://www.mongodb.com/docs/manual/data-modeling/design-patterns/data-versioning/document-versioning/) + [Zep/Graphiti — bi-temporal knowledge graph](https://blog.getzep.com/content/files/2025/01/ZEP__USING_KNOWLEDGE_GRAPHS_TO_POWER_LLM_AGENT_MEMORY_2025011700.pdf) | History in a **separate collection** (current document intact), snapshots + deltas, indexes on (docId, version, date), avoid micro-versioning. **Bi-temporal** model: a fact is valid from its creation until its **supersession** — nothing is erased, it is invalidated. |
| Industry ([Replit checkpoints/App History](https://blog.replit.com/inside-replits-snapshot-engine), Lovable, v0) | A **checkpoint after each AI interaction** + one-click restore has become the UX standard of generation products. Restoring creates a new state (history stays intact), like `git revert`. |

Divergences settled:

- **Full event sourcing vs document versioning**: event sourcing (replaying business events) is more powerful but requires rewriting every write. The *Document Versioning* pattern plugs into the existing code through a single path (the repository) → chosen.
- **Specialised database (Dolt, TerminusDB, XTDB) vs existing MongoDB**: no new infrastructure; MongoDB + RFC 6902 snapshots/deltas covers 100 % of the need → chosen.
- **Vector RAG vs agentic search**: at the scale of ONE project (a few hundred KB of structured data), full-text search + navigation by section is more reliable and cheaper than embeddings. Semantic RAG remains a possible extension.

## 3. Architecture

```
                        ┌──────────────────────────────────────────────┐
        AI agents ────▶ │  PromptService.runPromptWithTools (function-calling loop) │
   (advisor, …)         └──────────────┬───────────────────────────────┘
                                       │ project_* tools
                        ┌──────────────▼───────────────┐
   dashboard / apps ──▶ │        CONTEXT ENGINE         │
   (REST /project/…)    │  map · sections · search      │
                        └───────┬───────────────┬──────┘
                                │               │
                     ┌──────────▼──────┐  ┌──────▼──────────────────────┐
                     │ context-registry │  │ CHRONICLE                    │
                     │ (12 sections)    │  │ log·show·diff·at·restore     │
                     └──────────┬──────┘  └──────▲──────────────────────┘
                                │                │ record (hook)
                        ┌───────▼────────────────┴──────────────┐
                        │ MongooseRepository (project writes)   │
                        │  projects  +  project_revisions       │
                        └───────────────────────────────────────┘
```

### 3.1 Context Engine (just-in-time reading)

- **`context-registry.ts`** — the single source of truth: 12 sections (`overview`, `branding`, `businessPlan`, `pitchDeck`, `legalDocs`, `design`, `landing`, `architectures`, `development`, `communication`, `finance`, `deployments`), each with an agent-oriented description and its extractor.
- **`context-engine.service.ts`**:
  - `getProjectMap` — the "table of contents": existence, size, current version, last author (user/AI) and date per section. It is the compact core injected into the context (progressive disclosure);
  - `getSection(detail, path)` — token-efficient summary by default (long strings truncated, arrays sampled), full content on a precise path on demand;
  - `searchProject` — full-text search → `section + path + excerpt`, so the agent then knows *what* to ask for and *where*.

### 3.2 Chronicle (versioning queryable like git)

- Collection **`project_revisions`** (MongoDB Document Versioning pattern): one revision = one commit on one section. Fields: monotonic `version` per (project, section) — the unique index acts as an optimistic lock —, `author` (user/ai/system + uid), `source` (originating route), `summary` (auto-generated commit message), `changedPaths`, `patch` (RFC 6902 delta), `snapshot` (v1 + every 10 versions + large patches), `sizeBytes`, `createdAt`.
- **Light bi-temporal model** (Zep/Graphiti): a version is valid from its `createdAt` until the `createdAt` of the next one. Nothing is erased.
- **`version-history.service.ts`**: `record` (commit), `log`, `show` (reconstruction from snapshot + deltas), `diff`, `versionAt`/`stateAt` (temporal checkout), `latestVersions`.
- **Automatic capture**: a hook in `MongooseRepository.create/update` (`project-revision-hook.ts`) — the single path of every project write. No business service was changed. Conversational sections (`advisorConversation`, `activeChatMessages`) are excluded (no micro-versioning).
- **Attribution**: `revisionContextMiddleware` (AsyncLocalStorage, same pattern as `request-language.ts`) — author `user` by default, `ai` on generation routes, overridable per service through `markRevisionAsAI()` / `setRevisionNote()`.
- **`json-patch.util.ts`**: in-house RFC 6902 diff/apply (add/remove/replace, RFC 6901 pointers), zero dependencies, a stable and auditable history format.

### 3.3 Agent loop (function calling)

`PromptService.runPromptWithTools` — the same choke point as `runPrompt` (quota, language directive, model fallback):

1. sends `systemInstruction` + conversation + `functionDeclarations`;
2. executes the returned `functionCalls` (parallel ones included) through the executor bound on the server to `(userId, projectId)` — the agent **cannot** reach another project; the security is structural;
3. sends the `functionResponse`s back to the model, until the final answer (max 8 turns, then a forced answer without tools);
4. a single quota increment per message, whatever the number of turns.

### 3.4 The tools exposed to agents (`context-tools.ts`)

| Tool | git equivalent | Use |
|---|---|---|
| `project_get_map` | `ls` + `git status` | Which data exists, versions, freshness |
| `project_get_section` | `cat` | Content (summary or full, sub-path) |
| `project_search` | `grep` | Locate information without knowing the section |
| `project_history_log` | `git log` | Who changed what, when |
| `project_history_show` | `git show` | Exact state at a version |
| `project_history_diff` | `git diff v1..v2` | What changed between two versions |
| `project_state_at_date` | `git checkout @{date}` | State at a date (data since changed by the user) |

Two more tools serve the advisor: `project_finance_summary` and `project_coherence_alerts` (see 4 bis).

### 3.5 REST API (dashboard + other apps)

Routes in `context.routes.ts`, mounted on `/project`:

- `GET /project/context/:projectId/map`
- `GET /project/context/:projectId/section/:section?detail=&path=`
- `GET /project/context/:projectId/search?q=`
- `GET /project/history/:projectId?section=&limit=`
- `GET /project/history/:projectId/:section/version/:version`
- `GET /project/history/:projectId/:section/diff?from=&to=`
- `GET /project/history/:projectId/:section/at?date=`
- `POST /project/history/:projectId/:section/restore` `{ version }`

### 3.6 First connected agent: the advisor

`advisor.service.ts` uses the hybrid strategy: a summary sheet always in context + `ADVISOR_TOOLS_GUIDE` + the tools. If the agent loop fails, it falls back automatically to the simple flow (resilience).

## 4. Pitfalls identified and avoided

- **Index on a large Mixed field**: the snapshot reconstruction index is *partial* (`partialFilterExpression`) — the snapshot value is never indexed (MongoDB index key size limit).
- **Micro-versioning**: conversational sections excluded; no v1 baseline for an empty section; a revision is only created if the diff is not empty (Dates/ISO strings are normalised before comparison).
- **History never breaks the business write**: `record()` catches everything.
- **Bounded tool answers** (30,000 characters) + summaries by default: the agent's context cannot explode.
- **Concurrent writes**: unique index (projectId, section, version) + retry — never two revisions with the same number.

## 4 bis. Coherence Guard — keeping artefacts in sync

The real case behind this module: the user asks "what is my revenue model"; the business plan holds the answer (subscriptions €5–20/month + 5 % commissions), but the Finance module is empty — and the advisor answered from the Finance module alone ("no product recorded"). Two problems:

1. **Short circuit**: finance intent detection answered BEFORE the agent loop. → Fixed: *read* intents now go through the agent loop, which crosses `project_finance_summary` **and** `project_get_section('businessPlan')` (a mandatory cross-checking rule in the system prompt). The *mutation* flow with confirmation stays intact.
2. **Desynchronisation**: the business plan and the financial forecasts describe the same economic reality but lived unlinked. → The **Coherence Guard**:

- **Declarative rules** (`coherence-rules.ts`): each rule links two sections and describes its "coherence contract" (businessPlan↔finance, overview↔businessPlan; extensible: branding↔landing…).
- **Automatic detection**: after each section commit, the Chronicle hook schedules an AI audit (8 s debounce) of each affected rule. The audit compares both sections (bounded summaries) and returns a JSON verdict (coherent / inconsistencies + actions). No user quota is consumed.
- **Alerts**: collection `coherence_alerts` — a single open alert per (project, rule); previous ones are marked `superseded`.
- **EXPLICIT application, never silent**: the `finance_autofill` proposal reuses the existing Finance autofill (attributed to `ai` in Chronicle) after the user confirms. Product principle: *automatic detection, confirmed application* — user data is never overwritten without their consent.
- **No loops**: writes coming from an apply (`/coherence/` in the source) do not trigger a new audit.
- **Exposure**: REST (`GET /project/coherence/:projectId`, `POST …/check`, `POST …/:alertId/apply`, `POST …/:alertId/dismiss`) + the agent tool `project_coherence_alerts` (the advisor mentions desynchronisations in conversation and proposes the actions).
- Can be disabled with `COHERENCE_CHECKS_ENABLED=false`.

## 5. Roadmap

1. **Done** — foundation: registry, Context Engine, Chronicle, repository hook, function-calling loop, tools, REST API, advisor connected, Coherence Guard (businessPlan↔finance).
2. **Extend to the other agents**: inject the map + tools into the branding / business plan / communication / deployment generations (each generation becomes "aware" of the other artefacts → real cross-artefact coherence).
3. **Dashboard UI**: version timeline per section (log), visual diff, "Restore this version" button (the API already exists).
4. **Extensions**: section summaries precomputed in a Redis cache; semantic RAG if projects grow; an MCP server exposing the same tools to external apps (iDeploy, AppGen); a retention policy (TTL/archiving of old revisions).

## 6. Sources

- Anthropic — [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- Anthropic — [Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
- Anthropic — [Building effective agents](https://www.anthropic.com/research/building-effective-agents)
- MongoDB — [Document Versioning Pattern](https://www.mongodb.com/docs/manual/data-modeling/design-patterns/data-versioning/document-versioning/) · [Building with Patterns: Document Versioning](https://www.mongodb.com/company/blog/building-with-patterns-the-document-versioning-pattern)
- Zep — [A Temporal Knowledge Graph Architecture for Agent Memory](https://arxiv.org/html/2501.13956v1) · [Graphiti](https://neo4j.com/blog/developer/graphiti-knowledge-graph-memory/)
- Replit — [Inside Replit's Snapshot Engine](https://blog.replit.com/inside-replits-snapshot-engine) · [App History powered by Neon branches](https://neon.com/blog/replit-app-history-powered-by-neon-branches)
- Google — [Function calling with the Gemini API](https://ai.google.dev/gemini-api/docs/function-calling) · [js-genai SDK](https://github.com/googleapis/js-genai)
- IETF — [RFC 6902 (JSON Patch)](https://datatracker.ietf.org/doc/html/rfc6902) · [RFC 6901 (JSON Pointer)](https://datatracker.ietf.org/doc/html/rfc6901)

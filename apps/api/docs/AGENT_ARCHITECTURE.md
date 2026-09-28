# AI orchestration architecture

How IDEM makes several models work together, and why it is built this way. Read it before adding a generation, an agent or a model.

## The principle

> **The orchestrator is deterministic code. An agent is only justified where the path is not known in advance.**

Generating a 9-section business plan follows a plan known in advance → it is a **workflow**. Answering "why does my deployment break?" does not → it is an **agent**.

Turning every generation into a swarm of autonomous agents would cost 3 to 10× more tokens, with unbounded latency and a non-reproducible result — impossible to bill fairly, while the product sells credits.

| Flow | Execution model |
|---|---|
| Business plan, pitch deck, branding, legal documents | Deterministic graph + digests |
| Sourced business plan, financial forecasts | Research team (`research/`) |
| Advisor chat, section editing | Agent with tools (Context Engine) |
| iCode, deployment debugging | Agent (unknown path by nature) |
| Cross-deliverable coherence | Event-driven critic (`coherence/`) |

## The building blocks

```
services/agents/
├── agent-runtime.ts            Runs an agent: routing, escalation, budget, trace
├── run-budget.ts               Consumption ceiling of a run (pure module)
├── deliverable-graph.ts        Who depends on whom, per deliverable
├── section-digest.service.ts   Reduces a section to its facts
├── quality-gate.ts             Deterministic check of an output (pure module)
├── section-verifier.service.ts Bounded repair of a faulty output
└── text-extract.ts             Extracts the useful text (pure module)

config/
├── ai.config.ts                Settings per feature and per section
└── model-router.ts             XS / M / S model tiers
```

### 1. The agent runtime

Every AI call with a role goes through `runAgent()`. An agent is a **declaration**:

```ts
const result = await runAgent(
  {
    role: 'section-writer',
    task: 'draft',              // → starting tier
    baseConfig: { ... },        // model imposed by the feature (takes priority)
    tools: CONTEXT_TOOL_DECLARATIONS,
    toolExecutor: createContextToolExecutor(userId, projectId),
    validate: qualityValidator({ format: 'html' }),
  },
  { messages, userId, projectId, element: 'Financial Plan', budget }
);
```

The runtime provides, for everyone and once: the tool loop, a fallback without tools if it fails, a one-step escalation if the check fails, budget accounting, cost breakdown per element, and the `agent.*` trace.

### 2. Deliverable graphs

Dependencies between sections live in `deliverable-graph.ts`, not in the services. They are validated (cycles, unknown names) and measured: **the depth of the graph is the latency multiplier** of the deliverable.

Current graphs have 3 waves. Adding a dependency that is "logical but incidental" can cost a whole wave — keep only links that prevent a real contradiction.

```
Business plan   W1 Cover Page · Opportunity · Target Audience · Products & Services
                W2 Company Summary · Marketing & Sales · Financial Plan
                W3 Goal Planning · Appendix

Pitch deck      W1 Cover · Problem · Market · Team · Business Model
                W2 Solution · Product · Competition · Financials
                W3 Traction · Ask
```

### 3. Digests

A dependency does **not** carry the text of the upstream section but its digest: facts, figures, names, no markup. Typical reduction: 15 to 30×.

The former behaviour — concatenating the full text of every previous step — made the prompt of the n-th section grow with the sum of the n−1 previous ones. On 9 sections of ~12k tokens, the input bill exceeded that of the produced content.

Three modes, through `IPromptStep.contextMode`:

- `digest` (default as soon as there are dependencies);
- `full` — full text, for cases where exact names matter (Mermaid: a summary would lose the node names to reuse);
- `none`.

### 4. The model router

Three tiers. A tier is a **role**, not a model: it resolves to the model of that role for the active provider (`AI_DEFAULT_PROVIDER`, GLM by default — see [AI routing](AI_ROUTING.md)), and each tier can be pinned with `IDEM_TIER_XS_MODEL`, `IDEM_TIER_M_MODEL`, `IDEM_TIER_S_MODEL`.

| Tier | Role | For | Default on GLM |
|---|---|---|---|
| **XS** | `mechanical` | summary, check, repair, classification, extraction | `glm-4.7-flashx` |
| **M** | `writing` | writing, structuring | `glm-4.7` |
| **S** | `reasoning` | strategy, figures, visual creation | `glm-5.2` |

A section is routed by declaring `tier` in `ai.config.ts`:

```ts
'Cover Page': { tier: 'M', llmOptions: { maxOutputTokens: 9000 } },
```

Priority, strongest first: `modelName` declared on the section → the section's `tier` → the feature's `tier` → the feature's `modelName`. An explicit decision is never overridden by the router.

**Escalation**: an agent retries only if its `validate` fails, and only one step up. Without an output check there is no escalation — we never pay twice for nothing.

### 5. Output checks

Three levels, from free to paid:

1. **Deterministic grid** (`quality-gate.ts`) — truncation, unbalanced tags, leftover code block, unfilled template, leak of the internal prompt, model chatter, currency drift. Cost: zero.
2. **Deterministic repair** — removes fences and the introductory sentence. Cost: zero.
3. **AI repair** — a single pass, at the low tier, only on what code cannot fix, and only if the content is short enough for it to be worth it.

Beyond that, the section is delivered **with a flag** rather than spending blindly. No debate between agents, no critic → rewrite loop.

### 6. The run budget

Each deliverable opens a `RunBudget` (derived from the declared output budgets, with a factor of 3 for input and an escalation). A normal run never reaches it; a run that derails stops instead of digging.

It is an **estimate** (≈ 4 characters per token) that acts as a circuit breaker. Billing stays with `aiUsageService`, fed by the provider's real counters.

## Adding a generation

```ts
const steps: IPromptStep[] = [
  { stepName: 'Section A', promptConstant: PROMPT_A },
  { stepName: 'Section B', promptConstant: PROMPT_B },
];

const configuredSteps = withGraph(AI_CONFIG.myFeature, steps, MY_GRAPH, {
  format: 'html',
  minChars: 300,
  currency: project.analysisResultModel?.finance?.meta?.currency,
});

await this.processStepsWithStreaming(configuredSteps, project, callback, promptConfig, 'my_feature', userId);
```

`withGraph` sets the dependencies, the context mode, tool access and the AI settings of each section. Nothing else needs wiring.

## Checking the foundation

```bash
npm run check:agents
```

Exercises the pure parts — graphs, quality grid, router, budget, extraction — without network or database. Run it after any change to `services/agents/` or `config/model-router.ts`.

## Following what happens

Events are traced in `logs/ai-trace.log` (see [Tracing](TRACING.md)):

| Event | Meaning |
|---|---|
| `agent.start` / `agent.end` | role, tier, tool turns, estimated tokens, duration |
| `agent.escalation` | a check failed, moving up one tier |
| `agent.digest_built` | reduction ratio obtained on a section |
| `agent.budget_exhausted` | a run reached its ceiling |
| `quality.gate_failed` | defects detected in an output |
| `quality.repaired_deterministic` | fixed without a model call |
| `quality.repaired_by_model` | fixed by the repair pass |
| `quality.flagged` | delivered with remaining defects |

## Where NOT to add an agent

- A generation whose sequence is known: it is a graph.
- A check that can be written in code: it is the deterministic grid.
- A model choice: it is the router.
- An unbounded "what if we asked the model again" loop: no.

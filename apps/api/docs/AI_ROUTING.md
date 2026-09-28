# AI routing

How to decide **which provider and which model** serves each generation, without touching the code.

---

## The principle: three levels

From the most general to the most specific. **The most specific wins.**

| # | Level | Where | Scope |
|---|---|---|---|
| 1 | What the feature declares | `config/ai.config.ts` | the default |
| 2 | `AI_DEFAULT_PROVIDER` | `.env` | **everything**, translated by role |
| 3 | `AI_OVERRIDES` | `.env` | **one** specific generation |

What makes the switch usable: level 2 **translates models by ROLE**, it does not replace them with a single model. A section declared on the reasoning model stays on the new provider's reasoning model; a digest stays mechanical. **The XS/M/S router keeps working** — which is exactly what we want to observe during a test.

---

## Switching to Gemini (Google AI Studio)

Add to `apps/api/.env`:

```bash
# ── Global provider ──────────────────────────────────────────────────────────
AI_DEFAULT_PROVIDER=GEMINI

# ── Gemini back end: AI Studio (API key) rather than Vertex (service account)
GEMINI_BACKEND=ai-studio
GEMINI_API_KEY=<your AI Studio key>

# ── Z.ai's prefix cache no longer applies: Gemini has its own, with a different
#    price. Without this line, the dashboard would bill cached tokens at the GLM rate.
# GLM_CACHED_INPUT_RATIO=
```

Then, **before starting**:

```bash
cd apps/api
npm run check:provider
```

The script replays the translation on the 41 configurations of the catalogue and refuses to pass if one of them would land on a model Gemini does not serve.

### Models used

| Role | Model | Serves |
|---|---|---|
| `mechanical` (XS) | `gemini-3.5-flash-lite` | digests, plans, checks, repairs |
| `writing` (M) | `gemini-3.6-flash` | writing, most of the volume |
| `reasoning` (S) | `gemini-3.1-pro-preview` | **business plan, brand charter, pitch deck**, finance, logo, art direction |
| `vision` | `gemini-3.6-flash` | reading images |
| `image` | — | not served (see below) |

⚠️ The `reasoning` role is on `pro` **through `.env`**, not through the code: the default in `ai-providers.config.ts` remains `gemini-3.8-flash`, chosen for speed. The deciding line is

```bash
IDEM_GEMINI_REASONING_MODEL=gemini-3.1-pro-preview
```

and commenting it out is enough to go back to `flash`.

### What really goes to the reasoning model

Declaring `modelName: GLM_MODELS.reasoning` on a feature was not enough, and it is counter-intuitive: a section rendered from a TEMPLATE is **unpinned by default** (`generic.service.ts`, `pinModel: step.template ? false : …`), and an unpinned `baseConfig` does not dictate the tier. Those sections therefore always went back to their TASK's tier — `draft` → M, writing — whatever the feature declared. Templates cover 21 pages out of 24: the declared model only served the three covers.

The starting tier is now declared, and passed along:

| Where | What |
|---|---|
| `ai.config.ts` | `tier: 'S'` on `businessPlan`, `pitchDeck`, `branding.brandIdentity` |
| `generic.service.ts` | `tier: step.aiConfig?.tier` passed to `runAgent` |

A tier stays PORTABLE where a model name does not: on GLM it means `glm-5.2`, on Gemini it translates to the `reasoning` role.

Conversely, `branding.colors` and `branding.typography` were **moved down** to the writing tier. They turn reasoning off (`thinkingBudget: 0`, since the code took over the decision it served), and a `pro` model refuses not to reason: it would have taken ~350 thinking tokens out of their 6,000 budget, for a deliberation that no longer has a purpose. `npm run check:provider` rejects that combination.

**The 2.5 family is no longer available to new accounts.** Verified by a real call: `gemini-2.5-flash` and `gemini-2.5-pro` both answer `404 — no longer available to new users`, pointing to 3.x.

**The selection criterion is REASONING, not power.** Thinking tokens are counted in `maxOutputTokens`: on a tight budget, thinking consumes the envelope and the answer comes back EMPTY — no error, no visible truncation, nothing. Measured on the real XS-tier case (JSON, 1,024 tokens):

| Model | No instruction | `thinkingBudget: 0` translated |
|---|---|---|
| `gemini-3.5-flash-lite` | 0 thinking tokens | 0 |
| `gemini-3.6-flash` | **461** | **0** |
| `gemini-3.1-pro-preview` | 386 | 349 — `low` floor |

Hence the assignment: `flash-lite` on the mechanical tier (it does not think), and `pro` reserved for roles where thinking is precisely what we pay for — it **refuses** not to reason ("only works in thinking mode").

**Three dialects for one intent.** The configuration says `thinkingBudget: 0`; the code translates it (`config/ai-providers.config.ts`, `buildGeminiThinkingConfig`):

```
2.5 family    thinkingConfig: { thinkingBudget: 0 }
3.x flash     thinkingConfig: { thinkingLevel: 'minimal' }
3.x pro       thinkingConfig: { thinkingLevel: 'low' }     ← its floor
GLM           extraBody: { thinking: { type: 'disabled' } }
```

### Where reasoning is TURNED OFF, and why

Reasoning is not a quality in itself: it is a purchase. It is justified where the **code has not taken over the decision** — everywhere else it no longer changes the output, but it is counted in `maxOutputTokens` and paid for in latency.

What the code took over, and therefore no longer needs deliberation:

| Decision | Taken over by | Effect |
|---|---|---|
| page layout | the template (`sectionRenderer`) | 21 pages out of 24 |
| charter compliance | the linter (`slopLint`) | all |
| page structure | the planning step (M5 ①) | every section |
| colour uniqueness | 648 drawn regions | `branding.colors` |
| typographic uniqueness | the drawn registers | `branding.typography` |

What keeps it: `branding.logo` (parametric SVG geometry — without thinking the model approximates instead of enumerating), `finance.autofill` (36 months of series that must add up), `branding.artDirection` (one decision per project that propagates everywhere), and the **pages left in free composition** — the three covers and the nine charter pages outside templates, where the model really composes.

**Measured on a full generation: 34 calls were reasoning, 11 remain (68 % turned off).** On `gemini-3.6-flash`, each turned-off call saves the 461 thinking tokens measured above, ~9,700 tokens per generation — and the time to produce them.

Turning it off for templated sections is set on the PATH (`templatedLlmOptions`, in `config/ai.config.ts`), not in the configurations: the three features concerned are mixed — templated sections on one side, free cover on the other — and turning it off at feature level would degrade precisely the page that has no safety net. It emits **both dialects**, otherwise it would not survive a provider switch.

---

Sending the wrong dialect is not harmless: `thinkingBudget: 0` on a 3.x model returns `400 INVALID_ARGUMENT`, and `thinkingLevel: 'minimal'` on a `pro` returns `400 — not supported for this model`.

Each role can be overridden without touching the code:

```bash
IDEM_GEMINI_REASONING_MODEL=gemini-3.8-flash
IDEM_GEMINI_WRITING_MODEL=gemini-3.5-flash
```

### The live probe

No static analysis detects a retired model: the name is correct, the documentation mentions it, and the 404 arrives in the middle of a generation, far from its cause, after the fallback chain has exhausted itself on models that are unavailable too.

```bash
AI_PROBE=1 npm run check:provider
```

One call per declared model — the role table **and** the fallback chain, because the chain is what serves at the worst moment. Negligible cost; run it after any change of provider or model.

### What degrades without GLM

| Feature | Behaviour |
|---|---|
| Image generation (charter mockups, visuals) | degraded — guarded by `isGlmConfigured()`, the page is omitted rather than produced empty |
| Image analysis (vision) | degraded, same guard |
| Web search | **switches to native Google Search grounding** — works |

The first two go through `services/glm-media.service.ts`, which targets Z.ai-specific endpoints. They do not break generation: callers guard them behind `isGlmConfigured()`.

---

## Overriding one generation

`AI_OVERRIDES` is a JSON object. The key is the call's **`promptType`**.

```bash
# Everything on Gemini, except the logo which stays on GLM
AI_DEFAULT_PROVIDER=GEMINI
AI_OVERRIDES='{"Logo Concept":{"provider":"GLM"}}'

# One section on the reasoning model
AI_OVERRIDES='{"Financial Plan":{"role":"reasoning"}}'

# Pin an exact model, to reproduce a defect
AI_OVERRIDES='{"Market":{"provider":"GEMINI","modelName":"gemini-3.8-flash"}}'

# All mechanical groundwork at the lowest tier, sections unchanged
AI_OVERRIDES='{"section-digest":{"role":"mechanical"},"section-planner":{"role":"mechanical"}}'

# Wildcard: everything without its own entry
AI_OVERRIDES='{"*":{"role":"writing"},"Cover Page":{"role":"reasoning"}}'
```

### `role` or `modelName`?

**Prefer `role`.** An override by role survives a provider change; a model name becomes wrong. `modelName` is the escape hatch to pin an exact version — useful to reproduce a problem, not to leave in place.

### Key matching

Three forms, from the most specific to the broadest:

1. **exact** — `"Financial Plan"`
2. **prefix** — `"Logo Concept"` covers `Logo Concept 1`, `Logo Concept 2`… Essential: several generations number their steps. Between two matching prefixes, the longest wins.
3. **`*`** — the rest

To list the available keys:

```bash
npm run check:provider     # section 6: "Addressable keys"
```

And to know what really happened at run time, the log says it on every call:

```
Aiguillage: surcharge "Logo Concept → GLM/glm-5.2" (promptType=Logo Concept 1)
Aiguillage: bascule globale GLM/glm-4.7 → GEMINI/gemini-3.6-flash
```

(Those log lines are in French: "override" and "global switch".)

---

## Rolling back

Removing `AI_DEFAULT_PROVIDER` from `.env` is enough: each feature goes back to the provider it declares. No migration, no code to change.

---

## What the switch does not change

Template rendering, seed-based uniqueness, computed contrasts, deterministic repair and charter checks are produced by **code**. They are therefore identical on GLM, Gemini or GPT — that is the whole point of the design. The five harnesses check it without calling a model:

```bash
npm run check:all
```

What changes with the provider is what the model brings: the angle, the choice of facts, the wording. That is exactly what we want to measure from one provider to another.

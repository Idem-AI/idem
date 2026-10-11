# AI routing

How to decide **which model** serves each generation, without touching the code.

All models are served by **OpenRouter**, and only by it. The list of allowed models, their licences and costs: [OPENROUTER.md](OPENROUTER.md) and [OPENROUTER_MODEL_MATRIX.md](OPENROUTER_MODEL_MATRIX.md).

---

## The principle: three levels

From the most general to the most specific. **The most specific wins.**

| # | Level | Where | Scope |
|---|---|---|---|
| 1 | What the feature declares (a **role**) | `config/ai.config.ts` | the default |
| 2 | The model chosen for a role | `platform_settings/ai` (live), then `IDEM_OPENROUTER_<ROLE>_MODEL`, then the code default | **every** feature on that role |
| 3 | `AI_OVERRIDES` | `.env` | **one** specific generation |

A feature never names a model: it declares a **role** — `mechanical`, `writing`, `reasoning`, `vision`, `ocr`, `image` — and the role is translated into a model at each call. Changing the model of a role changes it for every feature that declared it, and the XS/M/S router keeps working because a tier is only a role seen from the angle of cost.

| Role | Tier | Default model | For |
|---|---|---|---|
| `mechanical` | XS | `qwen/qwen3.5-9b` | digests, plans, checks, repairs, extraction |
| `writing` | M | `qwen/qwen3.5-122b-a10b` | writing, most of the volume |
| `reasoning` | S | `qwen/qwen3.5-397b-a17b` | business plan, brand charter, pitch deck, finance, logo, art direction |
| `vision` | — | `qwen/qwen3.5-35b-a3b` | reading images |
| `ocr` | — | `qwen/qwen3-vl-30b-a3b-instruct` | text in images |
| `image` | — | `black-forest-labs/flux.2-klein-4b` | image generation |

---

## Changing a model live

No redeploy, no restart. The choice lives in the database and every instance rereads it every 15 seconds.

```bash
npm run ai:models                                               # what is in force
npm run ai:models -- --model writing=qwen/qwen3.5-27b          # one role
npm run ai:models -- --model reasoning=deepseek/deepseek-v4-pro --model image=black-forest-labs/flux.2-klein-4b
npm run ai:models -- --reset                                    # back to the defaults
```

Only models of the whitelist (`config/openrouter.config.ts`) are accepted: open weights **and** commercial licence, or an explicit exception (`allowClosed`).

At deployment level, `IDEM_OPENROUTER_<ROLE>_MODEL` does the same through the environment (`MECHANICAL`, `WRITING`, `REASONING`, `VISION`, `OCR`, `IMAGE`). A value that is not allowed is ignored with a warning, never silently sent.

A model pinned by hand (`modelName` on a section, or `AI_OVERRIDES`) is never retranslated.

---

## Reasoning

Reasoning is not a quality in itself: it is a purchase. It is counted in `maxOutputTokens` and paid for in latency, so it is justified only where the **code has not taken over the decision**.

The configuration says it once — `thinkingBudget: 0` / `feature({ thinking: false })` — and `PromptService` sends it to OpenRouter as `reasoning: { enabled: false }` (`translateReasoning`). It is **off by default** (`extraBody` of the provider); the reasoning tier turns it back on explicitly, with the output budget that goes with it (`MIN_TOKENS_FOR_THINKING`).

Models that **always** reason (`-thinking` variants, DeepSeek R1) cannot be switched off: `canSuppressThinking` keeps the cut from being sent to them. None is assigned to a role by default.

What the code took over, and therefore no longer needs deliberation:

| Decision | Taken over by | Effect |
|---|---|---|
| page layout | the template (`sectionRenderer`) | 21 pages out of 24 |
| charter compliance | the linter (`slopLint`) | all |
| page structure | the planning step | every section |
| colour / typographic uniqueness | the drawn registers | `branding.colors`, `branding.typography` |

What keeps it: `branding.logo` (parametric SVG geometry), `finance.autofill` (36 months of series that must add up), `branding.artDirection`, and the pages left in free composition.

Turning it off for templated sections is set on the PATH (`templatedLlmOptions`, in `config/ai.config.ts`), not in the configurations: the three features concerned mix templated sections and free covers.

---

## Overriding one generation

`AI_OVERRIDES` is a JSON object. The key is the call's **`promptType`**.

```bash
# One section on the reasoning model
AI_OVERRIDES='{"Financial Plan":{"role":"reasoning"}}'

# Pin an exact model, to compare two families
AI_OVERRIDES='{"Market":{"modelName":"deepseek/deepseek-v4-flash"}}'

# All mechanical groundwork at the lowest tier, sections unchanged
AI_OVERRIDES='{"section-digest":{"role":"mechanical"},"section-planner":{"role":"mechanical"}}'

# Wildcard: everything without its own entry
AI_OVERRIDES='{"*":{"role":"writing"},"Cover Page":{"role":"reasoning"}}'
```

**Prefer `role`.** An override by role follows the model chosen for that role; a model name stays where it is. `modelName` is the escape hatch to pin an exact version — useful to compare two models, not to leave in place.

Key matching, from the most specific to the broadest: **exact** (`"Financial Plan"`), **prefix** (`"Logo Concept"` covers `Logo Concept 1`, `2`… — between two matching prefixes the longest wins), then **`*`**.

At run time the log says what happened on every call:

```
Aiguillage: surcharge "Market → OPENROUTER/deepseek/deepseek-v4-flash" (promptType=Market)
```

---

## Fallback

A call that fails (saturated host, 429) falls back along the provider's chain, `defaultFallbackModels` (`openrouter.config.ts`): other sizes and another family, all open weights. A feature that declares its own `fallbackModels` keeps them. A 429 waits before falling back — the quota is shared, an immediate fallback hits the same wall.

---

## Web search

`runGroundedResearch` uses OpenRouter's `web` plugin: the server searches, injects the results, and the model answers with `url_citation` annotations. The real URLs, the executed queries and the segment → source map are extracted from them. **Without any source the text is returned empty**: a "grounded" answer without a source would be invented text that looks real.

---

## What does not depend on the model

Template rendering, seed-based uniqueness, computed contrasts, deterministic repair and charter checks are produced by **code**: identical whatever model serves the text. The harnesses check it without calling a model:

```bash
npm run check:all
npm run check:openrouter
```

What changes with the model is what it brings: the angle, the choice of facts, the wording. That is exactly what to compare from one model to another.

# AI usage tracking

Every AI generation on the platform is recorded, input **and** output, in the MongoDB collection `ai_usage_events`: one document per model call.

## What is recorded

| Dimension | Field | Example |
| --- | --- | --- |
| User | `userId` | Firebase uid |
| Project | `projectId` | project id |
| Feature | `feature` | `branding`, `businessPlan`, `design`, `appgen`… |
| Element | `element` | `logo`, `typography`, `colors`, generation step name |
| Kind | `operation` | `generate`, `regenerate`, `edit`, `variant`, `analysis`, `chat`, `appgen` |
| Batch of proposals | `batchId`, `variantCount` | the 4 logos of one action |
| Model | `provider`, `modelName` | `glm` / `glm-4.7` |
| Tokens | `inputTokens`, `outputTokens`, `cachedInputTokens`, `totalTokens` | measured |
| Cost | `estimatedCostUsd` | USD estimate |
| Reliability | `tokensEstimated`, `pricingEstimated` | see "Reliability" below |
| Result | `status`, `errorMessage`, `durationMs` | `success` / `error` |
| Correlation | `requestId`, `source`, `promptType` | to match with the logs |
| Period | `day` (`YYYY-MM-DD`) | denormalised for aggregations |

**Regenerations, edits and discarded proposals are counted.** A generation of 4 logos writes 4 events sharing a `batchId`: the real cost of "choosing a logo" is the sum of the batch, not the cost of the proposal that was kept.

**Failures are counted too.** A model that answers and then breaks at parsing was billed; a fallback to a secondary model produces two events. Hiding them would underestimate the real cost.

## How the context travels

The problem: `prompt.service.ts` is the single path of every model call, but it does not know *what it is generating*. Passing `projectId` / `feature` / `element` down through the twenty generation services would have meant changing all their signatures.

The solution follows the idiom already used in the repository (`request-language.ts`, `trace.util.ts`, `revision-context.util.ts`): an `AsyncLocalStorage`.

```
HTTP request
  └─ aiUsageContextMiddleware        → feature + operation derived from the route
       └─ business service
            └─ withAiUsage({ element, projectId })   → refines
                 └─ promptService.runPrompt()
                      └─ aiUsageService.record()     → reads the context
```

Three levels, from the most general to the most specific (the most specific wins):

1. **middleware** — `feature` and `operation` derived from the route path;
2. **service** — `withAiUsage()` / `setAiUsageContext()` / `openAiUsageBatch()`;
3. **call** — explicit overrides passed to `aiUsageService.record()`.

### Instrumenting a new feature

Most of the time: **nothing to do**. Section-based generations go through `generic.service.ts`, already instrumented — the element takes the step name.

For a named element or a batch of proposals:

```ts
// Identifiable element
return withAiUsage({ element: 'businessCard', operation: 'generate' }, () =>
  this.generate(project)
);

// Several proposals the user will choose from
openAiUsageBatch({ userId, projectId, feature: 'branding', element: 'logo' });
```

Add a route segment to `FEATURE_BY_SEGMENT` (`utils/ai-usage-context.util.ts`) if the new route is not recognised.

## Reliability of the figures

Two flags separate what was measured from what was approximated — the admin panel shows them, and a total mixing both must not pass for an invoice:

- **`tokensEstimated`** — the provider returned no usage metadata (some OpenAI-compatible gateways omit it). Tokens are then estimated at ~4 characters per token. Approximate, but better than a zero that would hide the consumption.
- **`pricingEstimated`** — the model is missing from `config/ai-pricing.config.ts` and the default price was applied.

Reasoning tokens of "thinking" models (`thoughtsTokenCount`) are added to the output tokens: ignoring them would heavily underestimate the cost. Tokens served by the Gemini context cache are counted separately and billed at the reduced cache price.

## Prices

`config/ai-pricing.config.ts`, in USD per million tokens. Resolution by longest prefix: `gemini-3-flash-preview-0842` inherits the `gemini-3-flash` price instead of falling back to the default.

To fix a price without redeploying:

```bash
AI_PRICING_OVERRIDES='{"gemini-3-flash":{"input":0.25,"output":2}}'
```

## Retention

One document per model call: the collection quickly becomes the largest in the database. A TTL index purges it automatically.

```bash
AI_USAGE_TTL_DAYS=400   # 0 = keep forever
```

The daily counters in `token_usage` are not purged. They are updated by `aiUsageService.record()` with an **atomic** `$inc` + upsert: a generation of 4 variants starts 4 concurrent writes, and the original read-modify-write silently lost increments.

Usage limits are enforced by billing (`requireCredits`, `middleware/billing.middleware.ts`), not by these counters.

## No regression guarantee

`aiUsageService.record()` never fails: any error is logged and swallowed. A MongoDB incident on `ai_usage_events` must not break a generation the user is waiting for. Same principle for the daily roll-up, whose failure does not lose the detailed event already written.

## Admin side

The admin panel (private repository) reads this collection, read-only:

- `GET /admin/ai-usage` — dashboard over a period
- `GET /admin/ai-usage/users/:userId` — one user's consumption
- `GET /admin/ai-usage/projects/:projectId` — consumption per project element
- `GET /admin/ai-usage/variant-batches` — cost of multi-proposal choices
- `GET /admin/ai-usage/events` — detailed log, one call per line

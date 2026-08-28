# IDEM Simulator

Angular 22 client-side application. It lets an entrepreneur put a project under
strain before launching it: the engine works out which factors can influence
the business, runs scenarios and stress tests against them, and reports where
the model breaks.

The product's core rule is that it never sells a prediction. Every screen that
shows a score also shows what the score means, how confident the engine is, and
the caveat that a simulation is a decision-support tool.

The public marketing page for this product is **not** here — it lives in the
main IDEM landing site at `apps/landing`, route `/simulation`, so all the SEO
weight stays on `idem.africa`.

## Running it

```bash
cp .env.development.example .env
npm install
npm start          # http://localhost:4203
```

`npm start` regenerates `src/environments/environment.ts` from `.env` via
`mynode.js`, the same convention as the other IDEM front-ends.

With the placeholder credentials still in `.env`, the app runs on its built-in
demo dataset and skips authentication. Fill in the real IDEM Firebase values to
exercise the actual sign-in flow.

## Architecture

```
src/app/
  core/          singletons: auth, theme, i18n, page titles, toasts
  shared/        presentational components with no domain knowledge
  layouts/       app shell for the authenticated surface
  features/
    auth/        sign-in and the IDEM handoff
    simulations/ the product
      models/       domain types
      data-access/  gateway (HTTP or demo), signal store
      components/   domain components: gauge, factor list, scenarios, charts
      pages/        list, new run, run, results, report, comparison
```

Standalone components, signals, zoneless change detection, lazy routes.

### The one backend seam

Every call to the simulation backend goes through the abstract
`SimulationGateway`. Two implementations are bound in `simulation.providers.ts`:

- `HttpSimulationGateway` talks to `${API}/simulations`.
- `DemoSimulationGateway` serves an in-memory dataset.

Nothing else in the app knows which one is active, so wiring the real API is a
one-line environment change.

The active source is resolved once at startup, in this order:

| Priority | Where | How |
| --- | --- | --- |
| 1 | URL | `?mock=on` / `?mock=off` — memorised, so a demo link stays a demo |
| 2 | Browser | the **Données de démonstration** switch in the account menu |
| 3 | Build | `USE_MOCK_DATA` in `.env`, the fallback |

Levels 1 and 2 need no rebuild: the choice is stored in `localStorage`
(`idem_simulation_mock_data`) and the app reloads itself to rebind the gateway.
Whenever the demo dataset is serving, a **Démo** badge sits in the top bar so a
screenshot can never be mistaken for real output.

`DemoSimulationGateway` is a small in-memory backend, not a set of fixtures: it
runs the six pipeline stages on a timer, keeps created runs, generated reports
and executed labs in `localStorage` (`idem_simulation_demo_state`), and applies
a latency to every call so loading and progress states actually get exercised.
*Reset the demo dataset* in the same menu puts it back to its seeded state.

The endpoints the HTTP gateway expects:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/projects/simulatable` | IDEM projects the user can simulate |
| `POST` | `/simulations/analysis` | Read a project or an uploaded plan |
| `GET` | `/simulations/pricing?origin=` | Plans, with the IDEM-project discount |
| `GET` | `/simulations` | List |
| `POST` | `/simulations` | Start a run |
| `GET` | `/simulations/:id` | One run, polled while it is running |
| `GET` | `/simulations/:id/report` | The full report |
| `POST` | `/simulations/:id/report` | Buy the report for an existing run |

### Authentication

The same system every other IDEM app uses, and no accounts of its own:
Firebase Auth for the credential, `POST /auth/sessionLogin` to open the server
session, the shared `authToken` / `currentUser` cookies, and the
`idem_session_active` sentinel so signing out of one IDEM app signs this one
out too.

It talks to Firebase through the `firebase` SDK directly rather than
`@angular/fire`, whose peer range stops at Angular 20. The flows, cookies and
API calls are unchanged — only the wrapper is gone.

`/auth/idem?token=…&projectId=…` is the landing spot for the dashboard's
"Simuler mon entreprise" button. It exchanges the one-time token at
`POST /auth/simulation-token/exchange` for a Firebase custom token, mirroring
how the dashboard already hands sessions to iDeploy. **That endpoint is not
implemented yet**; until it is, the route falls back to the sign-in screen.

### Theming

The shared design system (`@idem/shared-styles`) is dark-only, so `styles.css`
adds a semantic token layer (`--sim-canvas`, `--sim-panel`, `--sim-ink`, …)
defined twice: once for `[data-theme='dark']`, once for `[data-theme='light']`.
Tailwind utilities bind to those tokens through `@theme inline`, so a theme
change is one attribute on `<html>` and nothing else re-renders differently.

`index.html` resolves the theme before first paint, so there is no flash.

### i18n

Runtime translation with `@ngx-translate`, bundles in
`public/assets/i18n/{fr,en}.json`. French is the default. The language resolves
from `?lang=`, then storage, then the browser — so the dashboard can pass its
own language across when it links here.

Narrative content inside a simulation (factor descriptions, scenario outcomes,
recommendations) is generated per run and arrives already localised from the
API; it is not part of these bundles.

## Checks

```bash
npm run build
npm run lint
```

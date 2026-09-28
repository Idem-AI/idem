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

`/simulations/new` opens without an account. Everything else talks to the IDEM
API and needs a session, which is obtained on the IDEM dashboard
(`SERVICES_DASHBOARD_URL`) — there is no sign-in screen here. Both apps must be
running for that round trip to work.

## Architecture

```
src/app/
  core/          singletons: auth, theme, i18n, page titles, toasts
  shared/        presentational components with no domain knowledge
  layouts/       app shell for the authenticated surface
  features/
    auth/        the SSO callback from the IDEM dashboard
    simulations/ the product
      models/       domain types
      data-access/  HTTP gateway, signal store, report download
      components/   domain components: gauge, factor list, scenarios, charts
      pages/        list, new run, workspace (overview, understanding, factors,
                    scenarios, financials), labs, report, comparison
```

Standalone components, signals, zoneless change detection, lazy routes.

### The one backend seam

Every call to the simulation backend goes through the abstract
`SimulationGateway`. `simulation.providers.ts` binds a single implementation,
`HttpSimulationGateway`, which talks to the IDEM API. There is no demo or mock
mode any more: every screen shows real output from the API.

Endpoints used (all under `${API}`, all with the session cookie):

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/projects` | IDEM projects the user can simulate |
| `GET` | `/project/simulations/:projectId/inputs` | Data read from an IDEM project |
| `POST` | `/project/simulations/:projectId/analysis` | Understand a project before a run |
| `POST` | `/project/simulations/import/analysis` | Understand an uploaded business plan |
| `GET` | `/project/simulations/:projectId/pricing`, `/project/simulations/import/pricing` | Plans, with the IDEM-project discount |
| `GET` | `/project/simulations/:projectId` | List runs |
| `POST` | `/project/simulations/:projectId` | Start a run on a project |
| `POST` | `/project/simulations/import/run` | Start a run on an uploaded plan |
| `GET` | `/project/simulations/:projectId/:id` | One run, polled while it is running |
| `GET` | `/project/simulations/:projectId/:id/report` | Full report |
| `GET` | `/project/simulations/:projectId/:id/report/pdf` | Report as PDF |
| `POST` | `/project/simulations/:projectId/:id/report` | Buy the report for an existing run |
| `POST` | `/project/simulations/:projectId/:id/labs/:lab` | Run a lab (red team, customers, investors, black swan, universes, time machine, experiments) |
| `DELETE` | `/project/simulations/:projectId/:id` | Delete a run |

The API side is documented in [apps/api](../api/README.md).

### Authentication

**No IDEM app has a login screen of its own, and this one is no exception.**
The IDEM dashboard owns sign-in, the IDEM API owns the session: it sets an
`httpOnly` `session` cookie on the shared domain (`.idem.africa` in
production; a host-only `localhost` cookie in dev, which every dev port
shares). This app manages no token — it only asks the API whether the session
is valid.

The same pattern as `apps/ideploy-web`, in three pieces:

| Piece | What it does |
| --- | --- |
| `authInterceptor` | Adds `withCredentials` + `Accept-Language` to every API call. Nothing else — no bearer token. |
| `AuthService` | `GET /auth/profile` to read the identity, `POST /auth/logout` to end it, `redirectToLogin()` to hand the user over. |
| `authGuard` | Guards the screens that genuinely need an identity: no session → straight to the central login. |

#### Where the session is actually required

The guard sits on the routes, not on the shell. `/simulations/new` is public:
picking a source and uploading a business plan needs no account, and the ask
comes at the first action that does — the exact moment it can be justified to
the user.

| Moment | What happens without a session |
| --- | --- |
| Opening `/simulations/new` | Nothing. The page renders, both options are offered. |
| Choosing **an IDEM project** | `SignInDialog` opens: the project list belongs to the account. The panel below keeps a sign-in card so closing the dialog is not a dead end. |
| Choosing **my business plan** | Nothing. The file is selected and held locally. |
| **Analyse** / **Launch** | `SignInDialog` opens: these run on the server, under the account. |
| Any other screen | `authGuard` redirects to the central login. |

Leaving for the login means leaving the page, so the source step is stashed in
`sessionStorage` first (`new-run-draft.ts`) — origin, chosen project, and the
uploaded document itself as a data URL. The user comes back to their document
still in place; the draft is consumed on restore. Above
`MAX_STASHED_FILE_BYTES` the file is not stashed and the dialog says so
plainly, rather than letting it vanish.

The round trip when a signed-out user opens a page here:

```
/simulations/42/report                      guard: no session
  → {dashboard}/login?redirect=simulation&from=simulation
                     &returnUrl={simulation}/auth/idem?returnUrl=/simulations/42/report
  → sign in (or straight through, when the session is already valid)
  → {simulation}/auth/idem                  confirms the session, retrying
  → /simulations/42/report                  session cookie in place
```

`redirect=simulation` is the flag the dashboard login reads to know which app
to return to — the exact counterpart of iDeploy's `redirect=ideploy`. It is
handled in `apps/main-dashboard`, in both the login page and `publicGuard`, so
an already-authenticated user is bounced back without seeing the form. A
`returnUrl` is followed only when it points at this app: the login refuses to
be an open redirector.

`AuthService.redirectToLogin()` bounces at most once per tab
(`idem_simulation_login_attempt` in `sessionStorage`). If the user comes back
still without a session — a cookie that never crossed, typically — the second
attempt lands on the public landing page instead of looping forever.

`/auth/idem` is the return leg, and also the landing spot for the dashboard's
"Simuler mon entreprise" button (`?projectId=…`). There is no token to
exchange: it confirms the session and enters the app. The login comes back
through it rather than straight to the requested page because the cookie can
take a moment to become readable after a redirect chain — the callback retries
a few times instead of letting the guard conclude there is no session.


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

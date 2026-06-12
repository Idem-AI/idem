# Technical Documentation — Main Dashboard

This document describes the technical architecture, routing structure, coding conventions, and configuration for the **main dashboard** application (`apps/main-dashboard`).

---

## 🚀 Overview

The main dashboard is the private authenticated workspace of the Idem platform. It operates as a client-side-only (no SSR) Angular 20 application. Users access it after authenticating via the landing page. It manages the entire project lifecycle: business plan generation, branding, diagrams, development planning, financial modelling, team management, and deployment orchestration via iDeploy.

---

## 🛠️ Stack & Technologies

- **Framework**: Angular 20 (standalone components, no NgModules)
- **Rendering**: Client-Side Only (no SSR)
- **State Management**: Angular signals and service injection pattern
- **UI Library**: PrimeNG ^20.1.1 with a custom theme (`src/app/my-preset.ts`)
- **Styling**: Tailwind CSS 4 + shared package `@idem/shared-styles`
- **Internationalization**: `ngx-translate` with `@ngx-translate/http-loader` (dynamic JSON loading)
- **Firebase**: `@angular/fire` ^20.0.0 for authentication and Firestore
- **PDF Export**: `html2canvas` + `jspdf`
- **Diagram Rendering**: `mermaid` ^11.6.0
- **Markdown Rendering**: `ngx-markdown` ^20.0.0
- **Shared packages**: `@idem/shared-models`, `@idem/shared-auth-client`, `@idem/shared-styles`

---

## 📁 Project Structure

```
apps/main-dashboard/
├── src/
│   ├── app/
│   │   ├── app.routes.ts          # Complete lazy-loaded route table
│   │   ├── app.config.ts          # Application-level providers (router, HTTP, Firebase, translate)
│   │   ├── my-preset.ts           # PrimeNG custom theme token overrides
│   │   ├── guards/
│   │   │   └── auth.guard.ts      # authGuard (requires authentication) / publicGuard (redirects if logged in)
│   │   ├── layouts/
│   │   │   ├── global-layout/     # Global sidebar layout for main console pages
│   │   │   ├── dashboard-layout/  # Project-scoped sidebar layout
│   │   │   └── empty-layout/      # Full-screen (no sidebar) layout
│   │   ├── modules/
│   │   │   ├── auth/              # Login page and auth flow
│   │   │   └── dashboard/         # All project-related feature pages
│   │   │       └── pages/
│   │   │           ├── global-dashboard/    # Console homepage
│   │   │           ├── projects-list/       # All projects for the user
│   │   │           ├── create-project/      # Project creation wizard
│   │   │           ├── my-teams/ & team-details-*/  # Team management
│   │   │           ├── show-branding/       # Branding viewer and generation
│   │   │           ├── show-business-plan/  # Business plan viewer and generation
│   │   │           ├── show-diagrams/       # UML diagram viewer and generation
│   │   │           ├── show-communication/  # Communication plan viewer
│   │   │           ├── show-pitch-deck/     # Pitch deck viewer
│   │   │           ├── legal-docs/          # Legal documents
│   │   │           ├── advisor/             # AI advisor page
│   │   │           ├── development/         # Development planning
│   │   │           ├── ideploy-overview/    # iDeploy integration overview
│   │   │           ├── deployment/          # Deployment management (list, create, details)
│   │   │           ├── finance/             # Finance module (overview + per-section stubs)
│   │   │           └── profile/             # User profile
│   │   ├── shared/                # Shared components and services (API service, language service, etc.)
│   │   ├── directives/            # Custom Angular directives
│   │   └── utils/                 # Utility functions and helpers
│   ├── assets/
│   │   └── i18n/
│   │       ├── en.json            # English translation keys
│   │       └── fr.json            # French translation keys
│   ├── environments/              # Environment-specific configuration
│   ├── main.ts                    # Browser bootstrap entry point
│   └── styles.css                 # Global styles import
├── angular.json                   # Angular project builder configuration
└── package.json                   # Project scripts and dependencies
```

---

## ⚙️ Environment Variables

Configuration is read from `apps/main-dashboard/.env` by `mynode.js` before start/build.

| Key | Example Value | Description |
| :--- | :--- | :--- |
| `FIREBASE_API_KEY` | `AIzaSy...` | Firebase project API key |
| `FIREBASE_AUTH_DOMAIN` | `lexis-ia.firebaseapp.com` | Firebase auth domain |
| `FIREBASE_PROJECT_ID` | `lexis-ia` | Firebase project identifier |
| `FIREBASE_APP_ID` | `1:788...` | Firebase app identifier |
| `FIREBASE_MEASUREMENT_ID` | `G-1YQ...` | Firebase analytics measurement ID |
| `SERVICES_DOMAIN` | `https://idem.africa` | Production base domain |
| `SERVICES_API_URL` | `https://api.idem.africa` | Central API endpoint |
| `SERVICES_IDEPLOY_URL` | `https://ideploy.idem.africa` | iDeploy service endpoint |
| `IDEPLOY_API_TOKEN` | `4|G0hq...` | API token for iDeploy communication |
| `IS_BETA` | `true` | Toggle for beta UI features |
| `ANALYTICS_ENABLED` | `false` | Toggle for analytics collection |

---

## 🗺️ Route Map

Three layout contexts are used across the application:
- `global` — Full left sidebar, user-level navigation (all projects, teams).
- `dashboard` — Project-scoped sidebar (project-specific workspace).
- `empty` — Fullscreen layout (login, project creation, onboarding).

### Global Console Routes (`layout: global`)

| Path | Component |
| :--- | :--- |
| `/console` | `GlobalDashboard` |
| `/dashboard` | `GlobalDashboard` |
| `/projects` | `ProjectsList` |
| `/teams` | `MyTeams` |
| `/teams/create` | `CreateTeam` |
| `/teams/:teamId` | `TeamDetailsGlobal` |

### Project Dashboard Routes (`layout: dashboard`)

| Path | Component |
| :--- | :--- |
| `/project/dashboard` | `DashboardComponent` |
| `/project/branding` | `ShowBrandingComponent` |
| `/project/branding/display` | `BrandingDisplayComponent` |
| `/project/branding/generate` | `BrandingGenerationPage` |
| `/project/branding/logo-variations` | `LogoVariationsComponent` |
| `/project/branding/select-colors` | `ColorSelectionComponent` |
| `/project/branding/select-typography` | `TypographySelectionComponent` |
| `/project/business-plan` | `ShowBusinessPlan` |
| `/project/business-plan/generate` | `BusinessPlanGenerationPage` |
| `/project/communication` | `ShowCommunication` |
| `/project/pitch-deck` | `ShowPitchDeck` |
| `/project/legal-docs` | `LegalDocsPage` |
| `/project/advisor` | `AdvisorPage` |
| `/project/diagrams` | `ShowDiagramsComponent` |
| `/project/diagrams/generate` | `DiagramGenerationPage` |
| `/project/tests` | `ShowTestsComponent` |
| `/project/development` | `ShowDevelopment` |
| `/project/development/create` | `CreateDevelopmentComponent` |
| `/project/ideploy` | `IDeployOverview` |
| `/project/deployments` | `DeploymentList` |
| `/project/deployments/create` | `CreateDeployment` |
| `/project/deployments/:id` | `DeploymentDetails` |
| `/project/teams` | `ProjectTeams` |
| `/project/teams/:teamId` | `TeamDetailsProject` |
| `/project/teams/add` | `AddTeamToProject` |
| `/project/profile` | `ProfileComponent` |
| `/project/finance` | `FinanceOverviewComponent` |
| `/project/finance/products` | `FinanceSectionStubComponent` (`sectionKey: products`) |
| `/project/finance/sales` | `FinanceSectionStubComponent` (`sectionKey: salesObjectives`) |
| `/project/finance/charges` | `FinanceSectionStubComponent` (`sectionKey: variableCharges`) |
| `/project/finance/fixed-charges` | `FinanceSectionStubComponent` (`sectionKey: fixedCharges`) |
| `/project/finance/taxes` | `FinanceSectionStubComponent` (`sectionKey: taxesParams`) |
| `/project/finance/revenue` | `FinanceSectionStubComponent` (`sectionKey: revenueParams`) |
| `/project/finance/investments` | `FinanceSectionStubComponent` (`sectionKey: investments`) |
| `/project/finance/amortization` | `FinanceSectionStubComponent` (`sectionKey: amortization`) |
| `/project/finance/financing` | `FinanceSectionStubComponent` (`sectionKey: financing`) |
| `/project/finance/ratios-params` | `FinanceSectionStubComponent` (`sectionKey: ratiosParams`) |
| `/project/finance/exploitation` | `FinanceSectionStubComponent` (`sectionKey: compteExploitation`) |
| `/project/finance/bilan` | `FinanceSectionStubComponent` (`sectionKey: bilan`) |
| `/project/finance/cashflow` | `FinanceSectionStubComponent` (`sectionKey: fluxTresorerie`) |
| `/project/finance/ratios` | `FinanceSectionStubComponent` (`sectionKey: ratios`) |

### Utility Routes (`layout: empty`)

| Path | Component |
| :--- | :--- |
| `/login` | `Login` (protected by `publicGuard`) |
| `/create-project` | `CreateProjectComponent` |
| `/not-found` | `NotFoundComponent` |
| `/**` | Redirect to `/not-found` |

---

## 🌍 Internationalisation (i18n)

The dashboard uses `ngx-translate` for runtime language switching (not build-time like the landing page). Translation files are JSON files loaded lazily via `HttpClient`.

- Source files: `src/assets/i18n/en.json` and `src/assets/i18n/fr.json`.
- Supported languages: **English (`en`)** and **French (`fr`)**.
- `LanguageService` (at `src/app/shared/services/language.service`) manages the active language and delegates to `TranslateService`.

**Template usage:**
```html
<!-- Simple key -->
<h1>{{ 'dashboard.welcome' | translate }}</h1>

<!-- With parameter interpolation -->
<p>{{ 'common.greeting' | translate: {name: userName} }}</p>
```

---

## 🎨 Design System Conventions

This application consumes `@idem/shared-styles` and enforces the following usage rules.

**Allowed button classes:**
```html
<button class="inner-button">Primary action</button>
<button class="outer-button">Secondary action</button>
```

**Glassmorphism effects:**
```html
<div class="glass">Content with glass effect</div>
<div class="glass-dark">Dark glass content</div>
<div class="glass-card">Card with glass effect</div>
```

**Inputs:**
```html
<input type="text" class="input" />
```

---

## 📋 Angular Coding Rules

The codebase enforces the following patterns (listed in `apps/main-dashboard/README.md`):

1. ✅ Always use `inject()` instead of constructor injection.
2. ✅ Use standalone components (no NgModule declarations).
3. ✅ Use the Angular 17+ control flow syntax: `@if`, `@for`, `@else`.
4. ✅ Use `[ngClass]` for conditional Tailwind classes with opacity modifiers.
5. ❌ Never use `[class.bg-primary/20]` syntax (not supported at runtime).
6. ❌ Do not use PrimeNG's `p-button` component — use the shared `inner-button` / `outer-button` classes.

---

## 🔧 Development Scripts

```bash
# Start development server (port 4200)
npm start               # → ng serve --host 0.0.0.0

# Build production bundle
npm run build           # → ng build

# Run in watch mode (incremental rebuild)
npm run watch

# Run unit tests
npm test
```

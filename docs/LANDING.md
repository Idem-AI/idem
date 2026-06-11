# Technical Documentation — Landing Page

This document describes the technical architecture and configuration of the **landing page** application, located in `apps/landing`.

---

## 🚀 Overview

The landing page is the public entry point of the Idem platform. It is built with Angular 20 and uses Server-Side Rendering (SSR) via Angular Universal for SEO optimization. It presents the product, redirects users to the private dashboard (`console.idem.africa`), and includes legal pages and platform-specific landing experiences.

---

## 🛠️ Stack & Technologies

- **Framework**: Angular 20
- **Rendering**: Server-Side Rendering (SSR) — entry point: `src/main.server.ts`, Express server at `src/server.ts`
- **Build tool**: `@angular/build:application` (Angular v17+ builder)
- **Styles**: Global stylesheet at `src/styles.css` + shared package `@idem/shared-styles`
- **Internationalization**: `@angular/localize` with locales `en` (source) and `fr` (translation file at `src/locale/messages.fr.json`)
- **UI Library**: PrimeNG ^20.1.1 + custom PrimeNG theme at `src/app/my-preset.ts`

---

## 📁 Project Structure

```
apps/landing/
├── src/
│   ├── app/
│   │   ├── app.routes.ts          # Route configuration (lazy-loaded)
│   │   ├── app.config.ts          # Application providers configuration
│   │   ├── app.config.server.ts   # SSR-specific providers configuration
│   │   ├── my-preset.ts           # PrimeNG custom theme tokens
│   │   ├── pages/                 # Public page components
│   │   │   ├── home/
│   │   │   ├── about-page/
│   │   │   ├── architecture-page/
│   │   │   ├── contact-page/
│   │   │   ├── deployment/
│   │   │   ├── african-market-page/
│   │   │   ├── ideploy-page/
│   │   │   ├── idev-page/
│   │   │   ├── open-source-page/
│   │   │   ├── premium-beta-access/
│   │   │   ├── pricing-page/
│   │   │   └── solutions-page/
│   │   ├── components/            # Shared layout components
│   │   ├── services/              # Injectable services
│   │   └── shared/                # Shared utilities and sub-components
│   ├── environments/              # Environment config files
│   ├── locale/                    # i18n translation files (en/fr)
│   ├── main.ts                    # Browser bootstrap
│   ├── main.server.ts             # SSR bootstrap
│   └── server.ts                  # Express SSR adapter
├── public/                        # Static assets
├── angular.json                   # Angular project builder configuration
└── package.json                   # Project dependencies and scripts
```

---

## ⚙️ Environment Variables

Configuration is managed via a `.env` file at `apps/landing/.env`, loaded by `mynode.js` before serve/build.

| Key | Example Value | Description |
| :--- | :--- | :--- |
| `FIREBASE_API_KEY` | `AIzaSy...` | Firebase project API key |
| `FIREBASE_AUTH_DOMAIN` | `lexis-ia.firebaseapp.com` | Firebase auth domain |
| `FIREBASE_PROJECT_ID` | `lexis-ia` | Firebase project ID |
| `FIREBASE_APP_ID` | `1:788...` | Firebase app identifier |
| `FIREBASE_MEASUREMENT_ID` | `G-1YQ...` | Firebase analytics measurement ID |
| `SERVICES_DOMAIN` | `https://idem.africa` | Production base domain |
| `SERVICES_DASHBOARD_URL` | `https://console.idem.africa` | Link to the authenticated dashboard |
| `SERVICES_API_URL` | `https://api.idem.africa` | Link to the API |
| `SERVICES_IDEV_URL` | `https://appgen.idem.africa` | Link to Appgen service |
| `SERVICES_IDEPLOY_URL` | `https://ideploy.idem.africa` | Link to iDeploy service |
| `WAITLIST_URL` | `https://forms.gle/...` | Beta waitlist link |
| `IS_BETA` | `true` | Feature flag to show beta-specific UI |
| `ANALYTICS_ENABLED` | `false` | Toggle for Plausible/analytics |

---

## 🗺️ Route Map

All routes are lazy-loaded standalone components using the `public` or `empty` layouts.

| Path | Component | Layout |
| :--- | :--- | :--- |
| `/home` | `Home` | `public` |
| `/about` | `AboutPage` | `public` |
| `/architecture` | `ArchitecturePage` | `public` |
| `/contact` | `ContactPage` | `public` |
| `/deployment` | `DeploymentPage` | `public` |
| `/african-market` | `AfricanMarketPage` | `public` |
| `/ideploy` | `IdeployPage` | `public` |
| `/idev` | `IdevPage` | `public` |
| `/open-source` | `OpenSourcePage` | `public` |
| `/premium-beta` | `PremiumBetaAccess` | `empty` |
| `/pricing` | `PricingPage` | `public` |
| `/solutions` | `SolutionsPage` | `public` |
| `/privacy-policy` | `PrivacyPolicy` | `public` |
| `/terms-of-service` | `TermsOfService` | `public` |
| `/beta-policy` | `BetaPolicy` | `public` |
| `/**` | Redirect to `/not-found` | `public` |

---

## 🌍 Internationalisation (i18n)

The application supports **English** (source locale) and **French**. Build configurations are defined in `angular.json` under the `i18n` section.

```bash
# Build for French locale
npm run build:fr        # → ng build --configuration=production-fr

# Build for English locale
npm run build:en        # → ng build --configuration=production-en

# Build all locales (merge then build)
npm run build:all-locales

# Serve in French
npm run start:fr        # → ng serve --configuration=fr
```

---

## 🔧 Development Scripts

```bash
# Start development server (port 4201)
npm run dev             # → ng serve --host 0.0.0.0 --port 4201

# Build production bundle (all locales merged)
npm run build

# Run unit tests with Karma
ng test

# Lint the project
npm run lint
```

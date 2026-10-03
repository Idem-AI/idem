# Mobile applications in iCode

How iCode generates a mobile application, previews it in a phone, and puts it online — and why it is built the way it is.

A mobile application in IDEM is a **React application laid out for a phone**, installable from its link as a PWA, and packaged for Android and iOS by **Capacitor** from the same code. It is not React Native.

```
Dashboard « Site & App »         iCode (browser)                         iCode server (we-dev-next)           iDeploy
┌──────────────────────┐        ┌────────────────────────────────┐       ┌─────────────────────────────┐     ┌──────────────────┐
│ « Une application »  │  URL   │ product=app & platform=mobile  │ chat  │ resolveBuildTarget()        │     │                  │
│  ○ Application web   │ ─────► │ remembered per project         │ ────► │  → 'mobile-app'             │     │                  │
│  ● Application mobile│        │ preview in iPhone / Android    │       │ skills: webcontainer-mobile │     │                  │
└──────────────────────┘        │ « Mettre en ligne »            │       │         mobile-app-ux       │     │                  │
                                │   npm run build → dist/        │ ────► │ /api/ideploy/publish        │ ──► │ static app       │
                                └────────────────────────────────┘       └─────────────────────────────┘     │ (nginx, HTTPS)   │
                                                                                                             └──────────────────┘
```

| What | Where |
| --- | --- |
| Web / mobile choice | `apps/main-dashboard/.../pages/development/show-development/` (`platforms`, `openICode`) |
| Stored choice | `DevelopmentConfigsModel.appPlatform` (`'web' \| 'mobile'`) |
| Choice in iCode, remembered across redirects | `apps/appgen/apps/we-dev-client/src/utils/product.ts` (`rememberProductChoice`, `currentPlatform`, `isMobileApp`) |
| Build target | `apps/appgen/apps/we-dev-next/src/config/buildTarget.ts` |
| Technical contract given to the model | `apps/appgen/apps/we-dev-next/src/skills/catalog/webcontainer-mobile.md` |
| Phone UX rules given to the model | `apps/appgen/apps/we-dev-next/src/skills/catalog/mobile-app-ux.md` |
| Product brief | `ProjectPromptService.generateMobileAppPrompt()` in `src/services/projectPromptService.ts` |
| Phone mockups | `apps/appgen/apps/we-dev-client/src/components/EditMode/PhoneMockup.tsx` |
| Going live | `src/utils/ideployPublish.ts` (client), `src/routes/ideploy.ts` (iCode server) |

## 1. Why React + Capacitor, not React Native

The decision was made against React Native (Expo) for three reasons:

1. **The preview must work.** iCode runs the generated project in a WebContainer — Node in the browser, no native binaries. A React + Vite project runs there exactly like the web target already does. React Native would need `react-native-web` and would break on any library with native code, which the model reaches for constantly.
2. **The model writes React well.** Every rule, design token and anti-generic check iCode already has for the web applies unchanged. A second UI framework would need its own.
3. **Nothing is lost for the user.** The same code installs from its link as a PWA today, and becomes a store application with Capacitor — which wraps the very same `dist/` folder.

What this gives up: native-only APIs (camera roll, background tasks, push without a server). The contract forbids Capacitor plugins for that reason — they do not run in the preview. Browser APIs cover the common needs: `<input type="file" accept="image/*" capture>` for a photo, `navigator.geolocation`, `tel:` and `https://wa.me/` links.

## 2. How the choice travels

1. On « Site & App », the user clicks **Application web** (marked *Recommandé*) or **Application mobile** in the application card. The dashboard saves `appPlatform` in the development config, then opens iCode with `?projectId=…&product=app&platform=mobile`.
2. iCode reads the choice from the URL before its first render (`rememberProductChoice()` in `main.tsx`) and stores it per project in `localStorage`. When a redirect loses the parameters — sign-in, payment, a bookmarked link — they are put back into the URL. Everything else in iCode reads the URL, so it only has to be right there.
3. The header shows what is being built, under the project name: *Site vitrine*, *Application web* or *Application mobile*.
4. Every chat request sends `product` and `platform`. The server turns them into a build target:

   | `product` | `platform` | Target |
   | --- | --- | --- |
   | `site` | — | `site` |
   | `app` | `web` (or none) | `web-app` |
   | `app` | `mobile` | `mobile-app` |
   | none (old links) | — | from the project config: `ONLY_LANDING` → `site`, otherwise `appPlatform` |

## 3. What the model is given

The builder prompt is assembled from **skills** (`src/skills/catalog/*.md`). A skill can declare `targets:`; the router (`src/skills/router.ts`) drops every skill whose targets do not include the current one. For `mobile-app`:

- `webcontainer-react` (the web contract) and `dashboard-app`, `landing-page` are **left out** — a phone application has no sidebar and no hero.
- `webcontainer-mobile` and `mobile-app-ux` are **added**, as core skills.

On the first turn the server also replaces the client's message with its own brief (`ProjectPromptService.generatePrompt(projectData, target)`): for a mobile application, the product, the brand, and the screens to build (welcome, sign-in, home tab, two or three tabs from the project description, detail screens, profile). No Dockerfile section: a mobile application is published as static files.

> The client-side prompt in `multiChatPromptService.ts` is **not** what the model reads on the first turn when a project is attached — the server rebuilds the brief. Change the server side.

### The technical contract (`webcontainer-mobile.md`)

The files the model must write, copied verbatim from a reference project that was built and checked with `vite build` and `cap config` before being written into the skill:

| File | Why it matters |
| --- | --- |
| `package.json` | `dev` / `build` / `cap:sync` scripts; React, `react-router-dom`, `@capacitor/core`, `@capacitor/cli` 6, Vite 5, Tailwind 3 |
| `capacitor.config.json` | `appId` `africa.idem.<name>`, `webDir: "dist"` |
| `vite.config.js` | **`base: './'`** — Capacitor loads the app from local files; absolute `/assets/…` paths give a blank screen on a phone |
| `index.html` | `viewport-fit=cover`, `theme-color`, manifest and icon links, all paths relative, the module script tag |
| `public/manifest.webmanifest` | `display: standalone`, `orientation: portrait`, brand colours |
| `public/icon.svg` | rounded square in the brand primary, offline (never an external URL) |
| `public/sw.js` | minimal service worker; registered **in production only** (in the preview it would serve stale files) |
| `src/App.jsx` | **`HashRouter`** — routes must work from local files inside Capacitor |
| `src/components/layout/AppShell.jsx` | the screen scrolls, the tab bar stays at the bottom, `max-w-md` keeps it a phone on a large screen |
| `src/components/layout/TopBar.jsx` | the top of every screen, with a back button on pushed screens |
| `src/hooks/useStoredState.js` | the app has no server: its data lives on the phone (`localStorage`) |
| `src/styles/index.css` | full-height root, no overscroll bounce, safe-area utilities (`pt-safe`, `pb-safe`) |

Colours come from the design system's `theme.extend` (`brand-*`, `neutral-*`, `surface`, `ink`, `ink-muted`), never Tailwind's default palette.

### The phone UX rules (`mobile-app-ux.md`)

- Bottom tab bar with 3 to 5 tabs is the only navigation — no header links, no hamburger, no footer.
- One task per screen; full-width list rows (at least 56 px) rather than card grids.
- Primary action at the bottom, within thumb reach; choices in a bottom sheet, not a centred modal.
- Every target at least 44 × 44 px, `active:` feedback on everything tappable (touch has no hover).
- Empty, loading (skeleton rows) and done (toast) states on every screen.
- Seed data in `src/data/`, persisted with `useStoredState`: every list, detail and form works.
- What betrays a website — hero sections, marketing copy, footers, desktop breakpoints — is listed and banned.

## 4. The preview

For a mobile application the preview shows **a phone only**: an **iPhone** (393 × 852, Dynamic Island, home indicator) or an **Android** phone (412 × 915, punch-hole camera, gesture bar). The desktop sizes are not offered.

The mockups are drawn in CSS (`PhoneMockup.tsx`). The system status bar and navigation bar sit **above and below** the application's screen, never over it, so the app keeps its whole surface as on a real device. The phone is scaled to fit the available height. Before the dev server runs, the « Rien à afficher pour l'instant » message and the **Exécuter** button are shown inside the phone screen.

## 5. Going live

**Mettre en ligne** in iCode (or on the dashboard card, which opens iCode with `?publish=1`) publishes through iDeploy without leaving iCode:

1. iCode builds the application in the WebContainer (`npm run build`) and reads `dist/` — text files as text, images and fonts as base64.
2. The iCode server forwards it, with the user's IDEM session, to iDeploy's `POST /api/v1/quick-deploy` (`files`, `build_pack: static`).
3. iDeploy stores the files as an archive (`application_sources`), the deployment worker uploads and unpacks it on the server, and nginx serves it over HTTPS with a fallback to `index.html`.
4. iCode polls the deployment and shows the address. Later publications replace the code of the same application, so the address never changes.

What is published is exactly what the preview showed. The application then **installs on a phone from its address** (« Ajouter à l'écran d'accueil »), with its own icon, full screen.

### Store packaging (Android / iOS)

Not automated yet: it needs Android Studio / Xcode, which cannot run in the browser. From the downloaded project:

```bash
npm install
npm run cap:sync          # builds dist/ and copies it into the native projects
npx cap add android       # once
npx cap open android      # Android Studio → Build → Generate Signed Bundle
npx cap add ios           # once, on macOS
npx cap open ios          # Xcode → Product → Archive
```

## 6. Changing it safely

- **Add a dependency to the contract only if it runs in the WebContainer** (pure JavaScript, no native module, no postinstall binary).
- **Re-verify the reference project** after any change to `webcontainer-mobile.md`: copy its code blocks into an empty folder, `npm install`, `npx vite build`, check that `dist/index.html` uses relative paths, and `npx cap config`.
- **Keep `base: './'` and `HashRouter`.** Both look optional in the browser and both break the Capacitor build.
- **Do not add Capacitor plugins** to the contract until the preview can run them.

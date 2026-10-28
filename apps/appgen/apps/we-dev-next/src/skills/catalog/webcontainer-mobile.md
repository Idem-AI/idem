---
name: webcontainer-mobile
description: Technical contract for the mobile application target - a preconfigured Vite + React 18 + Tailwind v3 starter (PWA manifest, service worker, Capacitor config, app shell with tab bar, top bar, local storage hook) is already mounted; the model writes the screens, the tabs and the seed data.
tier: core
priority: 90
targets: [mobile-app]
---

# Build target: a mobile application

What the customers open on their phone, not a website. It runs in a browser WebContainer for the preview (Vite + React 18 + TailwindCSS v3, no native binaries), installs from its link (PWA), and is packaged for Android and iOS by Capacitor from the same code.

**The starter is already mounted in `/home/project` and it already runs.** Never scaffold (`npx create-vite`, `npx cap init`), never write a configuration file, never touch `package.json`.

Only browser APIs. **No Capacitor plugin, no native module** (`@capacitor/camera`, `@capacitor/geolocation`, `react-native-*`): they do not run in the preview. `<input type="file" accept="image/*" capture>` for a photo, `navigator.geolocation` for a position, `tel:` and `https://wa.me/` links for calls and WhatsApp.

## Already written — do not emit these files

```
package.json                     scripts dev/build/preview/cap:sync, dependencies installed
capacitor.config.json            appId africa.idem.<project>, webDir dist
vite.config.js                   base './' (mandatory for Capacitor), React plugin
postcss.config.js                tailwind.config.js (the project's palette, fonts, scale, radii)
index.html                       relative paths, manifest, icon, fonts, #root + module script
public/manifest.webmanifest       standalone, portrait, brand theme colour
public/icon.svg                  app icon in the brand colour
public/sw.js                     service worker (registered in production only)
src/main.jsx                     src/styles/index.css (+ .pt-safe / .pb-safe)
src/lib/cn.js  src/lib/utils.js  cn(...classes)
components.json  jsconfig.json   projet installable par le CLI shadcn (alias @/ → src/)
src/components/layout/AppShell.jsx   screen frame: scrolling area + bottom tab bar, reads TABS
src/components/layout/TopBar.jsx     <TopBar title back action /> — sticky, safe area, back arrow
src/hooks/useStoredState.js          useStoredState(key, initial) — persists to localStorage
src/i18n/  src/components/LanguageSwitcher.jsx   t('text'), useLanguage, formatDate… — every visible text goes through t() (skill i18n)
src/ui/*.jsx                     the component kit below
```

A `file` action on any of them is dropped by the workspace. Installed: `react`, `react-dom`, `react-router-dom`, `lucide-react`, `clsx`, `tailwind-merge`. Anything else: `<boltAction type="shell">npm install name</boltAction>`. For an interface library, pick one from the menu in the task instead of inventing a package: the code installs it.

## What you write

1. **`src/tabs.js`** — the tab bar, one entry per main activity of this product (3 or 4, including Profile). `AppShell` renders it; the icons are `lucide-react` components.
   ```js
   import { Home, Package, User } from 'lucide-react';

   export const TABS = [
     { to: '/', label: 'Accueil', icon: Home, end: true },
     { to: '/orders', label: 'Commandes', icon: Package },
     { to: '/profile', label: 'Profil', icon: User },
   ];
   ```
2. **`src/App.jsx`** — **`HashRouter`** (never `BrowserRouter`: routes must work from local files inside Capacitor). Tab screens are children of the `AppShell` layout route; pushed screens sit outside it or inside, but always carry a `TopBar` with `back`.
   ```jsx
   import { HashRouter, Route, Routes } from 'react-router-dom';
   import AppShell from './components/layout/AppShell.jsx';

   export default function App() {
     return (
       <HashRouter>
         <Routes>
           <Route path="welcome" element={<Welcome />} />
           <Route element={<AppShell />}>
             <Route index element={<Home />} />
             <Route path="orders" element={<Orders />} />
             <Route path="orders/:id" element={<OrderDetail />} />
             <Route path="profile" element={<Profile />} />
           </Route>
         </Routes>
       </HashRouter>
     );
   }
   ```
3. **`src/screens/*.jsx`** — one file per screen: Welcome (first launch), sign in / create an account (one field per screen when possible), the home tab with the one thing the user comes to do in one tap, the other tabs, the detail screens, Profile.
4. **`src/data/*.js`** — realistic local seed data, a dozen items. The app has no server: state lives on the phone through `useStoredState`.
5. **`src/components/common/*.jsx`** — what the kit does not cover (list item, sheet, filter chips…).

## Component kit — assemble it, don't rewrite it

```jsx
import { Badge, Button, Card, EmptyState, Field, Input, Section, Spinner } from './ui/index.js';
```

`<Button variant="primary|secondary|accent|ghost" size="sm|md|lg">` (44px targets), `<Card>`, `<Badge>`, `<Input as="textarea">`, `<Spinner label>`, `<EmptyState title description action>`, `<Field label hint error>{(props) => <Input {...props} />}</Field>` (ARIA wired). `<Section>` is page-sized: inside a phone screen prefer `p-block`. Restyle with `className`.

Colours come from the project's tokens (`brand-*`, `neutral-*`, `surface`, `surface-raised`, `ink`, `ink-muted`, `accent`): never Tailwind's default palette (`blue-*`, `gray-*`).

## Output format

Start the response **immediately** with the artifact. No preamble.

```
<boltArtifact id="project-id" title="Project Title">
  <boltAction type="file" filePath="src/tabs.js">…</boltAction>
  <boltAction type="file" filePath="src/App.jsx">…</boltAction>
  <boltAction type="file" filePath="src/screens/Home.jsx">…</boltAction>
  <boltAction type="file" filePath="src/data/orders.js">…</boltAction>
  <boltAction type="shell">npm install</boltAction>
  <boltAction type="start">npm run dev</boltAction>
</boltArtifact>
```

## Check before finishing

- Every tab in `TABS` has a matching `<Route>`, and every pushed screen has a `TopBar` with `back`.
- The router is `HashRouter`.
- No import of a package that is not installed, no Capacitor plugin, no `react-native`.

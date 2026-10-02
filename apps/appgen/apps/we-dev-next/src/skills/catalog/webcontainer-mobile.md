---
name: webcontainer-mobile
description: Technical contract for the mobile application target - Vite + React 18 + Tailwind v3 laid out for a phone, installable as a PWA, packaged for Android and iOS by Capacitor, and the boltArtifact output format.
tier: core
priority: 90
targets: [mobile-app]
---

# Build target: a mobile application

The user is building a **mobile application**: what their customers open on their phone, not a website. It runs in a browser WebContainer for the preview (Vite + React 18 + TailwindCSS v3, no native binaries), installs on a phone from its link (PWA), and is packaged for Android and iOS by Capacitor from the same code.

The project is **already initialised** in `/home/project`. Never run `npx create-vite`, `create-react-app`, `npx cap init` or any scaffolding command. Modify and add files; use `npm install <package>` for dependencies and `npm run dev` to start.

Only browser APIs. **No Capacitor plugin and no native module** (`@capacitor/camera`, `@capacitor/geolocation`, `react-native-*`…): they do not run in the preview. Use `<input type="file" accept="image/*" capture>` for a photo, `navigator.geolocation` for a position, `tel:` and `https://wa.me/` links for calls and WhatsApp.

## Files that must exist — copy these exactly, then adapt names and colours

1. **`package.json` first.** The `scripts` block is mandatory: without `dev` the preview never starts.

   ```json
   {
     "name": "project",
     "private": true,
     "version": "0.0.0",
     "type": "module",
     "scripts": {
       "dev": "vite",
       "build": "vite build",
       "preview": "vite preview",
       "cap:sync": "npm run build && cap sync"
     },
     "dependencies": {
       "@capacitor/core": "^6.1.0",
       "lucide-react": "^0.400.0",
       "react": "^18.2.0",
       "react-dom": "^18.2.0",
       "react-router-dom": "^6.26.0"
     },
     "devDependencies": {
       "@capacitor/cli": "^6.1.0",
       "@vitejs/plugin-react": "^4.2.0",
       "autoprefixer": "^10.4.0",
       "postcss": "^8.4.0",
       "tailwindcss": "^3.4.0",
       "vite": "^5.0.0"
     }
   }
   ```

   Every package imported anywhere must appear in `dependencies`.

2. **`capacitor.config.json`** — `appId` is `africa.idem.` + the project name in lowercase letters only; `appName` is the project name.
   ```json
   { "appId": "africa.idem.monapp", "appName": "Mon App", "webDir": "dist" }
   ```

3. **`vite.config.js`** — `base: './'` is **mandatory**: Capacitor loads the app from local files, and absolute `/assets/…` paths give a blank screen on the phone.
   ```js
   import { defineConfig } from 'vite';
   import react from '@vitejs/plugin-react';

   export default defineConfig({
     base: './',
     plugins: [react()],
   });
   ```

4. **`tailwind.config.js`** — `content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}']`, plus the `theme.extend` block from the design system, pasted verbatim. **`postcss.config.js`** — `export default { plugins: { tailwindcss: {}, autoprefixer: {} } };`

5. **`index.html`** — every path relative (`./`), and **both** the mount node and the bootstrap script:
   ```html
   <!doctype html>
   <html lang="fr">
     <head>
       <meta charset="UTF-8" />
       <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
       <meta name="theme-color" content="BRAND_PRIMARY" />
       <meta name="mobile-web-app-capable" content="yes" />
       <meta name="apple-mobile-web-app-capable" content="yes" />
       <link rel="manifest" href="./manifest.webmanifest" />
       <link rel="icon" href="./icon.svg" type="image/svg+xml" />
       <link rel="apple-touch-icon" href="./icon.svg" />
       <title>App name</title>
     </head>
     <body>
       <div id="root"></div>
       <script type="module" src="/src/main.jsx"></script>
     </body>
   </html>
   ```

6. **`public/manifest.webmanifest`** — `name`, `short_name`, `"start_url": "./"`, `"scope": "./"`, `"display": "standalone"`, `"orientation": "portrait"`, `background_color`, `theme_color` (brand primary), and `"icons": [{ "src": "icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any maskable" }]`.

7. **`public/icon.svg`** — the app icon, 512×512 viewBox, a rounded square in the brand primary colour. If the brand gives inline SVG for its icon, place it centred inside; otherwise the first letter of the name in white, bold. Never an external URL here: the icon must work offline.

8. **`public/sw.js`** — minimal service worker (installable app, last screen available offline):
   ```js
   const CACHE = 'app-v1';
   self.addEventListener('install', (event) => {
     event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['./', './index.html'])));
     self.skipWaiting();
   });
   self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
   self.addEventListener('fetch', (event) => {
     if (event.request.method !== 'GET') return;
     event.respondWith(
       fetch(event.request)
         .then((response) => {
           const copy = response.clone();
           caches.open(CACHE).then((cache) => cache.put(event.request, copy));
           return response;
         })
         .catch(() => caches.match(event.request).then((hit) => hit || caches.match('./index.html')))
     );
   });
   ```

9. **`src/styles/index.css`**:
   ```css
   @tailwind base;
   @tailwind components;
   @tailwind utilities;

   @layer base {
     html, body, #root { height: 100%; }
     body { margin: 0; overscroll-behavior: none; -webkit-tap-highlight-color: transparent; -webkit-font-smoothing: antialiased; }
   }

   @layer utilities {
     .pt-safe { padding-top: env(safe-area-inset-top); }
     .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
   }
   ```

10. **`src/main.jsx`** — imports `./styles/index.css`, renders `<App />` into `#root`, and registers the service worker **in production only** (in the preview it would serve stale files):
    ```jsx
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
    }
    ```

11. **`src/App.jsx`** — **`HashRouter`**, never `BrowserRouter` (routes must work from local files inside Capacitor). Tab screens are children of one layout route:
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

12. **`src/components/layout/AppShell.jsx`** — the frame of every tab screen: the screen scrolls, the tab bar stays at the bottom. `max-w-md mx-auto` keeps it a phone on a large screen.
    ```jsx
    import { NavLink, Outlet } from 'react-router-dom';
    import { Home, Package, User } from 'lucide-react';

    const TABS = [
      { to: '/', label: 'Accueil', icon: Home, end: true },
      { to: '/orders', label: 'Commandes', icon: Package },
      { to: '/profile', label: 'Profil', icon: User },
    ];

    export default function AppShell() {
      return (
        <div className="mx-auto flex h-full max-w-md flex-col bg-surface text-ink">
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
          <nav className="pb-safe border-t border-neutral-200 bg-surface">
            <ul className="flex">
              {TABS.map(({ to, label, icon: Icon, end }) => (
                <li key={to} className="flex-1">
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `flex min-h-[56px] flex-col items-center justify-center gap-1 text-xs ${isActive ? 'text-brand-700' : 'text-ink-muted'}`
                    }
                  >
                    <Icon size={22} aria-hidden="true" />
                    <span>{label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      );
    }
    ```

13. **`src/components/layout/TopBar.jsx`** — the top of every screen; `back` adds the return arrow on pushed screens:
    ```jsx
    import { useNavigate } from 'react-router-dom';
    import { ChevronLeft } from 'lucide-react';

    export default function TopBar({ title, back = false, action = null }) {
      const navigate = useNavigate();
      return (
        <header className="pt-safe sticky top-0 z-10 border-b border-neutral-200 bg-surface">
          <div className="flex h-14 items-center gap-2 px-2">
            {back && (
              <button type="button" onClick={() => navigate(-1)} className="grid h-11 w-11 place-items-center" aria-label="Retour">
                <ChevronLeft size={24} />
              </button>
            )}
            <h1 className={`flex-1 truncate text-lg font-semibold ${back ? '' : 'px-2'}`}>{title}</h1>
            {action}
          </div>
        </header>
      );
    }
    ```

14. **`src/hooks/useStoredState.js`** — the app has no server: its data lives on the phone.
    ```js
    import { useEffect, useState } from 'react';

    export function useStoredState(key, initialValue) {
      const [value, setValue] = useState(() => {
        try {
          const raw = localStorage.getItem(key);
          return raw ? JSON.parse(raw) : initialValue;
        } catch {
          return initialValue;
        }
      });
      useEffect(() => {
        try {
          localStorage.setItem(key, JSON.stringify(value));
        } catch {
          /* storage full or refused: the state stays in memory */
        }
      }, [key, value]);
      return [value, setValue];
    }
    ```

Colours come from the design system's `theme.extend` (`brand-*`, `neutral-*`, `surface`, `surface-raised`, `ink`, `ink-muted`, `accent`): use those names, never Tailwind's default palette (`blue-*`, `gray-*`).

## Structure

```
src/
├── components/
│   ├── layout/     AppShell, TopBar
│   └── common/     Button, ListItem, EmptyState, Sheet …
├── screens/        one file per screen (Home, Orders, OrderDetail, Profile, Welcome …)
├── data/           seed data: realistic, local, a dozen items
├── hooks/          useStoredState …
├── styles/index.css
├── App.jsx
└── main.jsx
```

## Output format

Start the response **immediately** with the artifact. No preamble.

```
<boltArtifact id="project-id" title="Project Title">
  <boltAction type="file" filePath="package.json">…</boltAction>
  <boltAction type="file" filePath="capacitor.config.json">…</boltAction>
  <boltAction type="file" filePath="vite.config.js">…</boltAction>
  <boltAction type="file" filePath="tailwind.config.js">…</boltAction>
  <boltAction type="file" filePath="postcss.config.js">…</boltAction>
  <boltAction type="file" filePath="index.html">…</boltAction>
  <boltAction type="file" filePath="public/manifest.webmanifest">…</boltAction>
  <boltAction type="file" filePath="public/icon.svg">…</boltAction>
  <boltAction type="file" filePath="public/sw.js">…</boltAction>
  <boltAction type="file" filePath="src/styles/index.css">…</boltAction>
  <boltAction type="file" filePath="src/main.jsx">…</boltAction>
  <boltAction type="file" filePath="src/App.jsx">…</boltAction>
  <boltAction type="file" filePath="src/components/layout/AppShell.jsx">…</boltAction>
  <boltAction type="file" filePath="src/components/layout/TopBar.jsx">…</boltAction>
  <boltAction type="file" filePath="src/hooks/useStoredState.js">…</boltAction>
  <boltAction type="file" filePath="src/screens/…">…</boltAction>
  <boltAction type="shell">npm install</boltAction>
  <boltAction type="start">npm run dev</boltAction>
</boltArtifact>
```

## Check before finishing

- `index.html` has the `<script type="module" src="/src/main.jsx">` tag (a missing one is a blank screen with no error).
- `vite.config.js` has `base: './'`; the router is `HashRouter`.
- Every tab in `TABS` has a matching `<Route>`, and every pushed screen has a `TopBar` with `back`.
- No import of a package missing from `package.json`, no Capacitor plugin, no `react-native`.

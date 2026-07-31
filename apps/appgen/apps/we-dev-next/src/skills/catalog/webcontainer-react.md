---
name: webcontainer-react
description: Technical contract for the WebContainer target - Vite + React 18 + Tailwind v3, required files, and the boltArtifact output format.
tier: core
priority: 90
---

# Build target

Browser WebContainer running Node. Vite + React 18 + TailwindCSS v3. No native binaries.

The project is **already initialised** in `/home/project`. Never run `npx create-vite`, `create-react-app` or any scaffolding command. Modify and add files; use `npm install <package>` for dependencies and `npm run dev` to start.

## Files that must exist

1. **`package.json` first**, with every dependency you use. Base: `react@^18.2.0`, `react-dom@^18.2.0`; dev: `@vitejs/plugin-react@^4.2.0`, `vite@^5.0.0`, `tailwindcss@^3.4.0`, `postcss@^8.4.0`, `autoprefixer@^10.4.0`.
2. **`tailwind.config.js`** — `content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"]`, plus the `theme.extend` block from the design system, pasted verbatim.
3. **`postcss.config.js`** — `{ plugins: { tailwindcss: {}, autoprefixer: {} } }`.
4. **`src/styles/index.css`** — `@tailwind base; @tailwind components; @tailwind utilities;` then any custom layers.
5. **`vite.config.js`** — React plugin.
6. **`index.html`** — must contain **both** the mount node and the bootstrap script:
   ```html
   <body>
     <div id="root"></div>
     <script type="module" src="/src/main.jsx"></script>
   </body>
   ```
   Omitting the script tag renders a **blank page with no console error**. This is the single most common failure; check it before finishing.
7. **`src/main.jsx`** — imports `./styles/index.css` and renders `<App />` into `#root`.
8. **`src/App.jsx`** and components.

## Structure

```
src/
├── components/
│   ├── common/     Button, Card, Input …
│   ├── layout/     Header, Footer, Shell
│   └── sections/   Hero, Features, Pricing …
├── hooks/
├── utils/
├── styles/index.css
├── App.jsx
└── main.jsx
```

Reusable components, not monolithic files. Semantic HTML. Mobile-first responsive with Tailwind breakpoints. Tailwind utilities, not inline styles. Loading and error states on anything asynchronous.

## Output format

Start the response **immediately** with the artifact. No preamble, no explanation before it.

```
<boltArtifact id="project-id" title="Project Title">
  <boltAction type="file" filePath="package.json">…</boltAction>
  <boltAction type="file" filePath="tailwind.config.js">…</boltAction>
  <boltAction type="file" filePath="postcss.config.js">…</boltAction>
  <boltAction type="file" filePath="src/styles/index.css">…</boltAction>
  <boltAction type="file" filePath="vite.config.js">…</boltAction>
  <boltAction type="file" filePath="index.html">…</boltAction>
  <boltAction type="file" filePath="src/main.jsx">…</boltAction>
  <boltAction type="file" filePath="src/App.jsx">…</boltAction>
  <boltAction type="file" filePath="src/components/…">…</boltAction>
  <boltAction type="shell">npm install</boltAction>
  <boltAction type="start">npm run dev</boltAction>
</boltArtifact>
```

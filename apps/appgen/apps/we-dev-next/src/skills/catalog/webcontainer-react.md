---
name: webcontainer-react
description: Technical contract for the WebContainer site target - a preconfigured Vite + React 18 + Tailwind v3 starter is already mounted, the model writes only the product files, plus the boltArtifact output format.
tier: core
priority: 90
targets: [site]
---

# Build target

Browser WebContainer running Node. Vite + React 18 + TailwindCSS v3. No native binaries.

**The starter is already mounted in `/home/project` and it already runs.** Never scaffold (`npx create-vite`, `create-react-app`), never write a configuration file, never touch `package.json`.

## Already written — do not emit these files

```
package.json          scripts dev/build/preview, dependencies installed
vite.config.js        React plugin, port 5173
postcss.config.js     tailwindcss + autoprefixer
tailwind.config.js    the project's palette, fonts, scale, radii, rhythm
index.html            fonts linked, meta tags, #root + the module script
src/main.jsx          mounts <App /> and imports the stylesheet
src/styles/index.css  Tailwind layers, brand fonts, focus ring
src/lib/cn.js         cn(...classes) — Tailwind-aware class merge
src/ui/*.jsx          the component kit below
```

A `file` action on any of them is dropped by the workspace, so writing one costs you tokens and changes nothing.

Installed and importable: `react`, `react-dom`, `lucide-react` (icons), `clsx`, `tailwind-merge`. Anything else: `<boltAction type="shell">npm install name</boltAction>`, never a `package.json` edit.

## Component kit — assemble it, don't rewrite it

```jsx
import { Badge, Button, Card, EmptyState, Field, Input, Section, Spinner } from './ui/index.js';
```

- `<Button variant="primary|secondary|accent|ghost" size="sm|md|lg" as="a" href="…">` — brand colours, 44px touch target, focus ring.
- `<Card>` — raised surface, hairline border, `p-block`.
- `<Section>` — page section: `px-6 py-section` and a centred `max-w-6xl` container.
- `<Badge>`, `<Input as="textarea">`, `<Spinner label="…" />`, `<EmptyState title description action />`.
- `<Field label hint error>{(props) => <Input {...props} />}</Field>` — label, hint and error wired with the right ARIA attributes.

Restyle any of them per section with `className` (the merge keeps the last conflicting class). Write a new component when the kit has no equivalent — a hero, a pricing table, a testimonial band are yours to design.

## What you write

```
src/App.jsx                 the page, composed of sections
src/components/sections/     Hero, Features, Pricing, FAQ, CTA …
src/components/layout/       Header, Footer
src/components/common/       anything the kit does not cover
src/hooks/  src/utils/  src/data/
```

Reusable components, not one monolithic file. Semantic HTML. Mobile-first with Tailwind breakpoints. Loading and error states on anything asynchronous.

## Output format

Start the response **immediately** with the artifact. No preamble, no explanation before it.

```
<boltArtifact id="project-id" title="Project Title">
  <boltAction type="file" filePath="src/App.jsx">…</boltAction>
  <boltAction type="file" filePath="src/components/layout/Header.jsx">…</boltAction>
  <boltAction type="file" filePath="src/components/sections/Hero.jsx">…</boltAction>
  <boltAction type="shell">npm install</boltAction>
  <boltAction type="start">npm run dev</boltAction>
</boltArtifact>
```

## Fallback — only when the task does not say the starter is in place

Then the workspace is empty and the build contract is yours: `package.json` first (`"type": "module"`, scripts `dev: vite` / `build: vite build` / `preview: vite preview`, deps `react`, `react-dom`, devDeps `vite`, `@vitejs/plugin-react`, `tailwindcss`, `postcss`, `autoprefixer`), then `vite.config.js` (React plugin), `postcss.config.js`, `tailwind.config.js` (`content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}']` plus the design system's `theme.extend`), `index.html` (**both** `<div id="root">` and `<script type="module" src="/src/main.jsx">` — a missing script tag is a blank page with no console error), `src/styles/index.css`, `src/main.jsx`, then the product.

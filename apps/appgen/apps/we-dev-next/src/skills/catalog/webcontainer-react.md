---
name: webcontainer-react
description: Technical contract for the WebContainer site target - a preconfigured Vite + React 18 + Tailwind starter with a section kit is already mounted; the model writes a page plan and one content file per section, and the code composes the page.
tier: core
priority: 90
targets: [site]
---

# Build target

Browser WebContainer running Node. Vite + React 18 + TailwindCSS v3. No native binaries.

**The starter is already mounted in `/home/project` and it already runs.** Never scaffold, never write a configuration file, never touch `package.json`.

## How a page is built here

You do **not** write the layout. The starter carries a section kit — responsive, accessible, already wearing this project's palette, fonts and rhythm. Your job is the two things a layout cannot decide for itself: **what goes on the page, and what it says.**

So you write exactly two kinds of file:

1. **`idem.plan.json`** — the page, in order.
2. **`src/content/<name>.js`** — one module per section, exporting a plain object.

`src/App.jsx` is then composed by the code from your plan. Its imports cannot be wrong, nothing can be left half-written, and a weak moment on your side costs one section, never the whole page.

```
<boltAction type="file" filePath="idem.plan.json">
{
  "libraries": ["motion"],
  "registryComponents": { "magic-ui": ["marquee"] },
  "sections": [
    { "component": "Nav", "content": "nav" },
    { "component": "Hero", "content": "hero" },
    { "component": "Features", "content": "features" },
    { "component": "Steps", "content": "steps" },
    { "component": "Testimonials", "content": "testimonials" },
    { "component": "Pricing", "content": "pricing" },
    { "component": "Faq", "content": "faq" },
    { "component": "Cta", "content": "cta" },
    { "component": "Footer", "content": "footer" }
  ]
}
</boltAction>
```

**The plan is never an answer on its own.** A reply that contains only the plan — or that prints it as text instead of writing it as a file — produces an empty page: the plan names content modules that do not exist yet, and every section without content is dropped. In the same artifact, write `idem.plan.json` **and one `src/content/<name>.js` for every section you listed**. Nothing else is expected of you, and nothing less works.

A section may carry a `"variant"`, but only one the kit has: `Hero` takes `split`, `centered` or `editorial`; `Features` takes `bento`, `rows` or `cards`; `Pricing` takes `cards` or `table`. Any other value is ignored, and leaving `variant` out is the better default — the starter already picked the one that fits this project's art direction.

A section may also carry a `"visual"` (a component installed from a registry):
`{ "component": "Hero", "content": "hero", "visual": { "component": "Globe", "import": "@/components/ui/globe.jsx", "named": true } }`

Pick the sections this product actually needs, in the order that sells it. A page with no pricing does not get a Pricing section.

## The section kit and what each one expects

Each content module is `export default { … }`. Plain data: strings, numbers, arrays — that is what travels best and what the kit expects. A value that is genuinely visual (a styled wordmark for `logo`, an icon) may hold a small JSX element; the starter reads `.js` files in `src/` as JSX, so it will not break the build. Everything else stays data.

| Section | Content object |
|---|---|
| `Nav` | `logo` (text), `links: [{ label, href }]`, `cta: { label, href }` |
| `Hero` | `eyebrow`, `title`, `description`, `primaryCta: { label, href }`, `secondaryCta` |
| `Features` | `title`, `intro`, `items: [{ title, description }]` |
| `Steps` | `title`, `items: [{ title, description }]` |
| `Testimonials` | `title`, `items: [{ quote, name, role }]` |
| `Pricing` | `title`, `intro`, `plans: [{ name, price, period, description, features: [], cta: { label, href }, featured }]` |
| `Faq` | `title`, `items: [{ question, answer }]` |
| `Cta` | `title`, `description`, `primaryCta`, `secondaryCta` |
| `Footer` | `logo`, `tagline`, `columns: [{ title, links: [{ label, href }] }]`, `legal` |

```js
// src/content/hero.js
export default {
  eyebrow: 'Douala, livraison avant midi',
  title: 'Le marché de Douala, livré chez vous avant midi',
  description: 'Commandez le soir auprès des maraîchers de Nkoldongo. Vous recevez le lendemain matin.',
  primaryCta: { label: 'Commander', href: '#tarifs' },
};
```

Write the copy as this product would say it: concrete nouns, real places, real prices. Never "Lorem ipsum", never "Feature One", never an invented statistic.

## When the kit is not enough

A product that needs something the kit has no shape for — a map, a booking calendar, a configurator — gets its own component under `src/components/`, and you compose it yourself in `src/App.jsx` instead of writing a plan. That is the escape hatch, not the default: use it for the one section that needs it, and keep the plan for the rest.

Everything from the component kit is available there: `import { Badge, Button, Card, EmptyState, Field, Input, Section, Spinner } from './ui/index.js';`

## Already written — do not emit these files

```
package.json  vite.config.js  postcss.config.js  tailwind.config.js  index.html
components.json  jsconfig.json  Dockerfile  nginx.conf  .dockerignore
src/main.jsx  src/styles/index.css  src/lib/cn.js  src/lib/utils.js
src/ui/*.jsx         the component kit
src/sections/*.jsx   the section kit
idem.libraries.json  the library catalog
```

A `file` action on any of them is dropped by the workspace. Installed and importable: `react`, `react-dom`, `lucide-react` (icons), `clsx`, `tailwind-merge`. Anything else is **chosen in the plan**, never installed by hand.

Only these font classes exist: `font-display`, `font-sans`, `font-mono`. A class named after a typeface does not exist, and inside `@apply` it stops the build.

## Output format

Start the response **immediately** with the artifact. No preamble.

```
<boltArtifact id="project-id" title="Project Title">
  <boltAction type="file" filePath="idem.plan.json">…</boltAction>
  <boltAction type="file" filePath="src/content/nav.js">…</boltAction>
  <boltAction type="file" filePath="src/content/hero.js">…</boltAction>
  <boltAction type="file" filePath="src/content/features.js">…</boltAction>
  <boltAction type="file" filePath="src/content/steps.js">…</boltAction>
  <boltAction type="file" filePath="src/content/pricing.js">…</boltAction>
  <boltAction type="file" filePath="src/content/faq.js">…</boltAction>
  <boltAction type="file" filePath="src/content/cta.js">…</boltAction>
  <boltAction type="file" filePath="src/content/footer.js">…</boltAction>
  <boltAction type="shell">npm install</boltAction>
  <boltAction type="start">npm run dev</boltAction>
</boltArtifact>
```

One `src/content/…` action per section of the plan, in the same order. The plan above lists nine sections, so nine content actions follow it.

## Fallback — only when the task does not say the starter is in place

Then the workspace is empty and the whole build contract is yours: `package.json` (`"type": "module"`, scripts `dev`/`build`/`preview`, deps `react`, `react-dom`, devDeps `vite`, `@vitejs/plugin-react`, `tailwindcss`, `postcss`, `autoprefixer`), `vite.config.js`, `postcss.config.js`, `tailwind.config.js` (`content: ['./index.html', './src/**/*.{js,jsx}']` plus the design system's `theme.extend`), `index.html` (**both** `<div id="root">` and `<script type="module" src="/src/main.jsx">` — a missing script tag is a blank page with no console error), `src/styles/index.css`, `src/main.jsx`, then the page in JSX. Set fonts with plain `font-family` in `@layer base`, never `@apply font-<FamilyName>`.

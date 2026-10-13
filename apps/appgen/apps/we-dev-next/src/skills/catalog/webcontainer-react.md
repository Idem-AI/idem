---
name: webcontainer-react
description: Technical contract for the showcase site target - a preconfigured multi-page Vite starter with a section kit is already mounted; the model writes a page plan and one content file per section, and the code composes the pages, their documents and their search metadata.
tier: core
priority: 90
targets: [site]
---

# Build target: a showcase site

Browser WebContainer running Node. **Vite, multi-page**, React 18, TailwindCSS v3.

One HTML document per page, not one bundle for the whole site. Each page carries its own title, description and sharing tags in the document that is served, and the build pre-renders every page to static HTML before writing `dist/` — so a search engine reads the copy without running a line of JavaScript. The sitemap, the robots file and the structured data are written by the build too. None of it is your concern: name the pages in the plan and they get all of it.

**The starter is already mounted in `/home/project` and it already runs.** Never scaffold, never write a configuration file, never touch `package.json`.

## How a site is built here

You do **not** write the layout. The starter carries a section kit — responsive, accessible, already wearing this project's palette, fonts and rhythm. You write the two things a layout cannot decide: **what the site contains, and what it says.**

1. **`idem.plan.json`** — the pages, in order, each with its sections.
2. **`src/content/<name>.js`** — one module per section, exporting a plain object.

The pages (`src/app/page.jsx`, `src/app/<slug>/page.jsx`) are then composed by the code. Their imports cannot be wrong, and a weak moment on your side costs one section, never the site.

```
<boltAction type="file" filePath="idem.plan.json">
{
  "libraries": ["motion"],
  "pages": [
    {
      "path": "/",
      "title": "Paniers de légumes livrés à Douala",
      "description": "Commandez le soir, recevez avant midi. Paiement Orange Money ou MTN MoMo.",
      "sections": [
        { "component": "Nav", "content": "nav" },
        { "component": "Hero", "content": "hero" },
        { "component": "Logos", "content": "logos" },
        { "component": "Features", "content": "features" },
        { "component": "Split", "content": "split-fraicheur" },
        { "component": "Stats", "content": "stats" },
        { "component": "Testimonials", "content": "testimonials" },
        { "component": "Pricing", "content": "pricing" },
        { "component": "Faq", "content": "faq" },
        { "component": "Cta", "content": "cta" },
        { "component": "Footer", "content": "footer" }
      ]
    },
    {
      "path": "/methode",
      "title": "Notre méthode",
      "description": "Des maraîchers de Nkoldongo à votre porte, en trois étapes.",
      "sections": [
        { "component": "Nav", "content": "nav" },
        { "component": "Steps", "content": "steps" },
        { "component": "Team", "content": "team" },
        { "component": "Contact", "content": "contact" },
        { "component": "Footer", "content": "footer" }
      ]
    }
  ]
}
</boltAction>
```

**The plan is never an answer on its own.** A reply that contains only the plan — or that prints it as text instead of writing it as a file — produces an empty site: the plan names content modules that do not exist yet, and every section without content is dropped. In the same artifact, write `idem.plan.json` **and one `src/content/<name>.js` per section listed**. Nothing less works.

### Make it a real site, not a slide

- **The home page carries 7 to 11 sections.** Three sections is a placeholder, not a site.
- **Two to four pages** when the product has something to say: a method, an offer, a team, a contact page, a story. A one-page site is a choice, not a default — pick it when the product genuinely has one thing to say.
- **Vary the navigation.** Links to real pages (`/methode`) and anchors inside a page (`#tarifs`) both work, and the kit handles each. A site where every menu entry merely scrolls reads as a template.
- `Nav` and `Footer` go on **every** page; everything else depends on what that page is for.

## The section kit

Each content module is `export default { … }`. Plain data: strings, numbers, arrays. A genuinely visual value (a styled wordmark, an icon) may hold a small JSX element; the starter reads `.js` files in `src/` as JSX. Everything else stays data.

| Section | Content object |
|---|---|
| `Nav` | `logo` (text), `links: [{ label, href }]`, `cta: { label, href }` |
| `Hero` | `eyebrow`, `title`, `description`, `primaryCta: { label, href }`, `secondaryCta` |
| `Logos` | `title`, `items: [{ name, src? }]` — trust band |
| `Features` | `title`, `intro`, `items: [{ title, description }]` |
| `Split` | `eyebrow`, `title`, `description`, `bullets: []`, `cta`, `reversed` — alternate them |
| `Steps` | `title`, `items: [{ title, description }]` |
| `Stats` | `title`, `items: [{ value, label }]` |
| `Testimonials` | `title`, `items: [{ quote, name, role }]` |
| `Pricing` | `title`, `intro`, `plans: [{ name, price, period, description, features: [], cta, featured }]` |
| `Team` | `title`, `intro`, `items: [{ name, role, bio?, photo? }]` |
| `Faq` | `title`, `items: [{ question, answer }]` |
| `Contact` | `title`, `description`, `hours`, `channels: [{ label, value, href }]` |
| `Cta` | `title`, `description`, `primaryCta`, `secondaryCta` |
| `Footer` | `logo`, `tagline`, `columns: [{ title, links: [{ label, href }] }]`, `legal` |

A section may carry a `"variant"` the kit knows: `Hero` → `split`, `centered`, `editorial`; `Features` → `bento`, `rows`, `cards`; `Pricing` → `cards`, `table`. Leaving it out is better — the starter already picked the one that fits this project's art direction.

A section may also carry a `"visual"` (a component installed from a registry):
`{ "component": "Hero", "content": "hero", "visual": { "component": "Globe", "import": "@/components/ui/globe.jsx", "named": true } }`

```js
// src/content/hero.js
export default {
  eyebrow: 'Douala, livraison avant midi',
  title: 'Le marché de Douala, livré chez vous avant midi',
  description: 'Commandez le soir auprès des maraîchers de Nkoldongo. Vous recevez le lendemain matin, payé par Orange Money ou MTN MoMo.',
  primaryCta: { label: 'Commander', href: '/commander' },
};
```

Write the copy as this product would say it: real places, real prices, real hours. Four to six items where the kit takes a list — two is thin. Never "Lorem ipsum", never "Feature One", never an invented statistic or award.

**Do not write `src/seo.js`.** Search settings are a separate step, asked for after the site exists, when the copy is there to draw keywords from.

## When the kit is not enough

A product needing something the kit has no shape for — a map, a booking calendar, a configurator — gets its own component under `src/components/` and its own page under `src/app/`, written by you. That is the escape hatch, not the default.

The component kit is available there: `import { Badge, Button, Card, EmptyState, Field, Input, Section, Spinner } from '@/ui/index.js';`

## Already written — do not emit these files

```
package.json  vite.config.js  postcss.config.js  tailwind.config.js  jsconfig.json
components.json  scripts/prerender.mjs  Dockerfile  nginx.conf  .dockerignore
index.html  idem.page.html   the home document, and the template every page is cut from
src/styles/index.css         the project's palette, fonts and rhythm
src/brand.jsx                the project's logo — already placed in Nav and Footer
src/entries/*.jsx            one mount per page, written by the code
src/lib/cn.js  src/lib/utils.js  src/ui/*.jsx  src/sections/*.jsx
idem.libraries.json          the library catalog
```

A `file` action on any of them is dropped by the workspace. Installed: `react`, `react-dom`, `lucide-react`, `clsx`, `tailwind-merge`. Anything else is **chosen in the plan**, never installed by hand.

Only these font classes exist: `font-display`, `font-sans`, `font-mono`. A class named after a typeface does not exist, and inside `@apply` it stops the build.

## Output format

Start the response **immediately** with the artifact. No preamble.

```
<boltArtifact id="project-id" title="Project Title">
  <boltAction type="file" filePath="idem.plan.json">…</boltAction>
  <boltAction type="file" filePath="src/content/nav.js">…</boltAction>
  <boltAction type="file" filePath="src/content/hero.js">…</boltAction>
  … one per section of every page …
  <boltAction type="shell">npm install</boltAction>
  <boltAction type="start">npm run dev</boltAction>
</boltArtifact>
```

## Fallback — only when the task does not say the starter is in place

Then the workspace is empty and the whole build contract is yours: a Vite + React 18 + Tailwind v3 project (`package.json` with `"type": "module"` and scripts `dev`/`build`/`preview`, `vite.config.js`, `postcss.config.js`, `tailwind.config.js` with the design system's `theme.extend`, `index.html` carrying **both** `<div id="root">` and `<script type="module" src="/src/main.jsx">`, `src/styles/index.css`, `src/main.jsx`), then the page in JSX. Set fonts with plain `font-family` in `@layer base`, never `@apply font-<FamilyName>`.

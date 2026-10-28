---
name: webcontainer-react
description: Technical contract for the showcase site target - React + TypeScript + Tailwind + shadcn/ui + Motion, a central design system configured by design-system.json, pages assembled from section components that compose the design system's primitives.
tier: core
priority: 90
targets: [site]
---

# Build target: a showcase site

Browser WebContainer running Node. **Vite, multi-page**, React 18, **TypeScript**, Tailwind CSS v3, **shadcn/ui** components, **Motion for React** (`motion/react`). One HTML document per page; the build pre-renders every page, writes the sitemap, robots file and structured data. The site is already generated and running: you are changing it.

## How this site is built

1. **The design system is central.** `src/components/ui/*` holds the base components (Button, Heading, Text, Card, Badge, Container, Section, Media, Input, Accordion, Tabs, Sheet, Dialog…). They already carry their colours, radii, borders, shadows, typography and states. **Never rewrite or restyle them.**
2. **Appearance lives in one file: `src/design-system/design-system.json`.** Colours, fonts, type scale, radii, borders, elevation, density, component recipes (button / input / card / badge) and motion. A plugin compiles it into `theme.generated.css` and `component-config.generated.json` — never edit those two files. To change the look of the whole site ("rounder buttons", "another primary colour", "less shadow", "calmer animations"), edit `design-system.json` and nothing else.
3. **Facts live in `src/site/data.ts`** (`site`: name, contact channels, primaryAction, navigation, pages, offers with real prices, team). Import them; never hard-code a price, a phone number or a link. Visuals live in `src/site/media.ts` (`media[key]`, shown with `<Media asset={…} />`). The logo is `<BrandMark />` from `@/site/brand`.
4. **Each section is its own component**: `src/sections/<page>/<Name>.tsx`, `export default function Name()`, root element with the section's anchor `id`. The header is `src/components/site/SiteHeader.tsx` (`{ current }` prop), the footer `src/components/site/SiteFooter.tsx`.
5. **Pages are assembled**: `src/pages/<page>.tsx` imports its sections in order (with the `.tsx` extension), between the header and footer, each wrapped in `<SectionBoundary name="…">`. To add, remove or reorder a section, edit that list.

## Writing a component

- Compose freely with React and Tailwind: layout, spacing, grids, asymmetry, responsive (mobile first). No page template is imposed.
- Use the design system components whenever their role fits, with their variants. Do not add colour, radius, shadow or font classes to them.
- Colours: theme tokens only — `background`, `foreground`, `primary`, `primary-foreground`, `secondary`, `muted`, `muted-foreground`, `accent`, `card`, `border`, `ring`, with opacity (`bg-primary/10`). Tailwind's default palette (`blue-600`, `gray-100`) **does not exist** in this project. No hex values.
- Type sizes: `text-display`, `text-h1` … `text-h4`, `text-lead`, `text-body`, `text-small` — or `Heading` / `Text`.
- Motion: only `motion/react`, with the project's tokens (`import { motionTokens } from '@/design-system'`). Never hide the first section's headline behind an entrance animation.
- Icons: `lucide-react`, by exact name.
- Forbidden: CSS files, `<style>`, colour in `style={{}}`, other component or animation libraries (MUI, Chakra, Mantine, GSAP…), invented facts, fake forms (the site has no backend: contact goes through `site.primaryAction` / `site.contact.channels`).

## Adding a page

Create `src/entries/<slug>.tsx` (same as `src/entries/home.tsx`, importing `../pages/<slug>.tsx`), `src/pages/<slug>.tsx`, its sections in `src/sections/<slug>/`, then add one entry per site language to `src/site/pages.json` (`path`, `lang`, `module`, `entry`, `html`: `<slug>/index.html`, `title`, `description`) and the page to `site.navigation` / `site.pages` in `src/site/data.ts`. Never create an HTML file for a page: the template builds each page document from `index.html` and `src/site/pages.json`.

## Files you never write

`package.json`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `tsconfig.json`, `components.json`, `scripts/**`, `src/components/ui/**`, `src/components/site/section-boundary.tsx`, `src/styles/index.css`, `src/lib/utils.ts`, `src/design-system/*.ts`, `src/design-system/*.generated.*`, `src/site/brand.tsx`. The workspace drops those writes.

Write only the files the request needs, each complete.

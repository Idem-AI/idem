---
name: webcontainer-fullstack
description: Technical contract for the complete web application target - a preconfigured frontend/ (Vite + React + Tailwind) and backend/ (Express + PostgreSQL via PGlite) starter is already mounted and starts with one command; the model writes the schema, the seed, the routes and the screens.
tier: core
priority: 90
targets: [web-app]
---

# Build target: a complete web application

An interface, a server carrying the business rules, and a database. Everything runs in a browser WebContainer for the preview (Node, no native binaries) and is deployed by iDeploy as three pieces: PostgreSQL, `backend/`, `frontend/`.

**The starter is already mounted in `/home/project` and it already starts.** `npm install` then `npm run dev` at the root install and run both halves. Never scaffold (`npx create-vite`, `prisma init`), never write a configuration file, never touch a `package.json`.

## Already written — do not emit these files

```
package.json                postinstall + concurrently: one command starts api and web
README.md                   what the app does and its environment variables
backend/package.json        express, cors, pg, @electric-sql/pglite, bcryptjs, jsonwebtoken, zod
backend/src/db.js           PGlite in the preview, pg online; exports query() and initDatabase()
backend/src/index.js        express, CORS, /api/health, error handler, AUTO-MOUNTS src/routes/*.js
backend/src/auth.js         hashPassword, verifyPassword, signToken, requireUser middleware
frontend/package.json       vite, react 18, tailwind v3, react-router-dom, lucide-react
frontend/vite.config.js     port 5173, proxy /api → http://localhost:3001
frontend/postcss.config.js  frontend/tailwind.config.js  (the project's palette and fonts)
frontend/index.html         fonts linked, #root + the module script
frontend/src/main.jsx       frontend/src/styles/index.css  frontend/src/lib/cn.js
frontend/src/lib/utils.js   frontend/components.json  frontend/jsconfig.json (CLI shadcn, alias @/)
frontend/src/api.js         api(path, options) — the only way to reach the backend
frontend/src/i18n/          t('text'), useLanguage, formatDate… + LanguageSwitcher — every visible text goes through t() (skill i18n)
frontend/src/ui/*.jsx       the component kit below
```

A `file` action on any of them is dropped by the workspace. Need another package? `<boltAction type="shell">cd backend && npm install name</boltAction>` (or `cd frontend && …`). For an interface library, pick one from the menu in the task instead of inventing a package: the code installs it.

## The rules that do not bend

- **The database is PostgreSQL.** The preview has no server: `db.js` runs **PGlite** (PostgreSQL in WebAssembly, same process). Online, `DATABASE_URL` is set and the same code uses `pg`. Write standard PostgreSQL SQL that works in both.
- **No ORM, no native module.** Prisma, TypeORM, Sequelize, `better-sqlite3`, `bcrypt`, `sharp` need native binaries that do not run in the preview. Plain SQL through `query()`, `bcryptjs` for passwords, `jsonwebtoken` for tokens — all three already installed.
- **Always parameterised queries** (`$1`, `$2`), never string concatenation.
- **The frontend never hard-codes the backend address**: it calls `api('/customers')`. The proxy handles the preview, `VITE_API_URL` handles production.

## What you write

1. **`backend/src/schema.sql`** — every table with `CREATE TABLE IF NOT EXISTS`, `SERIAL` or `TEXT` ids, foreign keys, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`. It runs on every start, so it must be safe to run twice.
2. **`backend/src/seed.sql`** — a dozen realistic rows per main table (African names, cities, currencies), with **explicit ids** and `ON CONFLICT (id) DO NOTHING`, then reset each sequence:
   ```sql
   INSERT INTO customers (id, name, city) VALUES
     (1, 'Amara Diallo', 'Dakar'),
     (2, 'Kwame Asante', 'Accra')
   ON CONFLICT (id) DO NOTHING;
   SELECT setval('customers_id_seq', (SELECT MAX(id) FROM customers));
   ```
3. **`backend/src/routes/<entity>.js`** — one file per entity, **default-exporting an `express.Router()`**. It is mounted under `/api` automatically; no line to add anywhere.
   ```js
   import { Router } from 'express';
   import { query } from '../db.js';

   const router = Router();

   router.get('/customers', async (_req, res, next) => {
     try {
       res.json(await query('SELECT id, name, city FROM customers ORDER BY id'));
     } catch (error) {
       next(error);
     }
   });

   export default router;
   ```
   Accounts needed? `routes/auth.js` with `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, using `backend/src/auth.js`; protect a route with `requireUser`.
4. **`frontend/src/App.jsx`** (router), **`frontend/src/pages/*.jsx`**, **`frontend/src/components/*.jsx`**. Every screen handles the loading, empty and error states of `api()`; no screen shows hard-coded data the API could serve.

## Component kit — assemble it, don't rewrite it

```jsx
import { Badge, Button, Card, EmptyState, Field, Input, Section, Spinner } from './ui/index.js';
```

`<Button variant="primary|secondary|accent|ghost" size="sm|md|lg">`, `<Card>`, `<Section>` (rhythm + centred container), `<Badge>`, `<Input as="textarea">`, `<Spinner label>`, `<EmptyState title description action>`, `<Field label hint error>{(props) => <Input {...props} />}</Field>` (ARIA wired). Restyle with `className`; write your own component when the kit has no equivalent.

## Output format

Start the response **immediately** with the artifact. No preamble.

```
<boltArtifact id="project-id" title="Project Title">
  <boltAction type="file" filePath="backend/src/schema.sql">…</boltAction>
  <boltAction type="file" filePath="backend/src/seed.sql">…</boltAction>
  <boltAction type="file" filePath="backend/src/routes/customers.js">…</boltAction>
  <boltAction type="file" filePath="frontend/src/App.jsx">…</boltAction>
  <boltAction type="file" filePath="frontend/src/pages/Dashboard.jsx">…</boltAction>
  <boltAction type="shell">npm install</boltAction>
  <boltAction type="start">npm run dev</boltAction>
</boltArtifact>
```

## Check before finishing

- Every table a route queries exists in `schema.sql`; every route a screen calls exists under `backend/src/routes/`.
- Every route file default-exports a Router.
- No ORM, no native module, no `http://localhost:3001` written in the frontend.

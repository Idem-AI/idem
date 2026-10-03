---
name: webcontainer-fullstack
description: Technical contract for the complete web application target - frontend/ (Vite + React + Tailwind) and backend/ (Express + PostgreSQL, embedded with PGlite in the preview) started together by one command, and the boltArtifact output format.
tier: core
priority: 90
targets: [web-app]
---

# Build target: a complete web application

The user is building a **complete web application**: an interface, a server with the business rules, and a database. Everything runs in a browser WebContainer for the preview (Node, no native binaries) and is deployed by iDeploy as three pieces: PostgreSQL, the `backend/` folder, the `frontend/` folder.

The project is **already initialised** in `/home/project`. Never run `npx create-vite`, `create-react-app`, `prisma init` or any scaffolding command. Modify and add files; `npm install` and `npm run dev` **at the root** install and start everything.

## The contract that makes « Run » start everything

- **One command starts the three pieces.** The root `package.json` installs both folders and runs both servers with `concurrently`. The database starts inside the backend.
- **The database is PostgreSQL.** In the preview there is no database server: the backend uses **PGlite** (PostgreSQL compiled to WebAssembly, in the same process). Online, `DATABASE_URL` is set and the same code uses `pg`. Write **standard PostgreSQL SQL** that works in both.
- **No ORM, no native module.** Prisma, TypeORM, Sequelize, `better-sqlite3`, `bcrypt`, `sharp`… need native binaries that do not run in the preview. Use plain SQL through `query()`, `bcryptjs` for passwords, `jsonwebtoken` for tokens.
- **Ports are fixed**: backend **3001**, frontend **5173**. The frontend never hard-codes the backend address: it calls `/api/...`, which Vite relays to 3001 in the preview; online, `VITE_API_URL` points at the deployed backend.

## Files — copy these exactly, then add the product

1. **`package.json`** (root):
   ```json
   {
     "name": "project",
     "private": true,
     "version": "0.0.0",
     "scripts": {
       "postinstall": "cd backend && npm install && cd ../frontend && npm install",
       "dev": "concurrently -k -n api,web -c blue,green \"cd backend && npm run dev\" \"cd frontend && npm run dev\"",
       "build": "cd frontend && npm run build"
     },
     "devDependencies": {
       "concurrently": "^9.0.0"
     }
   }
   ```

2. **`backend/package.json`** — add any pure-JavaScript package you use (`bcryptjs`, `jsonwebtoken`, `zod`…):
   ```json
   {
     "name": "backend",
     "private": true,
     "version": "0.0.0",
     "type": "module",
     "scripts": {
       "dev": "node --watch src/index.js",
       "start": "node src/index.js"
     },
     "dependencies": {
       "@electric-sql/pglite": "^0.2.0",
       "cors": "^2.8.5",
       "express": "^4.19.0",
       "pg": "^8.12.0"
     }
   }
   ```

3. **`backend/src/db.js`** — the only file that knows which engine runs:
   ```js
   import { readFileSync } from 'node:fs';

   let run;
   let exec;

   if (process.env.DATABASE_URL) {
     const { default: pg } = await import('pg');
     const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
     run = async (text, params = []) => (await pool.query(text, params)).rows;
     exec = (sql) => pool.query(sql);
   } else {
     const { PGlite } = await import('@electric-sql/pglite');
     const db = new PGlite('./.pglite');
     run = async (text, params = []) => (await db.query(text, params)).rows;
     exec = (sql) => db.exec(sql);
   }

   /** Creates the tables and the starting data; does nothing if they exist. */
   export async function initDatabase() {
     await exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
     await exec(readFileSync(new URL('./seed.sql', import.meta.url), 'utf8'));
   }

   export const query = run;
   ```

4. **`backend/src/schema.sql`** — every table with `CREATE TABLE IF NOT EXISTS`, `SERIAL` or `TEXT` ids, foreign keys, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`. It runs on every start, so it must be safe to run twice.

5. **`backend/src/seed.sql`** — a dozen realistic rows per main table (African names, cities, currencies), with **explicit ids** and `ON CONFLICT (id) DO NOTHING`, then reset each sequence:
   ```sql
   INSERT INTO customers (id, name, city) VALUES
     (1, 'Amara Diallo', 'Dakar'),
     (2, 'Kwame Asante', 'Accra')
   ON CONFLICT (id) DO NOTHING;
   SELECT setval('customers_id_seq', (SELECT MAX(id) FROM customers));
   ```

6. **`backend/src/index.js`** — Express, JSON, CORS, one router per entity under `/api`, `GET /api/health` that answers without touching the database, a JSON error handler, and the database initialised **before** listening:
   ```js
   import express from 'express';
   import cors from 'cors';
   import { initDatabase, query } from './db.js';

   const app = express();
   app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
   app.use(express.json());

   app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

   app.get('/api/customers', async (_req, res, next) => {
     try {
       res.json(await query('SELECT id, name, city FROM customers ORDER BY id'));
     } catch (error) {
       next(error);
     }
   });

   app.use((error, _req, res, _next) => {
     console.error(error);
     res.status(500).json({ error: 'Internal server error' });
   });

   const port = Number(process.env.PORT) || 3001;
   await initDatabase();
   app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
   ```
   Always parameterised queries (`$1`, `$2`), never string concatenation. Authentication when the product needs accounts: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `bcryptjs` + `jsonwebtoken` with `JWT_SECRET` (default `'dev-secret'` in the preview).

7. **`frontend/package.json`** — Vite + React 18 + Tailwind v3 (add `react-router-dom` and what you use):
   ```json
   {
     "name": "frontend",
     "private": true,
     "version": "0.0.0",
     "type": "module",
     "scripts": { "dev": "vite", "build": "vite build", "preview": "vite preview" },
     "dependencies": { "react": "^18.2.0", "react-dom": "^18.2.0" },
     "devDependencies": {
       "@vitejs/plugin-react": "^4.2.0",
       "autoprefixer": "^10.4.0",
       "postcss": "^8.4.0",
       "tailwindcss": "^3.4.0",
       "vite": "^5.0.0"
     }
   }
   ```

8. **`frontend/vite.config.js`**:
   ```js
   import { defineConfig } from 'vite';
   import react from '@vitejs/plugin-react';

   export default defineConfig({
     plugins: [react()],
     server: {
       port: 5173,
       proxy: { '/api': 'http://localhost:3001' },
     },
   });
   ```

9. **`frontend/src/api.js`** — every call to the backend goes through it:
   ```js
   const BASE = import.meta.env.VITE_API_URL ?? '';

   export async function api(path, options = {}) {
     const response = await fetch(`${BASE}/api${path}`, {
       headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
       ...options,
     });
     const data = await response.json().catch(() => null);
     if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
     return data;
   }
   ```

10. **`frontend/index.html`** with `<div id="root"></div>` **and** `<script type="module" src="/src/main.jsx"></script>`; **`frontend/tailwind.config.js`** (`content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}']` plus the design system's `theme.extend`, verbatim); **`frontend/postcss.config.js`**; **`frontend/src/styles/index.css`**; **`frontend/src/main.jsx`**; **`frontend/src/App.jsx`**; components under `frontend/src/components/`, screens under `frontend/src/pages/`.

11. **`README.md`** (root) — what the application does, the two folders, and the variables: backend `DATABASE_URL`, `PORT`, `JWT_SECRET`, `CORS_ORIGIN`; frontend `VITE_API_URL`.

Every screen handles loading, empty and error states from `api()`; no screen shows hard-coded data that the API could serve.

## Output format

Start the response **immediately** with the artifact. No preamble.

```
<boltArtifact id="project-id" title="Project Title">
  <boltAction type="file" filePath="package.json">…</boltAction>
  <boltAction type="file" filePath="backend/package.json">…</boltAction>
  <boltAction type="file" filePath="backend/src/db.js">…</boltAction>
  <boltAction type="file" filePath="backend/src/schema.sql">…</boltAction>
  <boltAction type="file" filePath="backend/src/seed.sql">…</boltAction>
  <boltAction type="file" filePath="backend/src/index.js">…</boltAction>
  <boltAction type="file" filePath="backend/src/routes/…">…</boltAction>
  <boltAction type="file" filePath="frontend/package.json">…</boltAction>
  <boltAction type="file" filePath="frontend/vite.config.js">…</boltAction>
  <boltAction type="file" filePath="frontend/tailwind.config.js">…</boltAction>
  <boltAction type="file" filePath="frontend/postcss.config.js">…</boltAction>
  <boltAction type="file" filePath="frontend/index.html">…</boltAction>
  <boltAction type="file" filePath="frontend/src/styles/index.css">…</boltAction>
  <boltAction type="file" filePath="frontend/src/api.js">…</boltAction>
  <boltAction type="file" filePath="frontend/src/main.jsx">…</boltAction>
  <boltAction type="file" filePath="frontend/src/App.jsx">…</boltAction>
  <boltAction type="file" filePath="frontend/src/…">…</boltAction>
  <boltAction type="file" filePath="README.md">…</boltAction>
  <boltAction type="shell">npm install</boltAction>
  <boltAction type="start">npm run dev</boltAction>
</boltArtifact>
```

## Check before finishing

- The root `package.json` has `postinstall` and `dev` exactly as above; nothing is placed at the root but `package.json` and `README.md`.
- Every table used by a route exists in `schema.sql`; every route the frontend calls exists in the backend.
- No Prisma, no ORM, no native module, no hard-coded `http://localhost:3001` in the frontend.
- `frontend/index.html` has its module script tag.

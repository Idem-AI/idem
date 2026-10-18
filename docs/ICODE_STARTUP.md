# How an iCode workspace starts

Why opening a project used to take minutes, what was actually slow, and the mechanism that now makes it feel immediate.

## 1. What was slow — measured, not guessed

The scaffold is deterministic: for a given target, the server writes the same configuration files and the same npm manifests every time, and the model only writes the product on top. So nothing about *generation* explained the wait. The wait was almost entirely dependency installation.

Measured on the `site` target, with a native `npm install` on a developer machine and a warm network:

| | |
| --- | --- |
| Packages | 191 |
| Files | 8 466 |
| Unpacked | 100 MB |
| `npm install` | **2 min 50 s** |
| Same tree, gzipped | **17 MB** |

Inside a WebContainer — npm running in a browser tab, on the user's own connection — this is slower, not faster. `web-app` is worse still: three trees (`/`, `backend/`, `frontend/`), PGlite included.

Three smaller costs sat on top of it:

- **the terminal wait.** Every command went through the xterm terminal, and the pre-install polled for its existence every 500 ms for up to twenty seconds — twenty seconds with a ready container and nothing happening. A command that arrived before the terminal mounted was dropped entirely (`aucun terminal, commande ignorée`), and the preview then stayed empty with no explanation;
- **the dev server started last.** `npm run dev` was appended at the *end* of generation, so the first paint of the user's own application came after the model's last word, plus Vite's cold start;
- **the container booted late.** `WebContainer.boot()` ran on the first file write, after two network round trips (project, then scaffold), instead of during them.

## 2. The mechanism

```
first paint ──► boot container          ─┐
            ──► GET deps plan            │ in parallel with loading the project
            ──► GET snapshot (17 MB)    ─┘

scaffold mounted ──► deps in place ──► npm run dev ──► PREVIEW
                     cache: ~2 s
                     snapshot: ~10 s
                     npm: ~3 min (fallback)
                                    ║
generation ═════════════════════════╬═══════════════════════►
                     every file the model writes arrives by HMR
```

The user sees a branded skeleton of their application about eight seconds in, and watches it fill screen by screen. Total time barely changes; *perceived* time changes completely.

### Dependencies come from a snapshot, not from npm

`node_modules` is fetched as a binary snapshot and mounted with `container.mount()`. Three sources are tried in order, and the order is the whole design:

| Source | Cost | When |
| --- | --- | --- |
| IndexedDB (`depsStore.ts`) | ~2 s, no network | every opening but the first |
| Server snapshot (`/api/scaffold/deps/…`) | one request, 17–40 MB, immutably cached | first opening |
| `npm install` | ~3 min | nothing else worked |

The address of a snapshot contains its fingerprint, so `Cache-Control: immutable` is literally true and a browser that already has the tree asks for nothing.

### Fingerprints, so a stale tree is never mounted

A tree's fingerprint is a hash of its `dependencies` and `devDependencies` blocks, read **out of the manifests the scaffold itself writes** (`scaffold/deps.ts`). Bump a version anywhere in the scaffold and the fingerprint changes with it: the old snapshot stops being requested, and nothing has to be incremented by hand.

### Nothing is trusted without verification

A mounted `node_modules` that isn't exactly what the manifest expects produces the worst failure in the set — Vite starts, then dies on a missing module, and the user sees an empty preview with no explanation. So after mounting, `deps.ts` checks:

1. `node_modules/.idem-deps.json` carries the expected fingerprint (we write it; npm never does);
2. the binary the start command needs is present (`.bin/vite`, or `concurrently` for a full-stack root);
3. **every direct dependency of the manifest has its folder** — this is what catches a truncated tree, which the marker alone would not see.

Any failure wipes the tree, forgets it from the browser cache, and falls back to `npm install`. A snapshot that is missing, truncated or cut for another scaffold slows a generation down; it never breaks one.

### Commands no longer need a terminal

`services/webcontainer/runner.ts` spawns on the container directly, feeds `runStatus`, and mirrors output into terminal 0 **if it exists** — output produced before a terminal appears is held and replayed, so the full log is there when you open it. Identical commands already in flight are not run twice: two concurrent `npm install` calls leave a half-linked tree (`EIO: failed to link packages`), and that is a failure we have already paid for.

### The preview starts during generation

`warmStart()` puts the dependencies in place and starts the dev server while the model writes. The scaffold's placeholder page is no longer `Espace de travail prêt.` on a white page — it is a skeleton of the layout that is coming, in the project's own colours (`scaffold/awaiting.ts`). The first file the model writes replaces it by hot reload.

Two token vocabularies, because the targets do not speak the same Tailwind: the application scaffold has its forged tokens (`bg-surface`, `text-ink`, `px-block`), while the site template **replaces** Tailwind's palette with its design system (`bg-background`, `text-muted-foreground`). `bg-neutral-200` does not exist there, so a skeleton bar written with it would be invisible — a waiting page with nothing on it, which is exactly the failure being avoided.

## 3. Baking the snapshots

Snapshots are produced **by a WebContainer**, never by the server's npm. `npm install` picks optional dependencies by platform — esbuild and rollup ship a binary per system/architecture pair — and only the npm running inside a WebContainer picks what a WebContainer can execute. A tree installed on the server would pass every structural check and fall over when Vite starts.

So the oven is a page of the workshop: **`<icode-url>/?deps-bake=1`**.

Per tree it lays the target's scaffold down in `/bake/<target>`, runs `npm install`, **verifies** (`npm run build` where the directory has one, otherwise the presence of every direct dependency and the start binary), exports `node_modules` as a binary snapshot, gzips it, and `PUT`s it to the server.

| | |
| --- | --- |
| Where snapshots live | `APPGEN_DEPS_CACHE_DIR` (a volume — see below) |
| Who may deposit | anyone holding `APPGEN_DEPS_BAKE_TOKEN` |
| What is already baked | `GET /api/scaffold/deps` |
| Plan for one target | `GET /api/scaffold/deps/:target` |

**Run the oven whenever a package version changes in the scaffold.** The fingerprint changes with it, the old snapshot stops being served, and workspaces fall back to `npm install` — three minutes per opening — until the oven has been run again. The page says so at the top: what needs redoing is in amber.

> `APPGEN_DEPS_CACHE_DIR` must be a volume in production. Without one, the snapshots go away with the next deployment and every workspace is back to three minutes.

## 4. Where things are

| What | Where |
| --- | --- |
| Dependency plan and fingerprints | `apps/appgen/apps/we-dev-next/src/scaffold/deps.ts` |
| Serving and depositing snapshots | `apps/appgen/apps/we-dev-next/src/routes/deps.ts` |
| Waiting screen in the generated project | `apps/appgen/apps/we-dev-next/src/scaffold/awaiting.ts` |
| Putting dependencies in place, verifying, falling back | `.../we-dev-client/src/components/WeIde/services/webcontainer/deps.ts` |
| Browser cache (IndexedDB) | `.../webcontainer/depsStore.ts` |
| Commands without a terminal | `.../webcontainer/runner.ts` |
| Warm start and prewarming | `.../we-dev-client/src/components/AiChat/utils/warmStart.ts` |
| What the user reads while waiting | `.../we-dev-client/src/stores/warmStartSlice.ts` |
| The oven | `.../we-dev-client/src/components/DepsBake/DepsBakePage.tsx` |

## 5. Checks

| Command | What it proves |
| --- | --- |
| `npm run deps:plan` | the trees and fingerprints of every target |
| `npm run check:deps` | a stale fingerprint is refused, a deposit without a token is refused, and a deposited snapshot comes back **identical** after compression, transport and decompression |

Both run in seconds, call no model, and cost nothing.

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

**Exec bits.** An exported-then-mounted tree keeps its `.bin` links but not the mode of their targets. For example, `vite/bin/vite.js` comes back as 644, and `npm run dev` dies at once on `jsh: spawn vite EACCES`. The preview then stays on "Starting" forever, and the error only shows in the terminal.

This affects every mounted tree: browser cache, server snapshot, or neighbour tree. Two fixes are in place:

- **After every mount,** `mountTree` runs `repairExecBits` (a small `node -e` script, under a second) to chmod 755 every `.bin` target.
- **When the dev server dies on `spawn … EACCES`,** `startCommand` repairs the bits and restarts once.

The script spells `require` in two pieces on purpose. The workspace's `@originjs/vite-plugin-commonjs` rewrites any `require` with a module name it finds, even inside a string, and the mangled script repaired nothing.

**Bounded installs.** An `npm install` is stopped after 15 minutes (`runCommand` `timeoutMs`). The preview then says it did not start, with the reason. `resetDeps()` also forgets setups started in a replaced container: one that never finished used to block every later start of that target.

### Commands no longer need a terminal

`services/webcontainer/runner.ts` spawns on the container directly, feeds `runStatus`, and mirrors output into terminal 0 **if it exists** — output produced before a terminal appears is held and replayed, so the full log is there when you open it. Identical commands already in flight are not run twice: two concurrent `npm install` calls leave a half-linked tree (`EIO: failed to link packages`), and that is a failure we have already paid for.

### The preview starts during generation

`warmStart()` puts the dependencies in place and starts the dev server while the model writes. The scaffold's placeholder page is no longer `Espace de travail prêt.` on a white page — it is a skeleton of the layout that is coming, in the project's own colours (`scaffold/awaiting.ts`). The first file the model writes replaces it by hot reload.

Two token vocabularies, because the targets do not speak the same Tailwind: the application scaffold has its forged tokens (`bg-surface`, `text-ink`, `px-block`), while the site template **replaces** Tailwind's palette with its design system (`bg-background`, `text-muted-foreground`). `bg-neutral-200` does not exist there, so a skeleton bar written with it would be invisible — a waiting page with nothing on it, which is exactly the failure being avoided.

## 2b. The 20-second budget (October 2026)

Goal: **the preview is up in under 20 seconds after a generation, every time.** Measured, not hoped for. What used to break it, and what replaces it:

| What made it slow | Mechanism |
| --- | --- |
| The site engine added functional packages (`date-fns`, `react-hook-form`, `zod`, `embla-carousel-react`) to `package.json`. The snapshot did not have them, so verification rejected the whole tree: **full `npm install`, ~3 min** | They are **always** in the site manifest (`renderPackageJson`), hence in the baked tree. The engine never asks for an install beyond the base |
| `npm install` / `npm run dev` written at the end of a generation ran as is | **Fast command path** (`webcontainer/fastCommands.ts`, in front of the command queue): `npm install` → `ensureDependencies` (cache, snapshot, neighbour); `npm install <pkgs>` → nothing if already present; `npm run dev` → nothing if a server runs, otherwise deps then start. Anything unrecognised goes to the terminal unchanged |
| A tree with one extra package was wiped and reinstalled | `treeState` distinguishes `missing-deps` from `bad`: the tree stays, **npm installs only the difference** (`--prefer-offline`) |
| A version bump made every opening fall back to npm until someone ran the oven | The plan offers the **nearest snapshot** of the same tree (`nearest`): mounted, then topped up by npm |
| After an npm fallback, the next opening paid it again | The installed tree is **exported to IndexedDB** (`rememberInstalled`), 15 s after start |
| Redesign / `/site` wiped the workspace and waited for the server's scaffold, then installed | The site scaffold is **mounted and started at click time**, during the site read and generation; the server's scaffold then replaces it by HMR |
| The post-generation safety net waited 30 s | 4 s grace when nothing is installing or starting |
| Two `npm run dev` (warm start + safety net) could start two Vite servers | `startCommand` keeps one live server per command; `stopStarted()` stops it when the target changes |
| Vite re-optimised and reloaded the page each time a section imported a not-yet-seen package | `optimizeDeps.include` lists every importable package; `server.warmup` pre-transforms entries, pages and UI components |
| Nobody knew the real time | `utils/startupTimer.ts` measures from the first gesture to `server-ready`, with phases and deps source; the server logs `chat.startup` (warning above 20 s) |

### Keeping the snapshots baked automatically

`npm run deps:bake` (in `we-dev-next`) opens the oven page in headless Chrome, in automatic mode (`?deps-bake=1&auto=1#token=…`), bakes every tree whose fingerprint is not baked yet, and exits non-zero on failure. Run it after every deployment that touches the scaffold (CI can). At startup the server logs `DEPS_MISSING` with the list of trees to bake.

| Env | |
| --- | --- |
| `ICODE_URL` | the workshop address (default `http://localhost:5173`) |
| `APPGEN_DEPS_BAKE_TOKEN` | deposit token (required) |
| `DEPS_BAKE_TIMEOUT_MIN` | default 30 |

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

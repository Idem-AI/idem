/**
 * Le four : la page qui fabrique les `node_modules` préinstallés.
 *
 * ## Pourquoi une page, et pas un script de construction
 *
 * L'arbre servi aux ateliers doit être installé **par la WebContainer
 * elle-même**. Un `npm install` choisit ses dépendances optionnelles selon la
 * plateforme — esbuild et rollup embarquent un binaire par couple
 * système/architecture — et seul le npm qui tourne dans la WebContainer choisit
 * à coup sûr ce que la WebContainer saura exécuter. Un arbre installé par le
 * serveur, même sous Linux x64, passerait tous les contrôles de forme et
 * tomberait au démarrage de Vite, sur une erreur illisible.
 *
 * Donc : on installe là où ça tournera, on prouve que ça tourne, et on exporte.
 *
 * ## Ce que fait le four, par arbre
 *
 * 1. pose les fichiers du socle de la cible à la racine du conteneur (là où un atelier les pose) ;
 * 2. `npm install` dans le dossier de l'arbre ;
 * 3. **vérifie** — `npm run build` quand le dossier en a un, sinon la présence
 *    des dépendances directes et du binaire de démarrage. C'est la seule étape
 *    qui distingue un instantané d'un pari ;
 * 4. pré-regroupe les dépendances de Vite (`vite optimize`), gardées dans `node_modules/.vite` ;
 * 5. `export(node_modules, binary)`, compresse, et dépose par `PUT`.
 *
 * ## Quand s'en servir
 *
 * À chaque fois qu'une version de paquet change dans le socle : l'empreinte
 * change avec elle, l'ancien instantané n'est plus demandé, et les ateliers
 * retombent sur `npm install` — trois minutes par ouverture — jusqu'à ce que le
 * four soit repassé. La page le dit en haut : ce qui est à refaire est en rouge.
 *
 * Ouverture : `?deps-bake=1`. Le dépôt exige le jeton `APPGEN_DEPS_BAKE_TOKEN`
 * du serveur, saisi ici et gardé le temps de l'onglet.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DepsPlanInfo,
  DepsTargetName,
  DepsTreeInfo,
  fetchDepsPlan,
  fetchTreeManifest,
  putSnapshot,
} from '@/api/deps';
import { fetchScaffold, Scaffold } from '@/api/scaffold';
import { getContainerInstance } from '@/components/WeIde/services';

const TARGETS: DepsTargetName[] = ['site', 'web-app', 'mobile-app'];

const TOKEN_KEY = 'idem:deps-bake-token';

type Phase = 'idle' | 'running' | 'done' | 'failed';

interface TreeState {
  phase: Phase;
  step: string;
  detail?: string;
  bytes?: number;
  unpacked?: number;
}

const megabytes = (bytes?: number): string =>
  bytes ? `${(bytes / 1024 / 1024).toFixed(1)} Mo` : '—';

export default function DepsBakePage() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) ?? '');
  const [plans, setPlans] = useState<Partial<Record<DepsTargetName, DepsPlanInfo>>>({});
  const [states, setStates] = useState<Record<string, TreeState>>({});
  const [log, setLog] = useState<string[]>([]);
  const busy = useRef(false);

  const say = useCallback((line: string) => {
    console.log('[four]', line);
    setLog((previous) => [...previous.slice(-200), line]);
  }, []);

  useEffect(() => {
    void (async () => {
      const loaded: Partial<Record<DepsTargetName, DepsPlanInfo>> = {};
      for (const target of TARGETS) {
        const plan = await fetchDepsPlan(target);
        if (plan) loaded[target] = plan;
      }
      setPlans(loaded);
    })();
  }, []);

  const pending = useMemo(
    () =>
      TARGETS.flatMap((target) =>
        (plans[target]?.trees ?? [])
          .filter((tree) => !tree.baked)
          .map((tree) => ({ target, tree }))
      ),
    [plans]
  );

  const setState = useCallback((key: string, next: Partial<TreeState>) => {
    setStates((previous) => ({
      ...previous,
      [key]: { phase: 'idle', step: '', ...previous[key], ...next },
    }));
  }, []);

  /**
   * Pose les fichiers du socle d'une cible à la RACINE du conteneur, vidée d'abord : exactement où un atelier les
   * pose (`/home/project`). Vite signe son cache de dépendances pré-regroupées avec la racine du projet ; cuit
   * ailleurs (`/bake/<cible>`, avant), ce cache n'aurait servi à aucun atelier.
   */
  const layDown = useCallback(
    async (target: DepsTargetName): Promise<Scaffold | null> => {
      const container = await getContainerInstance();
      if (!container) return null;

      const scaffold = await fetchScaffold(undefined, { product: productOf(target), platform: platformOf(target) });

      for (const name of await container.fs.readdir('.')) {
        await container.fs.rm(name, { recursive: true, force: true });
      }
      for (const [path, content] of Object.entries(scaffold.files)) {
        const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
        if (parent) await container.fs.mkdir(parent, { recursive: true });
        await container.fs.writeFile(path, content);
      }

      say(`${target} : ${Object.keys(scaffold.files).length} fichiers du socle posés à la racine`);
      return scaffold;
    },
    [say]
  );

  const bakeTree = useCallback(
    async (target: DepsTargetName, tree: DepsTreeInfo, scaffold: Scaffold): Promise<boolean> => {
      const key = `${target}/${tree.id}`;
      const container = await getContainerInstance();
      if (!container) {
        setState(key, { phase: 'failed', step: 'conteneur indisponible' });
        return false;
      }

      const cwd = tree.dir || '.';
      const at = (path: string) => (tree.dir ? `${tree.dir}/${path}` : path);

      // Le manifeste du serveur plutôt que celui du socle : c'est lui qui
      // porte l'empreinte sous laquelle l'instantané sera demandé.
      const manifest = await fetchTreeManifest(target, tree);
      if (manifest) {
        // On garde le `name` et les scripts du socle (la vérification s'appuie
        // sur `npm run build`), et on ne reprend du manifeste du serveur que
        // ses dépendances — qui sont, par construction, les mêmes.
        const local = JSON.parse(
          scaffold.files[tree.dir ? `${tree.dir}/package.json` : 'package.json'] ?? '{}'
        );
        const served = JSON.parse(manifest);
        const same =
          JSON.stringify(sorted(local.dependencies)) === JSON.stringify(sorted(served.dependencies)) &&
          JSON.stringify(sorted(local.devDependencies)) === JSON.stringify(sorted(served.devDependencies));
        if (!same) {
          setState(key, {
            phase: 'failed',
            step: 'socle et empreinte en désaccord',
            detail: 'le serveur a redémarré avec un autre socle pendant la cuisson',
          });
          return false;
        }
      }

      setState(key, { phase: 'running', step: 'npm install' });
      say(`${key} : npm install dans ${tree.dir ? `/${tree.dir}` : 'la racine'}`);
      const install = await shell(`cd ${cwd} && npm install --no-audit --no-fund`, say);
      if (install !== 0) {
        setState(key, { phase: 'failed', step: `npm install (code ${install})` });
        return false;
      }

      // --- La vérification. Sans elle, on servirait un pari. ---
      setState(key, { phase: 'running', step: 'vérification' });
      const scripts = JSON.parse(
        scaffold.files[tree.dir ? `${tree.dir}/package.json` : 'package.json'] ?? '{}'
      ).scripts as Record<string, string> | undefined;

      if (scripts?.build) {
        say(`${key} : npm run build`);
        const build = await shell(`cd ${cwd} && npm run build`, say);
        if (build !== 0) {
          setState(key, { phase: 'failed', step: `npm run build (code ${build})` });
          return false;
        }
      } else {
        // Pas de build à lancer (la racine d'une application complète, le
        // serveur) : on exige au moins que chaque dépendance directe soit là.
        const names = [
          ...Object.keys(JSON.parse(scaffold.files[tree.dir ? `${tree.dir}/package.json` : 'package.json']).dependencies ?? {}),
          ...Object.keys(JSON.parse(scaffold.files[tree.dir ? `${tree.dir}/package.json` : 'package.json']).devDependencies ?? {}),
        ];
        for (const name of names) {
          try {
            await container.fs.readdir(at(`node_modules/${name}`));
          } catch {
            setState(key, { phase: 'failed', step: `${name} absent de l'arbre` });
            return false;
          }
        }
        say(`${key} : ${names.length} dépendances directes présentes`);
      }

      // --- Le pré-regroupement de Vite, gardé dans l'arbre. ---
      // Sans lui, chaque atelier refait au premier affichage le regroupement des dépendances (esbuild en
      // WebAssembly : la plus longue attente avant la page). Fait ici une fois, à la même racine et sans
      // `package-lock.json` — comme dans un atelier monté depuis un instantané —, il est valable partout.
      let prebundled = false;
      try {
        await container.fs.readFile(at('node_modules/vite/bin/vite.js'), 'utf-8');
        setState(key, { phase: 'running', step: 'pré-regroupement Vite' });
        say(`${key} : vite optimize`);
        const optimize = await shell(
          `cd ${cwd} && rm -f package-lock.json && rm -rf node_modules/.vite && node node_modules/vite/bin/vite.js optimize`,
          say
        );
        if (optimize === 0) {
          await container.fs.readFile(at('node_modules/.vite/deps/_metadata.json'), 'utf-8');
          prebundled = true;
          say(`${key} : dépendances pré-regroupées`);
        } else {
          say(`${key} : pré-regroupement impossible (code ${optimize}), arbre exporté sans`);
          await container.fs.rm(at('node_modules/.vite'), { recursive: true, force: true });
        }
      } catch {
        // Pas de Vite dans cet arbre (serveur, racine d'une application complète), ou pas de métadonnées.
      }

      // --- L'export. ---
      setState(key, { phase: 'running', step: 'export' });
      const snapshot = (await container.export(at('node_modules'), {
        format: 'binary',
      })) as Uint8Array;
      say(`${key} : arbre exporté, ${megabytes(snapshot.byteLength)}`);

      setState(key, { phase: 'running', step: 'compression', unpacked: snapshot.byteLength });
      const gzipped = await gzip(snapshot);
      say(`${key} : compressé à ${megabytes(gzipped.byteLength)}`);

      setState(key, { phase: 'running', step: 'dépôt', bytes: gzipped.byteLength, unpacked: snapshot.byteLength });
      const result = await putSnapshot(target, tree, gzipped, {
        token,
        unpackedBytes: snapshot.byteLength,
        verified: `${scripts?.build ? 'npm run build' : 'dépendances directes'}${prebundled ? ' + vite optimize' : ''}`,
      });

      if (!result.stored) {
        setState(key, { phase: 'failed', step: `dépôt refusé : ${result.error}` });
        return false;
      }

      setState(key, {
        phase: 'done',
        step: 'déposé',
        bytes: gzipped.byteLength,
        unpacked: snapshot.byteLength,
      });
      say(`${key} : déposé.`);
      return true;
    },
    [say, setState, token]
  );

  const bakeTarget = useCallback(
    async (target: DepsTargetName) => {
      if (busy.current) return;
      busy.current = true;
      try {
        const plan = plans[target];
        if (!plan) return;

        const scaffold = await layDown(target);
        if (!scaffold) return;

        for (const tree of plan.trees) {
          await bakeTree(target, tree, scaffold);
        }

        const refreshed = await fetchDepsPlan(target);
        if (refreshed) setPlans((previous) => ({ ...previous, [target]: refreshed }));
      } finally {
        busy.current = false;
      }
    },
    [bakeTree, layDown, plans]
  );

  /**
   * Le four sans personne devant : `?deps-bake=1&auto=1#token=…` (lancé par `npm run deps:bake` dans un Chrome
   * sans écran). Toutes les cibles qui ont un arbre à refaire sont cuites, l'une après l'autre, puis le résultat
   * est posé sur `window.__idemBake`, que le script lit. Le jeton voyage dans l'ancre : jamais envoyé au serveur
   * dans une adresse, jamais journalisé.
   */
  const auto = useRef(false);
  useEffect(() => {
    if (auto.current || new URLSearchParams(window.location.search).get('auto') !== '1') return;
    const fromHash = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (fromHash && fromHash !== token) {
      setToken(fromHash);
      sessionStorage.setItem(TOKEN_KEY, fromHash);
      return;
    }
    if (!token || TARGETS.some((target) => !plans[target])) return;
    auto.current = true;
    void (async () => {
      const results: { target: string; tree: string; ok: boolean }[] = [];
      for (const target of TARGETS) {
        const plan = plans[target]!;
        const stale = plan.trees.filter((tree) => !tree.baked);
        if (!stale.length) continue;
        const scaffold = await layDown(target);
        if (!scaffold) {
          stale.forEach((tree) => results.push({ target, tree: tree.id, ok: false }));
          continue;
        }
        for (const tree of stale) {
          // Une exception (réseau, conteneur) compte comme un échec : sans cela le résultat n'était jamais posé, et
          // le script attendait trente minutes.
          const ok = await bakeTree(target, tree, scaffold).catch((error) => {
            say(`${target}/${tree.id} : échec (${error instanceof Error ? error.message : String(error)})`);
            return false;
          });
          results.push({ target, tree: tree.id, ok });
        }
      }
      say(`four automatique : ${results.filter((r) => r.ok).length}/${results.length} arbre(s) cuits`);
      (window as unknown as { __idemBake?: unknown }).__idemBake = { done: true, ok: results.every((r) => r.ok), results };
    })();
  }, [bakeTree, layDown, plans, say, token]);

  return (
    <div className="min-h-screen bg-white px-8 py-10 text-neutral-900">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold">Four à dépendances</h1>
          <p className="text-sm text-neutral-600">
            Installe les <code>node_modules</code> du socle dans la WebContainer, vérifie qu&apos;un
            projet s&apos;y construit vraiment, puis les dépose sur le serveur. Les ateliers les
            montent ensuite au lieu de lancer <code>npm install</code>.
          </p>
        </header>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Jeton de dépôt</span>
          <input
            type="password"
            value={token}
            onChange={(event) => {
              setToken(event.target.value);
              sessionStorage.setItem(TOKEN_KEY, event.target.value);
            }}
            placeholder="APPGEN_DEPS_BAKE_TOKEN"
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>

        {pending.length === 0 ? (
          <p className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Tous les arbres du socle actuel sont préinstallés. Les ateliers s&apos;ouvrent sans npm.
          </p>
        ) : (
          <p className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {pending.length} arbre(s) à cuire. Tant qu&apos;ils manquent, les ateliers concernés
            relancent <code>npm install</code> à chaque ouverture.
          </p>
        )}

        {TARGETS.map((target) => {
          const plan = plans[target];
          return (
            <section key={target} className="space-y-3 rounded border border-neutral-200 p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">{target}</h2>
                <button
                  type="button"
                  onClick={() => void bakeTarget(target)}
                  disabled={!plan || !token}
                  className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
                >
                  Cuire
                </button>
              </div>

              <ul className="space-y-1 text-sm">
                {(plan?.trees ?? []).map((tree) => {
                  const state = states[`${target}/${tree.id}`];
                  return (
                    <li key={tree.id} className="flex flex-wrap items-baseline gap-x-3">
                      <span className="font-mono text-xs">{tree.id}</span>
                      <span className="font-mono text-xs text-neutral-400">{tree.fingerprint}</span>
                      <span className={tree.baked ? 'text-emerald-700' : 'text-amber-700'}>
                        {tree.baked ? `servi · ${megabytes(tree.bytes)}` : 'à cuire'}
                      </span>
                      {state && (
                        <span
                          className={
                            state.phase === 'failed'
                              ? 'text-red-700'
                              : state.phase === 'done'
                                ? 'text-emerald-700'
                                : 'text-neutral-600'
                          }
                        >
                          {state.step}
                          {state.unpacked ? ` · ${megabytes(state.unpacked)} déployé` : ''}
                          {state.bytes ? ` · ${megabytes(state.bytes)} servi` : ''}
                          {state.detail ? ` — ${state.detail}` : ''}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        <section className="space-y-2">
          <h2 className="text-sm font-medium">Journal</h2>
          <pre className="max-h-80 overflow-auto rounded bg-neutral-900 p-3 text-xs leading-relaxed text-neutral-100">
            {log.join('\n') || '—'}
          </pre>
        </section>
      </div>
    </div>
  );
}

const sorted = (record?: Record<string, string>) =>
  Object.fromEntries(Object.entries(record ?? {}).sort(([a], [b]) => a.localeCompare(b)));

const productOf = (target: DepsTargetName) => (target === 'site' ? 'site' : 'app');
const platformOf = (target: DepsTargetName) => (target === 'mobile-app' ? 'mobile' : 'web');

/** Lance une commande et renvoie son code de sortie, en recopiant la sortie. */
async function shell(command: string, say: (line: string) => void): Promise<number> {
  const container = await getContainerInstance();
  if (!container) return -1;

  const process = await container.spawn('jsh', ['-c', command], { env: { npm_config_yes: true } });
  let tail = '';

  await process.output.pipeTo(
    new WritableStream({
      write: (data) => {
        tail += data;
        const lines = tail.split('\n');
        tail = lines.pop() ?? '';
        for (const line of lines) {
          const clean = line.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '').trimEnd();
          if (clean) say(clean);
        }
      },
    })
  );

  return process.exit;
}

/** Compresse l'instantané pour le transport et le stockage. */
async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as unknown as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream('gzip'));

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    size += value.length;
  }

  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * La vérification d'exécution : un composant n'est accepté que s'il s'affiche.
 *
 * esbuild ne contrôle que la syntaxe : `site.primaryAction.href` sur une action
 * absente, un <Button asChild> à deux enfants, un <TabsContent> hors de <Tabs>
 * ou un objet affiché comme texte se compilent très bien… et plantent dans le
 * navigateur, où la frontière d'erreur montre « Section en erreur ».
 *
 * Ici, le composant est monté pour de vrai, avant d'être accepté : le code est
 * réuni avec les fichiers du site (template, design system, `@/site/data`,
 * `@/site/media`, marque) et les mêmes versions de React, Motion et Radix
 * (`site-runtime/`), puis exécuté dans un DOM (jsdom, dans un fil à part) sous
 * une frontière d'erreur, effets compris. Un plantage devient une consigne
 * précise — message, ligne du fichier, cause probable — pour l'essai suivant.
 *
 * Sans `site-runtime/node_modules` (installation oubliée), la vérification est
 * sautée avec un avertissement au démarrage : la génération ne s'arrête pas.
 */

import { existsSync, readFileSync } from 'node:fs';
import { SourceMap } from 'node:module';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { build, Plugin } from 'esbuild';
import { ChatLogger } from '../utils/logger.js';
import { FUNCTIONAL_DEPENDENCIES, SITE_DEPENDENCIES, templateFiles } from './template.js';

/** `we-dev-next/site-runtime/` — à la même profondeur depuis `src/` et `dist/`. */
const RUNTIME_DIR = process.env.SITE_RUNTIME_DIR?.trim() || fileURLToPath(new URL('../../site-runtime/', import.meta.url));
const WORKER_FILE = posix.join(RUNTIME_DIR.split('\\').join('/'), 'render-worker.mjs');

/** Au-delà, le rendu est considéré comme bloqué (boucle infinie). */
const RENDER_TIMEOUT_MS = 12_000;
/** Fils de rendu en parallèle : les auteurs écrivent quatre composants à la fois. */
const POOL_SIZE = 3;

const BUNDLE_FILE = 'idem-check.js';
const NAMESPACE = 'idem-site';
const TARGET = '@idem-check/target';

/* -------------------------------------------------------------------------- */
/*  Disponibilité                                                              */
/* -------------------------------------------------------------------------- */

let availability: boolean | null = null;

/** Les dépendances d'exécution sont-elles installées ? Dit une fois, au premier usage. */
export function renderCheckAvailable(): boolean {
  if (availability !== null) return availability;
  if ((process.env.SITE_RENDER_CHECK ?? 'on').toLowerCase() === 'off') return (availability = false);
  const installed = ['react', 'react-dom', 'motion', 'jsdom'].every((name) => existsSync(posix.join(RUNTIME_DIR, 'node_modules', name, 'package.json')));
  if (!installed || !existsSync(WORKER_FILE)) {
    ChatLogger.warn('SITE_RENDER', 'Vérification d’exécution désactivée : site-runtime non installé (npm ci --prefix site-runtime)', { dir: RUNTIME_DIR });
    return (availability = false);
  }
  // Les versions doivent suivre le template : sinon on vérifierait autre chose que ce qui tourne.
  try {
    const declared = JSON.parse(readFileSync(posix.join(RUNTIME_DIR, 'package.json'), 'utf8')).dependencies ?? {};
    const expected = { ...SITE_DEPENDENCIES, ...FUNCTIONAL_DEPENDENCIES };
    const drift = Object.entries(expected).filter(([name, version]) => declared[name] !== version);
    if (drift.length) ChatLogger.warn('SITE_RENDER', 'site-runtime ne suit plus les versions du template', { drift: drift.map(([name, version]) => `${name}@${version} (site-runtime : ${declared[name] ?? 'absent'})`) });
  } catch {
    /* lecture impossible : la vérification reste possible */
  }
  return (availability = true);
}

/* -------------------------------------------------------------------------- */
/*  Paquet                                                                     */
/* -------------------------------------------------------------------------- */

const EXTENSIONS = ['', '.tsx', '.ts', '.jsx', '.js', '.json', '/index.tsx', '/index.ts', '/index.js'];

const LOADERS: Record<string, 'tsx' | 'ts' | 'jsx' | 'js' | 'json' | 'css'> = {
  tsx: 'tsx',
  ts: 'ts',
  jsx: 'jsx',
  js: 'js',
  mjs: 'js',
  json: 'json',
  css: 'css',
};

/** Le harnais : monte le composant sous une frontière d'erreur, attend ses effets, rend ce qui s'affiche. */
const HARNESS = `
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MotionConfig } from 'motion/react';
import * as Target from '${TARGET}';

let caught = null;

class Boundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error, info) {
    if (!caught) caught = { message: String(error && error.message ? error.message : error), stack: String((error && error.stack) || ''), componentStack: String((info && info.componentStack) || '') };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export async function run(props) {
  const Component = Target.default;
  if (typeof Component !== 'function' && !(Component && typeof Component === 'object' && Component.$$typeof)) {
    return { error: { message: "le fichier n'a pas d'export par défaut utilisable (export default function …)", stack: '', componentStack: '', phase: 'load' } };
  }
  const container = document.getElementById('root');
  const root = createRoot(container);
  await act(async () => {
    root.render(React.createElement(Boundary, null, React.createElement(MotionConfig, { reducedMotion: 'never' }, React.createElement(Component, props))));
  });
  // Les effets programmés au montage (minuteurs, apparitions) ont le temps de s'exécuter.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
  const elements = container.querySelectorAll('*').length;
  const text = (container.textContent || '').trim().length;
  const media = container.querySelectorAll('img,video,svg,[role="img"],[role="presentation"]').length;
  await act(async () => root.unmount());
  return caught ? { error: { ...caught, phase: 'boundary' } } : { elements, text, media };
}
`;

/** Résout `@/…` et les chemins relatifs dans les fichiers du site, le reste dans site-runtime. */
function siteFilesPlugin(files: Record<string, string>, target: string): Plugin {
  const find = (path: string): string | null => {
    for (const extension of EXTENSIONS) {
      const candidate = posix.normalize(`${path}${extension}`);
      if (typeof files[candidate] === 'string') return candidate;
    }
    return null;
  };
  return {
    name: 'idem-site-files',
    setup(builder) {
      builder.onResolve({ filter: /^@idem-check\/target$/ }, () => ({ path: `/${target}`, namespace: NAMESPACE }));
      builder.onResolve({ filter: /^@\// }, (args) => {
        const found = find(`src/${args.path.slice(2)}`);
        return found ? { path: `/${found}`, namespace: NAMESPACE } : { errors: [{ text: `« ${args.path} » n'existe pas dans le projet` }] };
      });
      builder.onResolve({ filter: /^\.\.?\//, namespace: NAMESPACE }, (args) => {
        const found = find(posix.join(posix.dirname(args.importer.slice(1)), args.path));
        return found ? { path: `/${found}`, namespace: NAMESPACE } : { errors: [{ text: `« ${args.path} » n'existe pas dans le projet` }] };
      });
      builder.onLoad({ filter: /.*/, namespace: NAMESPACE }, (args) => {
        const path = args.path.slice(1);
        const extension = path.split('.').pop() ?? 'tsx';
        const loader = LOADERS[extension] ?? 'tsx';
        // Une feuille de style ne change rien à l'exécution.
        if (loader === 'css') return { contents: '', loader: 'js' };
        return { contents: files[path], loader, resolveDir: RUNTIME_DIR };
      });
    },
  };
}

interface Bundle {
  code: string;
  map: string;
}

async function bundle(files: Record<string, string>, target: string): Promise<Bundle | { error: string }> {
  try {
    const result = await build({
      stdin: { contents: HARNESS, loader: 'jsx', resolveDir: RUNTIME_DIR, sourcefile: 'harness.jsx' },
      bundle: true,
      write: false,
      outfile: BUNDLE_FILE,
      format: 'iife',
      globalName: '__idemCheck',
      platform: 'browser',
      target: 'es2020',
      jsx: 'automatic',
      sourcemap: 'external',
      sourcesContent: false,
      logLevel: 'silent',
      nodePaths: [posix.join(RUNTIME_DIR, 'node_modules')],
      define: {
        'process.env.NODE_ENV': '"development"',
        'import.meta.env': '{"DEV":true,"PROD":false,"SSR":false,"MODE":"development","BASE_URL":"/"}',
      },
      plugins: [siteFilesPlugin(files, target)],
    });
    const code = result.outputFiles.find((file) => file.path.endsWith('.js'))?.text ?? '';
    const map = result.outputFiles.find((file) => file.path.endsWith('.map'))?.text ?? '';
    return { code, map };
  } catch (error) {
    const first = (error as { errors?: Array<{ text: string }> }).errors?.[0]?.text;
    return { error: first ?? (error as Error).message };
  }
}

/* -------------------------------------------------------------------------- */
/*  Fils de rendu                                                              */
/* -------------------------------------------------------------------------- */

interface RenderError {
  message: string;
  stack: string;
  componentStack: string;
  phase: string;
}

interface RenderResult {
  error?: RenderError;
  elements?: number;
  text?: number;
  media?: number;
}

interface Job {
  id: number;
  code: string;
  props: Record<string, unknown>;
  resolve: (result: RenderResult) => void;
}

class RenderPool {
  private idle: Worker[] = [];
  private busy = 0;
  private queue: Job[] = [];
  private nextId = 1;

  render(code: string, props: Record<string, unknown>): Promise<RenderResult> {
    return new Promise((resolve) => {
      this.queue.push({ id: this.nextId++, code, props, resolve });
      this.pump();
    });
  }

  private spawn(): Worker {
    const worker = new Worker(WORKER_FILE);
    worker.unref();
    return worker;
  }

  private pump(): void {
    while (this.queue.length && this.busy < POOL_SIZE) {
      const job = this.queue.shift()!;
      const worker = this.idle.pop() ?? this.spawn();
      this.busy += 1;
      this.execute(worker, job);
    }
  }

  private execute(worker: Worker, job: Job): void {
    let settled = false;
    const finish = (result: RenderResult, healthy: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.off('message', onMessage);
      worker.off('error', onError);
      worker.off('exit', onExit);
      this.busy -= 1;
      if (healthy) {
        // Au repos, le fil ne retient pas le processus.
        worker.unref();
        this.idle.push(worker);
      }
      else void worker.terminate();
      job.resolve(result);
      this.pump();
    };
    const onMessage = (message: RenderResult & { id: number }) => {
      if (message.id === job.id) finish(message, true);
    };
    const onError = (error: Error) => finish({ error: { message: error.message, stack: error.stack ?? '', componentStack: '', phase: 'worker' } }, false);
    const onExit = () => finish({ error: { message: 'le fil de rendu s’est arrêté', stack: '', componentStack: '', phase: 'worker' } }, false);
    const timer = setTimeout(
      () =>
        finish(
          {
            error: {
              message: `le rendu ne se termine pas en ${RENDER_TIMEOUT_MS / 1000} s (boucle infinie, setState à chaque rendu, ou minuteur qui se relance sans fin)`,
              stack: '',
              componentStack: '',
              phase: 'timeout',
            },
          },
          false
        ),
      RENDER_TIMEOUT_MS
    );
    worker.ref();
    worker.on('message', onMessage);
    worker.once('error', onError);
    worker.once('exit', onExit);
    worker.postMessage({ id: job.id, code: job.code, props: job.props });
  }
}

let pool: RenderPool | null = null;

/* -------------------------------------------------------------------------- */
/*  Lecture de l'erreur                                                        */
/* -------------------------------------------------------------------------- */

/** La ligne du fichier vérifié où l'erreur s'est produite, d'après la pile et la carte du paquet. */
function locate(error: RenderError, map: string, target: string, code: string): { line: number; text: string } | null {
  let sourceMap: SourceMap;
  try {
    sourceMap = new SourceMap(JSON.parse(map));
  } catch {
    return null;
  }
  const lines = code.split('\n');
  const frames = `${error.stack}\n${error.componentStack}`;
  for (const match of Array.from(frames.matchAll(new RegExp(`${BUNDLE_FILE.replace('.', '\\.')}:(\\d+):(\\d+)`, 'g')))) {
    const entry = sourceMap.findEntry(Number(match[1]) - 1, Number(match[2]) - 1) as { originalSource?: string; originalLine?: number };
    if (!entry?.originalSource || typeof entry.originalLine !== 'number') continue;
    if (!entry.originalSource.endsWith(target)) continue;
    const text = (lines[entry.originalLine] ?? '').trim();
    return { line: entry.originalLine + 1, text };
  }
  return null;
}

/** Le composant le plus profond de la pile de React (« at TabsContent (…) »). */
function innermostComponent(componentStack: string): string | null {
  const first = componentStack.match(/at\s+([A-Z][\w$.]*)/);
  return first?.[1] ?? null;
}

/** La cause probable, dite en clair au modèle, pour les plantages courants. */
function hintFor(message: string, component: string | null): string {
  const lower = message.toLowerCase();
  if (lower.includes('react.children.only') || lower.includes('single react element child') || lower.includes('slot failed to slot')) {
    return 'Un composant en `asChild` (Button, SheetTrigger, DialogTrigger, SheetClose…) doit avoir UN SEUL enfant élément : mets le texte et l’icône À L’INTÉRIEUR du <a> ou du <Button>, jamais à côté.';
  }
  if (/must be used within|must be rendered within|must be wrapped in|is not a descendant/.test(lower)) {
    return `${component ? `<${component}>` : 'Ce composant'} est utilisé hors de son parent : place-le dans son conteneur (TabsContent/TabsTrigger dans <Tabs>, AccordionItem dans <Accordion>, SheetContent dans <Sheet>, DialogTitle dans <DialogContent>, TooltipContent dans <Tooltip> lui-même dans <TooltipProvider>…).`;
  }
  if (lower.includes('objects are not valid as a react child')) {
    return 'Un objet est affiché comme du texte : affiche un de ses champs (par exemple `item.label`, `channel.value`, `offer.name`), pas l’objet entier.';
  }
  if (lower.includes('element type is invalid')) {
    return 'Un composant rendu vaut `undefined` : vérifie que chaque balise <Nom /> correspond à un import existant (nom exact, import nommé et non par défaut), et qu’une icône stockée dans une variable est bien un composant importé et non une chaîne.';
  }
  if (/cannot read propert(y|ies) of (null|undefined)|is not a function|is not iterable|undefined is not an object|null is not an object/.test(lower)) {
    return 'Une donnée lue n’existe pas pour ce site : `site.primaryAction` peut être `null`, une liste de `site` peut être vide, `media[…]` peut être absent, un champ peut manquer. N’utilise que les champs décrits, protège l’accès (`?.`, `?? []`) et n’affiche pas un bloc dont la donnée manque — sans inventer de remplacement.';
  }
  if (lower.includes('maximum update depth') || lower.includes('too many re-renders')) {
    return 'Le composant se redessine sans fin : ne fais pas de setState pendant le rendu, et donne un tableau de dépendances à chaque useEffect qui modifie l’état.';
  }
  if (lower.includes('rendered more hooks') || lower.includes('rendered fewer hooks') || lower.includes('invalid hook call')) {
    return 'Les hooks (useState, useEffect…) s’appellent au début du composant, jamais dans une condition, une boucle, un .map ou un rappel.';
  }
  if (lower.includes('select.item') && lower.includes('empty string')) {
    return 'Chaque <SelectItem> doit avoir une `value` non vide.';
  }
  if (lower.includes('is not defined')) {
    return 'Un nom est utilisé sans être importé ni déclaré : ajoute son import (depuis les modules permis) ou sa déclaration.';
  }
  return 'Corrige la cause de ce plantage sans retirer le contenu de la section.';
}

/* -------------------------------------------------------------------------- */
/*  Vérification                                                               */
/* -------------------------------------------------------------------------- */

export interface RenderCheckInput {
  /** Le chemin du composant dans le projet (`src/sections/home/Hero.tsx`). */
  path: string;
  code: string;
  /** Les fichiers du site propres au projet (design system, `src/site/*`), par-dessus le template. */
  files: Record<string, string>;
  /** Les props passées par la page (`{ current: '/' }` pour l'en-tête). */
  props?: Record<string, unknown>;
}

export interface RenderCheckResult {
  /** Les plantages, en consignes pour le modèle (vide si le composant s'affiche). */
  problems: string[];
  /** Le composant se monte sans erreur mais n'affiche rien avec les données du site. */
  empty: boolean;
  /** La vérification n'a pas pu avoir lieu (dépendances absentes, fil en panne). */
  skipped: boolean;
}

const PASS: RenderCheckResult = { problems: [], empty: false, skipped: false };

/** Monte le composant avec les données réelles du site ; rend ce qui empêcherait son affichage. */
export async function renderCheck(input: RenderCheckInput): Promise<RenderCheckResult> {
  if (!renderCheckAvailable()) return { ...PASS, skipped: true };
  const started = Date.now();
  const files = { ...templateFiles(), ...input.files, [input.path]: input.code };
  const packed = await bundle(files, input.path);
  if ('error' in packed) {
    return { problems: [`le fichier ne s'assemble pas avec le projet : ${packed.error}`], empty: false, skipped: false };
  }

  pool ??= new RenderPool();
  const result = await pool.render(packed.code, input.props ?? {});
  const ms = Date.now() - started;

  if (result.error) {
    const where = locate(result.error, packed.map, input.path, input.code);
    // Attrapée par la frontière, l'erreur est celle du composant. Ailleurs (chargement,
    // harnais, fil), elle ne l'est que si la pile passe par son fichier : sinon c'est
    // l'outil de vérification qui a cédé, et le composant n'en est pas responsable.
    const own = result.error.phase === 'boundary' || result.error.phase === 'timeout' || result.error.phase === 'effect' || !!where;
    if (!own) {
      ChatLogger.warn('SITE_RENDER', `${input.path} : vérification d’exécution impossible`, { message: result.error.message.slice(0, 300), phase: result.error.phase, ms });
      return { ...PASS, skipped: true };
    }
    const component = innermostComponent(result.error.componentStack);
    const message = result.error.message.split('\n')[0].slice(0, 300);
    ChatLogger.info('SITE_RENDER', `${input.path} : plante à l’exécution`, { message, line: where?.line, inside: component, phase: result.error.phase, ms });
    return {
      problems: [
        `à l'exécution dans le navigateur, le composant plante : « ${message} »${where ? ` — ligne ${where.line} : « ${where.text.slice(0, 120)} »` : component ? ` — dans <${component}>` : ''}. ${hintFor(message, component)}`,
      ],
      empty: false,
      skipped: false,
    };
  }

  const empty = !result.elements || (!result.text && !result.media);
  ChatLogger.info('SITE_RENDER', `${input.path} : affiché`, { elements: result.elements, text: result.text, media: result.media, ms });
  return { problems: [], empty, skipped: false };
}

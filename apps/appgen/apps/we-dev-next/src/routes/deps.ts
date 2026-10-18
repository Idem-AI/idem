/**
 * Les `node_modules` du socle, servis tout prêts.
 *
 * L'atelier ne lance plus `npm install` à l'ouverture d'un projet : il demande
 * ici l'instantané binaire de l'arbre `node_modules` correspondant à sa cible,
 * le monte dans la WebContainer (`container.mount`), et le projet démarre. Trois
 * minutes d'installation deviennent un téléchargement de quelques secondes,
 * mis en cache immuablement par le navigateur et par tout CDN posé devant.
 *
 * ## Pourquoi un instantané fabriqué dans un navigateur
 *
 * L'arbre servi ici est produit par une WebContainer, pas par le `npm` du
 * serveur. C'est délibéré : un `npm install` résout les dépendances optionnelles
 * selon la plateforme (esbuild et rollup embarquent un binaire par couple
 * système/architecture), et seul un `npm` qui tourne *dans* la WebContainer
 * choisit à coup sûr ce que la WebContainer saura exécuter. Un arbre installé
 * sur le serveur passerait les contrôles de forme et tomberait au démarrage de
 * Vite, sur une erreur illisible.
 *
 * Le four est donc une page de l'atelier (`/?deps-bake=1`), ouverte une fois par
 * version de socle — à la main, ou par un navigateur sans écran dans la chaîne
 * de livraison. Elle installe, vérifie que Vite démarre vraiment, exporte
 * l'arbre et le dépose ici par `PUT`.
 *
 * ## Ce que le serveur garantit
 *
 * Rien de plus que « voici les octets déposés sous cette empreinte ». La
 * confiance se gagne côté atelier, qui vérifie l'arbre monté avant de s'en
 * servir et retombe sur `npm install` au moindre doute. Un instantané absent,
 * tronqué ou périmé ne casse donc jamais une génération : il la ralentit.
 */

import { Router, Request, Response } from 'express';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash, timingSafeEqual } from 'node:crypto';
import { BuildTarget } from '../config/buildTarget.js';
import { buildScaffold } from '../scaffold/index.js';
import { BAKED_TARGETS, DepsPlan, depsPlanFromFiles, treeFingerprint, treeManifest } from '../scaffold/deps.js';
import { ChatLogger } from '../utils/logger.js';

const router = Router();

/**
 * Où vivent les instantanés. Un volume monté en production : ils survivent
 * ainsi à un redéploiement, et un seul four sert toutes les instances.
 */
const CACHE_DIR = resolve(process.env.APPGEN_DEPS_CACHE_DIR ?? 'deps-cache');

/** Le dépôt d'un instantané est réservé au four. Sans jeton, pas de dépôt. */
const BAKE_TOKEN = process.env.APPGEN_DEPS_BAKE_TOKEN ?? '';

/** Un arbre `node_modules` complet pèse de 20 à 60 Mo compressé. */
const MAX_SNAPSHOT_BYTES = 256 * 1024 * 1024;

/** Express 5 type un paramètre d'adresse `string | string[]` : on le ramène à un mot. */
const param = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? '') : (value ?? '');

const isTarget = (value: string): value is BuildTarget =>
  (BAKED_TARGETS as string[]).includes(value);

/**
 * Le plan d'une cible, calculé une fois puis gardé.
 *
 * C'est du calcul pur et déterministe (le socle sans projet), mais il recopie
 * tout un template : inutile de le refaire à chaque requête, et la route du
 * plan est appelée à l'ouverture de chaque atelier.
 */
const plans = new Map<BuildTarget, DepsPlan>();

const planFor = (target: BuildTarget): DepsPlan => {
  const known = plans.get(target);
  if (known) return known;
  const plan = depsPlanFromFiles(target, buildScaffold({ target }).files);
  plans.set(target, plan);
  return plan;
};

const snapshotPath = (target: string, fingerprint: string, id: string) =>
  join(CACHE_DIR, target, fingerprint, `${id}.bin.gz`);

const metaPath = (target: string, fingerprint: string, id: string) =>
  join(CACHE_DIR, target, fingerprint, `${id}.json`);

interface SnapshotMeta {
  /** Empreinte de l'arbre seul : l'atelier la réécrit dans `node_modules`. */
  tree: string;
  /** Taille des octets servis, pour que l'atelier annonce une progression juste. */
  bytes: number;
  /** Taille de l'arbre déployé, à titre indicatif. */
  unpackedBytes?: number;
  /** Ce que le four a vérifié avant de déposer. */
  verified?: string;
  bakedAt: string;
}

/**
 * Le plan de dépendances d'une cible, et ce qui en est préinstallé.
 *
 * L'atelier appelle cette route à l'ouverture, avant même d'avoir chargé le
 * projet : le plan ne dépend que de la cible. Un arbre sans instantané est
 * annoncé `baked: false`, et l'atelier l'installe comme avant — sans attendre.
 */
router.get('/:target', (req: Request, res: Response) => {
  const target = param(req.params.target);
  if (!isTarget(target)) return res.status(404).json({ error: 'Unknown target.' });

  const plan = planFor(target);

  const trees = plan.trees.map((tree) => {
    const fingerprint = treeFingerprint(tree);
    const file = snapshotPath(target, fingerprint, tree.id);
    const baked = existsSync(file);

    let meta: SnapshotMeta | undefined;
    if (baked) {
      try {
        meta = JSON.parse(readFileSync(metaPath(target, fingerprint, tree.id), 'utf8')) as SnapshotMeta;
      } catch {
        meta = undefined;
      }
    }

    return {
      id: tree.id,
      dir: tree.dir,
      mountPoint: tree.mountPoint,
      fingerprint,
      baked,
      bytes: baked ? (meta?.bytes ?? statSync(file).size) : 0,
      url: baked ? `/api/scaffold/deps/${target}/${fingerprint}/${tree.id}` : null,
      /** L'atelier l'écrit dans `node_modules/.idem-deps.json` après le montage. */
      marker: fingerprint,
    };
  });

  res.setHeader('Cache-Control', 'public, max-age=60');
  return res.json({ target, fingerprint: plan.fingerprint, trees });
});

/**
 * Le manifeste à installer pour fabriquer un arbre. Le four le lit, l'écrit
 * dans la WebContainer et lance `npm install` par-dessus : il n'a donc aucune
 * liste de dépendances à lui, et ne peut pas se désynchroniser du socle.
 */
router.get('/:target/:fingerprint/:id/manifest', (req: Request, res: Response) => {
  const target = param(req.params.target);
  const fingerprint = param(req.params.fingerprint);
  const id = param(req.params.id);
  if (!isTarget(target)) return res.status(404).json({ error: 'Unknown target.' });

  const tree = planFor(target).trees.find((candidate) => candidate.id === id);
  if (!tree) return res.status(404).json({ error: 'Unknown tree.' });
  if (treeFingerprint(tree) !== fingerprint) {
    return res.status(409).json({ error: 'Stale fingerprint.', expected: treeFingerprint(tree) });
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.send(treeManifest(target, tree));
});

/**
 * Les octets de l'instantané.
 *
 * L'empreinte est dans l'adresse, donc le contenu d'une adresse ne change
 * jamais : `immutable` est exact, et un navigateur qui a déjà l'arbre ne
 * redemande rien. C'est ce qui rend la deuxième ouverture gratuite.
 *
 * Le fichier est stocké déjà compressé (gzip) et servi tel quel avec
 * `Content-Encoding` : le navigateur le décompresse, et le serveur ne recompresse
 * pas 100 Mo à chaque requête.
 */
router.get('/:target/:fingerprint/:id', (req: Request, res: Response) => {
  const target = param(req.params.target);
  const fingerprint = param(req.params.fingerprint);
  const id = param(req.params.id);
  if (!isTarget(target)) return res.status(404).json({ error: 'Unknown target.' });
  if (!/^[a-f0-9]{8,64}$/.test(fingerprint) || !/^[a-z0-9-]{1,40}$/.test(id)) {
    return res.status(400).json({ error: 'Bad snapshot reference.' });
  }

  const file = snapshotPath(target, fingerprint, id);
  if (!existsSync(file)) return res.status(404).json({ error: 'Not baked yet.' });

  const { size } = statSync(file);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Encoding', 'gzip');
  res.setHeader('Content-Length', String(size));
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('X-Idem-Deps-Fingerprint', fingerprint);
  // Sans cela, Express pose `Content-Length` sur les octets décompressés attendus.
  res.removeHeader('Transfer-Encoding');

  return createReadStream(file).pipe(res);
});

/**
 * Dépôt d'un instantané par le four.
 *
 * Le corps est le flux gzip exporté par la WebContainer, posté brut. On vérifie
 * que l'empreinte annoncée correspond bien à un arbre du socle d'aujourd'hui :
 * un instantané déposé sous une empreinte inventée ne serait jamais demandé,
 * mais autant ne pas le stocker.
 */
router.put('/:target/:fingerprint/:id', async (req: Request, res: Response) => {
  const target = param(req.params.target);
  const fingerprint = param(req.params.fingerprint);
  const id = param(req.params.id);

  if (!BAKE_TOKEN) return res.status(403).json({ error: 'Baking is disabled on this server.' });

  const offered = String(req.get('X-Idem-Bake-Token') ?? '');
  const expected = BAKE_TOKEN;
  const ok =
    offered.length === expected.length &&
    timingSafeEqual(Buffer.from(offered), Buffer.from(expected));
  if (!ok) return res.status(403).json({ error: 'Bad bake token.' });

  if (!isTarget(target)) return res.status(404).json({ error: 'Unknown target.' });

  const tree = planFor(target).trees.find((candidate) => candidate.id === id);
  if (!tree) return res.status(404).json({ error: 'Unknown tree.' });
  if (treeFingerprint(tree) !== fingerprint) {
    return res.status(409).json({ error: 'Stale fingerprint.', expected: treeFingerprint(tree) });
  }

  const chunks: Buffer[] = [];
  let bytes = 0;
  try {
    await new Promise<void>((done, fail) => {
      req.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > MAX_SNAPSHOT_BYTES) {
          fail(new Error('Snapshot too large.'));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => done());
      req.on('error', fail);
    });
  } catch (error) {
    return res.status(413).json({ error: error instanceof Error ? error.message : 'Upload failed.' });
  }

  if (!bytes) return res.status(400).json({ error: 'Empty snapshot.' });

  const dir = join(CACHE_DIR, target, fingerprint);
  mkdirSync(dir, { recursive: true });

  const payload = Buffer.concat(chunks);
  const digest = createHash('sha256').update(payload).digest('hex');

  // Écriture à côté puis renommage : un GET concurrent ne lit jamais un
  // fichier à moitié écrit, ce qui donnerait un `node_modules` tronqué.
  const temporary = join(dir, `${id}.bin.gz.part`);
  await writeFile(temporary, payload);
  await rename(temporary, snapshotPath(target, fingerprint, id));

  const meta: SnapshotMeta = {
    tree: fingerprint,
    bytes,
    unpackedBytes: Number(req.get('X-Idem-Unpacked-Bytes')) || undefined,
    verified: req.get('X-Idem-Verified') ?? undefined,
    bakedAt: new Date().toISOString(),
  };
  await writeFile(metaPath(target, fingerprint, id), `${JSON.stringify(meta, null, 2)}\n`);

  ChatLogger.setContext('DepsRoute');
  ChatLogger.info('DEPS_BAKED', 'Dependency snapshot stored', {
    target,
    tree: id,
    fingerprint,
    bytes,
    digest: digest.slice(0, 12),
    verified: meta.verified,
  });

  return res.json({ stored: true, bytes, digest });
});

/** Ce que le four a déjà déposé, pour toutes les cibles. */
router.get('/', (_req: Request, res: Response) => {
  const targets = BAKED_TARGETS.map((target) => {
    const plan = planFor(target);
    return {
      target,
      fingerprint: plan.fingerprint,
      trees: plan.trees.map((tree) => {
        const fingerprint = treeFingerprint(tree);
        return {
          id: tree.id,
          fingerprint,
          baked: existsSync(snapshotPath(target, fingerprint, tree.id)),
        };
      }),
    };
  });

  return res.json({ cacheDir: CACHE_DIR, bakingEnabled: Boolean(BAKE_TOKEN), targets });
});

export default router;

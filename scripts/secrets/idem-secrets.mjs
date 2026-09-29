#!/usr/bin/env node
/**
 * idem-secrets — gestion des secrets IDEM dans Google Secret Manager.
 *
 * Chaque backend déclare ses secrets dans son manifeste (seule liste qui fait
 * foi) :
 *   apps/api/api/config/secrets.manifest.ts
 *   apps/appgen/apps/we-dev-next/src/config/secrets.manifest.ts
 *   apps/ideploy-api/api/config/secrets.manifest.ts
 *
 * Nommage : <SECRET_ENV_PREFIX><app>--<VARIABLE>, avec les labels
 * `app=<app>` et `managed-by=idem-secrets`.
 *
 * Commandes :
 *   plan                                  État des lieux, aucune écriture.
 *   push <app> --from <fichier.env>       Crée/versionne les secrets du manifeste présents dans le fichier.
 *   rotate <app> VAR                      Nouvelle version lue sur l'entrée standard ; les versions
 *                                         précédentes sont désactivées (réactivables pour revenir).
 *   migrate-legacy <app>                  Copie les anciens noms sans index vers <app>--<VAR>.
 *   copy <app-source> <app-cible> VAR…    Duplique une valeur partagée entre applications.
 *   export-config <app> --to <fichier.env> VAR…
 *                                         Rapatrie une ancienne entrée NON secrète vers un .env
 *                                         (ajoutée seulement si absente).
 *   prune [--after-deploy] [--legacy]     Supprime les entrées qu'aucun manifeste ne déclare.
 *                                         Sans --after-deploy, garde celles que l'API déployée
 *                                         avant la migration lit encore.
 *                                         --legacy (avec --after-deploy) : supprime aussi les
 *                                         anciens noms de secrets déjà copiés vers <app>--*.
 *
 * Options : --project <id> (défaut GCP_PROJECT_ID, sinon config gcloud), --yes
 * (pas de question), --dry-run.
 *
 * Aucune valeur de secret n'est jamais affichée : les copies passent par la
 * mémoire du processus et l'entrée standard de gcloud.
 *
 * Prérequis : Node ≥ 22.18 (import des manifestes .ts), gcloud authentifié avec
 * le rôle secretmanager.admin sur le projet.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST_PATHS = {
  api: 'apps/api/api/config/secrets.manifest.ts',
  appgen: 'apps/appgen/apps/we-dev-next/src/config/secrets.manifest.ts',
  'ideploy-api': 'apps/ideploy-api/api/config/secrets.manifest.ts',
};
const MANAGED_LABEL = 'managed-by=idem-secrets';

/**
 * Anciennes entrées NON secrètes que la version de l'API déployée avant la
 * migration lit encore dans Secret Manager (ancienne liste de secrets.ts).
 * `prune` les conserve tant qu'on ne passe pas `--after-deploy` : les supprimer
 * avant que la nouvelle API tourne en production, avec ces valeurs dans son
 * `.env.production`, empêcherait l'ancienne de redémarrer.
 */
const READ_BY_PREVIOUS_API = [
  'ADMIN_EMAILS',
  'GITHUB_CLIENT_ID',
  'GOOGLE_CLOUD_LOCATION',
];
const ENV_PREFIX = process.env.SECRET_ENV_PREFIX || '';

// ── Arguments ────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--') && !a.includes('=')));
function option(name) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}
const positional = argv.filter((a, i) => !a.startsWith('--') && !['--from', '--to', '--project'].includes(argv[i - 1]));
const [command, ...args] = positional;
const DRY_RUN = flags.has('--dry-run');
const YES = flags.has('--yes');

// ── gcloud ───────────────────────────────────────────────────────────────────

function gcloud(gargs, input) {
  const result = spawnSync('gcloud', [...gargs, `--project=${PROJECT}`, '--quiet'], {
    input,
    encoding: 'utf8',
    env: { ...process.env, CLOUDSDK_CORE_DISABLE_PROMPTS: '1' },
    maxBuffer: 64 * 1024 * 1024,
  });
  return { ok: result.status === 0, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function resolveProject() {
  const explicit = option('project') || process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  if (explicit) return explicit;
  const r = spawnSync('gcloud', ['config', 'get-value', 'project'], { encoding: 'utf8' });
  return (r.stdout || '').trim();
}
const PROJECT = resolveProject();

function listOnline() {
  const r = gcloud(['secrets', 'list', '--format=json(name,labels)']);
  if (!r.ok) throw new Error(`gcloud secrets list a échoué : ${r.stderr.split('\n').filter(Boolean).pop()}`);
  return JSON.parse(r.stdout).map((s) => ({ id: s.name.split('/').pop(), labels: s.labels ?? {} }));
}

/** Lit la dernière version. La valeur reste en mémoire, jamais affichée. */
function accessLatest(secretId) {
  const r = gcloud(['secrets', 'versions', 'access', 'latest', `--secret=${secretId}`]);
  if (!r.ok) throw new Error(`lecture impossible de ${secretId}`);
  return r.stdout;
}

function ensureSecret(secretId, app, online) {
  if (online.has(secretId)) return false;
  if (DRY_RUN) return true;
  const r = gcloud([
    'secrets', 'create', secretId,
    '--replication-policy=automatic',
    `--labels=app=${app},${MANAGED_LABEL}`,
  ]);
  if (!r.ok) throw new Error(`création impossible de ${secretId} : ${r.stderr.trim().split('\n').pop()}`);
  online.add(secretId);
  return true;
}

function addVersion(secretId, value) {
  if (DRY_RUN) return;
  const r = gcloud(['secrets', 'versions', 'add', secretId, '--data-file=-'], value);
  if (!r.ok) throw new Error(`ajout de version impossible sur ${secretId}`);
}

// ── Manifestes ───────────────────────────────────────────────────────────────

async function loadManifests() {
  const manifests = {};
  for (const [app, rel] of Object.entries(MANIFEST_PATHS)) {
    const mod = await import(pathToFileURL(resolve(ROOT, rel)).href);
    const m = mod.SECRET_MANIFEST;
    if (m.app !== app) throw new Error(`${rel} déclare app=${m.app}, attendu ${app}`);
    manifests[app] = { ...m, all: [...m.required, ...m.optional] };
  }
  return manifests;
}

const secretId = (app, variable) => `${ENV_PREFIX}${app}--${variable}`;

// ── Fichiers .env ────────────────────────────────────────────────────────────

function parseEnvFile(file) {
  if (!existsSync(file)) throw new Error(`fichier introuvable : ${file}`);
  const values = {};
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[m[1]] = value;
  }
  return values;
}

const isPlaceholder = (v) =>
  !v || /^your[-_]/i.test(v) || /change[-_]?in[-_]?production/i.test(v) || /^\$\{.*\}$/.test(v) || /^x{4,}$/i.test(v);

async function confirm(question) {
  if (YES || DRY_RUN) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question} Tapez "oui" pour continuer : `);
  rl.close();
  return answer.trim().toLowerCase() === 'oui';
}

// ── Classement de l'existant ─────────────────────────────────────────────────

function classify(online, manifests) {
  const indexed = new Map(); // secretId -> app
  const legacySecretNames = new Set();
  for (const [app, m] of Object.entries(manifests)) {
    for (const v of m.all) indexed.set(secretId(app, v), app);
    if (m.legacyUnprefixedFallback) m.all.forEach((v) => legacySecretNames.add(v));
  }

  const result = { managed: [], legacySecret: [], unused: [] };
  for (const { id } of online) {
    if (indexed.has(id)) {
      result.managed.push(id);
      continue;
    }
    // Secret indexé d'un AUTRE environnement (`staging-api--X` vu depuis la
    // prod, ou l'inverse) : il n'appartient pas à ce périmètre, on n'y touche pas.
    const otherEnv = Object.entries(manifests).some(([app, m]) =>
      m.all.some((v) => id.endsWith(`${app}--${v}`))
    );
    if (otherEnv) continue;
    if (legacySecretNames.has(id)) result.legacySecret.push(id);
    else result.unused.push(id);
  }
  return { ...result, indexed };
}

// ── Commandes ────────────────────────────────────────────────────────────────

async function cmdPlan(manifests) {
  const online = listOnline();
  const ids = new Set(online.map((s) => s.id));
  const { managed, legacySecret, unused } = classify(online, manifests);

  console.log(`Projet : ${PROJECT}   Préfixe d'environnement : ${ENV_PREFIX || '(aucun)'}\n`);
  for (const [app, m] of Object.entries(manifests)) {
    console.log(`■ ${app}`);
    for (const v of m.all) {
      const id = secretId(app, v);
      const kind = m.required.includes(v) ? 'requis   ' : 'optionnel';
      const state = ids.has(id)
        ? '✓ présent'
        : m.legacyUnprefixedFallback && ids.has(v)
          ? '↺ ancien nom seulement (migrate-legacy)'
          : '✗ absent';
      console.log(`   ${kind}  ${id.padEnd(46)} ${state}`);
    }
    console.log('');
  }
  console.log(`Entrées gérées (indexées) : ${managed.length}`);
  console.log(`Anciens noms de secrets à migrer puis supprimer (prune --legacy) : ${legacySecret.length}`);
  if (legacySecret.length) console.log('   ' + legacySecret.join(', '));
  console.log(`Entrées déclarées par aucun manifeste (prune) : ${unused.length}`);
  if (unused.length) console.log('   ' + unused.join(', '));
}

async function cmdPush(manifests) {
  const app = args[0];
  const m = manifests[app];
  const from = option('from');
  if (!m || !from) throw new Error('usage : push <app> --from <fichier.env>');
  const values = parseEnvFile(resolve(process.cwd(), from));
  const online = new Set(listOnline().map((s) => s.id));

  const plan = m.all.filter((v) => !isPlaceholder(values[v]));
  const ignored = Object.keys(values).filter((k) => !m.all.includes(k));
  console.log(`${app} : ${plan.length} secret(s) à pousser depuis ${from} : ${plan.join(', ') || '—'}`);
  if (ignored.length) console.log(`   ignorés (pas des secrets de ${app}, restent dans le .env) : ${ignored.length}`);
  const missingRequired = m.required.filter((v) => !plan.includes(v));
  if (missingRequired.length) console.log(`   ⚠ requis absents du fichier : ${missingRequired.join(', ')}`);
  if (!plan.length || !(await confirm(`Pousser ${plan.length} secret(s) vers ${PROJECT} ?`))) return;

  for (const v of plan) {
    const id = secretId(app, v);
    const created = ensureSecret(id, app, online);
    addVersion(id, values[v]);
    console.log(`   ${created ? 'créé ' : 'maj  '} ${id}`);
  }
}

async function readStdin() {
  if (process.stdin.isTTY) console.error('Collez la nouvelle valeur puis Ctrl-D :');
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
}

async function cmdRotate(manifests) {
  const [app, variable] = args;
  const m = manifests[app];
  if (!m || !variable) throw new Error('usage : rotate <app> VAR   (valeur sur l\'entrée standard)');
  if (!m.all.includes(variable)) throw new Error(`${variable} n'est pas un secret déclaré de ${app}`);
  const id = secretId(app, variable);
  const value = await readStdin();
  if (!value) throw new Error('valeur vide, rotation annulée');

  const online = new Set(listOnline().map((s) => s.id));
  ensureSecret(id, app, online);
  const previous = gcloud(['secrets', 'versions', 'list', id, '--filter=state=ENABLED', '--format=value(name)']);
  addVersion(id, value);
  const old = previous.stdout.split('\n').map((l) => l.trim().split('/').pop()).filter(Boolean);
  for (const version of old) {
    if (!DRY_RUN) gcloud(['secrets', 'versions', 'disable', version, `--secret=${id}`]);
  }
  console.log(`${id} : nouvelle version active, ${old.length} ancienne(s) désactivée(s).`);
  console.log('Redémarrez l\'application concernée pour qu\'elle lise la nouvelle valeur.');
}

async function cmdMigrateLegacy(manifests) {
  const app = args[0];
  const m = manifests[app];
  if (!m) throw new Error('usage : migrate-legacy <app>');
  const online = new Set(listOnline().map((s) => s.id));
  const todo = m.all.filter((v) => online.has(v) && !online.has(secretId(app, v)));
  console.log(`${app} : ${todo.length} ancien(s) secret(s) à copier vers ${app}--* : ${todo.join(', ') || '—'}`);
  if (!todo.length || !(await confirm('Copier ces valeurs (côté serveur, sans affichage) ?'))) return;
  for (const v of todo) {
    const id = secretId(app, v);
    const value = DRY_RUN ? '' : accessLatest(v);
    ensureSecret(id, app, online);
    addVersion(id, value);
    console.log(`   copié ${v} → ${id}`);
  }
}

async function cmdCopy(manifests) {
  const [fromApp, toApp, ...vars] = args;
  if (!manifests[fromApp] || !manifests[toApp] || !vars.length) {
    throw new Error('usage : copy <app-source> <app-cible> VAR…');
  }
  const notDeclared = vars.filter((v) => !manifests[toApp].all.includes(v));
  if (notDeclared.length) throw new Error(`non déclarés dans le manifeste de ${toApp} : ${notDeclared.join(', ')}`);
  const online = new Set(listOnline().map((s) => s.id));
  if (!(await confirm(`Copier ${vars.join(', ')} de ${fromApp} vers ${toApp} ?`))) return;
  for (const v of vars) {
    const src = online.has(secretId(fromApp, v)) ? secretId(fromApp, v) : online.has(v) ? v : null;
    if (!src) {
      console.log(`   ✗ ${v} : aucune source (${secretId(fromApp, v)} ni ancien nom)`);
      continue;
    }
    const id = secretId(toApp, v);
    ensureSecret(id, toApp, online);
    addVersion(id, DRY_RUN ? '' : accessLatest(src));
    console.log(`   copié ${src} → ${id}`);
  }
}

async function cmdExportConfig(manifests) {
  const [app, ...vars] = args;
  const to = option('to');
  if (!manifests[app] || !to || !vars.length) throw new Error('usage : export-config <app> --to <fichier.env> VAR…');
  const secrets = vars.filter((v) => manifests[app].all.includes(v));
  if (secrets.length) throw new Error(`refusé : ${secrets.join(', ')} sont des secrets, ils restent dans Secret Manager`);
  const target = resolve(process.cwd(), to);
  const existing = existsSync(target) ? parseEnvFile(target) : {};
  const online = new Set(listOnline().map((s) => s.id));
  for (const v of vars) {
    if (existing[v] !== undefined && existing[v] !== '') {
      console.log(`   = ${v} déjà présent dans ${to}`);
      continue;
    }
    if (!online.has(v)) {
      console.log(`   ✗ ${v} absent du Secret Manager`);
      continue;
    }
    if (!DRY_RUN) appendFileSync(target, `\n${v}=${accessLatest(v).replace(/\r?\n/g, '\\n')}\n`);
    console.log(`   + ${v} ajouté à ${to}`);
  }
}

async function cmdPrune(manifests) {
  const online = listOnline();
  const { legacySecret, unused } = classify(online, manifests);
  const ids = new Set(online.map((s) => s.id));

  const afterDeploy = flags.has('--after-deploy');
  const heldBack = afterDeploy ? [] : unused.filter((id) => READ_BY_PREVIOUS_API.includes(id));
  let targets = unused.filter((id) => !heldBack.includes(id));
  if (heldBack.length) {
    console.log(
      `Conservés tant que la nouvelle API n'est pas déployée (--after-deploy) : ${heldBack.join(', ')}`
    );
  }
  if (flags.has('--legacy')) {
    if (!afterDeploy) {
      throw new Error('--legacy exige --after-deploy : l\'API déployée lit encore les anciens noms.');
    }
    // Un ancien nom n'est supprimé que si sa copie indexée existe pour CHAQUE
    // application qui le relit encore en repli.
    const migrated = legacySecret.filter((v) =>
      Object.entries(manifests)
        .filter(([, m]) => m.legacyUnprefixedFallback && m.all.includes(v))
        .every(([app]) => ids.has(secretId(app, v)))
    );
    const notMigrated = legacySecret.filter((v) => !migrated.includes(v));
    if (notMigrated.length) console.log(`Conservés (copie indexée absente) : ${notMigrated.join(', ')}`);
    targets = targets.concat(migrated);
  }

  if (!targets.length) {
    console.log('Rien à supprimer.');
    return;
  }
  console.log(`${targets.length} entrée(s) à SUPPRIMER définitivement de ${PROJECT} :`);
  for (const t of targets) console.log(`   - ${t}`);
  if (!(await confirm('La suppression est irréversible.'))) return;
  for (const t of targets) {
    if (DRY_RUN) continue;
    const r = gcloud(['secrets', 'delete', t]);
    console.log(`   ${r.ok ? 'supprimé' : 'ÉCHEC   '} ${t}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

const COMMANDS = {
  plan: cmdPlan,
  push: cmdPush,
  rotate: cmdRotate,
  'migrate-legacy': cmdMigrateLegacy,
  copy: cmdCopy,
  'export-config': cmdExportConfig,
  prune: cmdPrune,
};

try {
  if (!COMMANDS[command]) {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
    process.exit(command ? 1 : 0);
  }
  if (!PROJECT) throw new Error('projet GCP introuvable (--project, GCP_PROJECT_ID ou gcloud config)');
  const manifests = await loadManifests();
  if (DRY_RUN) console.log('(simulation : aucune écriture)\n');
  await COMMANDS[command](manifests);
} catch (error) {
  console.error(`Erreur : ${error.message}`);
  process.exit(1);
}

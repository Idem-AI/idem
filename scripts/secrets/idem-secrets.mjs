#!/usr/bin/env node
/**
 * idem-secrets — gestion des secrets IDEM dans Infisical (self-hosted).
 *
 * Chaque backend déclare ses secrets dans son manifeste (seule liste qui fait
 * foi) :
 *   apps/api/api/config/secrets.manifest.ts
 *   apps/appgen/apps/we-dev-next/src/config/secrets.manifest.ts
 *   apps/ideploy-api/api/config/secrets.manifest.ts
 *
 * Chaque application a son propre projet Infisical (isolation native, pas de
 * préfixe de nom nécessaire) et un seul environnement utilisé pour l'instant :
 * `prod`, celui qu'Infisical crée avec chaque projet (surchargeable avec --environment).
 *
 * Commandes :
 *   plan                                  État des lieux, aucune écriture.
 *   push <app> --from <fichier.env>       Crée/met à jour les secrets du manifeste présents dans le fichier.
 *   rotate <app> VAR                      Nouvelle valeur lue sur l'entrée standard (Infisical
 *                                         garde l'historique des versions automatiquement).
 *   copy <app-source> <app-cible> VAR…    Duplique une valeur partagée entre deux projets d'app.
 *   prune [<app>]                         Supprime les secrets qu'aucun manifeste ne déclare
 *                                         (tous les projets, ou un seul si <app> est donné).
 *
 * Options : --environment <slug> (défaut "prod"), --yes (pas de question), --dry-run.
 *
 * Aucune valeur de secret n'est jamais affichée : les copies passent par la
 * mémoire du processus uniquement.
 *
 * Prérequis : Node ≥ 22.18 (import des manifestes .ts).
 *
 * Config (variables d'environnement) :
 *   INFISICAL_SITE_URL              URL de l'instance self-hosted.
 *   INFISICAL_ADMIN_CLIENT_ID       Identité machine avec accès en écriture
 *   INFISICAL_ADMIN_CLIENT_SECRET   aux 3 projets ci-dessous (Universal Auth).
 *   INFISICAL_PROJECT_ID_API
 *   INFISICAL_PROJECT_ID_APPGEN
 *   INFISICAL_PROJECT_ID_IDEPLOY_API
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { InfisicalSDK } from '@infisical/sdk';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST_PATHS = {
  api: 'apps/api/api/config/secrets.manifest.ts',
  appgen: 'apps/appgen/apps/we-dev-next/src/config/secrets.manifest.ts',
  'ideploy-api': 'apps/ideploy-api/api/config/secrets.manifest.ts',
};
const PROJECT_ID_ENV = {
  api: 'INFISICAL_PROJECT_ID_API',
  appgen: 'INFISICAL_PROJECT_ID_APPGEN',
  'ideploy-api': 'INFISICAL_PROJECT_ID_IDEPLOY_API',
};

// ── Arguments ────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--') && !a.includes('=')));
function option(name) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}
const positional = argv.filter((a, i) => !a.startsWith('--') && !['--from', '--environment'].includes(argv[i - 1]));
const [command, ...args] = positional;
const DRY_RUN = flags.has('--dry-run');
const YES = flags.has('--yes');
const did = (verb) => (DRY_RUN ? `${verb} (simulation)` : verb);
const ENVIRONMENT = option('environment') || 'prod';

// ── Infisical ────────────────────────────────────────────────────────────────

function projectIdFor(app) {
  const envVar = PROJECT_ID_ENV[app];
  const id = envVar && process.env[envVar];
  if (!id) throw new Error(`${envVar} n'est pas défini (id du projet Infisical de ${app})`);
  return id;
}

let client;
async function infisical() {
  if (client) return client;
  const siteUrl = process.env.INFISICAL_SITE_URL;
  const clientId = process.env.INFISICAL_ADMIN_CLIENT_ID;
  const clientSecret = process.env.INFISICAL_ADMIN_CLIENT_SECRET;
  if (!siteUrl || !clientId || !clientSecret) {
    throw new Error('INFISICAL_SITE_URL, INFISICAL_ADMIN_CLIENT_ID et INFISICAL_ADMIN_CLIENT_SECRET sont requis.');
  }
  client = new InfisicalSDK({ siteUrl });
  await client.auth().universalAuth.login({ clientId, clientSecret });
  return client;
}

/** Secrets déclarés (noms uniquement, jamais les valeurs) pour un projet. */
async function listOnline(app) {
  const c = await infisical();
  const result = await c.secrets().listSecrets({
    projectId: projectIdFor(app),
    environment: ENVIRONMENT,
    secretPath: '/',
    viewSecretValue: false,
  });
  return new Set(result.secrets.map((s) => s.secretKey));
}

/** Lit une valeur. Reste en mémoire, jamais affichée. */
async function readValue(app, variable) {
  const c = await infisical();
  const secret = await c.secrets().getSecret({
    projectId: projectIdFor(app),
    environment: ENVIRONMENT,
    secretPath: '/',
    secretName: variable,
    viewSecretValue: true,
  });
  return secret?.secretValue;
}

async function writeValue(app, variable, value, online) {
  const c = await infisical();
  const opts = { environment: ENVIRONMENT, projectId: projectIdFor(app), secretPath: '/', secretValue: value, type: 'shared' };
  if (DRY_RUN) return online.has(variable);
  const existed = online.has(variable);
  if (existed) await c.secrets().updateSecret(variable, opts);
  else await c.secrets().createSecret(variable, opts);
  online.add(variable);
  return existed;
}

async function deleteValue(app, variable) {
  if (DRY_RUN) return;
  const c = await infisical();
  await c.secrets().deleteSecret(variable, { environment: ENVIRONMENT, projectId: projectIdFor(app), secretPath: '/', type: 'shared' });
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

// ── Commandes ────────────────────────────────────────────────────────────────

async function cmdPlan(manifests) {
  console.log(`Environnement Infisical : ${ENVIRONMENT}\n`);
  for (const [app, m] of Object.entries(manifests)) {
    const online = await listOnline(app);
    console.log(`■ ${app}  (projet ${projectIdFor(app)})`);
    for (const v of m.all) {
      const kind = m.required.includes(v) ? 'requis   ' : 'optionnel';
      console.log(`   ${kind}  ${v.padEnd(36)} ${online.has(v) ? '✓ présent' : '✗ absent'}`);
    }
    const unused = [...online].filter((v) => !m.all.includes(v));
    if (unused.length) console.log(`   déclarés par aucun manifeste (prune ${app}) : ${unused.join(', ')}`);
    console.log('');
  }
}

async function cmdPush(manifests) {
  const app = args[0];
  const m = manifests[app];
  const from = option('from');
  if (!m || !from) throw new Error('usage : push <app> --from <fichier.env>');
  const values = parseEnvFile(resolve(process.cwd(), from));
  const online = await listOnline(app);

  const plan = m.all.filter((v) => !isPlaceholder(values[v]));
  const ignored = Object.keys(values).filter((k) => !m.all.includes(k));
  console.log(`${app} : ${plan.length} secret(s) à pousser depuis ${from} : ${plan.join(', ') || '—'}`);
  if (ignored.length) console.log(`   ignorés (pas des secrets de ${app}, restent dans le .env) : ${ignored.length}`);
  const missingRequired = m.required.filter((v) => !plan.includes(v));
  if (missingRequired.length) console.log(`   ⚠ requis absents du fichier : ${missingRequired.join(', ')}`);
  if (!plan.length || !(await confirm(`Pousser ${plan.length} secret(s) vers le projet ${app} ?`))) return;

  for (const v of plan) {
    const existed = await writeValue(app, v, values[v], online);
    console.log(`   ${did(existed ? 'maj' : 'créé')} ${v}`);
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
  const value = await readStdin();
  if (!value) throw new Error('valeur vide, rotation annulée');

  const online = await listOnline(app);
  await writeValue(app, variable, value, online);
  console.log(`${variable} : ${did('nouvelle valeur active')} (Infisical conserve l'historique des versions).`);
  console.log('Redémarrez l\'application concernée pour qu\'elle lise la nouvelle valeur.');
}

async function cmdCopy(manifests) {
  const [fromApp, toApp, ...vars] = args;
  if (!manifests[fromApp] || !manifests[toApp] || !vars.length) {
    throw new Error('usage : copy <app-source> <app-cible> VAR…');
  }
  const notDeclared = vars.filter((v) => !manifests[toApp].all.includes(v));
  if (notDeclared.length) throw new Error(`non déclarés dans le manifeste de ${toApp} : ${notDeclared.join(', ')}`);
  if (!(await confirm(`Copier ${vars.join(', ')} de ${fromApp} vers ${toApp} ?`))) return;
  const online = await listOnline(toApp);
  for (const v of vars) {
    const value = DRY_RUN ? '' : await readValue(fromApp, v);
    if (!DRY_RUN && value === undefined) {
      console.log(`   ✗ ${v} : absent du projet ${fromApp}`);
      continue;
    }
    await writeValue(toApp, v, value, online);
    console.log(`   ${did('copié')} ${fromApp}.${v} → ${toApp}.${v}`);
  }
}

async function cmdPrune(manifests) {
  const targetApps = args[0] ? [args[0]] : Object.keys(manifests);
  for (const app of targetApps) {
    const m = manifests[app];
    if (!m) throw new Error(`app inconnue : ${app}`);
    const online = await listOnline(app);
    const unused = [...online].filter((v) => !m.all.includes(v));
    if (!unused.length) {
      console.log(`${app} : rien à supprimer.`);
      continue;
    }
    console.log(`${app} : ${unused.length} secret(s) à SUPPRIMER définitivement : ${unused.join(', ')}`);
    if (!(await confirm(`Supprimer ces secrets du projet ${app} ? Irréversible.`))) continue;
    for (const v of unused) {
      await deleteValue(app, v);
      console.log(`   ${did('supprimé')} ${v}`);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

const COMMANDS = {
  plan: cmdPlan,
  push: cmdPush,
  rotate: cmdRotate,
  copy: cmdCopy,
  prune: cmdPrune,
};

try {
  if (!COMMANDS[command]) {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
    process.exit(command ? 1 : 0);
  }
  const manifests = await loadManifests();
  if (DRY_RUN) console.log('(simulation : aucune écriture)\n');
  await COMMANDS[command](manifests);
} catch (error) {
  console.error(`Erreur : ${error.message}`);
  process.exit(1);
}

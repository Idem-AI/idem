#!/usr/bin/env node
/**
 * Lance un serveur MCP du projet qui a besoin d'un navigateur (Chrome DevTools, audit d'accessibilité).
 *
 * Il donne au serveur le navigateur DÉJÀ installé — `CHROME_PATH`, sinon Google Chrome, sinon le
 * « Chrome for Testing » que Puppeteer a installé pour le moteur graphique — au lieu de laisser chaque
 * serveur télécharger le sien. Versions épinglées (jamais `@latest`) : un serveur MCP exécute du code sur
 * le poste ; on choisit quand il change.
 *
 *   node scripts/mcp/run.mjs chrome-devtools
 *   node scripts/mcp/run.mjs a11y
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function browser() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const installed = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].find((p) => fs.existsSync(p));
  if (installed) return installed;
  try {
    const path = require('puppeteer').executablePath();
    return path && fs.existsSync(path) ? path : undefined;
  } catch {
    return undefined;
  }
}

const SERVERS = {
  // Chrome DevTools pour agents (Google) : naviguer, exécuter un script, photographier une page rendue.
  // `--slim` : trois outils seulement (moins de contexte chargé) ; aucune statistique d'usage envoyée à
  // Google, aucun appel CrUX, pas de vérification de mise à jour.
  'chrome-devtools': (exe) => ({
    args: ['-y', 'chrome-devtools-mcp@1.10.1', '--slim', '--headless', '--isolated', '--no-usage-statistics', '--no-performance-crux', ...(exe ? ['--executablePath', exe] : [])],
    env: { CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS: '1' },
  }),
  // Audit WCAG (axe-core) d'une page servie en local : contraste, ARIA, structure.
  // 1.0.6 et non 1.1.0 : la 1.1.0 réclame `ws@^8.21.3`, absent du registre npm (dernière publiée : 8.21.2).
  a11y: (exe) => ({
    args: ['-y', 'a11y-mcp@1.0.6'],
    env: exe ? { PUPPETEER_EXECUTABLE_PATH: exe, PUPPETEER_SKIP_DOWNLOAD: 'true' } : {},
  }),
};

const name = process.argv[2];
const make = SERVERS[name];
if (!make) {
  console.error(`Serveur MCP inconnu : ${name ?? '(aucun)'} — attendus : ${Object.keys(SERVERS).join(', ')}`);
  process.exit(2);
}
const { args, env } = make(browser());
const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { stdio: 'inherit', env: { ...process.env, ...env } });
child.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));

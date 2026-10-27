/**
 * LE FOUR, SANS PERSONNE DEVANT — `npm run deps:bake`.
 *
 * Les instantanés `node_modules` doivent être installés PAR une WebContainer (les binaires d'esbuild et de rollup
 * dépendent de la plateforme). Ce script ouvre donc la page du four d'iCode dans un Chrome sans écran, en mode
 * automatique : chaque arbre dont l'empreinte n'est pas encore cuite est installé, vérifié (construction réelle),
 * exporté et déposé sur ce serveur. Sans lui, un changement de version dans le socle remettait chaque atelier à
 * trois minutes d'`npm install` jusqu'à ce que quelqu'un pense à ouvrir la page.
 *
 *   ICODE_URL                 l'adresse de l'atelier (défaut http://localhost:5173)
 *   APPGEN_DEPS_BAKE_TOKEN    le jeton de dépôt du serveur (obligatoire)
 *   DEPS_BAKE_TIMEOUT_MIN     au-delà, abandon (défaut 30)
 *
 * À lancer après chaque déploiement qui touche au socle (la CI peut le faire), et sans risque à tout moment :
 * ce qui est déjà cuit n'est pas refait.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch {
  // Le dépôt racine l'installe (moteur de rendu d'IDEM) : résolu depuis la racine du monorepo.
  puppeteer = createRequire(new URL('../../../../../package.json', import.meta.url))('puppeteer');
}

const url = (process.env.ICODE_URL || 'http://localhost:5173').replace(/\/+$/, '');
const token = process.env.APPGEN_DEPS_BAKE_TOKEN;
const timeout = Number(process.env.DEPS_BAKE_TIMEOUT_MIN || 30) * 60_000;
if (!token) {
  console.error('APPGEN_DEPS_BAKE_TOKEN manquant : le serveur refuserait le dépôt.');
  process.exit(2);
}

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-features=SharedArrayBuffer'] });
try {
  const page = await browser.newPage();
  page.on('console', (message) => {
    const text = message.text();
    if (text.startsWith('[four]')) console.log(text);
  });
  await page.goto(`${url}/?deps-bake=1&auto=1#token=${encodeURIComponent(token)}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction('window.__idemBake && window.__idemBake.done', { timeout, polling: 2000 });
  const outcome = await page.evaluate('window.__idemBake');
  for (const r of outcome?.results ?? []) console.log(`${r.ok ? '✓' : '✗'} ${r.target}/${r.tree}`);
  if (!outcome?.results?.length) console.log('Rien à cuire : tous les instantanés sont à jour.');
  process.exitCode = outcome?.ok === false ? 1 : 0;
} catch (error) {
  console.error('Four interrompu :', error.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}

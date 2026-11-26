/**
 * L'aperçu instantané, de bout en bout, dans Chrome — sans modèle :
 *
 *   - un site (dossier `--site`, par exemple celui du banc `bench:site`) envoyé au moteur, regroupé, servi ;
 *   - affiché dans une page parente isolée comme l'atelier (COEP credentialless), dans un iframe `sandbox` ;
 *   - premier affichage (h1 visible), mise à jour à chaud d'une section SANS recharger (le défilement reste),
 *     navigation vers une autre page, aucune erreur ; l'iframe n'a pas d'origine (ni cookie ni stockage du domaine) ;
 *   - mode Édition SUR l'aperçu instantané : repères `data-idem-id` justes, agent envoyé par l'atelier, « Sélectionner »
 *     sans recharger ni changer de page ni perdre le défilement, changement de page en mode Sélection.
 *
 *   PREVIEW_RUNTIME_DIR=<node_modules avec tailwindcss 3…> npm run check:preview -- --site <dossier du site> [--cold]
 */
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { availability, runtimeDir, vendor } from '../src/preview/engine.js';
import previewRouter, { openPreviewSession } from '../src/routes/preview.js';
import { metricsMiddleware } from '../src/middleware/metrics.js';

const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};
const SITE = option('site');
const COLD = args.includes('--cold');

let failures = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  if (ok) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.log(`  ÉCHEC ${label}${detail === undefined ? '' : `\n       ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
  }
};

const state = availability();
if (!state.available) {
  console.log(`Aperçu instantané indisponible ici : ${state.reason}`);
  process.exit(2);
}
if (!SITE || !existsSync(SITE)) {
  console.log('--site <dossier d’un site généré> est requis (par exemple le dossier site-new du banc bench:site).');
  process.exit(2);
}

const files: Record<string, string> = {};
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const rel = relative(SITE, path).split('\\').join('/');
    if (/^(node_modules|dist|\.idem)(\/|$)/.test(rel)) continue;
    if (statSync(path).isDirectory()) walk(path);
    else if (statSync(path).size < 2_000_000) files[rel] = readFileSync(path, 'utf8');
  }
};
walk(SITE);

console.log(`Site : ${Object.keys(files).length} fichiers · paquets : ${runtimeDir()}`);

if (COLD) {
  const cache = join(process.env.APPGEN_DEPS_CACHE_DIR || join(process.cwd(), 'deps-cache'), 'preview-vendor');
  rmSync(cache, { recursive: true, force: true });
}
let t = performance.now();
const info = await vendor();
const vendorMs = performance.now() - t;
console.log(`Dépendances : ${info.files.size} fichiers, ${Math.round([...info.files.values()].reduce((s, f) => s + f.length, 0) / 1024)} Ko, ${Math.round(vendorMs)} ms${COLD ? ' (à froid)' : ''}`);

t = performance.now();
const opened = await openPreviewSession('check', files);
const firstBuildMs = performance.now() - t;
check('le site se regroupe', opened.state.ok, opened.state.error);
console.log(`  première construction : ${Math.round(firstBuildMs)} ms · CSS ${Math.round(opened.session.css.length / 1024)} Ko`);

const app = express();
// Le middleware de métriques du vrai serveur : une route qu'il ne sait pas lire faisait tomber le processus (19/11).
app.use(metricsMiddleware);
app.use('/api/preview', previewRouter);
// La page parente, isolée comme l'atelier (la WebContainer exige COEP).
app.get('/parent', (req, res) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.type('html').send(`<!doctype html><html><body style="margin:0">
<iframe id="f" src="${typeof req.query.src === 'string' ? req.query.src : opened.url}" style="width:412px;height:823px;border:0" sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads"></iframe>
<script>window.messages=[];addEventListener('message',(e)=>{if(e.data&&(e.data.source==='idem-preview'||e.data.source==='idem-edit'))window.messages.push(e.data)});</script>
</body></html>`);
});
const server = app.listen(0, '127.0.0.1');
await new Promise((done) => server.once('listening', done));
const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

const require = createRequire(join(process.cwd(), '..', '..', '..', '..', 'package.json'));
const puppeteer = require('puppeteer');
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors: string[] = [];
page.on('console', (m: { type(): string; text(): string }) => m.type() === 'error' && !/fonts\.g|Failed to load resource/.test(m.text()) && errors.push(m.text()));
page.on('pageerror', (e: Error) => errors.push(e.message));
// Les tiers (Google Fonts, Pexels) ne répondent pas sans réseau : coupés tout de suite plutôt qu'attendus.
await page.setRequestInterception(true);
page.on('request', (r: { url(): string; continue(): void; abort(): void }) => (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(r.url()) ? r.continue() : r.abort()));

// DÉBUT DE GÉNÉRATION : la page arrive avant une de ses sections. La première construction échoue ; l'aperçu doit
// attendre sans erreur, puis afficher la page dès que la section arrive (cas vu le 19/11 : « Failed to fetch
// dynamically imported module … p0-home.js?v=1 »).
{
  const missing = Object.keys(files).find((path) => /^src\/sections\/home\/.+\.tsx$/.test(path) && !/<Heading level=\{1\}>|<h1/.test(files[path]));
  if (missing) {
    const partial = { ...files };
    delete partial[missing];
    const early = await openPreviewSession('check-early', partial);
    check('début de génération : première construction en échec (section absente)', !early.state.ok, early.state);
    await page.goto(`${origin}/parent?src=${encodeURIComponent(early.url)}`, { waitUntil: 'domcontentloaded' });
    await new Promise((d) => setTimeout(d, 1500));
    const earlyFrame = page.frames().find((f: { url(): string }) => f.url().includes(early.url));
    const text = (await earlyFrame.evaluate(`document.body.innerText`)) as string;
    check('… l’aperçu attend en silence (pas d’erreur affichée)', /se prépare/.test(text) && !/Failed to fetch|TypeError/.test(text), text.slice(0, 200));
    const told = (await page.evaluate(`window.messages.filter((m) => m.type === 'error').length`)) as number;
    check('… l’atelier n’est pas prévenu d’une erreur', told === 0, told);
    early.session.apply({ [missing]: files[missing] });
    const fixed = await early.session.build();
    await earlyFrame.waitForFunction(`!!document.querySelector('h1')`, { timeout: 10_000 });
    check('… la page s’affiche dès que la section arrive, sans recharger', fixed.ok);
    // Une erreur passagère (réparée en moins de 4 s) n'est jamais montrée.
    early.session.apply({ [missing]: `${files[missing]}\nexport const = ;` });
    await early.session.build();
    await new Promise((d) => setTimeout(d, 1000));
    early.session.apply({ [missing]: files[missing] });
    await early.session.build();
    await new Promise((d) => setTimeout(d, 4000));
    const overlay = (await earlyFrame.evaluate(`document.body.innerText.includes('Expected')`)) as boolean;
    const told2 = (await page.evaluate(`window.messages.filter((m) => m.type === 'error').length`)) as number;
    check('erreur passagère réparée en 1 s : jamais montrée', !overlay && told2 === 0, { overlay, told2 });
    await early.session.dispose();
    await page.evaluate(`window.messages = []`);
  }
}

t = performance.now();
await page.goto(`${origin}/parent`, { waitUntil: 'domcontentloaded' });
const frameOf = async () => {
  for (let i = 0; i < 200; i++) {
    const frame = page.frames().find((f: { url(): string }) => f.url().includes('/api/preview/s/'));
    if (frame) return frame;
    await new Promise((d) => setTimeout(d, 25));
  }
  throw new Error('iframe absent');
};
let frame = await frameOf();
await frame.waitForFunction(`!!document.querySelector('h1') && document.querySelector('h1').textContent.trim().length > 0`, { timeout: 20_000 });
const firstPaintMs = performance.now() - t;
check('première page affichée (h1)', true);
console.log(`  page affichée en ${Math.round(firstPaintMs)} ms (document + dépendances + code, cache vide)`);

const isolated = await frame.evaluate(`(() => { try { return { origin: self.origin, cookie: (() => { try { document.cookie; return 'lisible'; } catch { return 'refusé'; } })(), storage: (() => { try { localStorage.length; return 'lisible'; } catch { return 'refusé'; } })() }; } catch (e) { return String(e); } })()`);
check('iframe en origine opaque : ni cookie ni stockage du domaine', (isolated as { origin: string }).origin === 'null' && (isolated as { cookie: string }).cookie === 'refusé', isolated);
const ready = await page.evaluate(`window.messages.map((m) => m.type)`);
check('l’atelier est prévenu (postMessage « ready »)', (ready as string[]).includes('ready'), ready);

// Mise à jour à chaud : le texte d'une section change, la page n'est pas rechargée, le défilement reste.
const hero = Object.keys(files).find((path) => /^src\/sections\/home\/.*\.tsx$/.test(path) && /<Heading level=\{1\}>|<h1/.test(files[path]));
if (hero) {
  // Le site défile en douceur (`scroll-behavior: smooth`) : on attend la fin du défilement avant de mesurer.
  await frame.evaluate(`window.__marker = 42; window.scrollTo({ top: 600, behavior: 'instant' });`);
  await new Promise((d) => setTimeout(d, 400));
  const before = (await frame.evaluate(`window.scrollY`)) as number;
  const updated = files[hero].replace(/(<Heading level=\{1\}>|<h1[^>]*>)([^<]*)/, '$1Titre mis à jour en direct');
  opened.session.apply({ [hero]: updated });
  t = performance.now();
  const built = await opened.session.build();
  const rebuildMs = performance.now() - t;
  await frame.waitForFunction(`document.querySelector('h1') && document.querySelector('h1').textContent.includes('Titre mis à jour en direct')`, { timeout: 10_000 });
  const hmrMs = performance.now() - t;
  const after = (await frame.evaluate(`({ marker: window.__marker, y: window.scrollY })`)) as { marker: number; y: number };
  check('mise à jour à chaud appliquée', built.ok, built.error);
  check('sans rechargement (l’état de la page reste)', after.marker === 42, after);
  check('le défilement reste', Math.abs(after.y - before) < 5, { before, after: after.y });
  console.log(`  section modifiée : reconstruction ${Math.round(rebuildMs)} ms, visible en ${Math.round(hmrMs)} ms`);
}

// Fin d'une modification retenue par l'atelier (`restart`) : la page est remontée (état remis à zéro), le document
// reste (pas de dépendances retéléchargées).
if (hero) {
  await frame.evaluate(`window.__oldH1 = document.querySelector('h1'); window.__marker = 43;`);
  opened.session.apply({ [hero]: files[hero].replace(/(<Heading level=\{1\}>|<h1[^>]*>)([^<]*)/, '$1Version finale de la modification') });
  opened.session.restartPending = true;
  const built = await opened.session.build();
  await frame.waitForFunction(`document.querySelector('h1')?.textContent.includes('Version finale de la modification')`, { timeout: 10_000 });
  const remounted = (await frame.evaluate(`({ fresh: document.querySelector('h1') !== window.__oldH1 && !document.contains(window.__oldH1), marker: window.__marker })`)) as { fresh: boolean; marker: number };
  check('fin de modification : la page redémarre (remontée)', built.ok && remounted.fresh, remounted);
  check('… sans recharger le document', remounted.marker === 43, remounted);
  opened.session.apply({ [hero]: files[hero] });
  await opened.session.build();
}

// Une erreur de code : signalée dans l'aperçu et à l'atelier, puis effacée à la correction.
if (hero) {
  opened.session.apply({ [hero]: `${files[hero]}\nexport const = ;` });
  const broken = await opened.session.build();
  check('erreur de syntaxe : signalée avec le fichier et la ligne', !broken.ok && /\.tsx:\d+/.test(broken.error ?? ''), broken.error);
  // Une erreur qui DURE (plus de 4 s) est montrée et signalée.
  await new Promise((d) => setTimeout(d, 4600));
  const told = (await page.evaluate(`window.messages.filter((m) => m.type === 'error').length`)) as number;
  check('erreur durable : l’atelier la reçoit après 4 s (postMessage « error »)', told > 0);
  opened.session.apply({ [hero]: files[hero] });
  const fixed = await opened.session.build();
  check('corrigée : l’aperçu repart', fixed.ok);
}

// Navigation vers une autre page du site.
const other = opened.session.pages().find((p) => p.path !== '/');
if (other) {
  const homeTitle = (await frame.evaluate(`document.querySelector('h1')?.textContent ?? ''`)) as string;
  // Ce qui transite au changement de page : l'iframe en origine opaque n'a pas de cache, tout rechargement du
  // document retéléchargeait les dépendances (1,7 Mo, 25/11).
  const navRequests: string[] = [];
  const onRequest = (r: { url(): string }) => navRequests.push(r.url());
  page.on('request', onRequest);
  await frame.evaluate(`window.__stay = 7`);
  t = performance.now();
  await frame.evaluate(`(() => { const a = [...document.querySelectorAll('a[href]')].find((x) => x.getAttribute('href') === ${JSON.stringify(other.path)}); if (a) a.click(); else location.href = location.pathname.replace(/\\/$/, '') + ${JSON.stringify(other.path)}; })()`);
  const arrived = `location.pathname.endsWith(${JSON.stringify(other.path)}) && !!document.querySelector('h1') && document.querySelector('h1').textContent !== ${JSON.stringify(homeTitle)}`;
  for (let i = 0; i < 600; i++) {
    frame = await frameOf();
    if (await frame.evaluate(arrived).catch(() => false)) break;
    await new Promise((d) => setTimeout(d, 25));
  }
  await frame.waitForFunction(arrived, { timeout: 15_000 });
  const navigationMs = performance.now() - t;
  console.log(`  changement de page (clic du menu → nouvelle page affichée) : ${Math.round(navigationMs)} ms`);
  check('changement de page en moins de 1 s (local)', navigationMs < 1000, Math.round(navigationMs));
  page.off('request', onRequest);
  const vendorAgain = navRequests.filter((url) => url.includes('/api/preview/vendor/'));
  console.log(`  requêtes pendant le changement de page : ${navRequests.length} (dépendances : ${vendorAgain.length})`);
  check('changement de page sans recharger le document', (await frame.evaluate(`window.__stay`)) === 7);
  check('changement de page sans retélécharger les dépendances', vendorAgain.length === 0, vendorAgain.slice(0, 3));
  check('l’adresse suit la page', ((await frame.evaluate(`location.pathname`)) as string).endsWith(other.path));
  const otherTitle = (await frame.evaluate(`document.querySelector('h1')?.textContent ?? ''`)) as string;
  // Précédent : retour à l'accueil, toujours sans recharger (le titre de l'accueil peut être en cours d'animation).
  await frame.evaluate(`history.back()`);
  const backHome = `location.pathname.endsWith('/s/' + location.pathname.split('/s/')[1].split('/')[0] + '/') && !!document.querySelector('h1') && document.querySelector('h1').textContent !== ${JSON.stringify(otherTitle)}`;
  await frame.waitForFunction(backHome, { timeout: 5_000 }).catch(() => undefined);
  check('« Précédent » ramène à l’accueil sans recharger', (await frame.evaluate(`(${backHome}) && window.__stay === 7`)) === true);
  // Un lien du menu ramenait à l'accueil (19/11) : la page affichée doit être la bonne, pas seulement une page.
  check(`navigation vers ${other.path} : la bonne page, pas l’accueil`, otherTitle !== homeTitle && otherTitle.length > 0, { homeTitle, otherTitle });
}

// MODE ÉDITION sur l'aperçu instantané (26/11 : « Sélectionner » repartait sur l'accueil, « Dessiner » redémarrait
// l'application). Les repères sont posés au regroupement, l'agent part de l'atelier : allumer un mode = un message.
{
  const { AGENT_SOURCE } = (await import('../../we-dev-client/src/components/EditMode/instrumentation.ts')) as { AGENT_SOURCE: string };
  frame = await frameOf();
  const ids = (await frame.evaluate(`[...document.querySelectorAll('[data-idem-id]')].slice(0, 400).map((el) => el.getAttribute('data-idem-id'))`)) as string[];
  const wrong = ids.filter((id) => {
    const cut = id.lastIndexOf('|');
    const file = files[id.slice(0, cut)];
    return !file || file[Number(id.slice(cut + 1))] !== '<';
  });
  check('repères du mode Édition posés au regroupement', ids.length > 20, ids.length);
  check('… chacun désigne le « < » de sa balise dans le source propre', wrong.length === 0, wrong.slice(0, 5));

  const post = (msg: object) => page.evaluate(`document.getElementById('f').contentWindow.postMessage(${JSON.stringify(msg)}, '*')`);
  const waitFor = async (test: string, ms = 3000) => {
    for (let i = 0; i < ms / 20; i++) {
      if (await page.evaluate(test)) return true;
      await new Promise((d) => setTimeout(d, 20));
    }
    return false;
  };
  await page.evaluate(`window.messages = []`);
  t = performance.now();
  await post({ source: 'idem-preview-parent', type: 'LOAD_AGENT', code: AGENT_SOURCE });
  const agentReady = await waitFor(`window.messages.some((m) => m.type === 'AGENT_READY')`);
  console.log(`  agent d’édition installé en ${Math.round(performance.now() - t)} ms`);
  check('agent d’édition envoyé par l’atelier : prêt', agentReady);

  await frame.evaluate(`(window.__stay = 11, scrollTo(0, 600))`);
  const pathBefore = (await frame.evaluate(`location.pathname`)) as string;
  const yBefore = (await frame.evaluate(`scrollY`)) as number;
  t = performance.now();
  await post({ source: 'idem-edit', type: 'ENABLE_EDIT', enabled: true, mode: 'select' });
  const treeOk = await waitFor(`window.messages.some((m) => m.type === 'TREE' && m.nodes.length > 0)`);
  console.log(`  « Sélectionner » actif (arbre des calques reçu) en ${Math.round(performance.now() - t)} ms`);
  check('« Sélectionner » actif en moins de 300 ms (local)', treeOk && performance.now() - t < 300, Math.round(performance.now() - t));
  check('… sans recharger le document', (await frame.evaluate(`window.__stay`)) === 11);
  check('… sur la même page', (await frame.evaluate(`location.pathname`)) === pathBefore, pathBefore);
  check('… au même endroit (défilement)', Math.abs(((await frame.evaluate(`scrollY`)) as number) - yBefore) < 5, yBefore);

  // Un clic désigne un élément (et ne suit pas les liens).
  const box = (await frame.evaluate(`(() => { const el = [...document.querySelectorAll('[data-idem-id]')].find((x) => { const r = x.getBoundingClientRect(); return r.top > 40 && r.bottom < innerHeight - 40 && r.width > 40 && r.height > 16; }); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + Math.min(20, r.width / 2), y: r.top + Math.min(10, r.height / 2) }; })()`)) as { x: number; y: number } | null;
  if (box) {
    const frameBox = await (await page.$('#f')).boundingBox();
    await page.mouse.click(frameBox.x + box.x, frameBox.y + box.y);
    const picked = await waitFor(`window.messages.some((m) => m.type === 'SELECTED' && m.elements.length === 1)`);
    check('un clic sélectionne un élément', picked);
  }

  // Un clic sur un LIEN : l'atelier reçoit son adresse (pour la petite fenêtre « Modifier / Ouvrir le lien »), et la
  // position suit quand la page défile (la fenêtre reste collée à l'élément).
  await frame.evaluate(`scrollTo(0, 0)`);
  await new Promise((d) => setTimeout(d, 300));
  const linkBox = (await frame.evaluate(`(() => { const a = [...document.querySelectorAll('a[href]')].find((x) => { const r = x.getBoundingClientRect(); return (x.hasAttribute('data-idem-id') || x.querySelector('[data-idem-id]')) && r.top > 20 && r.bottom < innerHeight - 20 && r.width > 10; }); if (!a) return null; const r = a.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, href: a.getAttribute('href') }; })()`)) as { x: number; y: number; href: string } | null;
  if (linkBox) {
    await page.evaluate(`window.messages = []`);
    const frameBox = await (await page.$('#f')).boundingBox();
    await page.mouse.click(frameBox.x + linkBox.x, frameBox.y + linkBox.y);
    const linked = await waitFor(`window.messages.some((m) => m.type === 'SELECTED' && m.reason === 'click' && m.elements[0] && m.elements[0].linkHref === ${JSON.stringify(linkBox.href)})`);
    check('clic sur un lien : son adresse est annoncée (fenêtre « Modifier / Ouvrir le lien »)', linked, linkBox.href);
    check('… le lien n’est pas suivi en mode Sélection', ((await frame.evaluate(`location.pathname`)) as string) === pathBefore);
    await frame.evaluate(`scrollBy(0, 120)`);
    const moved = await waitFor(`window.messages.some((m) => m.type === 'SELECTION_RECTS' && m.rects.length === 1)`);
    check('… sa position suit le défilement', moved);

    // Une retouche depuis le panneau (« Plus petit ») recharge le module de la page : React remplace les éléments. La
    // sélection doit rester sur le même élément (26/11 : le panneau se fermait à chaque clic).
    const sel = (await page.evaluate(`[...window.messages].reverse().find((m) => m.type === 'SELECTED' && m.elements.length)?.elements[0]?.id`)) as string | undefined;
    if (sel) {
      const cut = sel.lastIndexOf('|');
      const file = sel.slice(0, cut);
      const start = Number(sel.slice(cut + 1));
      const code = opened.session.files.get(file)!;
      const nameEnd = start + 1 + (code.slice(start + 1).match(/^[\w.]+/)?.[0].length ?? 0);
      await page.evaluate(`window.messages = []`);
      opened.session.apply({ [file]: `${code.slice(0, nameEnd)} style={{ fontSize: '13px' }}${code.slice(nameEnd)}` });
      await opened.session.build();
      const kept = await waitFor(`window.messages.some((m) => m.type === 'SELECTED' && m.reason === 'refresh')`, 4000);
      const last = (await page.evaluate(`[...window.messages].reverse().find((m) => m.type === 'SELECTED')`)) as { elements: Array<{ id: string; computed: { fontSize: string } }> } | undefined;
      check('retouche depuis le panneau : la sélection reste (le panneau ne se ferme pas)', kept && !!last && last.elements.length === 1, JSON.stringify(last?.elements.map((e) => e.id)));
      check('… et montre la nouvelle valeur', kept && last?.elements[0]?.computed.fontSize === '13px', last?.elements[0]?.computed.fontSize);
      opened.session.apply({ [file]: code });
      await opened.session.build();
    }
  } else console.log('  (aucun lien visible dans le premier écran : cas du lien non vérifié)');

  // Changer de page EN mode Sélection (menu des pages de l'atelier) : la page change, l'agent reste.
  if (other) {
    await page.evaluate(`window.messages = []`);
    await post({ source: 'idem-preview-parent', type: 'NAVIGATE', href: other.path });
    const moved = await waitFor(`window.messages.some((m) => m.type === 'navigate')`, 5000);
    check(`en mode Sélection, l’atelier change de page (${other.path})`, moved && ((await frame.evaluate(`location.pathname`)) as string).endsWith(other.path));
    check('… sans recharger, agent toujours là', (await frame.evaluate(`window.__stay === 11 && window.__IDEM_AGENT__ === true`)) === true);
    const deselected = await waitFor(`window.messages.some((m) => m.type === 'SELECTED' && m.elements.length === 0)`);
    check('… la sélection de l’ancienne page est retirée', deselected);
    const fresh = await waitFor(`window.messages.some((m) => m.type === 'TREE' && m.nodes.length > 0)`);
    check('… les calques de la nouvelle page arrivent', fresh);
  }
  await post({ source: 'idem-edit', type: 'ENABLE_EDIT', enabled: false, mode: 'off' });
}

check('aucune erreur dans la page', errors.length === 0, errors.slice(0, 5));
await browser.close();
server.close();
await opened.session.dispose();
console.log(failures ? `\n${failures} échec(s).` : '\nTout est vert.');
process.exit(failures ? 1 : 0);

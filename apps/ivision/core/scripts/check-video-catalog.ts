/**
 * `npm run check:video-catalog` — le CATALOGUE VIDÉO, sans modèle, rendu dans Chrome :
 *
 *   1. le chargement : le dépôt `idem-templates` (catalog/videos) lu, chaque nœud vérifié, aucun écarté ; les règles
 *      refusent un rebond, une propriété non permise, un mot écrit en dur, un script ;
 *   2. les emplacements : chaque texte d'une scène a sa place (aucun perdu), un chiffre seul prend celle du chiffre ;
 *   3. le choix : au cran Low aucun appel ; au-dessus, UN appel pour tout le film ; une réponse illisible ou des
 *      identifiants inventés laissent le choix du code ; jamais deux fois la même mise en page de suite ;
 *   4. le RENDU : un film des 10 gabarits pour CHACUN des 10 thèmes, sur les 4 formats (story, carré, portrait,
 *      paysage) : aucune erreur, chaque texte tient (corps ≥ minimum), dans le cadre et la zone sûre, visible, sans
 *      chevauchement, tout le texte de la scène présent ; le même film assemblé deux fois est identique ;
 *   5. les planches : une image par scène et par format dans `tmp/check-video-catalog/` (à regarder).
 *
 * `--fast` : un thème sur trois et deux formats.
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import puppeteer, { Page } from 'puppeteer';
import { configureCore } from '../src/runtime/host';
import { buildComposition, formatCode } from '../src/video/rendering/hyperframes/composition';
import { COMPOSITION } from '../src/video/rendering/formats';
import { resetVideoCatalog, videoCatalog, buildVideoCatalog } from '../src/video/catalog/registry';
import { assembleFilm, CatalogScene, composeFilmFromCatalog } from '../src/video/catalog/compose';
import { sceneSlots } from '../src/video/catalog/graph';
import type { FilmFormatId, GabaritNode, SceneConfig, ThemeNode } from '../src/video/catalog/types';
import type { RuntimeScene } from '../src/video/catalog/assemble';

process.env.IDEM_TEMPLATES_DIR = process.env.IDEM_TEMPLATES_DIR || path.resolve(__dirname, '../../../../../idem-templates');
process.env.IDEM_QUALITY_MEMORY = '0';
const fast = process.argv.includes('--fast');
const OUT = path.resolve(__dirname, '../tmp/check-video-catalog');
let failures = 0;
let passed = 0;
const check = (ok: boolean, label: string, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${!ok && detail ? ` — ${detail}` : ''}`);
  if (ok) passed++;
  else failures++;
};
configureCore({ logger: { info: () => undefined, warn: () => undefined, error: (m: string, meta?: unknown) => console.error(m, meta) } as never });

const BRAND = { name: 'AgriLink', colors: { primary: '#1b7a5a', secondary: '#163a5f', accent: '#e3a03a', background: '#f6f7f4', text: '#14211c' }, fonts: { display: 'Fraunces', body: 'Karla' } };

/** Une scène d'essai par rôle : des textes RÉELS (français, longueurs du terrain), jamais des « lorem ». */
function sceneFor(g: GabaritNode, key: string, duration: number): CatalogScene {
  const role = g.roles[0];
  const media = [{ id: 'photo', kind: 'image' as const }];
  const layout = g.config.layout;
  const base: Record<string, Record<string, string>> = {
    'vlayout.title-center': { kicker: 'Agriculture connectée', headline: 'Le marché vient à vous, même sans smartphone', sub: 'Une borne tactile au cœur de chaque village du Moungo.' },
    'vlayout.title-left-rule': { kicker: 'Le problème', headline: 'Douze kilomètres à pied pour acheter ses semences', sub: 'Chaque saison, les exploitants perdent deux jours de travail et paient 30 % de plus.' },
    'vlayout.media-full-caption': { headline: 'Marie vend sa récolte depuis la place du village', sub: 'Payée en 24 heures, sans intermédiaire.' },
    'vlayout.split-media-text': { kicker: 'Commande', headline: 'Trois touches pour commander ses intrants', sub: 'La borne parle la langue de l’exploitant et imprime un reçu.' },
    'vlayout.big-figure': { figure: '1 200', label: 'Exploitants servis en 2026', headline: 'Une croissance mois après mois' },
    'vlayout.list-steps': { headline: 'Comment ça marche', text2: 'L’exploitant choisit ses intrants à la borne', text3: 'Le dépôt prépare la commande en une heure', text4: 'Le paiement passe par mobile money', text5: 'La livraison arrive au village le lendemain' },
    'vlayout.quote': { headline: 'Je ne marche plus jusqu’au marché : la borne est à côté de chez moi.', author: 'Marie Ngo, productrice de manioc' },
    'vlayout.media-framed': { headline: 'Une borne pensée pour le village', sub: 'Solaire, solide, utilisable sans savoir lire.' },
    'vlayout.cta-end': { headline: 'Installez une borne dans votre village', sub: 'Les dix premières coopératives sont équipées gratuitement.', cta: 'Écrire sur WhatsApp' },
    'vlayout.logo-sting': { headline: 'Les intrants à portée de main' },
    'vlayout.figure-media': { figure: '3 200', label: 'Commandes passées à la borne', headline: 'La borne tourne tous les jours' },
    'vlayout.data-rows': { kicker: 'Résultats', headline: 'Ce que la borne change', text2: 'Deux jours de marche économisés par saison', text3: 'Trente pour cent de moins sur les intrants', text4: 'Un reçu imprimé à chaque commande' },
    'vlayout.figure-footer': { figure: '98 %', label: 'Des commandes livrées le lendemain', headline: 'Un service qui tient ses promesses' },
    'vlayout.cta-split': { headline: 'Équipez votre coopérative cette saison', sub: 'Les dix premières installations sont offertes.', cta: 'Écrire sur WhatsApp' },
    'vlayout.signature-lockup': { headline: 'Les intrants à portée de main', cta: 'idem.africa' },
    'vlayout.problem-list': { kicker: 'Le problème', headline: 'Trois obstacles à chaque saison', text2: 'Le dépôt le plus proche est à douze kilomètres', text3: 'Les prix changent sans prévenir', text4: 'Aucun reçu, aucun recours' },
  };
  const texts = base[layout] ?? { headline: 'Une scène' };
  const needsMedia = ['vlayout.media-full-caption', 'vlayout.split-media-text', 'vlayout.media-framed', 'vlayout.figure-media'].includes(layout);
  return { key, duration, texts, media: needsMedia ? media : [], role, energy: 3 };
}

/** Ouvre une composition comme le rendu (origine locale, fichiers servis, aucun réseau). */
async function openComposition(page: Page, html: string, files: Record<string, { data: Buffer; type: string }>, size: { width: number; height: number }): Promise<string[]> {
  const ORIGIN = 'http://idem-check.local';
  await page.setViewport({ width: size.width, height: size.height, deviceScaleFactor: 1 });
  page.removeAllListeners('request');
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (url.startsWith('data:') || url === 'about:blank') return void req.continue();
    if (!url.startsWith(ORIGIN)) return void req.abort('blockedbyclient');
    const name = decodeURIComponent(url.slice(ORIGIN.length + 1).split('?')[0]);
    if (!name) return void req.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
    const f = files[name];
    return void req.respond(f ? { status: 200, contentType: f.type, body: f.data } : { status: 404, body: '' });
  });
  const errors: string[] = [];
  page.removeAllListeners('pageerror');
  page.on('pageerror', (e) => errors.push(String((e as Error)?.message || e)));
  await page.goto(`${ORIGIN}/`, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate('document.fonts && document.fonts.ready');
  await page.evaluate('new Promise(function (r) { setTimeout(r, 30); })');
  return errors;
}

/** Les mesures d'une scène posée (tout est entré) : textes dans le cadre et la zone sûre, visibles, sans chevauchement. */
const MEASURE = `(function (key, t, texts) {
  window.__timelines.film.seek(t, false);
  document.querySelectorAll('section.scene').forEach(function (el) { el.style.visibility = el.id === key ? 'visible' : 'hidden'; });
  var sec = document.getElementById(key), comp = document.getElementById('comp').getBoundingClientRect();
  var safe = sec.querySelector('[data-safe]').getBoundingClientRect();
  var els = Array.prototype.slice.call(sec.querySelectorAll('[data-fit]'));
  var problems = [];
  function opacity(el) { var o = 1; for (var e = el; e && e !== document.body; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; }
  // L'étendue RÉELLE du texte (ses lignes), pas la boîte du bloc qui peut occuper toute la largeur.
  function extent(el) {
    var rg = document.createRange(); rg.selectNodeContents(el);
    var rects = Array.prototype.slice.call(rg.getClientRects()).filter(function (q) { return q.width > 0.5 && q.height > 0.5; });
    if (!rects.length) return el.getBoundingClientRect();
    return rects.reduce(function (a, q) { return { left: Math.min(a.left, q.left), top: Math.min(a.top, q.top), right: Math.max(a.right, q.right), bottom: Math.max(a.bottom, q.bottom), width: 0, height: 0 }; }, { left: 1e9, top: 1e9, right: -1e9, bottom: -1e9 });
  }
  var boxes = els.map(function (el) {
    var r = extent(el); r.width = r.right - r.left; r.height = r.bottom - r.top;
    var name = el.getAttribute('data-fit');
    var tol = 3;
    if (r.width < 2 || r.height < 2) problems.push(name + ' vide');
    if (r.left < comp.left - tol || r.right > comp.right + tol || r.top < comp.top - tol || r.bottom > comp.bottom + tol) problems.push(name + ' hors du cadre');
    if (r.left < safe.left - tol || r.right > safe.right + tol || r.top < safe.top - tol || r.bottom > safe.bottom + tol) problems.push(name + ' hors de la zone sûre (texte ' + [r.left, r.top, r.right, r.bottom].map(Math.round).join(',') + ' · zone ' + [safe.left, safe.top, safe.right, safe.bottom].map(Math.round).join(',') + ')');
    if (opacity(el) < 0.9) problems.push(name + ' invisible (' + opacity(el).toFixed(2) + ')');
    var fs = parseFloat(getComputedStyle(el).fontSize), min = parseFloat(el.getAttribute('data-fmin')) * Math.min(comp.width, comp.height) / (window.devicePixelRatio || 1);
    return { name: name, r: r, el: el };
  });
  for (var i = 0; i < boxes.length; i++) for (var j = i + 1; j < boxes.length; j++) {
    var a = boxes[i], b = boxes[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    var w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (w > 2 && h > 2 && w * h > 0.04 * Math.min(a.r.width * a.r.height, b.r.width * b.r.height)) problems.push(a.name + ' chevauche ' + b.name);
  }
  // Les lignes découpées se suivent sans espace : la comparaison se fait sans les blancs.
  var shown = (sec.textContent || '').replace(/\\s+/g, '');
  texts.forEach(function (t) { if (shown.indexOf(t.replace(/\\s+/g, '')) < 0) problems.push('texte absent : ' + t.slice(0, 30)); });
  return problems;
})`;

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  // 1. Le chargement
  resetVideoCatalog();
  const cat = await videoCatalog();
  const count = (k: string) => [...cat.nodes.values()].filter((n) => n.kind === k && !n.id.startsWith('builtin.')).length;
  check(cat.source === 'dir' && ['layout', 'theme', 'animation', 'transition', 'gabarit'].every((k) => count(k) >= 10), 'chargement : le dépôt est lu, 10 nœuds au moins de chaque sorte', `${cat.source} · ${['layout', 'theme', 'animation', 'transition', 'gabarit'].map((k) => `${count(k)} ${k}`).join(', ')}`);
  check(cat.rejected.length === 0, 'chargement : aucun nœud écarté', cat.rejected.map((r) => `${r.id}: ${r.reason}`).join(' | '));
  const bad = buildVideoCatalog(
    [
      { node: { id: 'anim.bounce', version: 1, medium: 'video', kind: 'animation', doc: { title: 'x', summary: 'y' }, targets: ['text'], split: 'none', steps: { in: [{ from: { y: 40 }, to: { y: 0 }, duration: 0.5, ease: 'bounce.out' }] } } },
      { node: { id: 'anim.left', version: 1, medium: 'video', kind: 'animation', doc: { title: 'x', summary: 'y' }, targets: ['text'], split: 'none', steps: { in: [{ to: { left: 10 }, duration: 0.5 }] } } },
      { node: { id: 'vlayout.words', version: 1, medium: 'video', kind: 'layout', doc: { title: 'x', summary: 'y' }, formats: ['story'], roles: ['hook'], slots: { title: { need: 'required' } } }, html: '<div data-safe class="[[safe]]"><h1 data-v="title">{{title}} Bienvenue</h1></div>' },
      { node: { id: 'vlayout.script', version: 1, medium: 'video', kind: 'layout', doc: { title: 'x', summary: 'y' }, formats: ['story'], roles: ['hook'], slots: { title: { need: 'required' } } }, html: '<div data-safe class="[[safe]]"><h1 data-v="title">{{title}}</h1><script>alert(1)</script></div>' },
    ],
    'test',
    'dir'
  );
  check(['anim.bounce', 'anim.left', 'vlayout.words', 'vlayout.script'].every((id) => bad.rejected.some((r) => r.id === id)), 'règles : rebond, propriété non permise, mot en dur et script écartés au chargement', bad.rejected.map((r) => `${r.id}: ${r.reason}`).join(' | '));

  // L'instantané embarqué : sans dépôt ni CDN, le catalogue entier reste servi.
  const dirEnv = process.env.IDEM_TEMPLATES_DIR;
  const urlEnv = process.env.IDEM_TEMPLATES_URL;
  delete process.env.IDEM_TEMPLATES_DIR;
  delete process.env.IDEM_TEMPLATES_URL;
  process.env.IDEM_TEMPLATES_CACHE = path.join(OUT, 'no-cache');
  resetVideoCatalog();
  const snap = await videoCatalog();
  check(snap.source === 'snapshot' && [...snap.nodes.values()].filter((n) => n.kind === 'gabarit').length >= 10 && snap.rejected.length === 0, 'instantané embarqué : sans dépôt ni CDN, le catalogue entier est servi', `${snap.source} · ${snap.nodes.size} nœuds`);
  process.env.IDEM_TEMPLATES_DIR = dirEnv;
  if (urlEnv) process.env.IDEM_TEMPLATES_URL = urlEnv;
  resetVideoCatalog();
  await videoCatalog();

  // 2. Les emplacements
  const s1 = sceneSlots({ headline: 'Titre', sub: 'Soutien', text3: 'Point A', prop1: 'Point B' }, [], true, 'feature');
  check(s1.title === 'headline' && s1.body === 'sub' && s1.items.join() === 'text3,prop1', 'emplacements : titre, soutien, et les autres textes en liste (aucun perdu)', JSON.stringify(s1));
  const s2 = sceneSlots({ headline: 'Une croissance continue', text2: '+70 %' }, [], true, 'proof');
  check(s2.figure === 'text2' && s2.title === 'headline', 'emplacements : un chiffre seul d’une scène de preuve prend la place du chiffre', JSON.stringify(s2));

  // 3. Le choix
  const gabarits = [...cat.nodes.values()].filter((n): n is GabaritNode => n.kind === 'gabarit');
  const filmScenes = gabarits.map((g, i) => sceneFor(g, `s${i + 1}`, 3.4));
  const calls: string[] = [];
  const base = { scenes: filmScenes, film: { title: 'AgriLink', concept: 'Les intrants à portée de main', style: 'corporate', seed: 'check' }, brand: { name: BRAND.name, hasLogo: true, line: 'AgriLink · agriculture' }, formats: ['story'] as FilmFormatId[] };
  const low = await composeFilmFromCatalog({ ...base, level: 'low', call: { level: 'low', call: async ({ role }) => (calls.push(role), '') } });
  check(calls.length === 0 && low.trace.source === 'code' && low.scenes.length === filmScenes.length, 'choix : au cran Low, aucun appel de modèle (le code choisit)', `${calls.length} appel(s)`);
  calls.length = 0;
  const med = await composeFilmFromCatalog({ ...base, level: 'medium', call: { level: 'medium', call: async ({ role, user }) => (calls.push(`${role}|${user.length}`), JSON.stringify({ scenes: filmScenes.map((s) => ({ scene: s.key, pick: 'B' })) })) } });
  check(calls.length === 1 && calls[0].startsWith('video.template') && med.trace.source === 'llm', 'choix : au cran Medium, UN appel pour tout le film (rôle video.template)', calls.join(', '));
  check(med.scenes.every((s, i) => i === 0 || s.config.layout !== med.scenes[i - 1].config.layout), 'choix : jamais la même mise en page deux scènes de suite', med.scenes.map((s) => s.config.layout).join(' → '));
  calls.length = 0;
  const ultra = await composeFilmFromCatalog({ ...base, level: 'ultra', call: { level: 'ultra', call: async ({ user }) => (calls.push(user), JSON.stringify({ theme: 'B', scenes: filmScenes.map((s) => ({ scene: s.key, pick: 'A', animations: { title: 'anim.inventee', body: 'anim.rise-fade' }, transition: 'trans.push', pace: 9 })) })) } });
  check(calls[0]?.includes('THEMES') && calls[0].includes('ANIMATIONS') && calls[0].includes('TRANSITIONS') && ultra.scenes.every((s) => s.config.animations.title !== ('anim.inventee' as never) && (s.config.params?.pace ?? 1) <= 1.25), 'choix : à l’Ultra, thème, animations, transitions et rythme proposés ; un identifiant inventé et un rythme hors bornes refusés', ultra.trace.detail.slice(0, 200));
  const garbage = await composeFilmFromCatalog({ ...base, level: 'high', call: { level: 'high', call: async () => 'je ne sais pas' } });
  check(garbage.trace.source === 'code' && garbage.scenes.length === filmScenes.length, 'choix : une réponse illisible laisse le choix du code (le film se fait)');
  check(!calls.some((u) => /Le marché vient à vous|Douze kilomètres/.test(u)), 'choix : les mots des scènes ne sont jamais envoyés au modèle (seulement leur forme)');

  // 4. Le rendu : 10 gabarits × thèmes × formats
  const themes = [...cat.nodes.values()].filter((n): n is ThemeNode => n.kind === 'theme' && !n.id.startsWith('builtin.'));
  const formats: FilmFormatId[] = fast ? ['story', 'landscape'] : ['story', 'square', 'portrait', 'landscape'];
  const photo = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><rect width="1600" height="1200" fill="#cfe1d6"/><rect y="760" width="1600" height="440" fill="#2f6b50"/><circle cx="1180" cy="330" r="190" fill="#e3a03a"/><rect x="260" y="420" width="420" height="520" rx="30" fill="#163a5f"/></svg>')).jpeg({ quality: 82 }).toBuffer();
  const logo = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="120"><circle cx="60" cy="60" r="46" fill="#1b7a5a"/><text x="122" y="80" font-family="Arial" font-size="58" font-weight="700" fill="#14211c">AgriLink</text></svg>')).png().toBuffer();
  const files = { 'photo.jpg': { data: photo, type: 'image/jpeg' }, 'logo.png': { data: logo, type: 'image/png' } };
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-accelerated-2d-canvas'] });
  const page = await browser.newPage();
  const configs: SceneConfig[] = gabarits.map((g) => ({ gabarit: g.id, layout: g.config.layout, animations: { ...g.config.animations }, ...(g.config.transition ? { transition: g.config.transition } : {}) }));
  const picked = fast ? themes.filter((_, i) => i % 3 === 0) : themes;
  const problems: string[] = [];
  let renders = 0;
  let identical = true;
  for (const theme of picked) {
    for (const format of formats) {
      const assembled = assembleFilm(cat, { ...base, formats: [format] }, theme, configs);
      const again = assembleFilm(cat, { ...base, formats: [format] }, theme, configs);
      if (JSON.stringify(again) !== JSON.stringify(assembled)) identical = false;
      let start = 0;
      const scenes = assembled.map((a, i) => {
        const s = { key: a.key, start, duration: filmScenes[i].duration, html: a.html, script: a.script, animation: 'gsap' as const, texts: filmScenes[i].texts };
        start += filmScenes[i].duration;
        return s;
      });
      const size = COMPOSITION[format];
      const html = await buildComposition({ scenes, width: size.width, height: size.height, output: { width: Math.round(size.width / 2), height: Math.round(size.height / 2) }, durationSec: start, brand: { ...BRAND, logo: { light: 'logo.png', width: 480, height: 120 } } as never, media: { photo: { src: 'photo.jpg', kind: 'image' } }, logo: 'logo.png', fontCss: '', mode: 'render' });
      check(formatCode(size.width, size.height) === ({ story: 'st', square: 'sq', portrait: 'po', landscape: 'ls' } as const)[format], `format ${format} reconnu par la composition`);
      const pageErrors = await openComposition(page, html, files, { width: Math.round(size.width / 2), height: Math.round(size.height / 2) });
      const sceneErrors = (await page.evaluate('window.__sceneErrors || []')) as Array<{ key: string; message: string }>;
      const fit = (await page.evaluate('window.__fitIssues || []')) as string[];
      if (pageErrors.length || sceneErrors.length) problems.push(`${theme.id}/${format} : erreurs ${[...pageErrors, ...sceneErrors.map((e) => `${e.key} ${e.message}`)].join(' | ').slice(0, 300)}`);
      if (fit.length) problems.push(`${theme.id}/${format} : textes qui ne tiennent pas ${fit.join(', ')}`);
      const shots: Buffer[] = [];
      const specs = scenes.map((s) => JSON.parse(s.script.replace(/^__ge\.scene\(tl, root, D, /, '').replace(/\);$/, '')) as RuntimeScene);
      for (const [i, s] of scenes.entries()) {
        const spec = specs[i];
        const outs = spec.roles.map((r) => r.outAt).filter((x): x is number => typeof x === 'number');
        // Mesurée tout posé : avant les sorties, et avant que la transition vers la scène suivante ne commence.
        const nextHalf = specs[i + 1]?.transition?.half ?? 0;
        const t = s.start + Math.min(outs.length ? Math.min(...outs) - 0.08 : s.duration - 0.3, s.duration - nextHalf - 0.06);
        const found = (await page.evaluate(`${MEASURE}(${JSON.stringify(s.key)}, ${t}, ${JSON.stringify(Object.values(filmScenes[i].texts))})`)) as string[];
        for (const f of found) problems.push(`${theme.id}/${format}/${configs[i].gabarit} : ${f}`);
        shots.push(Buffer.from(await page.screenshot({ type: 'jpeg', quality: 70 })));
        renders++;
      }
      // La planche du film : ses scènes côte à côte.
      const w = Math.round(size.width / 2 / 3), h = Math.round(size.height / 2 / 3);
      const tiles = await Promise.all(shots.map((b) => sharp(b).resize(w, h).toBuffer()));
      const cols = 5;
      await sharp({ create: { width: cols * (w + 8), height: Math.ceil(tiles.length / cols) * (h + 8), channels: 3, background: '#777777' } })
        .composite(tiles.map((input, i) => ({ input, left: (i % cols) * (w + 8), top: Math.floor(i / cols) * (h + 8) })))
        .jpeg({ quality: 80 })
        .toFile(path.join(OUT, `${theme.id}-${format}.jpg`));
    }
  }
  await browser.close();
  check(identical, 'déterminisme : le même film assemblé deux fois est identique');

  // 5. L'export réel avec un CLIP SANS DURÉE (WebM écrit vers un tube, comme les anciens clips Lottie) : le clip est
  //    remis en conteneur par le code, HyperFrames l'accepte et le MP4 a la bonne durée.
  if (!fast) {
    const { spawnSync } = await import('child_process');
    const { seekableClip, probe } = await import('../src/video/rendering/ffmpeg');
    const { renderHyperFrames } = await import('../src/video/rendering/hyperframes/render');
    const piped = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=0x1b7a5a@0.8:s=480x480:d=2,format=rgba', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-f', 'webm', 'pipe:1'], { maxBuffer: 50 * 1024 * 1024 }).stdout as Buffer;
    const raw = path.join(OUT, 'piped.webm');
    fs.writeFileSync(raw, piped);
    const before = (await probe(raw)).duration;
    const clip = await seekableClip(piped, '.webm');
    const g = gabarits.find((x) => x.config.layout === 'vlayout.media-full-caption')!;
    const scene: CatalogScene = { key: 's1', duration: 3, texts: { headline: 'Un clip qui se joue' }, media: [{ id: 'clip', kind: 'video' }], role: 'reveal', energy: 3 };
    const [a] = assembleFilm(cat, { ...base, scenes: [scene], formats: ['square'] }, themes[0], [{ gabarit: g.id, layout: g.config.layout, animations: { ...g.config.animations } }]);
    const size = COMPOSITION.square;
    const html = await buildComposition({ scenes: [{ key: 's1', start: 0, duration: 3, html: a.html, script: a.script, animation: 'gsap', texts: scene.texts }], width: size.width, height: size.height, output: { width: 540, height: 540 }, durationSec: 3, brand: { ...BRAND, logo: { light: 'logo.png', width: 480, height: 120 } } as never, media: { clip: { src: 'clip.webm', kind: 'video' } }, logo: 'logo.png', fontCss: '', mode: 'render' });
    let mp4 = 0;
    let error = '';
    try {
      const out = await renderHyperFrames({ html, files: [{ name: 'clip.webm', data: clip }, { name: 'logo.png', data: logo }], durationSec: 3, fps: 30, quality: 'standard' });
      mp4 = (await probe(out.file)).duration;
      fs.copyFileSync(out.file, path.join(OUT, 'clip-export.mp4'));
    } catch (e) {
      error = String((e as Error)?.message || e).slice(0, 300);
    }
    check(before === 0 && Math.abs(mp4 - 3) < 0.2, 'export : un clip WebM sans durée est remis en conteneur et le MP4 se rend (HyperFrames réel)', `durée du clip avant ${before} s · MP4 ${mp4} s ${error}`);
  }
  check(problems.length === 0, `rendu : ${renders} scènes (${gabarits.length} gabarits × ${picked.length} thèmes × ${formats.length} formats) sans erreur, textes tenus, dans la zone sûre, visibles, sans chevauchement, tout le texte présent`, `${problems.length} défaut(s) :\n    ${problems.slice(0, 40).join('\n    ')}`);
  console.log(`\nPlanches : ${OUT}`);
  console.log(`\n${failures ? '✗' : '✓'} Catalogue vidéo : ${passed} vérification(s) réussie(s), ${failures} en échec.`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * `npm run check:video-catalog` — le CATALOGUE VIDÉO, sans modèle, rendu dans Chrome :
 *
 *   1. le chargement : le dépôt `idem-templates` (catalog/videos) lu, chaque nœud vérifié, aucun écarté ; les règles
 *      refusent un rebond, une propriété non permise, un mot écrit en dur, un script, un effet de texte inconnu, posé
 *      hors texte ou sur un découpage qu'il n'accepte pas ; les animations de texte sont les vingt animations GSAP, la
 *      rature n'entre que dans une scène « problème », un film d'avant retrouve l'équivalent de son animation ;
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
import { animationFor, sceneSlots } from '../src/video/catalog/graph';
import type { DecorNode, DevelopNode, FilmFormatId, GabaritNode, PrimitiveNode, SceneConfig, SequenceNode, ThemeNode } from '../src/video/catalog/types';
import { DEVELOP_FREE_MIN, IDLE_MAX, RuntimeScene } from '../src/video/catalog/assemble';

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
    'vlayout.title-center': { headline: 'Le marché vient à vous, même sans smartphone', sub: 'Une borne tactile au cœur de chaque village du Moungo.' },
    'vlayout.title-left-rule': { headline: 'Douze kilomètres à pied pour acheter ses semences', sub: 'Chaque saison, les exploitants perdent deux jours de travail et paient 30 % de plus.' },
    'vlayout.media-full-caption': { headline: 'Marie vend sa récolte depuis la place du village', sub: 'Payée en 24 heures, sans intermédiaire.' },
    'vlayout.split-media-text': { headline: 'Trois touches pour commander ses intrants', sub: 'La borne parle la langue de l’exploitant et imprime un reçu.' },
    'vlayout.big-figure': { figure: '1 200', label: 'Exploitants servis en 2026', headline: 'Une croissance mois après mois' },
    'vlayout.list-steps': { headline: 'Comment ça marche', text2: 'L’exploitant choisit ses intrants à la borne', text3: 'Le dépôt prépare la commande en une heure', text4: 'Le paiement passe par mobile money', text5: 'La livraison arrive au village le lendemain' },
    'vlayout.quote': { headline: 'Je ne marche plus jusqu’au marché : la borne est à côté de chez moi.', author: 'Marie Ngo, productrice de manioc' },
    'vlayout.media-framed': { headline: 'Une borne pensée pour le village', sub: 'Solaire, solide, utilisable sans savoir lire.' },
    'vlayout.cta-end': { headline: 'Installez une borne dans votre village', sub: 'Les dix premières coopératives sont équipées gratuitement.', cta: 'Écrire sur WhatsApp' },
    'vlayout.logo-sting': { headline: 'Les intrants à portée de main' },
    'vlayout.figure-media': { figure: '3 200', label: 'Commandes passées à la borne', headline: 'La borne tourne tous les jours' },
    'vlayout.data-rows': { headline: 'Ce que la borne change', text2: 'Deux jours de marche économisés par saison', text3: 'Trente pour cent de moins sur les intrants', text4: 'Un reçu imprimé à chaque commande' },
    'vlayout.figure-footer': { figure: '98 %', label: 'Des commandes livrées le lendemain', headline: 'Un service qui tient ses promesses' },
    'vlayout.cta-split': { headline: 'Équipez votre coopérative cette saison', sub: 'Les dix premières installations sont offertes.', cta: 'Écrire sur WhatsApp' },
    'vlayout.signature-lockup': { headline: 'Les intrants à portée de main', cta: 'idem.africa' },
    'vlayout.problem-list': { headline: 'Trois obstacles à chaque saison', text2: 'Le dépôt le plus proche est à douze kilomètres', text3: 'Les prix changent sans prévenir', text4: 'Aucun reçu, aucun recours' },
    'vlayout.editorial-split': { headline: 'Le marché vient à vous', sub: 'Une borne tactile au cœur de chaque village du Moungo.' },
    'vlayout.poster-word': { headline: 'Fini la marche', sub: 'Les intrants arrivent au village le lendemain.' },
    'vlayout.media-band': { headline: 'Les tisserandes de Bafoussam', sub: 'Chaque pagne est teint à la main, motif après motif.' },
    'vlayout.media-round': { headline: 'Marie, productrice de manioc', sub: 'Elle vend sa récolte depuis la place du village.' },
  };
  const node = CAT?.nodes.get(layout) as { slots?: Record<string, { need: string; max?: number; min?: number; maxChars?: number }> } | undefined;
  const texts = base[layout] ?? textsForSlots(node?.slots ?? {});
  const needsMedia = ['vlayout.media-full-caption', 'vlayout.split-media-text', 'vlayout.media-framed', 'vlayout.figure-media', 'vlayout.poster-word', 'vlayout.media-band', 'vlayout.media-round'].includes(layout) || Boolean(node?.slots?.media);
  return { key, duration, texts, media: needsMedia ? media : [], role, energy: 3 };
}

/**
 * Les textes d'essai d'une mise en page d'après ses EMPLACEMENTS (23/11/2026, catalogue ×4) : des phrases réelles du
 * terrain, à la longueur la plus longue que l'emplacement accepte (le cas difficile), jamais de « lorem ».
 */
const SAMPLE: Record<string, string[]> = {
  title: ['Fini la marche', 'Le marché vient à vous', 'Trois touches pour commander', 'Le marché vient à vous, même sans smartphone', 'Marie vend sa récolte depuis la place du village', 'Douze kilomètres à pied pour acheter ses semences chaque saison', 'Je ne marche plus jusqu’au marché : la borne est à côté de chez moi, et je paie par mobile money.'],
  body: ['Payée en 24 heures, sans intermédiaire.', 'La borne parle la langue de l’exploitant et imprime un reçu.', 'Chaque saison, les exploitants perdent deux jours de travail et paient 30 % de plus.', 'Une borne tactile solaire au cœur de chaque village du Moungo, utilisable sans savoir lire, avec un reçu imprimé à chaque commande.'],
  label: ['Nouveau', 'Moungo, Cameroun', 'Exploitants servis en 2026', 'Des commandes livrées le lendemain'],
  cta: ['Commander', 'Écrire sur WhatsApp', 'Installer une borne au village'],
  figure: ['98 %', '320', '1 200', '3 200 t'],
  attribution: ['Marie Ngo', 'Marie Ngo, productrice de manioc', 'Marie Ngo, productrice de manioc à Penja'],
  items: ['Livré le lendemain', 'Payé par mobile money', 'Le dépôt prépare la commande en une heure', 'Le paiement passe par mobile money', 'Un reçu imprimé à chaque commande', 'La livraison arrive au village le lendemain'],
};
function pickSample(slot: string, max?: number): string {
  const list = SAMPLE[slot] ?? SAMPLE.title;
  const fit = list.filter((t) => !max || t.length <= max);
  return fit[fit.length - 1] ?? list[0].slice(0, max);
}
function textsForSlots(slots: Record<string, { need: string; max?: number; min?: number; maxChars?: number }>): Record<string, string> {
  const out: Record<string, string> = {};
  const keys: Record<string, string> = { title: 'headline', body: 'sub', label: 'label', cta: 'cta', figure: 'figure', attribution: 'author' };
  for (const [slot, def] of Object.entries(slots)) {
    if (slot === 'media' || slot === 'logo' || slot === 'items') continue;
    out[keys[slot] ?? slot] = pickSample(slot, def.max);
  }
  if (slots.items) {
    const n = Math.min(slots.items.max ?? 3, Math.max(slots.items.min ?? 2, 3));
    const pool = SAMPLE.items.filter((t) => !slots.items.maxChars || t.length <= slots.items.maxChars);
    for (let i = 0; i < n; i++) out[`text${i + 2}`] = pool[i % pool.length];
  }
  if (!Object.keys(out).length) out.headline = 'Les intrants à portée de main';
  return out;
}
let CAT: Awaited<ReturnType<typeof videoCatalog>> | undefined;

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

/**
 * LE CONTRASTE RÉEL ET LA TAILLE SUR TÉLÉPHONE (22/11/2026, idées de l'audit HyperFrames et d'explainroo) : le texte de
 * la scène est masqué, l'image prise, puis les pixels DERRIÈRE chaque texte sont comparés à sa couleur (WCAG) — un
 * texte sur une photo est jugé sur la photo réelle. La taille de chaque texte est ramenée à l'écran d'un téléphone
 * (390 px de large pour un format vertical ou carré, un lecteur de 854 px pour le paysage).
 */
async function audit(page: Page, key: string, compWidth: number, landscape: boolean): Promise<{ contrast: string[]; small: string[]; tiny: string[] }> {
  const boxes = (await page.evaluate(`(function (key) {
    var sec = document.getElementById(key), comp = document.getElementById('comp'), cr = comp.getBoundingClientRect();
    var out = [];
    sec.querySelectorAll('[data-fit]').forEach(function (el) {
      var r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (r.width < 2 || r.height < 2) return;
      out.push({ name: el.getAttribute('data-fit'), x: r.left - cr.left, y: r.top - cr.top, w: r.width, h: r.height, color: cs.color, size: parseFloat(cs.fontSize), text: (el.textContent || '').trim().slice(0, 24) });
      el.setAttribute('data-ge-audit', JSON.stringify(['color', '-webkit-text-fill-color', '-webkit-text-stroke', 'text-shadow'].map(function (p) { return [p, el.style.getPropertyValue(p)]; })));
      el.style.setProperty('color', 'transparent', 'important');
      el.style.setProperty('-webkit-text-fill-color', 'transparent', 'important');
      el.style.setProperty('-webkit-text-stroke', '0', 'important');
      el.style.setProperty('text-shadow', 'none', 'important');
      // Un texte peint par son fond (balayage de lumière, contour) : le fond découpé au texte est masqué lui aussi.
      if (cs.backgroundClip === 'text' || cs.webkitBackgroundClip === 'text') { el.setAttribute('data-ge-audit-bg', el.style.backgroundImage || ''); el.style.setProperty('background-image', 'none', 'important'); }
    });
    return { boxes: out, scale: cr.width / comp.offsetWidth };
  })(${JSON.stringify(key)})`)) as { boxes: Array<{ name: string; x: number; y: number; w: number; h: number; color: string; size: number; text: string }>; scale: number };
  const shot = Buffer.from(await page.screenshot({ type: 'png' }));
  await page.evaluate(`document.querySelectorAll('[data-ge-audit]').forEach(function (el) { JSON.parse(el.getAttribute('data-ge-audit')).forEach(function (kv) { el.style.removeProperty(kv[0]); if (kv[1]) el.style.setProperty(kv[0], kv[1]); }); if (el.hasAttribute('data-ge-audit-bg')) { el.style.removeProperty('background-image'); el.style.backgroundImage = el.getAttribute('data-ge-audit-bg'); el.removeAttribute('data-ge-audit-bg'); } el.removeAttribute('data-ge-audit'); })`);
  const img = sharp(shot);
  const meta = await img.metadata();
  const raw = await img.removeAlpha().raw().toBuffer();
  const W = meta.width || 1;
  const H = meta.height || 1;
  const lum = (r: number, g: number, b: number) => {
    const c = [r, g, b].map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const contrast: string[] = [];
  const small: string[] = [];
  const tiny: string[] = [];
  const phone = landscape ? 854 : 390;
  for (const b of boxes.boxes) {
    const m = /rgba?\(([^)]+)\)/.exec(b.color);
    if (!m) continue;
    const [r, g, bl] = m[1].split(/[\s,\/]+/).map(Number);
    const fg = lum(r, g, bl);
    const ratios: number[] = [];
    const x0 = Math.max(0, Math.floor(b.x)), y0 = Math.max(0, Math.floor(b.y)), x1 = Math.min(W, Math.ceil(b.x + b.w)), y1 = Math.min(H, Math.ceil(b.y + b.h));
    for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
      const k = (y * W + x) * 3;
      const bg = lum(raw[k], raw[k + 1], raw[k + 2]);
      ratios.push((Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05));
    }
    if (!ratios.length) continue;
    ratios.sort((a, c) => a - c);
    // Le dixième le moins contrasté du fond (un texte doit se lire sur sa partie la plus difficile, pas en moyenne).
    const worst = ratios[Math.floor(ratios.length * 0.1)];
    if (worst < 2.4) contrast.push(`${b.name} « ${b.text} » contraste ${worst.toFixed(2)}:1`);
    const onPhone = (b.size * phone) / compWidth;
    if (onPhone < 9) tiny.push(`${b.name} « ${b.text} » ${onPhone.toFixed(1)} px sur téléphone`);
    else if (onPhone < 12) small.push(`${b.name} ${onPhone.toFixed(1)} px`);
  }
  return { contrast, small, tiny };
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  // 1. Le chargement
  resetVideoCatalog();
  const cat = await videoCatalog();
  CAT = cat;
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
  const anim = (id: string, extra: Record<string, unknown>) => ({ node: { id, version: 1, medium: 'video', kind: 'animation', doc: { title: 'x', summary: 'y' }, targets: ['text'], split: 'none', steps: { in: [{ fx: 'sweep', duration: 0.5 }] }, ...extra } });
  const fxBad = buildVideoCatalog(
    [
      anim('anim.fx-unknown', { steps: { in: [{ fx: 'explode', duration: 0.5 }] } }),
      anim('anim.fx-block', { targets: ['text', 'block'] }),
      anim('anim.fx-split', { steps: { in: [{ fx: 'type', duration: 0.5 }] } }),
      anim('anim.fx-opts', { steps: { in: [{ fx: 'sweep', opts: { amp: 3 }, duration: 0.5 }] } }),
      anim('anim.fx-ok', {}),
    ] as never,
    'test',
    'dir'
  );
  check(['anim.fx-unknown', 'anim.fx-block', 'anim.fx-split', 'anim.fx-opts'].every((id) => fxBad.rejected.some((r) => r.id === id)) && fxBad.nodes.has('anim.fx-ok'), 'effets de texte : inconnu, hors texte, mauvais découpage et réglage inconnu écartés ; un effet valide accepté', fxBad.rejected.map((r) => `${r.id}: ${r.reason}`).join(' | '));
  const TWENTY = ['anim.mask-rise', 'anim.word-stagger', 'anim.blur-in', 'anim.typewriter', 'anim.count-up', 'anim.tracking-expand', 'anim.letter-settle', 'anim.letter-flip', 'anim.marker', 'anim.outline-fill', 'anim.rotate-word', 'anim.squiggle-underline', 'anim.wave', 'anim.strike', 'anim.zoom-punch', 'anim.scramble', 'anim.light-sweep', 'anim.glitch', 'anim.extrude', 'anim.split-halves'];
  const textAnims = [...cat.nodes.values()].filter((n) => n.kind === 'animation' && !n.id.startsWith('builtin.') && n.targets.includes('text')).map((n) => n.id);
  const tiers = new Map<string, number>();
  for (const id of TWENTY) { const t = cat.nodes.get(id)?.tier ?? '?'; tiers.set(t, (tiers.get(t) ?? 0) + 1); }
  // 23/11/2026 (catalogue ×4) : les vingt animations GSAP du 18/11 restent, cinq par gamme ; d'autres animations de texte
  // (même moteur GSAP, mêmes règles : ni rebond ni élastique) s'y ajoutent, chacune rangée dans une gamme.
  const allTiers = new Map<string, number>();
  for (const id of textAnims) { const t = cat.nodes.get(id)?.tier ?? '?'; allTiers.set(t, (allTiers.get(t) ?? 0) + 1); }
  check(TWENTY.every((id) => cat.nodes.get(id)?.kind === 'animation') && ['low', 'medium', 'high', 'ultra'].every((t) => tiers.get(t) === 5) && !allTiers.has('?') && ['low', 'medium', 'high', 'ultra'].every((t) => (allTiers.get(t) ?? 0) >= 8), 'animations de texte : les vingt animations GSAP (cinq par gamme) et les neuves, chacune dans une gamme (8 au moins par gamme)', `texte : ${textAnims.length} · gammes ${[...allTiers].map(([t, n]) => `${t}=${n}`).join(' ')}`);
  const anyTheme = [...cat.nodes.values()].find((n) => n.kind === 'theme' && !n.id.startsWith('builtin.')) as ThemeNode;
  const strikeIn = (role: string) => animationFor(cat, anyTheme, { layout: 'x', animations: { title: 'anim.strike' } }, 'title', 'Des carnets perdus', role);
  const legacy = animationFor(cat, anyTheme, { layout: 'x', animations: { title: 'anim.mask-lines' as never } }, 'title', 'Un titre');
  check(strikeIn('problem') === 'anim.strike' && strikeIn('hook') !== 'anim.strike' && legacy === 'anim.mask-rise', 'rature réservée à la scène « problème » ; un film d’avant (anim.mask-lines) retrouve anim.mask-rise', `problem=${strikeIn('problem')} hook=${strikeIn('hook')} legacy=${legacy}`);

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
  const allScenes = filmScenes;
  const calls: string[] = [];
  const base = { scenes: filmScenes, film: { title: 'AgriLink', concept: 'Les intrants à portée de main', style: 'corporate', seed: 'check' }, brand: { name: BRAND.name, hasLogo: true, line: 'AgriLink · agriculture' }, formats: ['story'] as FilmFormatId[] };
  // 22/11/2026 : par défaut, le CODE choisit (0 jeton) à tous les crans ; `VIDEO_CATALOG_CHOOSER=model` rétablit l'appel.
  const byCode = await composeFilmFromCatalog({ ...base, level: 'medium', call: { level: 'medium', call: async ({ role }) => (calls.push(role), '') } });
  check(calls.length === 0 && byCode.trace.source === 'code' && byCode.scenes.length === filmScenes.length, 'choix : par défaut le code choisit tout le film, AUCUN appel de modèle', `${calls.length} appel(s)`);
  process.env.VIDEO_CATALOG_CHOOSER = 'model';
  const low = await composeFilmFromCatalog({ ...base, level: 'low', call: { level: 'low', call: async ({ role }) => (calls.push(role), '') } });
  // 18/11/2026 : le cran ne règle plus la profondeur du choix (il choisit la gamme des gabarits) — Low fait le même
  // appel que les autres ; une réponse vide laisse le choix du code, et le film est entier.
  check(calls.length === 1 && calls[0] === 'video.template' && low.trace.source === 'code' && low.scenes.length === filmScenes.length, 'choix (modèle rétabli) : au cran Low, le même appel unique ; réponse vide → choix du code, film entier', `${calls.length} appel(s)`);
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
  delete process.env.VIDEO_CATALOG_CHOOSER;

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
  const baseAll = base;
  const allConfigs = configs;
  const problems: string[] = [];
  const contrastIssues: string[] = [];
  const tinyIssues: string[] = [];
  let smallCount = 0;
  let textCount = 0;
  let renders = 0;
  let identical = true;
  const coveredGabarits = new Set<string>();
  // Le catalogue ×4 (23/11/2026) : chaque thème rend une PART tournante des gabarits (chaque gabarit passe sous
  // ROT thèmes différents, sur les quatre formats) — sinon 80 gabarits × 40 thèmes × 4 formats prendraient des heures.
  const ROT = Math.max(1, Math.ceil((picked.length * 2) / 10));
  for (const [ti, theme] of picked.entries()) {
    const mine = allConfigs.map((c, gi) => ({ c, gi })).filter(({ gi }) => picked.length <= 10 || (gi + ti) % Math.ceil(picked.length / ROT) === 0);
    const filmScenes = mine.map(({ gi }) => allScenes[gi]);
    const configsT = mine.map(({ c }) => c);
    const base = { ...baseAll, scenes: filmScenes };
    const configs = configsT;
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
        coveredGabarits.add(configs[i].gabarit ?? '');
        const a = await audit(page, s.key, size.width, format === 'landscape');
        for (const c of a.contrast) contrastIssues.push(`${theme.id}/${format}/${configs[i].gabarit} : ${c}`);
        for (const c of a.tiny) tinyIssues.push(`${theme.id}/${format}/${configs[i].gabarit} : ${c}`);
        smallCount += a.small.length;
        textCount += 1;
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
  // 4b. Les SÉQUENCES, la TRAVERSÉE et les DÉVELOPPEMENTS (22/11/2026), rendus et mesurés dans Chrome.
  const sequences = [...cat.nodes.values()].filter((n): n is SequenceNode => n.kind === 'sequence');
  const develops = [...cat.nodes.values()].filter((n): n is DevelopNode => n.kind === 'develop');
  check(sequences.length >= 6 && develops.length >= 6, 'séquences et développements : le dépôt en sert au moins six de chaque', `${sequences.length} séquences, ${develops.length} développements`);
  const seqProblems: string[] = [];
  const theme0 = themes[0];
  for (const seq of sequences) {
    for (const format of formats) {
      const scenes: CatalogScene[] = seq.scenes.map((st, k) => {
        const s = sceneFor({ roles: [st.roles[0]], config: { layout: st.layout } } as unknown as GabaritNode, `q${k + 1}`, 3.6);
        // Le même média des deux côtés d'une coupe portée : la continuité qu'on veut vérifier.
        return { ...s, media: /media|figure-media/.test(st.layout) ? [{ id: 'photo', kind: 'image' as const }] : [] };
      });
      const configs = seq.scenes.map((st, k): SceneConfig => ({ layout: st.layout, animations: { ...(st.animations ?? {}) }, sequence: seq.id, step: k, ...(st.carry ? { carry: st.carry } : {}), ...(st.develop ? { develop: st.develop } : {}) }));
      const assembled = assembleFilm(cat, { ...base, scenes, formats: [format] }, theme0, configs);
      const carried = assembled.map((a) => a.quality?.carry);
      if (!carried.some(Boolean)) seqProblems.push(`${seq.id}/${format} : aucune traversée posée`);
      let start = 0;
      const film = assembled.map((a, i) => {
        const s = { key: a.key, start, duration: scenes[i].duration, html: a.html, script: a.script, animation: 'gsap' as const, texts: scenes[i].texts };
        start += scenes[i].duration;
        return s;
      });
      const size = COMPOSITION[format];
      const html = await buildComposition({ scenes: film, width: size.width, height: size.height, output: { width: Math.round(size.width / 2), height: Math.round(size.height / 2) }, durationSec: start, brand: { ...BRAND, logo: { light: 'logo.png', width: 480, height: 120 } } as never, media: { photo: { src: 'photo.jpg', kind: 'image' } }, logo: 'logo.png', fontCss: '', mode: 'render' });
      const errs = await openComposition(page, html, files, { width: Math.round(size.width / 2), height: Math.round(size.height / 2) });
      const sceneErrors = (await page.evaluate('window.__sceneErrors || []')) as unknown[];
      if (errs.length || sceneErrors.length) seqProblems.push(`${seq.id}/${format} : erreurs ${JSON.stringify([...errs, ...sceneErrors]).slice(0, 200)}`);
      for (const [i, a] of assembled.entries()) {
        const role = a.quality?.carry;
        if (!role) continue;
        const spec = JSON.parse(a.script.replace(/^__ge\.scene\(tl, root, D, /, '').replace(/\);$/, '')) as RuntimeScene;
        // Juste avant la coupe (scène d'avant) et juste après (celle-ci) : l'élément porté est au même endroit, à la
        // même taille ; une fois glissé, il est à sa place, sans reste de déplacement.
        const at = (t: number, key: string) => page.evaluate(`(function () {
          window.__timelines.film.seek(${t}, false);
          document.querySelectorAll('section.scene').forEach(function (el) { el.style.visibility = el.id === ${JSON.stringify(key)} ? 'visible' : 'hidden'; });
          var sec = document.getElementById(${JSON.stringify(key)}), el = sec.querySelector('[data-v="${role}"]'), r = el.getBoundingClientRect(), k = r.width / Math.max(1, el.offsetWidth * (r.width / Math.max(1, el.getBoundingClientRect().width)));
          // La place de l'élément dans la mise en page (sans transformation), en px de l'écran.
          var x = 0, y = 0; for (var e = el; e && e !== sec; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; }
          var s = document.getElementById('comp').getBoundingClientRect().width / document.getElementById('comp').offsetWidth, c = document.getElementById('comp').getBoundingClientRect();
          // Le point d'ancrage d'un texte ou d'un logo : là où il est aligné (sa boîte peut couvrir toute la largeur).
          var al = getComputedStyle(el).textAlign, f = '${role}' === 'media' ? 0.5 : al === 'center' ? 0.5 : al === 'right' || al === 'end' ? 1 : 0;
          return { x: r.left + r.width * f, y: r.top + r.height / 2, w: r.width, h: r.height, homeX: c.left + (x + el.offsetWidth * f) * s, homeY: c.top + (y + el.offsetHeight / 2) * s };
        })()`) as Promise<{ x: number; y: number; w: number; h: number; homeX: number; homeY: number }>;
        const cut = film[i].start;
        const before = await at(cut - 0.02, film[i - 1].key);
        const after = await at(cut + 0.001, film[i].key);
        const settled = await at(cut + (spec.carry?.duration ?? 0.6) + 0.1, film[i].key);
        const side = Math.min(size.width, size.height) / 2;
        const gap = Math.max(Math.abs(before.x - after.x), Math.abs(before.y - after.y), Math.abs(before.w - after.w) * (role === 'media' ? 1 : 0), Math.abs(before.h - after.h)) / side;
        if (gap > 0.03) seqProblems.push(`${seq.id}/${format} : ${role} saute à la coupe (${(gap * 100).toFixed(1)} % du côté) ${JSON.stringify({ before, after })}`);
        const home = Math.max(Math.abs(settled.x - settled.homeX), Math.abs(settled.y - settled.homeY)) / side;
        if (home > 0.01) seqProblems.push(`${seq.id}/${format} : ${role} pas revenu à sa place (${(home * 100).toFixed(1)} %)`);
      }
      // Les mesures habituelles, scène par scène, une fois tout posé.
      for (const [i, s] of film.entries()) {
        const t = s.start + s.duration - 0.35;
        const found = (await page.evaluate(`${MEASURE}(${JSON.stringify(s.key)}, ${t}, ${JSON.stringify(Object.values(scenes[i].texts))})`)) as string[];
        for (const f of found) seqProblems.push(`${seq.id}/${format}/${s.key} : ${f}`);
      }
      await page.screenshot({ type: 'jpeg', quality: 70 }).then((b) => fs.writeFileSync(path.join(OUT, `${seq.id}-${format}.jpg`), b));
    }
  }
  check(seqProblems.length === 0, `séquences : ${sequences.length} séquences × ${formats.length} formats rendues — l'élément porté part de sa place d'avant (≤ 3 %), revient à la sienne, textes tenus et visibles`, seqProblems.slice(0, 20).join('\n    '));

  // 4c. Les PRIMITIVES du registre HyperFrames (HeyGen, Apache-2.0 ; source figé, empreinte vérifiée) : chacune montée
  // dans sa scène IDEM, sur les quatre formats — aucune erreur, sa timeline enregistrée, tous les textes présents.
  const primitives = [...cat.nodes.values()].filter((n): n is PrimitiveNode => n.kind === 'primitive');
  check(primitives.length >= 7, 'primitives : les composants de la liste blanche HyperFrames sont chargés (empreinte vérifiée)', primitives.map((p) => p.id).join(', '));
  const PRIM_TEXTS: Record<string, Record<string, string>> = {
    'hf.cta-close': { headline: 'Équipez votre village', cta: 'Écrire sur WhatsApp' },
    'hf.cta-lockup': { headline: 'Équipez votre village', cta: 'Écrire sur WhatsApp', sub: 'Installation offerte cette saison' },
    'hf.per-word-rise': { headline: 'Le marché vient à vous', sub: 'Une borne tactile au cœur de chaque village.' },
    'hf.count-up': { figure: '320', label: 'Coopératives équipées', headline: 'Une croissance continue' },
    'hf.conic-progress-ring': { figure: '98 %', label: 'Des commandes livrées le lendemain' },
    'hf.browser-device-stage': { headline: 'Commander en trois touches', sub: 'Le tableau de bord de la coopérative.' },
    'hf.device-frame-stage': { headline: 'L’application des exploitants', sub: 'Commander depuis son téléphone.' },
  };
  const primProblems: string[] = [];
  for (const p of primitives) {
    for (const format of formats) {
      const texts = PRIM_TEXTS[p.id] ?? { headline: 'Une scène' };
      const scene: CatalogScene = { key: 'p1', duration: 4.5, texts, media: p.slots.media ? [{ id: 'photo', kind: 'image' }] : [], role: p.roles[0] as never, energy: 3 };
      const [a] = assembleFilm(cat, { ...base, scenes: [scene], formats: [format] }, theme0, [{ layout: p.id, animations: {} }]);
      const size = COMPOSITION[format];
      const html = await buildComposition({ scenes: [{ key: 'p1', start: 0, duration: 4.5, html: a.html, script: a.script, animation: 'gsap', texts }], width: size.width, height: size.height, output: { width: Math.round(size.width / 2), height: Math.round(size.height / 2) }, durationSec: 4.5, brand: { ...BRAND, logo: { light: 'logo.png', width: 480, height: 120 } } as never, media: { photo: { src: 'photo.jpg', kind: 'image' } }, logo: 'logo.png', fontCss: '', mode: 'render' });
      const errs = await openComposition(page, html, files, { width: Math.round(size.width / 2), height: Math.round(size.height / 2) });
      const sceneErrors = (await page.evaluate('window.__sceneErrors || []')) as unknown[];
      if (errs.length || sceneErrors.length) primProblems.push(`${p.id}/${format} : erreurs ${JSON.stringify([...errs, ...sceneErrors]).slice(0, 240)}`);
      await page.evaluate('(function(){var tl=window.__timelines.film;tl.pause();tl.progress(0.9);})()');
      const shown = (await page.evaluate(`(document.getElementById('p1').textContent || '').replace(/\\s+/g, '')`)) as string;
      for (const t of Object.values(texts)) if (!shown.includes(t.replace(/\s+/g, '')) && !(p.id === 'hf.conic-progress-ring' && t === '98 %' && shown.includes('98'))) primProblems.push(`${p.id}/${format} : texte absent « ${t} »`);
      const found = (await page.evaluate(`${MEASURE}("p1", 4.0, [])`)) as string[];
      for (const f of found) primProblems.push(`${p.id}/${format} : ${f}`);
      await page.screenshot({ type: 'jpeg', quality: 70 }).then((b) => fs.writeFileSync(path.join(OUT, `${p.id}-${format}.jpg`), b));
    }
  }
  check(primProblems.length === 0, `primitives : ${primitives.length} composants × ${formats.length} formats montés dans leur scène — aucune erreur, timeline enregistrée, textes présents et tenus`, primProblems.slice(0, 20).join('\n    '));

  // LA SIGNATURE DESSINÉE : un logo SVG (assaini) est posé dans la page de fin et se trace, puis se remplit.
  {
    const { sanitizeLogoSvg } = await import('../src/video/rendering/logo-svg');
    const dirty = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="480" height="120" viewBox="0 0 480 120" onload="alert(1)"><script>alert(2)</script><circle cx="60" cy="60" r="46" fill="#1b7a5a"/><path d="M130 30 L130 90 L200 90" fill="none" stroke="#14211c" stroke-width="10"/><image href="https://x.test/a.png"/></svg>';
    const clean = sanitizeLogoSvg(dirty) ?? '';
    check(!!clean && !/script|onload|image|https?:\/\/(?!www\.w3\.org\/)/.test(clean) && /<circle/.test(clean), 'logo SVG assaini : ni script, ni gestionnaire, ni image ou adresse étrangère ; les formes gardées', clean.slice(0, 160));
    const g = gabarits.find((x) => x.config.layout === 'vlayout.logo-sting')!;
    const scene: CatalogScene = { key: 'l1', duration: 3.5, texts: { headline: 'Les intrants à portée de main' }, media: [], role: 'signature', energy: 2 };
    const [a] = assembleFilm(cat, { ...base, scenes: [scene], formats: ['square'] }, theme0, [{ layout: g.config.layout, animations: { ...g.config.animations } }]);
    const size = COMPOSITION.square;
    const html = await buildComposition({ scenes: [{ key: 'l1', start: 0, duration: 3.5, html: a.html, script: a.script, animation: 'gsap', texts: scene.texts }], width: size.width, height: size.height, output: { width: 540, height: 540 }, durationSec: 3.5, brand: { ...BRAND, logo: { light: 'logo.png', width: 480, height: 120 } } as never, media: {}, logo: 'logo.png', logoSvg: clean, fontCss: '', mode: 'render' });
    await openComposition(page, html, files, { width: 540, height: 540 });
    const at = (p: number) => page.evaluate(`(function(){var tl=window.__timelines.film;tl.pause();tl.progress(${p});var sh=document.querySelector('#l1 [data-v="logo"] svg path');return sh?{off:parseFloat(sh.getAttribute('stroke-dashoffset')||'0'),fill:parseFloat(getComputedStyle(document.querySelector('#l1 [data-v="logo"] svg circle')).fillOpacity)}:null;})()`) as Promise<{ off: number; fill: number } | null>;
    const mid = await at(0.18);
    const end = await at(0.98);
    check(!!mid && !!end && mid.off > 1 && end.off < 0.5 && end.fill > 0.95, 'signature dessinée : le logo se trace (trait en cours à mi-chemin) puis se remplit', JSON.stringify({ mid, end }));
  }

  // La RETOUCHE POINTÉE : dans l'aperçu, une zone tracée sur le titre revient avec la scène, l'instant et le titre ;
  // le corps de retouche garde l'endroit (assaini) et la ligne du modèle le dit en clair.
  {
    const g = gabarits.find((x) => x.config.layout === 'vlayout.logo-sting')!;
    const scene: CatalogScene = { key: 'k1', duration: 3.5, texts: { headline: 'Les intrants à portée de main' }, media: [], role: 'signature', energy: 2 };
    const [a] = assembleFilm(cat, { ...base, scenes: [scene], formats: ['square'] }, theme0, [{ layout: g.config.layout, animations: { ...g.config.animations } }]);
    const size = COMPOSITION.square;
    const html = await buildComposition({ scenes: [{ key: 'k1', start: 0, duration: 3.5, html: a.html, script: a.script, animation: 'gsap', texts: scene.texts }], width: size.width, height: size.height, output: { width: 540, height: 540 }, durationSec: 3.5, brand: { ...BRAND, logo: { light: 'logo.png', width: 480, height: 120 } } as never, media: {}, logo: 'logo.png', fontCss: '', mode: 'preview' });
    await openComposition(page, html, files, { width: 540, height: 540 });
    const picked = (await page.evaluate(`new Promise(function (done) {
      setTimeout(function () {
        window.addEventListener('message', function (e) { if (e.data && e.data.type === 'ivision:picked') done(e.data); });
        window.__timelines.film.pause(2.6);
        var el = document.querySelector('#k1 [data-v="title"]'), r = el.getBoundingClientRect();
        window.postMessage({ type: 'ivision:pick', x: r.left / innerWidth, y: r.top / innerHeight, w: r.width / innerWidth, h: r.height / innerHeight }, '*');
      }, 400);
      setTimeout(function () { done(null); }, 4000);
    })`)) as { key: string; at: number; roles: string[]; texts: string[]; zone: { w: number } } | null;
    check(!!picked && picked.key === 'k1' && picked.roles[0] === 'title' && picked.texts.some((t) => t.includes('intrants')) && Math.abs(picked.at - 2.6) < 0.05, 'retouche pointée : la zone tracée sur le titre revient avec sa scène, son instant et son texte', JSON.stringify(picked));
    const { sanitizeVideoPatch } = await import('../src/video/motionVideo.service');
    const { pointLine } = await import('../src/video/catalog/choose');
    const patch = sanitizeVideoPatch({ visual: { k1: 'plus gros' }, points: { k1: { at: 2.6, zone: { x: 0.1, y: 0.05, w: 0.8, h: 2 }, roles: ['title', 'DROP TABLE', 'media'], texts: ['Les intrants   à portée'] }, 'bad key!': { zone: {} } } });
    const p = patch.points?.k1;
    check(!!p && p.zone.h === 1 && p.roles.join() === 'title,media' && p.texts?.[0] === 'Les intrants à portée' && Object.keys(patch.points!).length === 1, 'retouche pointée : endroit assaini (zone bornée, rôles et clés filtrés, textes nettoyés)', JSON.stringify(patch.points));
    const line = pointLine(p);
    check(/at 2\.6 s into the scene, most of the frame, on: title, media/.test(line), 'retouche pointée : la ligne du modèle dit l’instant, la zone et les éléments', line);
  }

  // La liste qui se RESSERRE : les éléments arrivent de plus en plus vite (écarts décroissants), mesuré dans la page.
  {
    const g = gabarits.find((x) => x.config.layout === 'vlayout.problem-list' || x.config.layout === 'vlayout.list-steps')!;
    const scene = sceneFor(g, 'l1', 4.5);
    const [a] = assembleFilm(cat, { ...base, scenes: [scene], formats: ['story'] }, theme0, [{ layout: g.config.layout, animations: { ...g.config.animations } }]);
    const size = COMPOSITION.story;
    const html = await buildComposition({ scenes: [{ key: 'l1', start: 0, duration: 4.5, html: a.html, script: a.script, animation: 'gsap', texts: scene.texts }], width: size.width, height: size.height, output: { width: 540, height: 960 }, durationSec: 4.5, brand: { ...BRAND, logo: { light: 'logo.png', width: 480, height: 120 } } as never, media: {}, logo: 'logo.png', fontCss: '', mode: 'render' });
    await openComposition(page, html, files, { width: 540, height: 960 });
    const firsts = (await page.evaluate(`(function () {
      var spec = ${a.script.replace(/^__ge\.scene\(tl, root, D, /, '').replace(/\);$/, '')};
      var r = spec.roles.find(function (x) { return x.role === 'items'; });
      var items = Array.prototype.slice.call(document.querySelectorAll(r.sel)), seen = items.map(function () { return null; });
      for (var t = 0; t <= 4.5; t += 0.02) {
        window.__timelines.film.seek(t, false);
        items.forEach(function (el, i) { if (seen[i] === null && parseFloat(getComputedStyle(el).opacity) > 0.5) seen[i] = t; });
      }
      return seen;
    })()`)) as Array<number | null>;
    const gaps = firsts.slice(1).map((t, i) => (t ?? 0) - (firsts[i] ?? 0));
    check(firsts.every((t) => t !== null) && gaps.length >= 2 && gaps[gaps.length - 1] < gaps[0] - 0.01, 'répétition resserrée : les éléments de la liste arrivent de plus en plus vite (écarts décroissants)', `instants ${JSON.stringify(firsts.map((t) => t?.toFixed(2)))}`);
  }

  // Le TEMPS MORT, borné par le code : sur le film des gabarits, toute scène qui avait du temps libre a reçu un
  // développement, et aucune ne reste plus de IDLE_MAX secondes sans mouvement utile après sa lecture.
  {
    const longScenes = filmScenes.map((s) => ({ ...s, duration: 5.5 }));
    process.env.VIDEO_DEVELOP = 'off';
    const flat = assembleFilm(cat, { ...base, scenes: longScenes, formats: ['story'] }, theme0, configs);
    delete process.env.VIDEO_DEVELOP;
    const film = assembleFilm(cat, { ...base, scenes: longScenes, formats: ['story'] }, theme0, configs);
    const idle = film.map((s) => s.quality?.idle ?? 0);
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    const before = sum(flat.map((s) => s.quality?.idle ?? 0));
    const developed = film.filter((s) => s.quality?.develop).length;
    const free = film.filter((s) => (s.quality?.free ?? 0) >= DEVELOP_FREE_MIN).length;
    check(developed >= Math.ceil(free * 0.7) && sum(idle) <= before * 0.7 && idle.every((x) => x <= IDLE_MAX + 0.3), `temps mort : ${developed}/${free} scènes à temps libre développées ; temps mort total ${before.toFixed(1)} s → ${sum(idle).toFixed(1)} s (−30 % au moins), ≤ ${IDLE_MAX + 0.3} s par scène`, `temps morts ${JSON.stringify(idle)} · ${film.map((s) => (s.quality?.develops ?? ['-']).join('+')).join(', ')}`);
    check(film.every((s, i) => !i || !s.quality?.develop || s.quality.develop !== film[i - 1].quality?.develop), 'développements : jamais le même deux scènes de suite');
  }

  // Le film entier par le CODE : un film réaliste reçoit au moins une séquence, aucun appel.
  {
    const realistic: CatalogScene[] = [
      { key: 'r1', duration: 3.4, role: 'hook', energy: 4, texts: { headline: 'Marie vend sa récolte depuis la place du village', sub: 'Payée en 24 heures, sans intermédiaire.' }, media: [{ id: 'photo', kind: 'image' }] },
      { key: 'r2', duration: 3.6, role: 'feature', energy: 3, texts: { headline: 'Trois touches pour commander ses intrants', sub: 'La borne parle la langue de l’exploitant.' }, media: [{ id: 'photo', kind: 'image' }] },
      { key: 'r3', duration: 3.2, role: 'proof', energy: 4, texts: { figure: '1 200', label: 'Exploitants servis en 2026' }, media: [] },
      { key: 'r4', duration: 3.4, role: 'cta', energy: 4, texts: { headline: 'Installez une borne dans votre village', cta: 'Écrire sur WhatsApp' }, media: [] },
      { key: 'r5', duration: 2.6, role: 'signature', energy: 2, texts: { headline: 'Les intrants à portée de main' }, media: [] },
    ];
    const n0 = calls.length;
    const real = await composeFilmFromCatalog({ ...base, scenes: realistic, level: 'medium', call: { level: 'medium', call: async ({ role }) => (calls.push(role), '') } });
    check(calls.length === n0 && real.scenes.some((s) => s.config.sequence) && real.scenes.some((s) => s.quality?.carry), 'film réaliste : séquences posées par le code (au moins une traversée), aucun appel', real.trace.detail);
    const m = real.metrics!;
    check(!!m && m.continuity >= 0.25 && m.simultaneous <= 3 && m.subject >= 0.5, `mesures du film : continuité ${m?.continuity} (≥ 0,25), au plus ${m?.simultaneous} entrées simultanées (≤ 3), sujet à l'écran ${Math.round((m?.subject ?? 0) * 100)} % (≥ 50 %), cadence ${m?.cadence}`, JSON.stringify(m));
  }

  // LA VOIX D'ABORD : le titre entre quand la voix dit son premier mot porteur, chaque élément d'une liste quand elle le cite.
  {
    const g = gabarits.find((x) => x.config.layout === 'vlayout.problem-list')!;
    const scene: CatalogScene = {
      ...sceneFor(g, 'v1', 7),
      spoken: ['Chaque', 'saison', 'trois', 'obstacles', 'reviennent', 'le', 'dépôt', 'est', 'loin', 'les', 'prix', 'changent', 'et', 'aucun', 'reçu'].map((text, k) => ({ text, t: 0.3 + k * 0.4 })),
    };
    const [a] = assembleFilm(cat, { ...base, scenes: [scene], formats: ['story'] }, theme0, [{ layout: g.config.layout, animations: { ...g.config.animations } }]);
    const spec = JSON.parse(a.script.replace(/^__ge\.scene\(tl, root, D, /, '').replace(/\);$/, '')) as RuntimeScene;
    const title = spec.roles.find((r) => r.role === 'title')!;
    const items = spec.roles.find((r) => r.role === 'items')!;
    // « Trois obstacles à chaque saison » : « Chaque » est dit à 0,3 s ; « dépôt » 2,7 s ; « prix » 4,3 s ; « aucun » 5,5 s.
    check(Math.abs(title.at - 0.18) < 0.03 && JSON.stringify(items.cues) === JSON.stringify([2.58, 4.18, 5.38]), 'voix d’abord : le titre entre sur son mot, chaque élément de la liste quand la voix le cite', JSON.stringify({ title: title.at, cues: items.cues }));
  }

  // LA CAMÉRA (adaptée d'explainroo) : une scène construite au fil de la voix s'ouvre serrée sur le premier élément,
  // s'élargit quand les suivants arrivent, et revient au plan large avant la coupe — rien de visible n'est coupé.
  {
    const g = gabarits.find((x) => x.config.layout === 'vlayout.big-figure')!;
    const scene: CatalogScene = { key: 'c1', duration: 6, role: 'proof', energy: 3, media: [], texts: { figure: '1 200', label: 'Exploitants servis en 2026', headline: 'Une croissance mois après mois' }, spoken: ['Mille', 'deux', 'cents', 'exploitants', 'servis', 'cette', 'année', 'et', 'une', 'croissance', 'continue'].map((text, k) => ({ text, t: 0.3 + k * 0.48 })) };
    // Un thème posé (un thème audacieux agrandit le chiffre à toute la largeur : aucun plan plus serré n'existe alors).
    const calmTheme = (cat.nodes.get('theme.editorial-calm') as ThemeNode) ?? theme0;
    const [a] = assembleFilm(cat, { ...base, scenes: [scene], formats: ['story'] }, calmTheme, [{ layout: g.config.layout, animations: {} }]);
    const size = COMPOSITION.story;
    const html = await buildComposition({ scenes: [{ key: 'c1', start: 0, duration: 6, html: a.html, script: a.script, animation: 'gsap', texts: scene.texts }], width: size.width, height: size.height, output: { width: 540, height: 960 }, durationSec: 6, brand: { ...BRAND, logo: { light: 'logo.png', width: 480, height: 120 } } as never, media: {}, logo: 'logo.png', fontCss: '', mode: 'render' });
    await openComposition(page, html, files, { width: 540, height: 960 });
    const cams = (await page.evaluate('window.__ge.cameras || []')) as Array<{ shots: Array<{ at: number; z: number }> }>;
    const shots = cams[0]?.shots ?? [];
    const found = (await page.evaluate(`${MEASURE}("c1", 5.8, ${JSON.stringify(Object.values(scene.texts))})`)) as string[];
    check(shots.length >= 2 && shots[0].z > 1.05 && shots[shots.length - 1].z === 1 && shots[shots.length - 1].at <= 5.4 && found.length === 0, 'caméra : ouverture serrée sur le premier élément, élargie au fil des entrées, plan large avant la coupe, rien de coupé', JSON.stringify({ shots, found }));
  }

  // 4d. Les DÉCORS (23/11/2026) : formes animées, objets 3D, illustrations qui se tracent, motifs, cadres de bord. Chacun
  // posé dans une scène réelle sur les quatre formats : aucune erreur, les textes tiennent et SE LISENT (contraste mesuré
  // sur l'image, décor compris), un décor de bord reste hors de la zone sûre, un trait qui se dessine finit tracé.
  const decors = [...cat.nodes.values()].filter((n): n is DecorNode => n.kind === 'decor');
  check(decors.length >= 40, 'décors : le dépôt en sert au moins quarante', `${decors.length} décors`);
  const decorProblems: string[] = [];
  const decorContrast: string[] = [];
  const decorTheme = (cat.nodes.get('theme.editorial-calm') as ThemeNode) ?? theme0;
  for (const d of decors) {
    for (const format of formats) {
      const withMedia = d.media === 'with';
      const layout = withMedia ? 'vlayout.media-full-caption' : 'vlayout.title-center';
      const texts = withMedia ? { headline: 'Marie vend sa récolte depuis la place du village', sub: 'Payée en 24 heures, sans intermédiaire.' } : { headline: 'Le marché vient à vous, même sans smartphone', sub: 'Une borne tactile au cœur de chaque village du Moungo.' };
      const role = d.sceneRoles?.[0] ?? (withMedia ? 'feature' : 'hook');
      const scene: CatalogScene = { key: 'd1', duration: 4.2, texts, media: withMedia ? [{ id: 'photo', kind: 'image' }] : [], role, energy: 3 };
      const [a] = assembleFilm(cat, { ...base, scenes: [scene], formats: [format] }, decorTheme, [{ layout, animations: {}, decor: d.id }]);
      if (!a.html.includes(`data-ge-decor="${d.place}"`)) { decorProblems.push(`${d.id}/${format} : décor absent de la scène`); continue; }
      const size = COMPOSITION[format];
      const html = await buildComposition({ scenes: [{ key: 'd1', start: 0, duration: 4.2, html: a.html, script: a.script, animation: 'gsap', texts }], width: size.width, height: size.height, output: { width: Math.round(size.width / 2), height: Math.round(size.height / 2) }, durationSec: 4.2, brand: { ...BRAND, logo: { light: 'logo.png', width: 480, height: 120 } } as never, media: { photo: { src: 'photo.jpg', kind: 'image' } }, logo: 'logo.png', fontCss: '', mode: 'render' });
      const errs = await openComposition(page, html, files, { width: Math.round(size.width / 2), height: Math.round(size.height / 2) });
      const sceneErrors = (await page.evaluate('window.__sceneErrors || []')) as unknown[];
      if (errs.length || sceneErrors.length) decorProblems.push(`${d.id}/${format} : erreurs ${JSON.stringify([...errs, ...sceneErrors]).slice(0, 200)}`);
      const found = (await page.evaluate(`${MEASURE}("d1", 3.9, ${JSON.stringify(Object.values(texts))})`)) as string[];
      for (const f of found) decorProblems.push(`${d.id}/${format} : ${f}`);
      const probe = (await page.evaluate(`(function () {
        window.__timelines.film.seek(3.9, false);
        var sec = document.getElementById('d1'), deco = sec.querySelector('[data-ge-decor]'), safe = sec.querySelector('[data-safe]').getBoundingClientRect();
        var out = { inside: 0, undrawn: 0, visible: 0 };
        Array.prototype.forEach.call(deco.querySelectorAll('*'), function (el) {
          if (el.children.length && el.tagName.toLowerCase() !== 'svg' && el.tagName.toLowerCase() !== 'g') return;
          var r = el.getBoundingClientRect(); if (r.width < 0.5 && r.height < 0.5) return;
          var o = 1; for (var e = el; e && e !== document.body; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity);
          if (o > 0.05) out.visible++;
          var w = Math.min(r.right, safe.right) - Math.max(r.left, safe.left), h = Math.min(r.bottom, safe.bottom) - Math.max(r.top, safe.top);
          if (${JSON.stringify(d.place)} === 'edge' && w > 2 && h > 2 && o > 0.05) out.inside++;
        });
        Array.prototype.forEach.call(deco.querySelectorAll('[pathLength]'), function (sh) { if (parseFloat(getComputedStyle(sh).strokeDashoffset) > 0.05) out.undrawn++; });
        return out;
      })()`)) as { inside: number; undrawn: number; visible: number };
      if (probe.visible === 0) decorProblems.push(`${d.id}/${format} : rien de visible`);
      if (probe.inside) decorProblems.push(`${d.id}/${format} : ${probe.inside} forme(s) de bord dans la zone sûre`);
      if (probe.undrawn) decorProblems.push(`${d.id}/${format} : ${probe.undrawn} trait(s) pas tracé(s) à la fin`);
      const au = await audit(page, 'd1', size.width, format === 'landscape');
      for (const c of au.contrast) decorContrast.push(`${d.id}/${format} : ${c}`);
      await page.screenshot({ type: 'jpeg', quality: 70 }).then((b) => fs.writeFileSync(path.join(OUT, `${d.id}-${format}.jpg`), b));
    }
  }
  check(decorProblems.length === 0, `décors : ${decors.length} décors × ${formats.length} formats posés dans leur scène — aucune erreur, textes tenus, bords hors de la zone sûre, traits tracés`, decorProblems.slice(0, 30).join('\n    '));
  check(decorContrast.length === 0, 'décors : les textes restent lisibles par-dessus (contraste mesuré sur l’image)', `${decorContrast.length} défaut(s) :\n    ${decorContrast.slice(0, 20).join('\n    ')}`);

  // LA VARIÉTÉ (23/11/2026) : le même storyboard, six générations (six graines) → des films vraiment différents :
  // mises en page, thèmes, animations de titre, transitions, décors — et le même film rejoué à l'identique.
  {
    const story: CatalogScene[] = [
      { key: 'v1', duration: 3.4, role: 'hook', energy: 4, texts: { headline: 'Marie vend sa récolte depuis la place du village', sub: 'Payée en 24 heures, sans intermédiaire.' }, media: [{ id: 'photo', kind: 'image' }] },
      { key: 'v2', duration: 3.6, role: 'problem', energy: 2, texts: { headline: 'Trois obstacles à chaque saison', text2: 'Le dépôt le plus proche est à douze kilomètres', text3: 'Les prix changent sans prévenir', text4: 'Aucun reçu, aucun recours' }, media: [] },
      { key: 'v3', duration: 3.6, role: 'feature', energy: 3, texts: { headline: 'Trois touches pour commander ses intrants', sub: 'La borne parle la langue de l’exploitant.' }, media: [{ id: 'photo', kind: 'image' }] },
      { key: 'v4', duration: 3.2, role: 'proof', energy: 4, texts: { figure: '1 200', label: 'Exploitants servis en 2026' }, media: [] },
      { key: 'v5', duration: 3.4, role: 'statement', energy: 3, texts: { headline: 'Le marché vient à vous', sub: 'Une borne au cœur de chaque village.' }, media: [] },
      { key: 'v6', duration: 3.4, role: 'cta', energy: 4, texts: { headline: 'Installez une borne dans votre village', cta: 'Écrire sur WhatsApp' }, media: [] },
    ];
    const films = [];
    for (let k = 0; k < 6; k++) films.push(await composeFilmFromCatalog({ ...base, scenes: story, film: { ...base.film, seed: 1000 + k * 7919 }, level: 'high', call: { level: 'high', call: async () => '' } }));
    const again = await composeFilmFromCatalog({ ...base, scenes: story, film: { ...base.film, seed: 1000 }, level: 'high', call: { level: 'high', call: async () => '' } });
    const distinct = (f: (x: (typeof films)[number]) => string) => new Set(films.map(f)).size;
    const perScene = story.map((_, i) => new Set(films.map((x) => x.scenes[i].config.gabarit ?? x.scenes[i].config.layout)).size);
    const titleAnims = new Set(films.flatMap((x) => x.scenes.map((s) => s.config.animations.title).filter(Boolean))).size;
    const transitions = new Set(films.flatMap((x) => x.scenes.map((s) => s.config.transition).filter(Boolean))).size;
    const decorsUsed = new Set(films.flatMap((x) => x.scenes.map((s) => s.config.decor).filter(Boolean))).size;
    const detail = `thèmes ${distinct((x) => x.theme)} · scènes distinctes par rang ${JSON.stringify(perScene)} · animations de titre ${titleAnims} · transitions ${transitions} · décors ${decorsUsed}\n    ${films.map((x) => x.trace.detail.slice(0, 260)).join('\n    ')}`;
    check(distinct((x) => x.theme) >= 3 && perScene.filter((n) => n >= 3).length >= 4 && titleAnims >= 8 && transitions >= 5 && decorsUsed >= 5, 'variété : six générations du même storyboard donnent six films différents (thèmes, scènes, mouvements, transitions, décors)', detail);
    check(JSON.stringify(again.scenes.map((s) => s.config)) === JSON.stringify(films[0].scenes.map((s) => s.config)), 'variété : une même graine rejoue exactement le même film');
    console.log(`  · ${detail.split('\n')[0]}`);
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
  check(contrastIssues.length === 0, `contraste réel : chaque texte se lit sur son fond (photo comprise), 2,4:1 au moins sur sa partie la plus difficile`, `${contrastIssues.length} défaut(s) :\n    ${contrastIssues.slice(0, 20).join('\n    ')}`);
  check(tinyIssues.length === 0, `lisible sur téléphone : aucun texte sous 9 px une fois la vidéo réduite (${smallCount} sous 12 px sur ${textCount} scènes)`, `${tinyIssues.length} défaut(s) :\n    ${tinyIssues.slice(0, 20).join('\n    ')}`);
  check(coveredGabarits.size === gabarits.length, `rendu : chaque gabarit est passé sous au moins un thème (${coveredGabarits.size}/${gabarits.length})`);
  check(problems.length === 0, `rendu : ${renders} scènes (${gabarits.length} gabarits en rotation sur ${picked.length} thèmes × ${formats.length} formats) sans erreur, textes tenus, dans la zone sûre, visibles, sans chevauchement, tout le texte présent`, `${problems.length} défaut(s) :\n    ${problems.slice(0, 40).join('\n    ')}`);
  console.log(`\nPlanches : ${OUT}`);
  console.log(`\n${failures ? '✗' : '✓'} Catalogue vidéo : ${passed} vérification(s) réussie(s), ${failures} en échec.`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

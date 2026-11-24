/**
 * check:motion-math — le noyau mathématique du moteur vidéo (24/11/2026), gratuit, sans modèle :
 *
 *   1. courbes cinématiques (geJerk, geSettle, geKin) : bornes, bouts, continuité, même code dans la page ;
 *   2. arrivée cinématique : le mouvement et l'opacité séparés, seules les DA joueuses en reçoivent ;
 *   3. sujet hors des textes : la géométrie du cadrage (cas types), même code dans la page ;
 *   4. chemin du film : programmation dynamique contre l'ancien choix scène par scène (énergie, répétitions, variété) ;
 *   5. calage musical hiérarchique : pose sur le temps qui compte, la voix d'abord, traits sur les temps forts ;
 *   6. rendu réel (Chrome) : courbes enregistrées dans GSAP, image replacée sous un titre plein cadre, aucune erreur.
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import puppeteer from 'puppeteer';
import { configureCore } from '../src/runtime/host';
import { buildComposition } from '../src/video/rendering/hyperframes/composition';
import { COMPOSITION } from '../src/video/rendering/formats';
import { videoCatalog } from '../src/video/catalog/registry';
import { assembleFilm, CatalogScene, composeFilmFromCatalog, ComposeInput } from '../src/video/catalog/compose';
import { kinematicSteps, RuntimeScene } from '../src/video/catalog/assemble';
import { KINEMATIC_EASE_NAMES, KINEMATIC_EASES_JS, kinematicEase } from '../src/video/catalog/kinematics';
import { frameSubject, FRAMING_JS } from '../src/video/catalog/framing';
import { choosePath, pathEnergy, PathCandidate } from '../src/video/catalog/film-path';
import { beatAlignScore, landingShift } from '../src/video/catalog/rhythm';
import { specOf } from '../src/video/catalog/metrics';
import type { FilmFormatId, LayoutNode, SceneConfig, ThemeNode } from '../src/video/catalog/types';

process.env.IDEM_TEMPLATES_DIR = process.env.IDEM_TEMPLATES_DIR || path.resolve(__dirname, '../../../../../idem-templates');
process.env.IDEM_QUALITY_MEMORY = '0';
configureCore({ logger: { info: () => undefined, warn: () => undefined, error: (m: string, meta?: unknown) => console.error(m, meta) } as never });
const OUT = path.resolve(__dirname, '../tmp/check-motion-math');
let failures = 0;
let passed = 0;
const check = (ok: boolean, label: string, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (ok) passed++;
  else failures++;
};
const r3 = (v: number) => Math.round(v * 1000) / 1000;

function curves(): void {
  console.log('\n1. Courbes cinématiques');
  // Le code de la page, évalué avec un faux GSAP : il doit enregistrer les mêmes fonctions.
  const registered: Record<string, (u: number) => number> = {};
  const fakeGsap = { registerEase: (n: string, f: (u: number) => number) => (registered[n] = f) };
  new Function('window', 'gsap', KINEMATIC_EASES_JS)({ gsap: fakeGsap }, fakeGsap);
  for (const name of KINEMATIC_EASE_NAMES) {
    const f = kinematicEase(name)!;
    let min = Infinity;
    let max = -Infinity;
    let jump = 0;
    let parity = 0;
    let prevV = 0;
    let prevVel = 0;
    for (let i = 0; i <= 2000; i++) {
      const u = i / 2000;
      const v = f(u);
      min = Math.min(min, v);
      max = Math.max(max, v);
      parity = Math.max(parity, Math.abs(v - (registered[name]?.(u) ?? NaN)));
      const vel = (v - prevV) * 2000;
      if (i > 1) jump = Math.max(jump, Math.abs(vel - prevVel));
      prevV = v;
      prevVel = vel;
    }
    const endVel = (f(1) - f(1 - 1e-4)) / 1e-4;
    check(f(0) === 0 && f(1) === 1, `${name} : 0 et 1 exactement aux bouts`);
    check(Math.abs(endVel) < 0.01, `${name} : arrivée à vitesse nulle (pose sans à-coup)`, `vitesse finale ${endVel.toFixed(4)}`);
    check(jump < 0.06, `${name} : vitesse continue (aucune cassure)`, `saut max ${jump.toFixed(4)} par pas`);
    check(parity < 1e-12, `${name} : la page calcule exactement la même courbe que le serveur`);
    if (name === 'geJerk') check(min >= 0 && max <= 1 && Math.abs(f(0.5) - 0.5) < 1e-9, 'geJerk : ne recule ni ne dépasse jamais, symétrique', `min ${r3(min)} max ${r3(max)}`);
    if (name === 'geSettle') check(min >= 0 && max > 1.01 && max <= 1.04, 'geSettle : dépasse de 1 à 4 % sans reculer', `max ${r3(max)}`);
    if (name === 'geKin') check(min <= -0.015 && min >= -0.035 && max > 1.02 && max <= 1.05, 'geKin : recul de 1,5 à 3,5 %, dépassement de 2 à 5 %', `min ${r3(min)} max ${r3(max)}`);
  }
  // Jerk minimal contre power2.inOut : l'accélération ne saute plus au milieu.
  const acc = (f: (u: number) => number, u: number, h = 1e-3) => (f(u + h) - 2 * f(u) + f(u - h)) / (h * h);
  const p2 = (u: number) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
  const jumpP2 = Math.abs(acc(p2, 0.5 + 2e-3) - acc(p2, 0.5 - 2e-3));
  const jumpMJ = Math.abs(acc(kinematicEase('geJerk')!, 0.5 + 2e-3) - acc(kinematicEase('geJerk')!, 0.5 - 2e-3));
  check(jumpMJ < 0.2 && jumpP2 > 5, 'jerk minimal : accélération continue au milieu (power2.inOut y saute)', `saut d'accélération ${jumpMJ.toFixed(3)} contre ${jumpP2.toFixed(1)}`);
}

function arrival(): void {
  console.log('\n2. Arrivée cinématique');
  const steps = [{ from: { opacity: 0, y: 40, scale: 0.9 }, to: { opacity: 1, y: 0, scale: 1 }, duration: 0.6, ease: 'expo.out', stagger: 0.05 }, { to: { opacity: 0.8 }, duration: 0.2, ease: 'power1.inOut' }];
  const out = kinematicSteps(steps, 'geKin');
  check(out.length === 3 && out[0].ease === 'geKin' && !('opacity' in (out[0].from ?? {})) && !('opacity' in (out[0].to ?? {})), 'le mouvement prend la courbe ; l’opacité n’y est plus', JSON.stringify(out[0]));
  check(out[1].ease === 'expo.out' && out[1].at === 0 && out[1].from?.opacity === 0 && out[1].stagger === 0.05, 'l’opacité garde sa courbe, part au même instant, même décalage', JSON.stringify(out[1]));
  check(out[2] === steps[1], 'les pas suivants restent tels quels');
  const fade = [{ from: { opacity: 0 }, to: { opacity: 1 }, duration: 0.5, ease: 'power2.out' }];
  check(kinematicSteps(fade, 'geKin') === fade, 'un simple fondu ne reçoit aucune courbe qui dépasse');
}

function framing(): void {
  console.log('\n3. Sujet hors des textes');
  const frame = { w: 1080, h: 1920 };
  const centred = frameSubject(frame, 16 / 9, { x: 0.3, y: 0.5 }, []);
  // Sans texte : le sujet est au centre du cadre (le recadrage du point d'intérêt, appliqué).
  const rw = 1920 * (16 / 9);
  const subjectX = centred ? -((rw - 1080) * centred.px) + 0.3 * rw : NaN;
  check(!!centred && Math.abs(subjectX - 540) < 2, 'sans texte : le sujet est centré dans le cadre (avant : image centrée, sujet hors champ)', `sujet à x=${Math.round(subjectX)} px`);
  // Un titre au milieu du cadre, sujet au centre de l'image : l'image glisse, le sujet sort de sous le titre.
  // Un texte ferré à gauche sur le sujet : l'image glisse, le sujet passe à droite du texte, entier.
  const left = { x: 80, y: 820, w: 540, h: 300 };
  const moved = frameSubject(frame, 16 / 9, { x: 0.5, y: 0.5 }, [left]);
  check(!!moved && moved.before > 0.3 && moved.after <= moved.before * 0.4 && moved.cx <= 0.7 + 1e-3, 'texte à gauche sur le sujet : l’image glisse jusqu’à la ligne des tiers, le sujet sort en grande partie de sous le texte', JSON.stringify(moved));
  // Un titre centré sur toute la largeur utile : impossible de dégager le sujet sans le couper — l'image ne bouge pas.
  const wide = frameSubject(frame, 16 / 9, { x: 0.5, y: 0.5 }, [{ x: 140, y: 820, w: 800, h: 300 }]);
  const c0 = frameSubject(frame, 16 / 9, { x: 0.5, y: 0.5 }, []);
  check(!!wide && !!c0 && wide.px === c0.px && wide.py === c0.py, 'titre centré sur un grand sujet : jamais de sujet coupé au bord (l’image reste centrée sur lui)', JSON.stringify(wide));
  // Aucun débord possible (mêmes proportions) : rien ne bouge.
  const none = frameSubject(frame, 9 / 16, { x: 0.5, y: 0.5 }, [left]);
  check(!!none && none.px === 0.5 && none.py === 0.5, 'image aux proportions du cadre : rien à déplacer');
  const parity = (new Function(`${FRAMING_JS}; return frameSubject;`)() as typeof frameSubject)(frame, 16 / 9, { x: 0.5, y: 0.5 }, [left]);
  check(JSON.stringify(parity) === JSON.stringify(moved), 'la page calcule exactement le même cadrage que le serveur');
}

function paths(): void {
  console.log('\n4. Chemin du film');
  // Des listes où le meilleur candidat local est souvent le même : le choix scène par scène répète, le chemin non.
  const L = (layout: string, score: number, cover: PathCandidate['cover'] = 'none', gabarit?: string): PathCandidate => ({ layout, score, cover, ...(gabarit ? { gabarit } : {}) });
  const lists: PathCandidate[][] = [
    [L('title-center', 0.9), L('poster', 0.82), L('media-full', 0.8, 'full')],
    [L('title-center', 0.88), L('split', 0.8, 'part'), L('poster', 0.75)],
    [L('media-full', 0.9, 'full', 'g.photo'), L('split', 0.86, 'part'), L('title-center', 0.7)],
    [L('media-full', 0.89, 'full', 'g.photo'), L('framed', 0.85, 'part'), L('split', 0.8, 'part')],
    [L('figure', 0.9), L('title-center', 0.84), L('framed', 0.7, 'part')],
    [L('cta', 0.92), L('title-center', 0.8)],
  ];
  // L'ancien choix : le meilleur de chaque scène, −0,6 si même mise en page que juste avant, −0,12 par usage.
  const greedy: number[] = [];
  const use = new Map<string, number>();
  lists.forEach((list, i) => {
    let best = 0;
    let bs = -Infinity;
    list.forEach((c, k) => {
      const s = c.score - (i && lists[i - 1][greedy[i - 1]].layout === c.layout ? 0.6 : 0) - 0.12 * (use.get(c.layout) ?? 0);
      if (s > bs) (bs = s), (best = k);
    });
    greedy.push(best);
    use.set(list[best].layout, (use.get(list[best].layout) ?? 0) + 1);
  });
  const best = choosePath(lists, { seed: 'x', mode: 'best' });
  const eG = pathEnergy(lists, greedy);
  const eB = pathEnergy(lists, best);
  check(eB <= eG + 1e-9, 'le meilleur chemin a une énergie au plus égale à celle du choix scène par scène', `chemin ${eB} contre ${eG}`);
  const adj = (p: number[]) => p.filter((k, i) => i && lists[i][k].layout === lists[i - 1][p[i - 1]].layout).length;
  check(adj(best) === 0, 'le meilleur chemin ne répète aucune mise en page d’une scène à la suivante', best.map((k, i) => lists[i][k].layout).join(' → '));
  // Tiré : rejouable, varié d'un film à l'autre, toujours proche du meilleur.
  const samples = Array.from({ length: 40 }, (_, k) => choosePath(lists, { seed: `film-${k}` }));
  check(JSON.stringify(choosePath(lists, { seed: 'film-3' })) === JSON.stringify(samples[3]), 'même graine, même chemin (le film se rejoue)');
  const distinct = new Set(samples.map((p) => p.join(','))).size;
  check(distinct >= 4, 'graines différentes, chemins différents (variété d’un film à l’autre)', `${distinct} chemins distincts sur 40`);
  const worst = Math.max(...samples.map((p) => pathEnergy(lists, p) - eB));
  const mean = samples.reduce((n, p) => n + pathEnergy(lists, p) - eB, 0) / samples.length;
  check(mean < 0.2 && worst < 0.45, 'les chemins tirés restent proches du meilleur', `écart moyen ${r3(mean)}, pire ${r3(worst)}`);
  check(samples.every((p) => adj(p) === 0), 'aucun chemin tiré ne répète une mise en page d’une scène à la suivante');
}

function rhythm(): void {
  console.log('\n5. Calage musical hiérarchique');
  const grid = { bpm: 120, first: 0, beats: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4], downbeats: [0, 2, 4], phrases: [4] };
  check(landingShift(1.85, grid, { energy: 3 }) === 0.15, 'la pose glisse sur le temps fort de mesure le plus proche', String(landingShift(1.85, grid, { energy: 3 })));
  check(landingShift(1.02, grid, { energy: 3 }) === 0, 'une pose déjà sur un temps ne bouge pas');
  check(landingShift(1.2, grid, { energy: 2 }) === 0, 'une scène posée ne se cale pas sur un simple temps (seulement sur la mesure)');
  check(landingShift(1.3, grid, { energy: 4 }) === 0.2, 'une scène vive se cale sur un simple temps', String(landingShift(1.3, grid, { energy: 4 })));
  check(landingShift(3.8, grid, { energy: 4, role: 'hook' }) === 0.2, 'une révélation préfère le début de phrase', String(landingShift(3.8, grid, { energy: 4, role: 'hook' })));
  check(landingShift(1.85, grid, { energy: 3, late: 0.1 }) === 0, 'jamais au-delà du temps permis (lecture garantie)');
  check(beatAlignScore([{ t: 1, beats: grid.beats }, { t: 2.5, beats: grid.beats }]) === 1, 'score d’alignement : 1 quand tout tombe sur la musique');
  check((beatAlignScore([{ t: 1.25, beats: grid.beats }]) ?? 1) < 0.02, 'score d’alignement : ≈ 0 au contretemps');
}

async function catalogue(): Promise<void> {
  console.log('\n6. Sur le catalogue réel');
  const cat = await videoCatalog();
  const theme = [...cat.nodes.values()].find((n): n is ThemeNode => n.kind === 'theme' && !n.id.startsWith('builtin.') && !(n as ThemeNode).requiresDark)!;
  const layout = (cat.nodes.get('vlayout.cta-end') ?? [...cat.nodes.values()].find((n) => n.kind === 'layout' && /data-v="cta"/.test((n as LayoutNode).html))) as LayoutNode;
  const texts = { headline: 'Installez une borne dans votre village', sub: 'Les dix premières coopératives sont équipées gratuitement.', cta: 'Écrire sur WhatsApp' };
  const scene = (extra: Partial<CatalogScene> = {}): CatalogScene => ({ key: 's1', duration: 10, texts, media: [], role: 'cta', energy: 4, ...extra });
  const config: SceneConfig = { layout: layout.id, animations: {} };
  const brand = (direction?: string) => ({ name: 'AgriLink', hasLogo: false, line: 'AgriLink', ...(direction ? { direction } : {}) });
  const spec = (scenes: CatalogScene[], direction?: string) => specOf(assembleFilm(cat, { scenes, brand: brand(direction), formats: ['story'] }, theme, [config])[0].script)!;
  // Le calage : sans grille, la pose de référence ; avec un temps fort juste après, la pose y tombe.
  const plain = spec([scene()]);
  const lead = (s: RuntimeScene) => s.accents?.find((a) => a.kind === 'settle')?.t ?? NaN;
  const target = Math.round((lead(plain) + 0.2) * 1000) / 1000;
  const onBeat = spec([scene({ beat: { bpm: 120, first: 0, beats: [target - 0.5, target], downbeats: [target], phrases: [] } })]);
  check(Math.abs(lead(onBeat) - target) < 0.011, 'la pose du titre tombe sur le temps fort de mesure (et non plus son départ)', `pose ${lead(plain)} → ${lead(onBeat)}, temps fort ${target}`);
  const voiced = spec([scene({ beat: { bpm: 120, first: 0, beats: [target], downbeats: [target], phrases: [] }, spoken: [{ text: 'Installez', t: 0.4 }] })]);
  const voicedNoMusic = spec([scene({ spoken: [{ text: 'Installez', t: 0.4 }] })]);
  check(lead(voiced) === lead(voicedNoMusic), 'une scène dite garde ses entrées sur la voix (la musique ne la déplace pas)', `pose ${lead(voiced)} avec musique, ${lead(voicedNoMusic)} sans`);
  // Les courbes par DA.
  const kin = (s: RuntimeScene) => s.roles.flatMap((r) => r.in).filter((st) => KINEMATIC_EASE_NAMES.includes(st.ease)).length;
  check(kin(spec([scene()], 'swiss')) === 0, 'une DA posée (swiss) garde les courbes du catalogue');
  const playful = spec([scene()], 'memphis');
  check(kin(playful) > 0 && playful.roles.every((r) => r.in.every((st) => !KINEMATIC_EASE_NAMES.includes(st.ease) || !('opacity' in (st.to ?? {})))), 'une DA joueuse (memphis) : arrivée cinématique, jamais sur l’opacité', `${kin(playful)} pas`);
  // Le film entier : chemin contre ancien choix, sur 12 graines.
  const roles = ['hook', 'problem', 'feature', 'feature', 'benefits', 'proof', 'statement', 'cta'];
  const scenes: CatalogScene[] = roles.map((role, i) => ({ key: `s${i + 1}`, duration: 4.5, role, energy: 3, texts: role === 'proof' ? { figure: '1 200', label: 'Exploitants servis en 2026' } : role === 'benefits' ? { headline: 'Ce que la borne change', text2: 'Deux jours de marche économisés', text3: 'Trente pour cent de moins', text4: 'Un reçu à chaque commande' } : role === 'cta' ? texts : { headline: `Une borne au cœur du village, scène ${i + 1}`, sub: 'Solaire, solide, utilisable sans savoir lire.' }, media: role === 'feature' || role === 'hook' ? [{ id: 'photo', kind: 'image' as const, focus: { story: { x: 0.3, y: 0.5 } }, calm: {}, aspect: 1.5 }] : [] }));
  const input = (seed: number): ComposeInput => ({ scenes, film: { title: 'Borne', concept: 'x', seed }, brand: brand('editorial'), formats: ['story'] as FilmFormatId[], level: 'high', call: { level: 'high', call: async () => '' } as never });
  const runs = async (mode?: string) => {
    if (mode) process.env.VIDEO_FILM_PATH = mode;
    else delete process.env.VIDEO_FILM_PATH;
    const out = [];
    for (let k = 0; k < 12; k++) out.push(await composeFilmFromCatalog(input(k)));
    return out;
  };
  const path_ = await runs();
  const greedy = await runs('greedy');
  delete process.env.VIDEO_FILM_PATH;
  const rep = (fs_: typeof path_) => fs_.reduce((n, f) => n + f.metrics!.repeats.layout + f.metrics!.repeats.gabarit, 0);
  check(rep(path_) <= rep(greedy), 'film entier (12 graines) : le chemin ne répète pas plus que l’ancien choix', `répétitions ${rep(path_)} contre ${rep(greedy)}`);
  const sigs = new Set(path_.map((f) => f.scenes.map((s) => s.config.layout).join(',')));
  check(sigs.size >= 6, 'film entier : les graines donnent des films différents', `${sigs.size} films distincts sur 12`);
  const again = await composeFilmFromCatalog(input(3));
  check(JSON.stringify(again.scenes.map((s) => s.config)) === JSON.stringify(path_[3].scenes.map((s) => s.config)), 'film entier : même graine, même film');
  const framedSpec = path_[0].scenes.map((s) => specOf(s.script)).find((s) => s?.media);
  check(!!framedSpec?.media?.focus.st && framedSpec.media.aspect === 1.5, 'le point d’intérêt et les proportions de l’image arrivent jusqu’à la page', JSON.stringify(framedSpec?.media));
}

/** Une scène plein cadre rendue dans Chrome : le cadrage posé par la page et une planche. */
async function renderOne(o: { layoutId: string; format: FilmFormatId; photo: { w: number; h: number; cx: number; cy: number; r: number }; focus: { x: number; y: number } }) {
  const cat = await videoCatalog();
  const theme = [...cat.nodes.values()].find((n): n is ThemeNode => n.kind === 'theme' && !n.id.startsWith('builtin.') && !(n as ThemeNode).requiresDark)!;
  const layout = cat.nodes.get(o.layoutId) as LayoutNode;
  const p = o.photo;
  const photo = await sharp({ create: { width: p.w, height: p.h, channels: 3, background: '#d8c9a8' } }).composite([{ input: Buffer.from(`<svg width="${p.w}" height="${p.h}"><circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="#2b2b2b"/></svg>`), top: 0, left: 0 }]).jpeg().toBuffer();
  const texts = { headline: 'Marie vend sa récolte depuis la place du village', sub: 'Payée en 24 heures, sans intermédiaire.' };
  const sc: CatalogScene = { key: 'f1', duration: 4, role: 'feature', energy: 3, texts, media: [{ id: 'photo', kind: 'image', focus: { [o.format]: o.focus }, aspect: Math.round((p.w / p.h) * 1000) / 1000 }] };
  const a = assembleFilm(cat, { scenes: [sc], brand: { name: 'AgriLink', hasLogo: false }, formats: [o.format] }, theme, [{ layout: layout.id, animations: {} }])[0];
  const size = COMPOSITION[o.format];
  const html = await buildComposition({ scenes: [{ key: 'f1', start: 0, duration: 4, html: a.html, script: a.script, animation: 'gsap', texts }], width: size.width, height: size.height, output: { width: size.width / 2, height: size.height / 2 }, durationSec: 4, brand: { name: 'AgriLink', colors: { primary: '#1b7a5a', secondary: '#163a5f', accent: '#e3a03a', background: '#f6f7f4', text: '#14211c' }, fonts: { display: 'Fraunces', body: 'Karla' } } as never, media: { photo: { src: 'photo.jpg', kind: 'image' } }, logo: '', fontCss: '', mode: 'render' });
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const ORIGIN = 'http://idem-check.local';
    await page.setViewport({ width: size.width / 2, height: size.height / 2 });
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url.startsWith('data:')) return void req.continue();
      if (url === `${ORIGIN}/`) return void req.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
      if (url.endsWith('/photo.jpg')) return void req.respond({ status: 200, contentType: 'image/jpeg', body: photo });
      return void req.abort('blockedbyclient');
    });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String((e as Error)?.message || e)));
    await page.goto(`${ORIGIN}/`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate('document.fonts && document.fonts.ready');
    await page.evaluate('new Promise(function (r) { setTimeout(r, 60); })');
    const state = (await page.evaluate(`({ errs: window.__sceneErrors || [], framed: window.__geFramed || [], eases: ['geJerk','geSettle','geKin'].map(function (n) { var f = gsap.parseEase(n); return f ? Math.round(f(0.5) * 1000) / 1000 : null; }) })`)) as { errs: unknown[]; framed: Array<{ before: number; after: number; px: number; py: number; cx: number; cy: number; obstacles: number }>; eases: Array<number | null> };
    fs.mkdirSync(OUT, { recursive: true });
    // Tout posé ; l'expression renvoie 1 (renvoyer la timeline ferait sérialiser tout GSAP).
    await page.evaluate(`window.__timelines.film.seek(3, false); 1`);
    const shot = path.join(OUT, `${o.layoutId}-${o.format}.png`);
    await page.screenshot({ path: shot as `${string}.png` });
    return { errors: [...errors, ...state.errs.map((e) => JSON.stringify(e))], framed: state.framed[0], eases: state.eases, shot };
  } finally {
    await browser.close();
  }
}

async function render(): Promise<string[]> {
  console.log('\n7. Rendu réel (Chrome)');
  const shots: string[] = [];
  // Titre centré sur un grand sujet centré, en story : le dégager le couperait au bord — l'image reste centrée.
  const centre = await renderOne({ layoutId: 'vlayout.media-full-center', format: 'story', photo: { w: 1800, h: 1200, cx: 900, cy: 600, r: 220 }, focus: { x: 0.5, y: 0.5 } });
  shots.push(centre.shot);
  check(!centre.errors.length, 'la page s’exécute sans erreur', centre.errors.join(' | ').slice(0, 200));
  check(centre.eases.every((v, k) => v !== null && Math.abs(v - r3(kinematicEase(KINEMATIC_EASE_NAMES[k])!(0.5))) < 0.002), 'GSAP connaît geJerk, geSettle, geKin (mêmes valeurs que le serveur)', JSON.stringify(centre.eases));
  const cf = centre.framed;
  check(!!cf && cf.cx >= 0.3 - 1e-3 && cf.cx <= 0.7 + 1e-3 && cf.cy >= 0.3 - 1e-3 && cf.cy <= 0.7 + 1e-3 && cf.after <= cf.before, 'titre centré sur un grand sujet : le sujet reste dans la bande des tiers (jamais poussé au bord)', JSON.stringify(cf));
  // Texte à gauche en paysage, sujet au centre d'une image large : l'image glisse, le sujet passe à droite du texte.
  const side = await renderOne({ layoutId: 'vlayout.media-full-side', format: 'landscape', photo: { w: 2400, h: 1000, cx: 1200, cy: 500, r: 190 }, focus: { x: 0.5, y: 0.5 } });
  shots.push(side.shot);
  check(!side.errors.length, 'paysage : la page s’exécute sans erreur', side.errors.join(' | ').slice(0, 200));
  check(!!side.framed && side.framed.obstacles > 0 && side.framed.before > 0.08 && side.framed.after <= side.framed.before * 0.6, 'texte à gauche sur le sujet (paysage) : l’image glisse, le sujet sort de sous le texte', JSON.stringify(side.framed));
  return shots;
}

(async () => {
  curves();
  arrival();
  framing();
  paths();
  rhythm();
  await catalogue();
  const shots = process.argv.includes('--no-render') ? [] : await render();
  console.log(`\n${passed} réussis, ${failures} échoués${shots.length ? ` — planches : ${shots.join(', ')}` : ''}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * `npm run bench:video` — le BANC du moteur vidéo, GRATUIT (aucun modèle payant, aucun média généré) :
 *
 *   A. JETONS   la même demande créée avec l'ANCIEN enchaînement (directeur de création + concept + storyboard + choix
 *               dans le catalogue : `IDEM_VIDEO_AUTO_BRIEF=1`, `IDEM_VIDEO_CONCEPT=1`, `VIDEO_CATALOG_CHOOSER=model`) et
 *               le NOUVEAU (un seul appel de storyboard, le code choisit tout) — agents SIMULÉS dont les réponses ont la
 *               longueur de réponses réelles ; on compte les appels et les jetons envoyés et reçus par rôle ;
 *   B. RENDU    des films FIGÉS écrits à la main (aucun modèle) assemblés AVANT (sans séquences ni développements) et
 *               APRÈS, rendus dans Chrome : séquences, traversées, développements, temps mort par scène — et une planche
 *               par film (3 instants par scène, avant / après) dans `tmp/bench-video/` ;
 *   C. RÉFÉRENCE la caméra d'un plan mesurée par le code (zoom avant synthétique), et la vision lue par paquets de
 *               quatre plans (12 plans → 3 appels).
 *
 * Les jetons sont ESTIMÉS (≈ 4 signes par jeton, comme `estimateTokens`) sur des réponses simulées : le banc compare
 * deux enchaînements à réponses égales, il ne remplace pas une mesure en production (`ai-trace`).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import sharp from 'sharp';
import puppeteer, { Page } from 'puppeteer';
import { configureCore } from '../src/runtime/host';
import { MotionVideoService } from '../src/video/motionVideo.service';
import type { VideoStore } from '../src/video/contracts/store';
import type { MotionVideo } from '../src/video/contracts/model';
import type { AgentCall } from '../src/creativity/orchestrator';
import { buildComposition } from '../src/video/rendering/hyperframes/composition';
import { COMPOSITION } from '../src/video/rendering/formats';
import { closeFilmBrowser } from '../src/video/rendering/runner';
import { resetVideoCatalog, videoCatalog } from '../src/video/catalog/registry';
import { CatalogScene, composeFilmFromCatalog, ComposedFilm } from '../src/video/catalog/compose';
import { IDLE_MAX } from '../src/video/catalog/assemble';
import { estimateTokens } from '../src/video/request/facts';
import type { FilmFormatId } from '../src/video/catalog/types';
import { analyzeReferenceVideo, measureCamera } from '../src/reference/reference.analyzer';

process.env.VIDEO_ALLOW_FILE_URLS = '1';
process.env.VIDEO_SFX_OFFLINE = '1';
process.env.IDEM_DESIGN_TOOLS_OFFLINE = '1';
process.env.IDEM_QUALITY_MEMORY = '0';
process.env.IDEM_TEMPLATES_DIR = process.env.IDEM_TEMPLATES_DIR || path.resolve(__dirname, '../../../../../idem-templates');
const OUT = path.resolve(__dirname, '../tmp/bench-video');
const fast = process.argv.includes('--fast');
let failures = 0;
const check = (ok: boolean, label: string, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};
const BRAND = { primary: '#1f6f4a', secondary: '#14324a', accent: '#f2a93b', background: '#fbfaf7', text: '#16181d' };

// ── A. Les jetons ────────────────────────────────────────────────────────────────────────────

const REQUESTS: Record<string, string> = {
  courte: 'Une vidéo pour lancer Kora Café : café torréfié chaque matin à Dakar, livré en 30 minutes. Commandez sur WhatsApp.',
  brief: [
    'Vidéo du calendrier — semaine 48. Objectif : faire connaître la livraison du matin de Kora Café aux actifs du Plateau.',
    'Déroulé : 1. l’aube, les grains qui craquent dans le torréfacteur ; 2. un livreur à moto traverse Dakar ; 3. une cliente goûte au bureau ;',
    '4. la preuve : livré en 30 minutes ; 5. l’appel : commandez sur WhatsApp ; 6. le logo.',
    'Ton de la narration : chaleureux, posé, comme un ami qui raconte. Musique afro légère. À montrer : le torréfacteur, la moto, la tasse.',
    'Message clé : un café torréfié le matin même, livré en 30 minutes. Pas de prix à l’écran. Public : actifs de 25 à 45 ans.',
  ].join('\n'),
  scenario: ['SCÈNE 1 — « Le matin » : les grains torréfient. Texte : « Torréfié ce matin »', 'SCÈNE 2 — « La route » : un livreur à moto. Texte : « Livré en 30 minutes »', 'SCÈNE 3 — « La tasse » : une cliente sourit. Texte : « Le café qui réveille Dakar »', 'SCÈNE 4 — « L’appel » : le logo. Texte : « Commandez sur WhatsApp »'].join('\n'),
};

const BRIEF_ANSWER = JSON.stringify({
  objective: 'Faire connaître la livraison du matin de Kora Café',
  audience: 'Les actifs de Dakar',
  keyMessage: 'Un café torréfié le matin même, livré en 30 minutes',
  story: 'Du grain qui torréfie à l’aube à la tasse sur le bureau.',
  voiceover: false,
  pacing: 'Lent au début puis plus vif, chaque plan prolonge le précédent',
  look: 'Lumière du matin, tons bruns et crème',
  show: ['grains de café qui torréfient', 'un livreur à moto dans les rues de Dakar', 'une cliente qui sourit avec sa tasse'],
  beats: [
    { name: 'Accroche', see: 'des grains qui craquent dans le torréfacteur à l’aube', text: 'Votre café est torréfié ce matin', flow: 'la fumée devient la rue' },
    { name: 'Le trajet', see: 'un livreur à moto traverse Dakar', text: 'Livré en 30 minutes', flow: 'la moto s’arrête devant un bureau' },
    { name: 'La tasse', see: 'une cliente goûte et sourit', text: 'Le café qui réveille Dakar', flow: 'la tasse se pose à côté du logo' },
    { name: 'La fin', see: 'le logo Kora Café sur fond crème', text: 'Commandez sur WhatsApp' },
  ],
  ending: 'Le logo et l’appel à commander',
  music: 'afro',
});

/** Un storyboard simulé de la longueur d'un vrai : l'ancien format (visuel, mouvement, transition détaillés) ou le nouveau. */
function plannerAnswer(oldStyle: boolean, scenes: number): string {
  const lines = ['TITLE: Le café qui réveille Dakar', 'CONCEPT: Une journée qui commence par une tasse torréfiée le matin même.', oldStyle ? 'BIBLE: fond crème, vert de la marque en aplats, titres serrés en capitales, filets fins, mouvement posé qui accélère au moment du produit, chaque scène garde un élément de la précédente.' : 'DIRECTION: editorial, second: organic', oldStyle ? '' : 'MUSIC: afro'];
  const roles = ['hook', 'reveal', 'feature', 'proof', 'cta', 'signature'];
  for (let i = 0; i < scenes; i++) {
    lines.push(`SCENE ${i + 1} | ${(30 / scenes).toFixed(1)}`, `role: ${roles[i % roles.length]}`, `energy: ${[3, 4, 3, 5, 4, 2][i % 6]}`, 'purpose: faire sentir la fraîcheur du café du matin', 'visual: les grains de café qui torréfient à l’aube dans le torréfacteur');
    if (oldStyle) {
      lines[lines.length - 1] = 'visual: les grains plein cadre à gauche sur 60 % de la largeur, le titre en capitales blanc à droite sur fond vert de la marque, un filet ocre sous le titre, le logo petit en bas à droite';
      lines.push('motion: les grains entrent par un zoom lent de 110 % à 100 % en 1,2 s, courbe expo.out ; le titre monte mot à mot avec un décalage de 80 ms ; le filet se trace de gauche à droite ; le moment fort est la pose du titre à 1,4 s', 'transition: la photo glisse vers la gauche et devient le fond de la scène suivante, pendant que le vert balaie l’écran de droite à gauche');
    }
    lines.push(`text.headline: ${['Torréfié ce matin', 'Livré en 30 minutes', 'Le café qui réveille Dakar', 'Commandez sur WhatsApp', 'Kora Café', 'Kora Café'][i % 6]}`, 'text.sub: Chaque matin, au Plateau', 'new image: roasted coffee beans in a small Dakar roastery at dawn | coffee roasting dawn');
  }
  return lines.filter(Boolean).join('\n');
}

function templateAnswer(user: string): string {
  const keys = [...user.matchAll(/^(s\d+) \(/gm)].map((m) => m[1]);
  return JSON.stringify({ theme: 'A', scenes: keys.map((k) => ({ scene: k, pick: 'A', animations: { title: 'anim.mask-rise' }, transition: 'trans.push' })) });
}

type Usage = { calls: number; input: number; output: number; byRole: Record<string, { calls: number; input: number; output: number }> };

async function tokensFor(mode: 'avant' | 'après', request: string, level: 'medium' | 'ultra'): Promise<Usage> {
  const env = { IDEM_VIDEO_AUTO_BRIEF: process.env.IDEM_VIDEO_AUTO_BRIEF, IDEM_VIDEO_CONCEPT: process.env.IDEM_VIDEO_CONCEPT, VIDEO_CATALOG_CHOOSER: process.env.VIDEO_CATALOG_CHOOSER };
  if (mode === 'avant') Object.assign(process.env, { IDEM_VIDEO_AUTO_BRIEF: '1', IDEM_VIDEO_CONCEPT: '1', VIDEO_CATALOG_CHOOSER: 'model' });
  else for (const k of Object.keys(env)) delete process.env[k];
  const usage: Usage = { calls: 0, input: 0, output: 0, byRole: {} };
  const videos = new Map<string, MotionVideo>();
  const store: VideoStore = {
    loadBrand: async () => ({ brandName: 'Kora Café', country: 'Sénégal', branding: { colors: { colors: BRAND } } as never, voice: { tone: 'chaleureux', language: 'fr', businessType: 'torréfacteur artisanal', valueProposition: 'Un café torréfié chaque matin à Dakar, livré en 30 minutes' }, visuals: [], videos: [...videos.values()] }),
    listVideos: async () => [...videos.values()],
    saveVideo: async (_u, _p, v) => void videos.set(v.id, v),
    mutateVideo: async (_u, _p, id, fn) => {
      const v = videos.get(id);
      if (!v) return null;
      const next = fn(v);
      videos.set(id, next);
      return next;
    },
    removeVideo: async (_u, _p, id) => videos.delete(id),
  };
  const call: AgentCall = async ({ role, system, user }) => {
    const answer =
      role === 'video.brief' ? BRIEF_ANSWER
      : role === 'video.concept-explore' ? 'TRACK 1: Morning ritual — the coffee followed from bean to cup in one camera move.\nTRACK 2: Hands — only hands roasting, pouring, giving the cup.\nTRACK 3: Big numbers — one huge figure per beat.\nTRACK 4: City wakes — Dakar wakes up street by street around the café.'
      : role === 'video.concept' ? ['TITLE: Le café qui réveille', 'DIRECTION: editorial, second: organic', 'ENERGY: 3, 4, 3, 5, 4, 2', 'CONCEPT: Une journée qui commence par une tasse.', 'BIBLE: fond crème, vert de la marque, gros titres serrés, filets fins, mouvement posé.', ...[1, 2, 3, 4, 5, 6].map((n) => `SCENE ${n}: les grains plein cadre, le titre qui monte, la photo qui glisse vers la scène suivante`)].join('\n')
      : role === 'video.planner' ? plannerAnswer(mode === 'avant', /CLIENT SCRIPT/.test(user) ? 4 : 6)
      : role === 'video.template' ? templateAnswer(user)
      : role === 'video.reader' ? '{}'
      : '';
    const r = (usage.byRole[role] ??= { calls: 0, input: 0, output: 0 });
    const i = estimateTokens(`${system}${user}`);
    const o = estimateTokens(answer);
    r.calls++;
    r.input += i;
    r.output += o;
    usage.calls++;
    usage.input += i;
    usage.output += o;
    return answer;
  };
  const service = new MotionVideoService(store, call);
  try {
    await service.createVideo('u1', 'p1', { brief: { message: request.slice(0, 200), request, musicMood: 'auto', sfx: false, voice: false, media: [], allowGenerate: false, allowStock: false } as never, scope: { durationSec: 30, formats: ['story'], quality: 'standard' }, creativity: level }, 120);
  } catch (error) {
    console.log(`  (création ${mode}/${level} : ${(error as Error).message})`);
  }
  Object.assign(process.env, Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined)));
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
  return usage;
}

// ── B. Les films figés ───────────────────────────────────────────────────────────────────────

const photo = (id: string) => [{ id, kind: 'image' as const }];
const FILMS: Record<string, CatalogScene[]> = {
  'lancement-produit': [
    { key: 's1', duration: 3.4, role: 'hook', energy: 4, texts: { headline: 'Votre café est torréfié ce matin', sub: 'Au cœur du Plateau, à Dakar.' }, media: photo('p1') },
    { key: 's2', duration: 4.2, role: 'feature', energy: 3, texts: { headline: 'Livré chez vous en 30 minutes', sub: 'Un livreur à moto, chaque matin.' }, media: photo('p1') },
    { key: 's3', duration: 3.6, role: 'proof', energy: 5, texts: { figure: '30 min', label: 'Du torréfacteur à votre bureau' }, media: [] },
    { key: 's4', duration: 4.4, role: 'reveal', energy: 4, texts: { figure: '30 min', label: 'Chaque matin, au Plateau', headline: 'La tasse arrive encore chaude' }, media: photo('p2') },
    { key: 's5', duration: 3.6, role: 'cta', energy: 4, texts: { headline: 'Commandez sur WhatsApp', sub: 'Avant 9 h, livré avant 9 h 30.', cta: 'Écrire sur WhatsApp' }, media: [] },
    { key: 's6', duration: 2.8, role: 'signature', energy: 2, texts: { headline: 'Le café qui réveille Dakar' }, media: [] },
  ],
  'probleme-solution': [
    { key: 's1', duration: 3.2, role: 'hook', energy: 4, texts: { headline: 'Douze kilomètres pour des semences', sub: 'Chaque saison, pour chaque exploitant.' }, media: photo('p1') },
    { key: 's2', duration: 5.2, role: 'problem', energy: 2, texts: { headline: 'Trois obstacles à chaque saison', text2: 'Le dépôt le plus proche est à douze kilomètres', text3: 'Les prix changent sans prévenir', text4: 'Aucun reçu, aucun recours' }, media: [] },
    { key: 's3', duration: 4.4, role: 'reveal', energy: 4, texts: { headline: 'La borne vient au village', sub: 'Solaire, solide, utilisable sans savoir lire.' }, media: photo('p2') },
    { key: 's4', duration: 4.6, role: 'feature', energy: 3, texts: { headline: 'Trois touches pour commander', sub: 'La borne parle la langue de l’exploitant.' }, media: photo('p2') },
    { key: 's5', duration: 5.0, role: 'statement', energy: 3, texts: { headline: 'Le marché à portée de main', sub: 'Dix coopératives équipées cette saison.' }, media: [] },
    { key: 's6', duration: 2.8, role: 'signature', energy: 2, texts: { headline: 'AgriLink' }, media: [] },
  ],
  // Une vidéo à voix off : des scènes longues (la narration), là où une scène qui ne fait qu'attendre se voit le plus.
  'narration-longue': [
    { key: 's1', duration: 5.6, role: 'hook', energy: 3, texts: { headline: 'Il est six heures à Dakar', sub: 'Et votre café est déjà en train de naître.' }, media: photo('p1') },
    { key: 's2', duration: 6.2, role: 'reveal', energy: 3, texts: { headline: 'Torréfié dans notre atelier du Plateau' }, media: photo('p1') },
    { key: 's3', duration: 5.8, role: 'benefits', energy: 3, texts: { headline: 'Ce qui change le matin', text2: 'Un café du jour, jamais de la veille', text3: 'Livré avant votre première réunion', text4: 'Payé par mobile money' }, media: [] },
    { key: 's4', duration: 5.4, role: 'proof', energy: 4, texts: { figure: '30 min', label: 'Du torréfacteur à votre bureau' }, media: [] },
    { key: 's5', duration: 5.6, role: 'cta', energy: 4, texts: { headline: 'Commandez sur WhatsApp', cta: 'Écrire sur WhatsApp' }, media: [] },
    { key: 's6', duration: 4.4, role: 'signature', energy: 2, texts: { headline: 'Le café qui réveille Dakar' }, media: [] },
  ],
  'preuve-chiffres': [
    { key: 's1', duration: 3.0, role: 'hook', energy: 4, texts: { headline: 'Une année de récoltes vendues', sub: 'Sans intermédiaire.' }, media: [] },
    { key: 's2', duration: 4.2, role: 'data', energy: 4, texts: { figure: '1 200', label: 'Exploitants servis en 2026' }, media: [] },
    { key: 's3', duration: 4.4, role: 'proof', energy: 5, texts: { figure: '3 200', label: 'Commandes passées à la borne' }, media: photo('p1') },
    { key: 's4', duration: 5.4, role: 'benefits', energy: 3, texts: { headline: 'Ce que la borne change', text2: 'Deux jours de marche économisés', text3: 'Trente pour cent de moins sur les intrants', text4: 'Un reçu imprimé à chaque commande' }, media: [] },
    { key: 's5', duration: 3.6, role: 'cta', energy: 4, texts: { headline: 'Équipez votre coopérative', cta: 'Écrire sur WhatsApp' }, media: [] },
    { key: 's6', duration: 2.6, role: 'signature', energy: 2, texts: { headline: 'Les intrants à portée de main' }, media: [] },
  ],
};

async function open(page: Page, html: string, files: Record<string, Buffer>, size: { width: number; height: number }) {
  await page.setViewport({ width: size.width, height: size.height });
  page.removeAllListeners('request');
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const u = r.url();
    if (u === 'http://bench.local/') return void r.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
    const name = decodeURIComponent(u.replace('http://bench.local/', ''));
    if (files[name]) return void r.respond({ status: 200, contentType: name.endsWith('.png') ? 'image/png' : 'image/jpeg', body: files[name] });
    if (u.startsWith('data:')) return void r.continue();
    r.abort('blockedbyclient');
  });
  await page.goto('http://bench.local/', { waitUntil: 'load' });
  await page.evaluate('document.fonts.ready');
  await page.evaluate('new Promise(function (r) { setTimeout(r, 40); })');
}

async function sheet(page: Page, composed: ComposedFilm, scenes: CatalogScene[], format: FilmFormatId, files: Record<string, Buffer>, rest?: { share: number; longest: number }[]): Promise<Buffer> {
  const size = COMPOSITION[format];
  const out = { width: Math.round(size.width / 3), height: Math.round(size.height / 3) };
  let start = 0;
  const hs = composed.scenes.map((s, i) => {
    const x = { key: s.key, start, duration: scenes[i].duration, html: s.html, script: s.script, animation: 'gsap' as const, texts: scenes[i].texts };
    start += scenes[i].duration;
    return x;
  });
  const html = await buildComposition({ scenes: hs, width: size.width, height: size.height, output: out, durationSec: start, brand: { name: 'Kora', colors: BRAND, fonts: { display: 'Fraunces', body: 'Karla' }, logo: { light: 'logo.png', width: 480, height: 120 } } as never, media: { p1: { src: 'p1.jpg', kind: 'image' }, p2: { src: 'p2.jpg', kind: 'image' } }, logo: 'logo.png', fontCss: '', mode: 'render' });
  await open(page, html, files, out);
  if (rest) rest.push(await restOf(page, start));
  const tiles: Buffer[] = [];
  for (const s of hs) {
    for (const k of [0.25, 0.6, 0.97]) {
      const t = s.start + s.duration * k;
      await page.evaluate(`(function () { window.__timelines.film.seek(${t}, false); document.querySelectorAll('section.scene').forEach(function (el) { var a = parseFloat(el.dataset.start), d = parseFloat(el.dataset.duration); el.style.visibility = ${t} >= a && ${t} < a + d ? 'visible' : 'hidden'; }); })()`);
      tiles.push(Buffer.from(await page.screenshot({ type: 'jpeg', quality: 72 })));
    }
  }
  const w = out.width;
  const h = out.height;
  return sharp({ create: { width: 3 * (w + 6), height: hs.length * (h + 6), channels: 3, background: '#6b6b6b' } })
    .composite(tiles.map((input, i) => ({ input, left: (i % 3) * (w + 6), top: Math.floor(i / 3) * (h + 6) })))
    .jpeg({ quality: 78 })
    .toBuffer();
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/**
 * LE REPOS, mesuré sur les images (idée d'onetake) : la part des images presque identiques à la précédente (écart
 * moyen < 0,5 % à 96 px), et le plus long passage calme. Un film sans aucun repos fatigue ; un film fait de repos
 * est un diaporama. Repère : 15 à 45 % d'images au repos, un passage calme d'au moins 0,8 s.
 */
async function restOf(page: Page, duration: number): Promise<{ share: number; longest: number }> {
  const fps = 8;
  const frames: Buffer[] = [];
  for (let t = 0; t < duration - 0.05; t += 1 / fps) {
    await page.evaluate(`(function () { window.__timelines.film.seek(${t}, false); document.querySelectorAll('section.scene').forEach(function (el) { var a = parseFloat(el.dataset.start), d = parseFloat(el.dataset.duration); el.style.visibility = ${t} >= a && ${t} < a + d ? 'visible' : 'hidden'; }); })()`);
    frames.push(await sharp(Buffer.from(await page.screenshot({ type: 'jpeg', quality: 60 }))).resize(96, 96, { fit: 'fill' }).greyscale().raw().toBuffer());
  }
  let still = 0;
  let run = 0;
  let longest = 0;
  for (let i = 1; i < frames.length; i++) {
    let d = 0;
    for (let k = 0; k < frames[i].length; k++) d += Math.abs(frames[i][k] - frames[i - 1][k]);
    const calm = d / frames[i].length / 255 < 0.005;
    if (calm) still++;
    run = calm ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return { share: Math.round((still / Math.max(1, frames.length - 1)) * 100) / 100, longest: Math.round((longest / fps) * 10) / 10 };
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const storageDir = path.join(OUT, 'storage');
  configureCore({
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined } as never,
    storage: {
      uploadFile: async (content: Buffer, fileName: string, folder: string) => {
        const d = path.join(storageDir, folder);
        fs.mkdirSync(d, { recursive: true });
        fs.writeFileSync(path.join(d, fileName), content);
        return { downloadURL: `file://${path.join(d, fileName)}` };
      },
    } as never,
  });
  const report: Record<string, unknown> = { date: new Date().toISOString() };

  // A. Les jetons
  console.log('A. Jetons (agents simulés, réponses de longueur réelle)');
  const rows: string[] = ['| demande | cran | appels avant → après | jetons envoyés avant → après | jetons reçus avant → après |', '| --- | --- | --- | --- | --- |'];
  const tokens: Record<string, unknown> = {};
  for (const [name, request] of Object.entries(REQUESTS)) {
    for (const level of fast ? (['medium'] as const) : (['medium', 'ultra'] as const)) {
      const before = await tokensFor('avant', request, level);
      const after = await tokensFor('après', request, level);
      tokens[`${name}/${level}`] = { before, after };
      rows.push(`| ${name} | ${level} | ${before.calls} → ${after.calls} | ${before.input} → ${after.input} (−${Math.round((1 - after.input / Math.max(1, before.input)) * 100)} %) | ${before.output} → ${after.output} |`);
      console.log(`  ${name}/${level} : ${before.calls} appels → ${after.calls} · envoyés ${before.input} → ${after.input} · reçus ${before.output} → ${after.output} · rôles après ${Object.keys(after.byRole).join(', ')}`);
      check(after.calls < before.calls && after.input < before.input * 0.6 && !after.byRole['video.template'] && !after.byRole['video.concept'] && !after.byRole['video.brief'], `jetons ${name}/${level} : un seul appel de film, −40 % au moins de jetons envoyés`, JSON.stringify(after.byRole));
    }
  }
  report.tokens = tokens;
  await closeFilmBrowser().catch(() => undefined);

  // B. Les films figés
  console.log('\nB. Rendu de films figés (aucun modèle)');
  resetVideoCatalog();
  await videoCatalog();
  const img = (fill: string) => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><rect width="1600" height="1200" fill="${fill}"/><circle cx="1050" cy="520" r="300" fill="#e3a03a"/><rect x="260" y="420" width="420" height="560" rx="30" fill="#163a5f"/><rect y="900" width="1600" height="300" fill="#2f6b50"/></svg>`)).jpeg({ quality: 82 }).toBuffer();
  const files = { 'p1.jpg': await img('#cfe1d6'), 'p2.jpg': await img('#e9d8c4'), 'logo.png': await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="120"><circle cx="60" cy="60" r="46" fill="#1f6f4a"/><text x="122" y="80" font-family="Arial" font-size="58" font-weight="700" fill="#16181d">Kora</text></svg>')).png().toBuffer() };
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const quality: Record<string, unknown> = {};
  const qrows: string[] = ['| film | séquences | traversées | développements | temps mort total avant → après | scènes > ' + IDLE_MAX + ' s avant → après | continuité | cadence | sujet | repos avant → après |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'];
  for (const [name, scenes] of Object.entries(FILMS)) {
    for (const format of fast ? (['story'] as FilmFormatId[]) : (['story', 'square'] as FilmFormatId[])) {
      const input = { scenes, film: { title: name, concept: name, seed: 'bench' }, brand: { name: 'Kora', hasLogo: true, line: 'Kora · café' }, formats: [format], level: 'medium' as const, call: { level: 'medium' as const, call: async () => '' } };
      process.env.VIDEO_SEQUENCES = 'off';
      process.env.VIDEO_DEVELOP = 'off';
      const flat = await composeFilmFromCatalog(input);
      delete process.env.VIDEO_SEQUENCES;
      delete process.env.VIDEO_DEVELOP;
      const film = await composeFilmFromCatalog(input);
      const idleB = flat.scenes.map((s) => s.quality?.idle ?? 0);
      const idleA = film.scenes.map((s) => s.quality?.idle ?? 0);
      const seqs = new Set(film.scenes.map((s) => s.config.sequence).filter(Boolean)).size;
      const carries = film.scenes.filter((s) => s.quality?.carry).length;
      const develops = sum(film.scenes.map((s) => s.quality?.develops?.length ?? 0));
      quality[`${name}/${format}`] = { sequences: seqs, carries, develops, idleBefore: idleB, idleAfter: idleA, detail: film.trace.detail };
      qrows.push(`| ${name} (${format}) | ${seqs} | ${carries} | ${develops} | ${sum(idleB).toFixed(1)} s → ${sum(idleA).toFixed(1)} s | ${idleB.filter((x) => x > IDLE_MAX).length} → ${idleA.filter((x) => x > IDLE_MAX).length} |`);
      console.log(`  ${name}/${format} : ${seqs} séquence(s), ${carries} traversée(s), ${develops} développement(s), temps mort ${sum(idleB).toFixed(1)} s → ${sum(idleA).toFixed(1)} s`);
      check(carries >= 1 && sum(idleA) <= sum(idleB) && film.trace.source === 'code', `film ${name}/${format} : au moins une traversée, temps mort qui ne monte pas, choix du code`, film.trace.detail);
      const rests: { share: number; longest: number }[] = [];
      const [b, a] = [await sheet(page, flat, scenes, format, files, rests), await sheet(page, film, scenes, format, files, rests)];
      const m = film.metrics;
      qrows[qrows.length - 1] += ` ${m?.continuity ?? '-'} | ${m?.cadence ?? '-'} | ${Math.round((m?.subject ?? 0) * 100)} % | ${Math.round(rests[0].share * 100)} % → ${Math.round(rests[1].share * 100)} % (calme ${rests[1].longest} s) |`;
      (quality[`${name}/${format}`] as Record<string, unknown>).rest = rests;
      (quality[`${name}/${format}`] as Record<string, unknown>).metrics = m;
      fs.writeFileSync(path.join(OUT, `${name}-${format}-avant.jpg`), b);
      fs.writeFileSync(path.join(OUT, `${name}-${format}-apres.jpg`), a);
    }
  }
  await browser.close();
  report.quality = quality;

  // C. La référence
  console.log('\nC. Vidéo modèle (mesure par le code, vision par paquets)');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-ref-'));
  const src = path.join(dir, 'src.png');
  await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#e9d8c4"/><circle cx="640" cy="360" r="160" fill="#1f6f4a"/><rect x="120" y="120" width="220" height="140" fill="#163a5f"/><rect x="940" y="480" width="200" height="120" fill="#e3a03a"/><rect x="540" y="80" width="200" height="40" fill="#14324a"/></svg>')).png().toFile(src);
  const zoomA = path.join(dir, 'a.jpg');
  const zoomB = path.join(dir, 'b.jpg');
  await sharp(src).resize(640, 360).jpeg().toFile(zoomA);
  await sharp(src).extract({ left: 128, top: 72, width: 1024, height: 576 }).resize(640, 360).jpeg().toFile(zoomB);
  const cam = await measureCamera(fs.readFileSync(zoomA), fs.readFileSync(zoomB));
  const still = await measureCamera(fs.readFileSync(zoomA), fs.readFileSync(zoomA));
  check(cam === 'push' && still === 'still', `caméra mesurée par le code : zoom avant → « ${cam} », plan fixe → « ${still} »`);
  // Une vidéo de 12 plans (couleurs franches) : la vision lue par paquets de quatre.
  const clip = path.join(dir, 'ref.mp4');
  const colors = ['red', 'green', 'blue', 'yellow', 'purple', 'orange', 'white', 'gray', 'cyan', 'magenta', 'brown', 'pink'];
  const r = spawnSync('ffmpeg', ['-v', 'error', ...colors.flatMap((c) => ['-f', 'lavfi', '-i', `color=c=${c}:s=320x568:d=1.5`]), '-filter_complex', `${colors.map((_, i) => `[${i}:v]`).join('')}concat=n=${colors.length}:v=1:a=0[v]`, '-map', '[v]', '-pix_fmt', 'yuv420p', '-y', clip]);
  let visionCalls = 0;
  if (r.status === 0) {
    const bp = await analyzeReferenceVideo(clip, {
      vision: async (_b, _m, instruction) => {
        visionCalls++;
        const n = [...instruction.matchAll(/SHOT n/g)].length ? 4 : 1;
        return JSON.stringify(Array.from({ length: n }, () => ({ role: 'claim', layout: 'centered-title', camera: 'still', energy: 'medium', description: 'A title enters.' })));
      },
    });
    check(bp.shots.length >= 10 && visionCalls <= Math.ceil(bp.shots.length / 4) + 1, `vision par paquets : ${bp.shots.length} plans lus en ${visionCalls} appel(s) (un appel par plan avant)`);
    report.reference = { shots: bp.shots.length, visionCalls };
  } else check(false, 'vidéo modèle de synthèse (ffmpeg)', String(r.stderr).slice(0, 200));
  fs.rmSync(dir, { recursive: true, force: true });

  const md = ['# Banc du moteur vidéo', '', `${new Date().toISOString().slice(0, 16)} · agents simulés, rendu local, aucun coût.`, '', '## Jetons (estimés)', '', ...rows, '', '## Films figés', '', ...qrows, '', 'Planches : `*-avant.jpg` / `*-apres.jpg` (3 instants par scène : 25 %, 60 %, 97 %).', ''].join('\n');
  fs.writeFileSync(path.join(OUT, 'RAPPORT.md'), md);
  fs.writeFileSync(path.join(OUT, 'rapport.json'), JSON.stringify(report, null, 2));
  console.log(`\n${md}`);
  console.log(`\n${failures ? '✗' : '✓'} Banc vidéo : ${failures} échec(s) · ${OUT}`);
  process.exit(failures ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  await closeFilmBrowser().catch(() => undefined);
  process.exit(1);
});

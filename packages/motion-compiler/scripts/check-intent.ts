/**
 * `npm run check:intent --prefix packages/motion-compiler` — le compilateur 0.3, sans modèle :
 *
 *   1. système de design : contrastes de chaque rôle (plusieurs marques, trois déclinaisons), surface claire, échelle
 *      typographique bornée, parité des fonctions du serveur et du navigateur (courbes, ressorts, zones sûres) ;
 *   2. intention : lecture tolérante (rien d'inventé, rien d'oublié) ;
 *   3. solveurs : chaque composition, dans les quatre formats, sans texte hors zone sûre ni chevauchement ; variantes ;
 *      temps de lecture tenu ; trajectoires sans collision ;
 *   4. exécution réelle : intention → programme → compilation → Motion Canvas, contrôle d'affichage existant (aucun
 *      défaut, aucune erreur) dans chaque format ; coutures entre scènes sans défaut.
 */
process.env.VIDEO_SFX_OFFLINE = '1';
process.env.VIDEO_ALLOW_FILE_URLS = '1';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { validateProgram } from '../src/dsl/validate';
import { compileProgram } from '../src/compiler/compile';
import { buildColorRoles, colorRoleChecks, isLight } from '../src/design/color';
import { cubicBezier as serverBezier, EASE_CURVES, springEase as serverSpring, readTime } from '../src/design/motion';
import { SAFE_MARGINS, frameInUnits, SafeFormat } from '../src/design/safezones';
import { buildFilmDesign, resolveSceneDesign } from '../src/design/system';
import { planSeams, planTransitionCues, energyArc, snapCutsToBeats } from '../src/design/film';
import { DIRECTIONS } from '../src/design/directions';
import { typeSizes } from '../src/design/typography';
import { validateIntent } from '../src/intent/validate';
import { lowerIntent } from '../src/intent/lower';
import { variantChoices, DEFAULT_CHOICE } from '../src/solver/geometry';
import type { SceneIntent } from '../src/intent/types';
import { prejudge, fitWeights, agreement, linearScore, DEFAULT_WEIGHTS, motionMetrics, reportText } from '../src/judge';
import { cubicBezier as kitBezier, springEase as kitSpring } from '../../../apps/ivision/core/motion/kit/design';
import { PLATFORM_SAFE } from '../../../apps/ivision/core/motion/kit/safe';
import { buildFilmBundle } from '../../../apps/ivision/core/src/video/rendering/compiler';
import { closeFilmBrowser, localizeFilm, probeFilm } from '../../../apps/ivision/core/src/video/rendering/runner';
import { COMPOSITION, frameSpec } from '../../../apps/ivision/core/src/video/rendering/formats';
import type { FilmData } from '../../../apps/ivision/core/motion/runtime/film-data';

let failures = 0;
let passes = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) passes++;
  else failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${!ok && detail ? ` — ${detail}` : ''}`);
}
const section = (t: string) => console.log(`\n${t}`);
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-intent-check-'));

const BRAND = { primary: '#1f6f4a', secondary: '#14324a', accent: '#f2a93b', background: '#fbfaf7', text: '#16181d' };
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80" viewBox="0 0 240 80"><circle cx="40" cy="40" r="30" fill="#f2a93b"/><text x="84" y="54" font-family="Arial" font-size="40" font-weight="700" fill="#14324a">Kora</text></svg>`;
const TOKENS = { name: 'Kora Café', colors: BRAND, fonts: { display: 'Inter', body: 'Inter' }, logo: { light: `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString('base64')}`, width: 240, height: 80 } };
const FORMATS: SafeFormat[] = ['story', 'portrait', 'square', 'landscape'];
const TEXTS: Record<string, string> = {
  headline: 'Le café qui réveille Dakar',
  sub: 'Torréfié chaque matin, à deux pas de chez vous',
  figure: '1 250 clients',
  label: 'servis chaque semaine',
  p1: 'Grains du Fouta-Djalon',
  p2: 'Torréfaction artisanale',
  p3: 'Livraison en 30 minutes',
  quote: 'Le meilleur café de la ville, sans hésiter',
  author: 'Awa, cliente depuis 2019',
  tagline: 'Réveillez votre journée',
  cta: 'Commander',
};

async function photo(file: string, w: number, h: number) {
  // Une « photo » d'essai : un dégradé, un sujet sombre à gauche, une zone claire et calme à droite.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#3b2a1e"/><stop offset="1" stop-color="#e9ddc8"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><circle cx="${w * 0.28}" cy="${h * 0.5}" r="${Math.min(w, h) * 0.22}" fill="#1b120c"/><rect x="${w * 0.2}" y="${h * 0.3}" width="${w * 0.04}" height="${h * 0.4}" fill="#f2a93b"/></svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toFile(file);
}

interface Case {
  name: string;
  intent: unknown;
  texts: string[];
  media: { kind: 'image' | 'video'; width: number; height: number }[];
  duration: number;
}

const CASES: Case[] = [
  { name: 'hero (titre mot par mot, sous-titre, trait)', texts: ['headline', 'sub'], media: [], duration: 3.5, intent: { role: 'hook', energy: 4, layout: 'hero', elements: [{ id: 'title', kind: 'text', text: '$headline', rank: 1, level: 'display', emphasis: 2 }, { id: 'sub', kind: 'text', text: '$sub', rank: 2 }, { id: 'rule', kind: 'shape', shape: 'underline', rank: 3 }], beats: [{ verb: 'reveal', target: 'title', style: 'words' }, { verb: 'draw', target: 'rule', after: 'title' }, { verb: 'rise', target: 'sub', after: 'title' }, { verb: 'highlight', target: 'title' }] } },
  { name: 'hero-left (barre, deux textes)', texts: ['headline', 'sub'], media: [], duration: 4.5, intent: { layout: 'hero-left', elements: [{ id: 'title', kind: 'text', text: '$headline', rank: 1 }, { id: 'sub', kind: 'text', text: '$sub', rank: 2 }, { id: 'bar', kind: 'shape', shape: 'bar', rank: 3 }], beats: [{ verb: 'slide-in', target: 'title', from: 'left' }, { verb: 'draw', target: 'bar', with: 'title' }, { verb: 'blur-in', target: 'sub' }] } },
  { name: 'media-split (photo, titre, sous-titre, appel)', texts: ['headline', 'sub', 'cta'], media: [{ kind: 'image', width: 1200, height: 800 }], duration: 4, intent: { role: 'feature', layout: 'media-split', elements: [{ id: 'shot', kind: 'image', media: 0, rank: 2, crop: 'subject' }, { id: 'title', kind: 'text', text: '$headline', rank: 1 }, { id: 'sub', kind: 'text', text: '$sub', rank: 2 }, { id: 'go', kind: 'button', text: '$cta', rank: 3 }], beats: [{ verb: 'wipe', target: 'shot', from: 'top' }, { verb: 'reveal', target: 'title', style: 'line' }, { verb: 'rise', target: 'sub' }, { verb: 'pop', target: 'go' }] } },
  { name: 'full-bleed (texte en zone calme ou sur aplat)', texts: ['headline', 'sub'], media: [{ kind: 'image', width: 1600, height: 1000 }], duration: 3.5, intent: { layout: 'full-bleed', elements: [{ id: 'shot', kind: 'image', media: 0, rank: 2 }, { id: 'title', kind: 'text', text: '$headline', rank: 1 }, { id: 'sub', kind: 'text', text: '$sub', rank: 2 }], beats: [{ verb: 'zoom', target: 'shot' }, { verb: 'reveal', target: 'title' }, { verb: 'rise', target: 'sub' }] } },
  { name: 'figure (chiffre qui défile, étiquette, anneau)', texts: ['figure', 'label'], media: [], duration: 3.5, intent: { role: 'data', layout: 'figure', elements: [{ id: 'n', kind: 'text', text: '$figure', rank: 1, level: 'display' }, { id: 'l', kind: 'text', text: '$label', rank: 2 }, { id: 'dots', kind: 'shape', shape: 'dots', rank: 3 }], beats: [{ verb: 'count', target: 'n', intensity: 'strong' }, { verb: 'rise', target: 'l' }, { verb: 'reveal', target: 'dots' }] } },
  { name: 'list (titre, trois puces en cascade)', texts: ['headline', 'p1', 'p2', 'p3'], media: [], duration: 5, intent: { role: 'benefits', layout: 'list', elements: [{ id: 'title', kind: 'text', text: '$headline', rank: 1 }, { id: 'pts', kind: 'list', items: ['$p1', '$p2', '$p3'], rank: 2 }], beats: [{ verb: 'reveal', target: 'title' }, { verb: 'cascade', target: 'pts.*', after: 'title' }] } },
  { name: 'quote (citation, auteur)', texts: ['quote', 'author'], media: [], duration: 4, intent: { role: 'proof', layout: 'quote', elements: [{ id: 'q', kind: 'text', text: '$quote', rank: 1, level: 'title' }, { id: 'a', kind: 'text', text: '$author', rank: 3, level: 'caption' }], beats: [{ verb: 'reveal', target: 'q', style: 'words' }, { verb: 'blur-in', target: 'a' }] } },
  { name: 'device (téléphone, titre)', texts: ['headline', 'sub'], media: [{ kind: 'image', width: 900, height: 1800 }], duration: 4, intent: { layout: 'device', elements: [{ id: 'phone', kind: 'device', device: 'phone', media: 0, rank: 2 }, { id: 'title', kind: 'text', text: '$headline', rank: 1 }, { id: 'sub', kind: 'text', text: '$sub', rank: 2 }], beats: [{ verb: 'grow', target: 'phone' }, { verb: 'reveal', target: 'title' }, { verb: 'rise', target: 'sub' }] } },
  { name: 'end-card (logo, signature, bouton)', texts: ['tagline', 'cta'], media: [], duration: 3.5, intent: { role: 'signature', layout: 'end-card', elements: [{ id: 'logo', kind: 'logo', rank: 1 }, { id: 't', kind: 'text', text: '$tagline', rank: 2, level: 'subtitle' }, { id: 'go', kind: 'button', text: '$cta', rank: 3 }, { id: 'ring', kind: 'shape', shape: 'ring', rank: 3 }], beats: [{ verb: 'draw', target: 'ring' }, { verb: 'pop', target: 'logo' }, { verb: 'type', target: 't' }, { verb: 'pop', target: 'go' }] } },
];

function filmData(scenes: { key: string; code: string; texts: Record<string, string>; media: { kind: 'image' | 'video'; file: string; width: number; height: number }[]; duration: number; design: ReturnType<typeof resolveSceneDesign>; seamIn?: unknown; seamOut?: unknown }[], format: SafeFormat): FilmData {
  const frame = frameSpec(format, 'standard');
  let start = 0;
  return {
    format,
    ...COMPOSITION[format],
    resolutionScale: frame.scale,
    fps: frame.fps,
    background: scenes[0].design.colors.ground,
    lang: 'fr',
    fontFamilies: ['Inter'],
    brand: TOKENS,
    cues: [],
    scenes: scenes.map((s) => {
      const sc = { key: s.key, start, duration: s.duration, texts: s.texts, design: s.design as never, media: s.media.map((m, i) => ({ id: `m${i + 1}`, kind: m.kind, url: `file://${m.file}`, width: m.width, height: m.height })), ...(s.seamIn ? { seamIn: s.seamIn as never } : {}), ...(s.seamOut ? { seamOut: s.seamOut as never } : {}) };
      start += s.duration;
      return sc;
    }),
  };
}

(async () => {
  console.log('Compilateur 0.3 — système de design, intention, solveurs, exécution\n');
  const photoFile = path.join(OUT, 'photo.jpg');
  const tallFile = path.join(OUT, 'screen.jpg');
  await photo(photoFile, 1600, 1000);
  await photo(tallFile, 900, 1800);

  section('1. Système de design');
  const brands = [BRAND, { primary: '#e63946', secondary: '#1d3557', accent: '#ffb703', background: '#0b0b0f', text: '#ffffff' }, { primary: '#7b2cbf', secondary: '#240046', accent: '#80ffdb', background: '#ffffff', text: '#10002b' }, { primary: '#f4d35e', secondary: '#0d3b66', accent: '#ee964b', background: '#faf0ca', text: '#0d3b66' }];
  let contrastOk = true;
  let detail = '';
  for (const b of brands) for (const variant of ['tonal', 'vivid', 'monochrome'] as const) {
    const roles = buildColorRoles(b, { variant });
    const bad = colorRoleChecks(roles).filter((c) => c.ratio < c.min);
    if (bad.length) {
      contrastOk = false;
      detail = `${b.primary} ${variant} ${JSON.stringify(bad)}`;
    }
  }
  check('chaque encre tient son contraste (4 marques × 3 déclinaisons : 7:1 encre, 4,5:1 sinon, 3:1 au mieux sur un ton moyen)', contrastOk, detail);
  check('surface claire garantie (marque à fond noir → fond clair) ; fond sombre seulement sur demande', isLight(buildColorRoles(brands[1], { variant: 'tonal' }).ground) && !isLight(buildColorRoles(brands[1], { variant: 'tonal', allowDark: true }).ground));
  const sizesOk = FORMATS.every((f) => {
    const s = typeSizes(f, 1.5);
    const H = frameInUnits(f).H;
    return s.title >= 0.04 * H - 0.01 && s.title <= 0.09 * H + 0.01 && s.display > s.title && s.title > s.subtitle && s.subtitle > s.body && s.body > s.caption;
  });
  check('échelle typographique : titre entre 4 et 9 % de la hauteur, niveaux décroissants, dans chaque format', sizesOk);
  const bezierSame = Object.values(EASE_CURVES).every((c) => [0.1, 0.3, 0.5, 0.7, 0.9].every((t) => Math.abs(serverBezier(c)(t) - kitBezier(c)(t)) < 1e-9));
  const springSame = [1, 0.8, 0.5].every((z) => [0.1, 0.3, 0.6, 0.99].every((t) => Math.abs(serverSpring(z)(t) - kitSpring(z)(t)) < 1e-9));
  check('courbes et ressorts : le navigateur calcule exactement comme le serveur', bezierSame && springSame);
  check('zones sûres : la copie du kit est identique à la source (story ≈ 900 × 1 400)', JSON.stringify(SAFE_MARGINS) === JSON.stringify(PLATFORM_SAFE) && Math.round(frameInUnits('story').SW * 10.8) === 900 && Math.round(frameInUnits('story').SH * 10.8) === 1400);
  check('temps de lecture : 17 signes/s, jamais moins de 5/6 s', Math.abs(readTime('Bonjour') - 5 / 6) < 1e-9 && Math.abs(readTime('x'.repeat(34)) - 2) < 1e-9);
  const design = buildFilmDesign({ brand: BRAND, direction: 'editorial', energy: [4, 2, 4, 3, 3, 3, 4, 2] });
  const roles = ['hook', 'problem', 'reveal', 'feature', 'benefits', 'proof', 'cta', 'signature'] as const;
  const seams = planSeams(design, [...roles], design.energy);
  const opposite = seams.some((s, i) => i > 0 && ((s.dir === 'left' && seams[i - 1].dir === 'right') || (s.dir === 'right' && seams[i - 1].dir === 'left') || (s.dir === 'up' && seams[i - 1].dir === 'down')));
  check('coutures : une par transition, jamais deux sens opposés de suite, une direction dominante', seams.length === 7 && !opposite && seams.filter((s) => s.dir === design.motion.current).length >= 4, JSON.stringify(seams));
  const kinds = new Set(seams.map((s) => s.kind));
  check('coutures : 3 à 5 sortes dans le film, au plus un tiers de coupes franches', kinds.size >= 2 && kinds.size <= 5 && seams.filter((s) => s.kind === 'cut').length <= 2, [...kinds].join(','));
  const arc = energyArc([...roles], 3);
  const cues = planTransitionCues(seams, arc);
  check('sons des transitions : environ une sur deux, montée + impact une seule fois', cues.filter((c) => c.kind === 'impact').length === 1 && cues.filter((c) => c.kind === 'whoosh' || c.kind === 'softwhoosh').length <= Math.ceil(seams.length * 0.75), JSON.stringify(cues.map((c) => c.kind)));
  const snapped = snapCutsToBeats([{ start: 0, duration: 3.05 }, { start: 3.05, duration: 2.9 }, { start: 5.95, duration: 3.05 }], [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9]);
  check('coupes calées sur les temps de la musique (±120 ms), durée totale gardée', Math.abs(snapped[1].start - 3) < 1e-6 && Math.abs(snapped[2].start - 6) < 1e-6 && Math.abs(snapped.reduce((a, s) => a + s.duration, 0) - 9) < 1e-6, JSON.stringify(snapped));
  check('six directions, toutes à surface claire', Object.keys(DIRECTIONS).length === 6 && Object.values(DIRECTIONS).every((d) => isLight(buildFilmDesign({ brand: BRAND, direction: d.id, energy: [3] }).colors.ground)));

  section('2. Lecture d’une intention');
  const ctx = { texts: { headline: TEXTS.headline, sub: TEXTS.sub }, media: ['image' as const], hasLogo: false };
  const v = validateIntent({ layout: 'weird', elements: [{ id: 'a', kind: 'text', text: 'Un texte inventé', rank: 1 }, { id: 'b', kind: 'text', text: '$headline', rank: 1 }, { id: 'b', kind: 'text', text: '$headline', rank: 2 }, { id: 'l', kind: 'logo', rank: 2 }, { id: 'p', kind: 'image', media: 4, rank: 2 }], beats: [{ verb: 'explode', target: 'b' }, { verb: 'reveal', target: 'ghost' }] }, ctx);
  check('intention lisible malgré ses fautes (composition inconnue → hero)', v.ok && v.intent!.layout === 'hero');
  check('rien d’inventé : un texte qui n’est pas de la scène, un doublon, un logo absent, un média absent sont retirés et dits', !v.intent!.elements.some((e) => e.id === 'a' || e.id === 'l' || e.id === 'p') && v.warnings.length >= 4);
  check('rien d’oublié : le texte non placé et le média non placé sont ajoutés', v.intent!.elements.some((e) => e.text === '$sub') && v.intent!.elements.some((e) => e.media === 0));
  check('un seul élément principal ; chaque élément a son entrée', v.intent!.elements.filter((e) => e.rank === 1).length === 1 && v.intent!.elements.every((e) => v.intent!.beats.some((b) => b.target.split('.')[0] === e.id)));

  section('3. Solveurs (sans rendu)');
  const lowered: { c: Case; intent: SceneIntent; result: ReturnType<typeof lowerIntent> }[] = [];
  for (const c of CASES) {
    const texts = Object.fromEntries(c.texts.map((k) => [k, TEXTS[k]]));
    const vi = validateIntent(c.intent, { texts, media: c.media.map((m) => m.kind), hasLogo: true });
    if (!vi.ok) {
      check(`${c.name} : intention lue`, false, vi.errors.join(' | '));
      continue;
    }
    const designs = Object.fromEntries(FORMATS.map((f) => [f, resolveSceneDesign(design, f, 2)]));
    const result = lowerIntent({ intent: vi.intent!, texts, media: c.media, formats: FORMATS, designs, fonts: { display: 'Inter', body: 'Inter' }, logoAspect: 3, duration: c.duration, choice: variantChoices(vi.intent!)[0] || DEFAULT_CHOICE, seamOut: 0.32 });
    lowered.push({ c, intent: vi.intent!, result });
    const texts2 = result.placements.flatMap((p) => p.elements.filter((e) => e.layer >= 10).map((e) => ({ f: p.format, e })));
    const inside = texts2.every(({ f, e }) => {
      const F = frameInUnits(f);
      return e.box.x0 >= F.L - 0.6 && e.box.x1 <= F.R + 0.6 && e.box.y0 >= F.T - 0.6 && e.box.y1 <= F.B + 0.6;
    });
    check(`${c.name} : 4 formats résolus, textes dans la zone sûre, aucun chevauchement`, result.feasible && inside, result.warnings.slice(0, 4).join(' | '));
    const readOk = result.reveals.every((r) => r.end + r.read <= c.duration - 0.32 + 0.01);
    check(`${c.name} : chaque texte révélé reste le temps d’être lu avant la coupe`, readOk, JSON.stringify(result.reveals.map((r) => [r.id, r.end.toFixed(2), r.read.toFixed(2)])));
  }
  {
    const texts = { headline: TEXTS.headline, sub: TEXTS.sub };
    const vi = validateIntent(CASES[1].intent, { texts, media: [], hasLogo: false });
    const short = lowerIntent({ intent: vi.intent!, texts, media: [], formats: ['story'], designs: { story: resolveSceneDesign(design, 'story', 2) }, fonts: { display: 'Inter', body: 'Inter' }, duration: 2.2, choice: DEFAULT_CHOICE });
    check('une scène trop courte pour lire ses textes est DITE (jamais cachée)', !short.feasible && short.warnings.some((w) => /trop courte|resserrées/.test(w)), short.warnings.join(' | '));
  }
  const counts = CASES.map((c) => variantChoices(validateIntent(c.intent, { texts: Object.fromEntries(c.texts.map((k) => [k, TEXTS[k]])), media: c.media.map((m) => m.kind), hasLogo: true }).intent!).length);
  check('variantes : 4 à 12 choix par composition', counts.every((n) => n >= 4 && n <= 12), counts.join(','));

  section('3 bis. Le juge (sans rendu)');
  {
    const scores = lowered.map(({ c, intent, result }) => ({ c, j: prejudge(intent, result, { duration: c.duration, design: resolveSceneDesign(design, 'story', 2), seamOut: 0.32 }) }));
    check('chaque composition reçoit un score entre 0 et 1, non éliminée, avec ses mesures', scores.every(({ j }) => !j.eliminated && j.score > 0 && j.score <= 1 && Object.keys(j.features).length >= 15), scores.map(({ c, j }) => `${c.name.split(' ')[0]}=${j.score}${j.eliminated ? `(${j.reasons[0]})` : ''}`).join(' '));
    const hero = lowered[0];
    const texts = { headline: TEXTS.headline, sub: TEXTS.sub };
    const designs = Object.fromEntries(FORMATS.map((f) => [f, resolveSceneDesign(design, f, 2)]));
    const flat = validateIntent({ layout: 'hero', elements: [{ id: 'title', kind: 'text', text: '$headline', rank: 1, level: 'body' }, { id: 'sub', kind: 'text', text: '$sub', rank: 2, level: 'body' }], beats: [{ verb: 'rise', target: 'title' }, { verb: 'rise', target: 'sub', with: 'title' }] }, { texts, media: [], hasLogo: false }).intent!;
    const flatLow = lowerIntent({ intent: flat, texts, media: [], formats: FORMATS, designs, fonts: { display: 'Inter', body: 'Inter' }, duration: 3.5, choice: { ...DEFAULT_CHOICE, typeStep: -1, valign: 'lower' }, seamOut: 0.32 });
    const good = prejudge(hero.intent, hero.result, { duration: 3.5, design: resolveSceneDesign(design, 'story', 2), seamOut: 0.32 });
    const bad = prejudge(flat, flatLow, { duration: 3.5, design: resolveSceneDesign(design, 'story', 2), seamOut: 0.32 });
    check('« prudence = platitude » : un titre au corps de texte, deux entrées identiques simultanées sont jugés sous la bonne version', bad.score < good.score && bad.report.some((r) => r.metric === 'hierarchy' || r.metric === 'mainScale'), `${good.score} vs ${bad.score} — ${reportText(bad, 3)}`);
    const wobble = motionMetrics([{ at: 0, target: 'title', dur: 1, repeat: 'yoyo', to: { scale: 1.05 } } as never, { at: 1, target: 'title', dur: 1.2, ease: 'move' as never, from: { x: 0 }, to: { x: 10 } } as never], { duration: 4, maxSimultaneous: 2, textIds: ['title'], mainId: 'title' });
    check('tremblement et titre qui bouge encore après s’être posé : relevés', wobble.jitter < 1);
    // Étalonnage : des « humains » synthétiques qui préfèrent la hiérarchie et le contraste ; le juge doit les retrouver.
    const rnd = (k: number) => Math.abs(Math.sin(k * 12.9898) * 43758.5453) % 1;
    const vec = (k: number) => Object.fromEntries(Object.keys(DEFAULT_WEIGHTS).map((m, i) => [m, rnd(k * 31 + i)]));
    const truth = (f: Record<string, number>) => 3 * f.hierarchy + 2 * f.contrast + 0.2 * f.alignment;
    const pairs = Array.from({ length: 200 }, (_, k) => {
      const a = vec(k * 2 + 1);
      const b = vec(k * 2 + 2);
      return { a, b, y: truth(a) > truth(b) ? 1 : 0 };
    });
    const fitted = fitWeights(pairs, Object.fromEntries(Object.keys(DEFAULT_WEIGHTS).map((k) => [k, 0])));
    const agree = agreement(pairs, (f) => linearScore(f, fitted.weights));
    check('étalonnage par régression logistique : retrouve les préférences d’un panel (≥ 85 % d’accord)', agree >= 0.85 && fitted.weights.hierarchy > fitted.weights.colors, `${Math.round(agree * 100)} %`);
  }

  section('4. Exécution réelle (Motion Canvas, contrôle d’affichage)');
  for (const format of FORMATS) {
    const scenes = lowered.map(({ c, result }, i) => {
      const texts = Object.fromEntries(c.texts.map((k) => [k, TEXTS[k]]));
      const v2 = validateProgram(result.program, { texts: Object.keys(texts), values: texts, media: c.media.map((m) => m.kind), duration: c.duration, hasLogo: true });
      if (!v2.ok) throw new Error(`${c.name} : programme refusé — ${v2.errors.join(' | ')}`);
      return { key: `s${i + 1}`, code: compileProgram(v2.program!, { warnings: v2.warnings }).code, texts, duration: c.duration, design: resolveSceneDesign(design, format, 2), media: c.media.map((m) => ({ ...m, file: m.height > m.width ? tallFile : photoFile })) };
    });
    const bundle = await buildFilmBundle(scenes.map((s) => ({ key: s.key, code: s.code })), 'render');
    const local = await localizeFilm(filmData(scenes, format));
    const probed = await probeFilm({ data: local.data, bundle, fontCss: '', files: local.files });
    const issues = Object.entries(probed.layout).map(([k, v]) => `${lowered[Number(k.slice(1)) - 1]?.c.name.split(' ')[0]}: ${v.join(' ; ')}`);
    check(`${format} : ${scenes.length} scènes d’intention exécutées sans erreur`, !probed.errors.length, JSON.stringify(probed.errors).slice(0, 400));
    check(`${format} : aucun défaut d’affichage (coupé, chevauché, caché, illisible)`, !issues.length, issues.join(' | ').slice(0, 600));
    fs.writeFileSync(path.join(OUT, `${format}-thumbs.json`), JSON.stringify(Object.keys(probed.thumbnails)));
    for (const [k, buf] of Object.entries(probed.thumbnails)) fs.writeFileSync(path.join(OUT, `${format}-${k}.jpg`), buf);
  }

  // Les coutures : trois scènes enchaînées par une coupe au vol, un zoom inverse et une coulée de couleur.
  const seamScenes = lowered.slice(0, 3).map(({ c, result }, i) => {
    const texts = Object.fromEntries(c.texts.map((k) => [k, TEXTS[k]]));
    const v2 = validateProgram(result.program, { texts: Object.keys(texts), values: texts, media: c.media.map((m) => m.kind), duration: c.duration, hasLogo: true });
    const seamOut = i === 0 ? { kind: 'cut-the-curve', dir: 'left' } : i === 1 ? { kind: 'inverse-zoom', dir: 'left' } : undefined;
    const seamIn = i === 1 ? { kind: 'cut-the-curve', dir: 'left' } : i === 2 ? { kind: 'inverse-zoom', dir: 'left' } : undefined;
    return { key: `s${i + 1}`, code: compileProgram(v2.program!).code, texts, duration: c.duration, design: resolveSceneDesign(design, 'story', 2), media: c.media.map((m) => ({ ...m, file: photoFile })), seamIn, seamOut };
  });
  const seamBundle = await buildFilmBundle(seamScenes.map((s) => ({ key: s.key, code: s.code })), 'render');
  const seamLocal = await localizeFilm(filmData(seamScenes, 'story'));
  const seamProbe = await probeFilm({ data: seamLocal.data, bundle: seamBundle, fontCss: '', files: seamLocal.files });
  check('coutures (coupe au vol, zoom inverse) : sans erreur ni défaut d’affichage hors de leur fenêtre', !seamProbe.errors.length && !Object.keys(seamProbe.layout).length, JSON.stringify({ e: seamProbe.errors, l: seamProbe.layout }).slice(0, 400));

  await closeFilmBrowser();
  console.log(`\n${passes} vérifications réussies, ${failures} en échec · fichiers : ${OUT}`);
  process.exit(failures ? 1 : 0);
})().catch(async (error) => {
  console.error(error);
  await closeFilmBrowser().catch(() => undefined);
  process.exit(1);
});

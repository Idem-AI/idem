/**
 * `npm run bench:quality:offline --prefix packages/motion-compiler` — GRATUIT (aucun modèle).
 *
 * Chaque scène de la bibliothèque de références (amorce écrite à la main + scènes du professeur acceptées) passe par le
 * compilateur 0.3 dans les QUATRE formats : solveur géométrique (meilleure variante au pré-jugement), solveur temporel,
 * compilation, exécution réelle dans Motion Canvas et contrôle d'affichage. Mesures : défauts d'affichage, textes qui
 * appelleraient le dernier recours (aplat, encre), score du juge. Sorties : `bench/out/quality/offline.json` et une
 * planche (`offline.html`) pour l'équipe.
 *
 * C'est la mesure gratuite du chantier 3 (« défauts au premier jet ») sur des intentions de qualité connue ; la mesure
 * sur les intentions écrites par les modèles est celle du banc payant.
 */
process.env.VIDEO_SFX_OFFLINE = '1';
process.env.VIDEO_ALLOW_FILE_URLS = '1';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { execFileSync } from 'child_process';
import { buildFilmDesign, resolveSceneDesign } from '../../src/design/system';
import { referenceLibrary, ReferenceScene } from '../../src/references/library';
import { validateIntent } from '../../src/intent/validate';
import { lowerIntent } from '../../src/intent/lower';
import { variantChoices } from '../../src/solver/geometry';
import { validateProgram } from '../../src/dsl/validate';
import { compileProgram } from '../../src/compiler/compile';
import { prejudge } from '../../src/judge';
import type { SafeFormat } from '../../src/design/safezones';
import { safeBox } from '../../src/design/safezones';
import { resolveIcon } from '../../../../apps/ivision/core/src/video/assets/icons';
import { buildFilmBundle } from '../../../../apps/ivision/core/src/video/rendering/compiler';
import { closeFilmBrowser, localizeFilm, probeFilm } from '../../../../apps/ivision/core/src/video/rendering/runner';
import { COMPOSITION, frameSpec } from '../../../../apps/ivision/core/src/video/rendering/formats';
import type { FilmData } from '../../../../apps/ivision/core/motion/runtime/film-data';

const OUT = path.join(__dirname, '../out/quality');
const FORMATS: SafeFormat[] = ['story', 'portrait', 'square', 'landscape'];
const BRAND = { primary: '#1f6f4a', secondary: '#14324a', accent: '#f2a93b', background: '#fbfaf7', text: '#16181d' };
const LOGO = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80" viewBox="0 0 240 80"><circle cx="40" cy="40" r="30" fill="#f2a93b"/><text x="84" y="54" font-family="Arial" font-size="40" font-weight="700" fill="#14324a">Kora</text></svg>').toString('base64')}`;
const SAMPLE: Record<string, string> = { title: 'Le café qui réveille Dakar', sub: 'Torréfié chaque matin, à deux pas de chez vous', figure: '1 250 clients', label: 'servis chaque semaine', p1: 'Grains du Fouta-Djalon', p2: 'Torréfaction artisanale', p3: 'Livré en 30 minutes', quote: 'Le meilleur café de la ville, sans hésiter', author: 'Awa, cliente depuis 2019', cta: 'Commander', tagline: 'Réveillez votre journée', tag: '-20 % ce week-end', before: 'Avant : une heure de queue', after: 'Maintenant : prêt en cinq minutes', date: '14 et 15 novembre', place: 'CICAD, Diamniadio' };

export interface EvalAssets {
  photo: string;
  clip: string;
}

export interface EvalResult {
  id: string;
  source: string;
  score: number;
  layout: Record<string, number>;
  fallbacks: number;
  errors: number;
  feasible: boolean;
  thumbs: Record<string, string>;
}

/** Les médias d'essai (une photo, un clip), créés une fois. */
export async function evalAssets(dir: string): Promise<EvalAssets> {
  fs.mkdirSync(dir, { recursive: true });
  const photo = path.join(dir, 'photo.jpg');
  if (!fs.existsSync(photo)) await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#5a3b22"/><stop offset="1" stop-color="#efe6d6"/></linearGradient></defs><rect width="1600" height="1000" fill="url(#g)"/><circle cx="420" cy="500" r="230" fill="#24160c"/></svg>')).jpeg().toFile(photo);
  const clip = path.join(dir, 'clip.webm');
  if (!fs.existsSync(clip)) execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30:duration=6', '-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '8', '-b:v', '0', '-crf', '40', clip]);
  return { photo, clip };
}

/**
 * Une scène de référence évaluée sans modèle : meilleure variante au pré-jugement, puis exécution réelle et contrôle
 * d'affichage dans les quatre formats (vignettes déposées dans `dir`).
 */
export async function evaluateReference(ref: ReferenceScene, assets: EvalAssets, dir: string): Promise<EvalResult | null> {
  const design = buildFilmDesign({ brand: BRAND, direction: 'editorial', energy: [3] });
  const keys = [...new Set(JSON.stringify(ref.intent).match(/\$\w+/g) || [])].map((k) => k.slice(1));
  const texts = Object.fromEntries(keys.map((k) => [k, SAMPLE[k] || 'Un texte de la scène']));
  const media = ref.media.map((kind) => ({ kind, width: kind === 'video' ? 1280 : 1600, height: kind === 'video' ? 720 : 1000 }));
  const v = validateIntent(ref.intent, { texts, media: ref.media, hasLogo: true, iconExists: (n) => !!resolveIcon(n) });
  if (!v.ok) return null;
  const designs = Object.fromEntries(FORMATS.map((f) => [f, resolveSceneDesign(design, f, 0)]));
  // Une durée LISIBLE : le temps de lire chaque texte, plus l'entrée et la sortie.
  const duration = Math.max(4, Math.round((Object.values(texts).reduce((a, t) => a + Math.max(5 / 6, t.length / 17), 0) + 1.6) * 2) / 2);
  let best: { code: string; score: number; feasible: boolean } | null = null;
  for (const choice of variantChoices(v.intent!)) {
    const lowered = lowerIntent({ intent: v.intent!, texts, media, formats: FORMATS, designs, fonts: { display: 'Inter', body: 'Inter' }, logoAspect: 3, duration, choice, seamOut: 0.32 });
    const p = validateProgram(lowered.program, { texts: keys, values: texts, media: ref.media, duration, hasLogo: true, icons: resolveIcon });
    if (!p.ok) continue;
    const j = prejudge(v.intent!, lowered, { duration, design: designs.story!, seamOut: 0.32 });
    if (!best || j.score > best.score) best = { code: compileProgram(p.program!).code, score: j.score, feasible: lowered.feasible };
  }
  if (!best) return null;
  const layout: Record<string, number> = {};
  const thumbs: Record<string, string> = {};
  let fallbacks = 0;
  let errors = 0;
  for (const format of FORMATS) {
    const spec = frameSpec(format, 'standard');
    const data: FilmData = { format, ...COMPOSITION[format], resolutionScale: 0.4, fps: spec.fps, background: design.colors.ground, lang: 'fr', fontFamilies: ['Inter'], brand: { name: 'Kora', colors: BRAND, fonts: { display: 'Inter', body: 'Inter' }, logo: { light: LOGO, width: 240, height: 80 } }, safe: safeBox(format), cues: [], scenes: [{ key: 's1', start: 0, duration, texts, design: resolveSceneDesign(design, format, 0) as never, media: ref.media.map((kind, i) => ({ id: `m${i}`, kind, url: `file://${kind === 'video' ? assets.clip : assets.photo}`, width: kind === 'video' ? 1280 : 1600, height: kind === 'video' ? 720 : 1000 })) }] };
    const bundle = await buildFilmBundle([{ key: 's1', code: best.code }], 'render');
    const local = await localizeFilm(data);
    const probe = await probeFilm({ data: local.data, bundle, fontCss: '', files: local.files }, { thumbnails: true });
    layout[format] = (probe.layout.s1 || []).length;
    fallbacks += (probe.contrast.s1 || []).length;
    errors += probe.errors.length;
    if (probe.thumbnails.s1) {
      const file = path.join(dir, `${ref.id}-${format}.jpg`);
      fs.writeFileSync(file, probe.thumbnails.s1);
      thumbs[format] = path.basename(file);
    }
  }
  return { id: ref.id, source: ref.source, score: best.score, layout, fallbacks, errors, feasible: best.feasible, thumbs };
}

async function main() {
  const dir = path.join(OUT, 'offline');
  const assets = await evalAssets(dir);
  const rows: EvalResult[] = [];
  for (const ref of referenceLibrary()) {
    const r = await evaluateReference(ref, assets, dir);
    if (!r) continue;
    rows.push(r);
    console.log(`${r.errors || Object.values(r.layout).some(Boolean) ? '✗' : '✓'} ${r.id} · score ${r.score} · défauts ${JSON.stringify(r.layout)} · recours ${r.fallbacks}`);
  }
  await closeFilmBrowser();
  const total = rows.reduce((a, r) => a + Object.values(r.layout).reduce((x, y) => x + y, 0), 0);
  fs.writeFileSync(path.join(OUT, 'offline.json'), JSON.stringify({ at: new Date().toISOString(), scenes: rows.length, defects: total, fallbacks: rows.reduce((a, r) => a + r.fallbacks, 0), rows }, null, 2));
  fs.writeFileSync(path.join(OUT, 'offline.html'), `<!doctype html><meta charset="utf-8"><title>Références</title><style>body{font:14px system-ui;background:#f7f5f0;margin:16px}div{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}figure{margin:0;background:#fff;padding:6px;border-radius:8px}img{width:100%}</style><div>${rows.map((r) => `<figure><img src="offline/${r.thumbs.story}" alt="${r.id}"><figcaption>${r.id} · ${r.score}</figcaption></figure>`).join('')}</div>`);
  console.log(`\n${rows.length} scènes · ${total} défauts d’affichage sur ${rows.length * FORMATS.length} rendus · ${rows.reduce((a, r) => a + r.fallbacks, 0)} recours à l’aplat/encre`);
}

if (require.main === module) void main();

/**
 * `npm run bench:renderers` — le BANC DES MOTEURS DE RENDU (chantier 11, 23/11/2026), gratuit : aucun modèle, aucun
 * média généré.
 *
 * Le même film du catalogue (des gabarits réels, textes réels, une photo et un logo dessinés par le code) est rendu :
 *   1. par HyperFrames (le moteur de production : Chrome sans écran, image par image) ;
 *   2. par Kinetograph (Apache-2.0, https://github.com/0xS4N4TG/kinetograph : la page lue par Node, peinte par un
 *      compositeur Rust sur le GPU, sans navigateur) — SEULEMENT s'il est installé sur le poste : le banc ne télécharge
 *      rien. Pour l'essayer : `npm i -D kinetograph` dans `apps/ivision/core` (Node 22+, macOS Apple Silicon, Linux x64
 *      ou Windows x64), puis relancer le banc.
 *
 * Il mesure le temps de chaque rendu, la durée et le nombre d'images des deux MP4, et leur RESSEMBLANCE image par image
 * (SSIM de FFmpeg : 1 = identiques ; en dessous de 0,9, Kinetograph ne rend pas fidèlement nos pages — polices,
 * `color-mix`, unités de conteneur, mesures de texte, caméra). Une planche (3 instants par scène, HyperFrames en haut,
 * Kinetograph en bas) est écrite dans `tmp/bench-renderers/`. Le banc ne BASCULE rien : il dit si la bascule vaut un
 * essai (plus rapide ET fidèle), la décision reste humaine.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import sharp from 'sharp';
import { configureCore } from '../src/runtime/host';
import { buildComposition } from '../src/video/rendering/hyperframes/composition';
import { renderHyperFrames } from '../src/video/rendering/hyperframes/render';
import { COMPOSITION } from '../src/video/rendering/formats';
import { FFMPEG } from '../src/video/rendering/ffmpeg';
import { resetVideoCatalog, videoCatalog } from '../src/video/catalog/registry';
import { assembleFilm, CatalogScene } from '../src/video/catalog/compose';
import type { FilmFormatId, GabaritNode, SceneConfig, ThemeNode } from '../src/video/catalog/types';

process.env.IDEM_TEMPLATES_DIR = process.env.IDEM_TEMPLATES_DIR || path.resolve(__dirname, '../../../../../idem-templates');
process.env.IDEM_QUALITY_MEMORY = '0';
configureCore({ logger: { info: () => undefined, warn: () => undefined, error: (m: string, meta?: unknown) => console.error(m, meta) } as never });
const OUT = path.resolve(__dirname, '../tmp/bench-renderers');
const FORMAT: FilmFormatId = (process.argv.find((a) => a.startsWith('--format='))?.slice(9) as FilmFormatId) || 'story';
const BRAND = { name: 'AgriLink', colors: { primary: '#1b7a5a', secondary: '#163a5f', accent: '#e3a03a', background: '#f6f7f4', text: '#14211c' }, fonts: { display: 'Fraunces', body: 'Karla' } };

const SCENES: Array<{ layout: string; role: CatalogScene['role']; texts: Record<string, string>; media?: boolean }> = [
  { layout: 'vlayout.media-full-caption', role: 'hook', texts: { headline: 'Marie vend sa récolte depuis la place du village', sub: 'Payée en 24 heures, sans intermédiaire.' }, media: true },
  { layout: 'vlayout.big-figure', role: 'proof', texts: { figure: '1 200', label: 'Exploitants servis en 2026', headline: 'Une croissance mois après mois' } },
  { layout: 'vlayout.list-steps', role: 'feature', texts: { headline: 'Comment ça marche', text2: 'L’exploitant choisit ses intrants à la borne', text3: 'Le dépôt prépare la commande en une heure', text4: 'Le paiement passe par mobile money' } },
  { layout: 'vlayout.cta-end', role: 'cta', texts: { headline: 'Installez une borne dans votre village', sub: 'Les dix premières coopératives sont équipées gratuitement.', cta: 'Écrire sur WhatsApp' } },
];

/** Kinetograph installé ? (le paquet `kinetograph` dans les node_modules, en remontant ; ou `KINETOGRAPH_BIN`). */
function kinetographBin(): string | null {
  if (process.env.KINETOGRAPH_BIN && fs.existsSync(process.env.KINETOGRAPH_BIN)) return process.env.KINETOGRAPH_BIN;
  for (let dir = path.resolve(__dirname, '..'); ; dir = path.dirname(dir)) {
    const bin = path.join(dir, 'node_modules', '.bin', 'kinetograph');
    if (fs.existsSync(bin)) return bin;
    if (path.dirname(dir) === dir) return null;
  }
}

function probe(file: string): { duration: number; frames: number } {
  const r = spawnSync(process.env.FFPROBE_PATH || 'ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=nb_read_frames:format=duration', '-of', 'json', file], { encoding: 'utf8' });
  const j = JSON.parse(r.stdout || '{}');
  return { duration: Number(j.format?.duration) || 0, frames: Number(j.streams?.[0]?.nb_read_frames) || 0 };
}

/** SSIM moyen des deux films (le second ramené à la taille et à la cadence du premier). */
function ssim(a: string, b: string, width: number, height: number, fps: number): number | null {
  const r = spawnSync(FFMPEG, ['-v', 'info', '-i', a, '-i', b, '-lavfi', `[1:v]scale=${width}:${height},fps=${fps}[b];[0:v]fps=${fps}[a];[a][b]ssim`, '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /SSIM .*All:([\d.]+)/.exec(r.stderr || '');
  return m ? Number(m[1]) : null;
}

async function frameAt(file: string, t: number, width: number): Promise<Buffer> {
  const out = path.join(os.tmpdir(), `bench-r-${process.pid}-${Math.round(t * 1000)}-${path.basename(file)}.png`);
  spawnSync(FFMPEG, ['-y', '-v', 'error', '-ss', t.toFixed(3), '-i', file, '-frames:v', '1', '-vf', `scale=${width}:-2`, out]);
  const buf = fs.existsSync(out) ? await sharp(out).png().toBuffer() : await sharp({ create: { width, height: Math.round(width * 1.6), channels: 3, background: '#ffffff' } }).png().toBuffer();
  fs.rmSync(out, { force: true });
  return buf;
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  resetVideoCatalog();
  const cat = await videoCatalog();
  const theme = [...cat.nodes.values()].find((n): n is ThemeNode => n.kind === 'theme' && !n.id.startsWith('builtin.'))!;
  const gabarits = [...cat.nodes.values()].filter((n): n is GabaritNode => n.kind === 'gabarit');
  const duration = 3.6;
  const scenes: CatalogScene[] = SCENES.map((s, i) => ({ key: `s${i + 1}`, duration, texts: s.texts, media: s.media ? [{ id: 'photo', kind: 'image' as const }] : [], role: s.role, energy: 3 }));
  const configs: SceneConfig[] = SCENES.map((s) => {
    const g = gabarits.find((x) => x.config.layout === s.layout);
    return { layout: s.layout, animations: { ...(g?.config.animations ?? {}) } };
  });
  const film = assembleFilm(cat, { scenes, film: { title: 'AgriLink', concept: 'Les intrants à portée de main', style: 'corporate', seed: 'bench' }, brand: { name: BRAND.name, hasLogo: true, line: 'AgriLink · agriculture' }, formats: [FORMAT] } as never, theme, configs);
  const size = COMPOSITION[FORMAT];
  const output = { width: Math.round(size.width / 2), height: Math.round(size.height / 2) };
  const total = duration * scenes.length;
  const photo = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><rect width="1600" height="1200" fill="#cfe1d6"/><rect y="760" width="1600" height="440" fill="#2f6b50"/><circle cx="1180" cy="330" r="190" fill="#e3a03a"/><rect x="260" y="420" width="420" height="520" rx="30" fill="#163a5f"/></svg>')).jpeg({ quality: 82 }).toBuffer();
  const logo = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="120"><circle cx="60" cy="60" r="46" fill="#1b7a5a"/><text x="122" y="80" font-family="Arial" font-size="58" font-weight="700" fill="#14211c">AgriLink</text></svg>')).png().toBuffer();
  const files = [{ name: 'photo.jpg', data: photo }, { name: 'logo.png', data: logo }];
  let start = 0;
  const html = await buildComposition({
    scenes: film.map((a, i) => {
      const s = { key: scenes[i].key, start, duration, html: a.html, script: a.script, animation: 'gsap' as const, texts: scenes[i].texts };
      start += duration;
      return s;
    }),
    width: size.width,
    height: size.height,
    output,
    durationSec: total,
    brand: { ...BRAND, logo: { light: 'logo.png', width: 480, height: 120 } } as never,
    media: { photo: { src: 'photo.jpg', kind: 'image' } },
    logo: 'logo.png',
    fontCss: '',
    mode: 'render',
  });
  const fps = 30;

  // 1. HyperFrames
  let t0 = Date.now();
  const hf = await renderHyperFrames({ html, files, durationSec: total, fps, quality: 'standard' });
  const hfMs = Date.now() - t0;
  const hfFile = path.join(OUT, `hyperframes-${FORMAT}.mp4`);
  fs.copyFileSync(hf.file, hfFile);
  fs.rmSync(hf.workDir, { recursive: true, force: true });
  const hfProbe = probe(hfFile);
  console.log(`HyperFrames  ${(hfMs / 1000).toFixed(1)} s · ${hfProbe.frames} images · ${hfProbe.duration.toFixed(2)} s de film → ${hfFile}`);

  // 2. Kinetograph (s'il est installé)
  const bin = kinetographBin();
  if (!bin) {
    console.log('Kinetograph  absent — rien n’est téléchargé par le banc. Pour comparer : `npm i -D kinetograph` (Node 22+) dans apps/ivision/core, puis `npm run bench:renderers`.');
    return;
  }
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'idem-kg-'));
  try {
    fs.mkdirSync(path.join(project, 'html'));
    fs.writeFileSync(path.join(project, 'html', 'index.html'), html);
    for (const f of files) fs.writeFileSync(path.join(project, 'html', f.name), f.data);
    t0 = Date.now();
    const r = spawnSync(bin, ['render', 'html/index.html'], { cwd: project, encoding: 'utf8', timeout: 15 * 60_000 });
    const kgMs = Date.now() - t0;
    const made: string[] = [];
    const walk = (d: string) => fs.existsSync(d) && fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.mp4') && made.push(path.join(d, e.name))));
    walk(path.join(project, 'out'));
    if (r.status !== 0 || !made.length) {
      console.log(`✗ Kinetograph n’a pas rendu la page (code ${r.status}) : ${(r.stderr || r.stdout || '').slice(-800)}`);
      process.exitCode = 1;
      return;
    }
    const kgFile = path.join(OUT, `kinetograph-${FORMAT}.mp4`);
    fs.copyFileSync(made[0], kgFile);
    const kgProbe = probe(kgFile);
    const score = ssim(hfFile, kgFile, output.width, output.height, fps);
    console.log(`Kinetograph  ${(kgMs / 1000).toFixed(1)} s · ${kgProbe.frames} images · ${kgProbe.duration.toFixed(2)} s de film → ${kgFile}`);
    console.log(`Ressemblance SSIM ${score == null ? 'non mesurée' : score.toFixed(3)} (1 = identiques) · vitesse ×${(hfMs / Math.max(1, kgMs)).toFixed(2)}`);

    // La planche : 3 instants par scène, HyperFrames en haut, Kinetograph en bas.
    const w = 180;
    const times = scenes.flatMap((_, i) => [0.25, 0.55, 0.9].map((p) => i * duration + p * duration));
    const h = Math.round((w * output.height) / output.width);
    const raw = await Promise.all(times.flatMap((t) => [frameAt(hfFile, t, w), frameAt(kgFile, t, w)]));
    const tiles = await Promise.all(raw.map((b) => sharp(b).resize(w, h, { fit: 'cover' }).png().toBuffer()));
    const sheet = await sharp({ create: { width: w * times.length, height: h * 2, channels: 3, background: '#ffffff' } })
      .composite(tiles.map((input, k) => ({ input, left: Math.floor(k / 2) * w, top: (k % 2) * h })))
      .jpeg({ quality: 78 })
      .toBuffer();
    fs.writeFileSync(path.join(OUT, `planche-${FORMAT}.jpg`), sheet);
    const verdict = score != null && score >= 0.9 && kgMs < hfMs ? 'à essayer : plus rapide et fidèle sur ce film' : score != null && score < 0.9 ? 'pas encore : le rendu diffère de nos pages (voir la planche)' : 'pas plus rapide sur ce poste';
    console.log(`Verdict      ${verdict} — ${path.join(OUT, `planche-${FORMAT}.jpg`)}`);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

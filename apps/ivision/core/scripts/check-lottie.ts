/**
 * `npm run check:lottie` — GRATUIT (aucun modèle) : la sélection interne se rend en clips WebM TRANSPARENTS à la couleur
 * demandée, un import .json devient un clip, un fichier qui n'est pas une animation est refusé.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import sharp from 'sharp';
import { lottieLibrary, recolorLottie, renderLottieClip } from '../src/video/assets/lottie';
import { MediaInputError, processUpload } from '../src/video/assets/media';
import { closeFilmBrowser } from '../src/video/rendering/runner';

let failed = 0;
const ok = (label: string, cond: boolean, detail = '') => {
  if (!cond) failed++;
  console.log(`${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

/** La dernière image d'un clip, avec sa couche alpha. */
async function lastFrame(webm: Buffer, at: number, dir: string) {
  const file = path.join(dir, `c${Math.random().toString(36).slice(2)}.webm`);
  const png = `${file}.png`;
  fs.writeFileSync(file, webm);
  // Le décodeur libvpx est nécessaire pour lire l'alpha VP9.
  execFileSync(FFMPEG, ['-y', '-v', 'error', '-c:v', 'libvpx-vp9', '-ss', String(at), '-i', file, '-frames:v', '1', '-vf', 'format=rgba', png]);
  return sharp(png).raw().toBuffer({ resolveWithObject: true });
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idem-lottie-'));
  try {
    const lib = lottieLibrary();
    ok('sélection interne trouvée', lib.length >= 3, lib.map((a) => a.id).join(', '));
    ok('chaque animation est décrite pour le planificateur', lib.every((a) => a.note.length > 20));

    const check = lib.find((a) => a.id === 'check')!;
    const data = recolorLottie(JSON.parse(fs.readFileSync(check.file, 'utf8')), '#c2410c');
    ok('recoloration : plus aucune couleur d’origine', !JSON.stringify(data).includes('0.43') && JSON.stringify(data).includes('0.761'));
    const clip = await renderLottieClip(data);
    ok('rendu en WebM', clip.webm.length > 1000 && clip.durationSec > 1, `${clip.width}×${clip.height}, ${clip.durationSec} s`);
    const file = path.join(dir, 'check.webm');
    fs.writeFileSync(file, clip.webm);
    const probe = execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'stream=codec_name:stream_tags=alpha_mode', '-of', 'compact', file]).toString();
    ok('VP9 avec couche alpha', /vp9/.test(probe) && /alpha_mode=1/.test(probe), probe.trim());
    const { data: px, info } = await lastFrame(clip.webm, clip.durationSec * 0.9, dir);
    let clear = 0;
    let ink = 0;
    for (let i = 0; i < px.length; i += info.channels) {
      if (px[i + 3] < 10) clear++;
      else if (px[i + 3] > 200 && px[i] > 150 && px[i + 2] < 60) ink++;
    }
    const total = px.length / info.channels;
    ok('fond transparent', clear / total > 0.7, `${Math.round((clear / total) * 100)} % de pixels transparents`);
    ok('trait à la couleur demandée', ink / total > 0.02, `${Math.round((ink / total) * 1000) / 10} % de pixels orangés`);

    const uploads: string[] = [];
    const storage = { uploadFile: async (content: Buffer, name: string) => (uploads.push(name), fs.writeFileSync(path.join(dir, name), content), { downloadURL: `file://${path.join(dir, name)}` }) };
    const asset = await processUpload({ buffer: fs.readFileSync(lib[1].file), mimetype: 'application/json', originalname: 'burst.json' }, storage, 'x', { lottieAsClip: true });
    ok('un import Lottie devient un clip transparent', asset.kind === 'video' && asset.transparent === true && /\.webm$/.test(uploads[0] || ''), `${asset.kind} ${uploads[0]}`);
    const refused = await processUpload({ buffer: Buffer.from('{"hello":1}'), mimetype: 'application/json', originalname: 'x.json' }, storage, 'x', { lottieAsClip: true }).then(
      () => false,
      (e) => e instanceof MediaInputError
    );
    ok('un JSON qui n’est pas une animation est refusé', refused);
  } finally {
    await closeFilmBrowser();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(failed ? `\n${failed} échec(s)` : '\nTout passe.');
  process.exit(failed ? 1 : 0);
})();

/**
 * `npm run check:generated-audio` — les adaptateurs de sons GÉNÉRÉS (musique ACE-Step, bruitage MMAudio), sans GPU
 * ni réseau : un faux serveur local répond comme les serveurs d'IDEM (un son de synthèse FFmpeg).
 *
 *   • sans adresse : aucun appel, `null` (l'adaptateur est éteint par défaut) ;
 *   • avec adresse : la piste est rendue, mise en cache (second appel = aucune requête), de licence « generated » ;
 *   • une réponse qui n'est pas un son est refusée ; un clip hors https n'est jamais envoyé ;
 *   • le bruitage est mixé dans le film (piste audio présente, à son instant).
 */
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { FFMPEG, mixAudio } from '../src/video/rendering/ffmpeg';
import { generatedFoley, generatedMusic } from '../src/video/audio/generated';

let failures = 0;
const check = (ok: boolean, label: string, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

async function main(): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idem-gen-audio-'));
  const wav = path.join(dir, 'tone.wav');
  spawnSync(FFMPEG, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=12', '-ac', '2', wav]);
  const tone = fs.readFileSync(wav);
  const seen: Array<{ url: string; body: any; auth?: string }> = [];
  let mode: 'audio' | 'html' = 'audio';
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      seen.push({ url: req.url || '', body: JSON.parse(raw || '{}'), auth: req.headers.authorization });
      if (mode === 'html') return void res.writeHead(200, { 'Content-Type': 'text/html' }).end('<html>nope</html>');
      res.writeHead(200, { 'Content-Type': 'audio/wav' }).end(tone);
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as { port: number }).port;
  try {
    delete process.env.VIDEO_MUSIC_GEN_URL;
    delete process.env.VIDEO_FOLEY_GEN_URL;
    const off = await generatedMusic({ mood: 'afro', durationSec: 12, seed: 1 });
    const offFoley = await generatedFoley({ videoUrl: 'https://cdn.idem.test/clip.mp4', prompt: 'a moto in Dakar', durationSec: 3, seed: 1 });
    check(off === null && offFoley === null && seen.length === 0, 'éteint par défaut : sans adresse, aucun appel');

    process.env.VIDEO_MUSIC_GEN_URL = `http://127.0.0.1:${port}/music`;
    process.env.VIDEO_FOLEY_GEN_URL = `http://127.0.0.1:${port}/foley`;
    process.env.VIDEO_GEN_AUDIO_KEY = 'k-test';
    const seed = Date.now() % 100000;
    const track = await generatedMusic({ mood: 'afro', durationSec: 12, seed });
    check(!!track && track.license === 'generated' && track.provider === 'local' && fs.existsSync(track.url) && seen[0]?.body?.instrumental === true && /afrobeats/.test(seen[0]?.body?.prompt) && seen[0]?.auth === 'Bearer k-test', 'musique : piste originale rendue (licence « generated », fichier local, ambiance en mots de métier, clé envoyée)', JSON.stringify({ track, req: seen[0] }));
    const again = await generatedMusic({ mood: 'afro', durationSec: 12, seed });
    check(again?.url === track?.url && seen.length === 1, 'musique : même demande = fichier en cache, aucun second appel', `${seen.length} appels`);

    mode = 'html';
    const bad = await generatedMusic({ mood: 'calm', durationSec: 12, seed: seed + 1 });
    check(bad === null, 'musique : une réponse qui n’est pas un son est refusée (les banques reprennent la main)');
    mode = 'audio';

    const before = seen.length;
    const http1 = await generatedFoley({ videoUrl: 'http://intranet.local/clip.mp4', prompt: 'x', durationSec: 3, seed });
    check(http1 === null && seen.length === before, 'bruitage : un clip hors https n’est jamais envoyé');
    const foley = await generatedFoley({ videoUrl: 'https://cdn.idem.test/clip.mp4', prompt: 'a moto   crosses Dakar at dawn', durationSec: 3.2, seed });
    const last = seen[seen.length - 1];
    check(!!foley && fs.existsSync(foley) && last?.url === '/foley' && last.body.video_url === 'https://cdn.idem.test/clip.mp4' && last.body.prompt === 'a moto crosses Dakar at dawn' && last.body.duration === 3.2, 'bruitage : le clip et ce qu’il montre partent au serveur, le son revient', JSON.stringify(last));

    // Le mixage : un film muet de 6 s + le bruitage posé à 2 s → une piste audio, silencieuse avant 2 s.
    const silent = path.join(dir, 'silent.mp4');
    spawnSync(FFMPEG, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=white:s=160x90:d=6', '-r', '30', '-pix_fmt', 'yuv420p', silent]);
    const out = path.join(dir, 'out.mp4');
    await mixAudio({ silent, file: out, d: 6, cues: [], files: {}, voice: [], ambience: [{ file: foley!, at: 2, duration: 3.2 }] });
    const vol = (from: number, len: number) => {
      const r = spawnSync(FFMPEG, ['-v', 'info', '-ss', String(from), '-t', String(len), '-i', out, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
      return Number(/mean_volume: (-?[\d.]+|-inf) dB/.exec(r.stderr || '')?.[1] ?? -999);
    };
    const quiet = vol(0.2, 1.4);
    const loud = vol(2.6, 2);
    check(loud > -40 && (quiet < -60 || !Number.isFinite(quiet)) && loud - quiet > 20, `bruitage : mixé dans le film à son instant (avant ${quiet} dB, pendant ${loud} dB)`);
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.VIDEO_MUSIC_GEN_URL;
    delete process.env.VIDEO_FOLEY_GEN_URL;
    delete process.env.VIDEO_GEN_AUDIO_KEY;
  }
  console.log(failures ? `✗ ${failures} échec(s)` : '✓ sons générés : adaptateurs vérifiés');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

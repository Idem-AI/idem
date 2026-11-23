/**
 * `npm run check:sfx-bank` — GRATUIT, hors ligne : la sonothèque n'a plus jamais un seul son par moment sonore.
 *   - sans réseau ni banque : trois prises de synthèse par sorte (trois hauteurs) ;
 *   - avec une banque locale (`VIDEO_SFX_BANK`, celle qu'Earshot construit) : ses sons passent avant la synthèse.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { configureCore } from '../src/runtime/host';
import { ensureSfxLibrary } from '../src/video/audio/sfx';
import { SFX_KINDS } from '../src/video/contracts/model';

configureCore({ logger: { info: () => undefined, warn: () => undefined, error: () => undefined } as never });
let failed = 0;
const ok = (label: string, cond: boolean, detail = '') => {
  if (!cond) failed++;
  console.log(`${cond ? '✓' : '✗'} ${label}${!cond && detail ? ` — ${detail}` : ''}`);
};
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sfx-bank-'));
  process.env.VIDEO_SFX_DIR = path.join(tmp, 'lib');
  process.env.VIDEO_SFX_BANK = path.join(tmp, 'none');
  const synth = await ensureSfxLibrary({ offline: true, force: true });
  ok('hors ligne, sans banque : trois prises de synthèse par moment sonore', SFX_KINDS.every((k) => synth.sounds[k].length === 3 && new Set(synth.sounds[k].map((s) => s.file)).size === 3), JSON.stringify(Object.fromEntries(SFX_KINDS.map((k) => [k, synth.sounds[k].length]))));
  // Une banque d'essai : deux sons par sorte, fabriqués par ffmpeg (comme Earshot les écrirait).
  const bank = path.join(tmp, 'bank');
  fs.mkdirSync(bank);
  const index: Record<string, Array<{ file: string; title: string }>> = {};
  for (const k of SFX_KINDS) {
    index[k] = [];
    for (const n of [1, 2]) {
      const d = k === 'riser' ? 1.6 : k === 'shimmer' || k === 'impact' ? 1 : k === 'tick' ? 0.08 : 0.35;
      const f = `${k}_${n}.wav`;
      spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', `aevalsrc='sin(2*PI*${300 + n * 120}*t)*exp(-${k === 'riser' ? 0.2 : 6}*t)':s=48000:d=${d}`, '-y', path.join(bank, f)]);
      index[k].push({ file: f, title: `${k} ${n}` });
    }
  }
  fs.writeFileSync(path.join(bank, 'index.json'), JSON.stringify(index));
  process.env.VIDEO_SFX_BANK = bank;
  process.env.VIDEO_SFX_DIR = path.join(tmp, 'lib2');
  const lib = await ensureSfxLibrary({ offline: true, force: true });
  const banked = SFX_KINDS.filter((k) => lib.sounds[k].some((s) => s.id.startsWith('bank:')));
  ok('banque locale (Earshot) : ses sons servis hors ligne, avant la synthèse', banked.length >= SFX_KINDS.length - 1 && banked.every((k) => lib.sounds[k][0].id.startsWith('bank:')), JSON.stringify(Object.fromEntries(SFX_KINDS.map((k) => [k, lib.sounds[k].map((s) => s.id)]))));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${failed ? '✗' : '✓'} Sonothèque : ${failed} échec(s).`);
  process.exit(failed ? 1 : 0);
})();

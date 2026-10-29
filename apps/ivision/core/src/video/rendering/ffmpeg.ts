/**
 * FFMPEG — encodage, mixage du son, lecture des fichiers. Commun aux vidéos et au montage.
 */
import { spawn } from 'child_process';
import type { SfxKind, VideoQuality } from '../contracts/model';
import { MUSIC_GAIN_DB, MUSIC_UNDER_VOICE_DB, SFX_UNDER_VOICE_DB, SfxCue } from '../audio/sfx';

export const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

/** ffmpeg, en gardant son journal (mesures de `loudnorm`). */
export function runLog(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    ff.stderr.on('data', (c) => (err += c.toString()));
    ff.on('error', reject);
    ff.on('close', (code) => (code === 0 ? resolve(err) : reject(new Error(`ffmpeg ${code}: ${err.slice(-600)}`))));
  });
}

export function run(args: string[], input?: NodeJS.ReadableStream): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    let err = '';
    ff.stderr.on('data', (c) => (err += c.toString()));
    ff.on('error', reject);
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${err.slice(-600)}`))));
    if (input) input.pipe(ff.stdin);
    else ff.stdin.end();
  });
}

/** Réglages d'encodage : débit plafonné pour rester léger sur des connexions modestes. */
export function encoding(quality: VideoQuality, fps: number): string[] {
  const common = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-g', String(fps * 2), '-preset', 'veryfast'];
  switch (quality) {
    case 'standard':
      return [...common, '-crf', '23', '-maxrate', '2500k', '-bufsize', '5000k'];
    case 'premium':
      return [...common, '-crf', '19', '-maxrate', '12000k', '-bufsize', '24000k'];
    default:
      return [...common, '-crf', '20', '-maxrate', '8000k', '-bufsize', '16000k'];
  }
}

/**
 * Le mixage : musique (extrait, fondus), effets sonores posés à la milliseconde, voix off.
 *
 *   effets   franchement au-dessus de la musique : la musique (−7 dB) s'efface sous chacun ;
 *   voix     au premier plan : musique abaissée (−10 dB) et compressée sous chaque ligne, effets
 *            légèrement retenus pendant qu'elle parle (un whoosh ne couvre pas un mot) ;
 *   master   limiteur puis normalisation à −14 LUFS (niveau des réseaux sociaux) EN DEUX PASSES : la première mesure
 *            le mixage (`loudnorm` en JSON), la seconde l'applique linéairement (pas de pompage) ;
 *   fin      une musique dont l'extrait finit sur une fin de phrase s'arrête par un fondu court (0,6 s) ;
 *   prises   un moment sonore peut avoir plusieurs prises : la transition n prend la prise n (jamais le même whoosh).
 *
 * Exporté pour les contrôles (`check:video` mesure le niveau des effets sur la musique).
 */
export async function mixAudio(opts: {
  silent: string;
  file: string;
  d: number;
  music?: { file: string; startAt: number; phraseEnd?: boolean };
  cues: (SfxCue & { db: number; take?: number })[];
  files: Partial<Record<SfxKind, string | string[]>>;
  voice: { file: string; at: number }[];
}): Promise<void> {
  const { silent, file, d, music, cues, voice } = opts;
  const fileOf = (kind: SfxKind, take = 0): string | undefined => {
    const f = opts.files[kind];
    return Array.isArray(f) ? f[take % f.length] : f;
  };
  if (!music && !cues.length && !voice.length) {
    await run(['-y', '-v', 'error', '-i', silent, '-c', 'copy', '-movflags', '+faststart', file]);
    return;
  }
  const args = ['-y', '-v', 'error', '-i', silent];
  const filters: string[] = [];
  let index = 1;
  let bed = '';
  if (music) {
    args.push('-ss', String(Math.max(0, music.startAt)), '-t', String(d + 0.5), '-i', music.file);
    // Un extrait calé sur une fin de phrase s'arrête net avec un fondu court ; sinon un fondu plus long le masque.
    const fadeOut = music.phraseEnd ? Math.min(0.6, d * 0.1) : Math.min(1.5, d * 0.2);
    filters.push(
      `[${index}:a]atrim=0:${d},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,afade=t=in:st=0:d=0.35,afade=t=out:st=${Math.max(0, d - fadeOut).toFixed(3)}:d=${fadeOut.toFixed(3)},volume=${voice.length ? MUSIC_UNDER_VOICE_DB : MUSIC_GAIN_DB}dB[mus]`
    );
    bed = '[mus]';
    index++;
  }
  /** Un bus : les entrées posées à leur instant, sommées, étendues à toute la durée. */
  const bus = (label: string, inputs: string[]) => {
    filters.push(`${inputs.join('')}amix=inputs=${inputs.length}:normalize=0:dropout_transition=0,apad=whole_dur=${d}[${label}]`);
  };
  const sfxLabels: string[] = [];
  for (const cue of cues) {
    const sound = fileOf(cue.kind, cue.take);
    if (!sound) continue;
    args.push('-i', sound);
    const ms = Math.round(cue.t * 1000);
    filters.push(`[${index}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${cue.db + (voice.length ? SFX_UNDER_VOICE_DB : 0)}dB,adelay=${ms}|${ms}[s${index}]`);
    sfxLabels.push(`[s${index}]`);
    index++;
  }
  const voiceLabels: string[] = [];
  for (const line of voice) {
    args.push('-i', line.file);
    const ms = Math.round(Math.max(0, line.at) * 1000);
    filters.push(`[${index}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms}[v${index}]`);
    voiceLabels.push(`[v${index}]`);
    index++;
  }
  const finals: string[] = [];
  let sfx = '';
  if (sfxLabels.length) {
    bus('sfx', sfxLabels);
    sfx = '[sfx]';
  }
  if (voiceLabels.length) {
    bus('vo', voiceLabels);
    // La voix pilote deux compresseurs : la musique, et (plus doucement) les effets.
    const keys = 1 + (bed ? 1 : 0) + (sfx ? 1 : 0);
    filters.push(`[vo]asplit=${keys}${['[vom]', '[vok]', '[vos]'].slice(0, keys).join('')}`);
    finals.push('[vom]');
    let k = 1;
    if (bed) {
      filters.push(`${bed}[${['vom', 'vok', 'vos'][k++]}]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=420:makeup=1[bedv]`);
      bed = '[bedv]';
    }
    if (sfx) {
      filters.push(`${sfx}[${['vom', 'vok', 'vos'][k++]}]sidechaincompress=threshold=0.05:ratio=2.5:attack=5:release=200:makeup=1[sfxv]`);
      sfx = '[sfxv]';
    }
  }
  if (sfx && bed) {
    // La musique s'efface sous chaque effet : c'est ce qui les fait entendre.
    filters.push(`${sfx}asplit=2[sfxa][sfxb]`);
    filters.push(`${bed}[sfxa]sidechaincompress=threshold=0.03:ratio=6:attack=5:release=240:makeup=1[duck]`);
    finals.push('[duck]', '[sfxb]');
  } else {
    if (bed) finals.push(bed);
    if (sfx) finals.push(sfx);
  }
  const sum = (master: string) => (finals.length > 1 ? `${finals.join('')}amix=inputs=${finals.length}:normalize=0:dropout_transition=0,${master}[a]` : `${finals[0]}${master}[a]`);
  // Première passe : la mesure du mixage (sans écrire de fichier).
  let master = 'alimiter=limit=0.94:level=disabled,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000';
  try {
    const log = await runLog([...args, '-filter_complex', [...filters, sum('alimiter=limit=0.94:level=disabled,loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json')].join(';'), '-map', '[a]', '-t', String(d), '-f', 'null', '-']);
    const json = log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1);
    const m = JSON.parse(json) as Record<string, string>;
    if (Number.isFinite(Number(m.input_i)) && Number(m.input_i) > -70) {
      master = `alimiter=limit=0.94:level=disabled,loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000`;
    }
  } catch {
    // mesure impossible : une seule passe, comme avant
  }
  filters.push(sum(master));
  args.push(
    '-filter_complex', filters.join(';'),
    '-map', '0:v', '-map', '[a]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
    '-t', String(d), '-movflags', '+faststart', file
  );
  await run(args);
}

/** Durée et flux d'un fichier, via ffprobe (contrôles et tests). */
export function probe(file: string): Promise<{ duration: number; width: number; height: number; fps: number; hasAudio: boolean }> {
  return new Promise((resolve, reject) => {
    const p = spawn(process.env.FFPROBE_PATH || 'ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]);
    let out = '';
    p.stdout.on('data', (c) => (out += c.toString()));
    p.on('error', reject);
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffprobe ${code}`));
      try {
        const data = JSON.parse(out);
        const v = (data.streams || []).find((s: any) => s.codec_type === 'video') || {};
        const [n, d] = String(v.r_frame_rate || '0/1').split('/').map(Number);
        resolve({
          duration: Number(data.format?.duration) || 0,
          width: v.width || 0,
          height: v.height || 0,
          fps: d ? n / d : 0,
          hasAudio: (data.streams || []).some((s: any) => s.codec_type === 'audio'),
        });
      } catch (e) {
        reject(e);
      }
    });
  });
}


/**
 * EFFETS SONORES — la sonothèque des vidéos motion design.
 *
 * Un motion design professionnel se reconnaît aussi à l'oreille : un « whoosh »
 * sur chaque transition, un « pop » quand un prix apparaît, un clic discret quand
 * un titre se pose, un scintillement sur le logo. Ces moments (« cues ») sont
 * posés par le moteur d'animation lui-même (moteur React, `video-engine/src`), à l'image près :
 * le son ne peut pas tomber à côté du mouvement.
 *
 * SOURCES (licence CC0 uniquement : aucun crédit à afficher dans la vidéo)
 *   1. catalogue maison        `VIDEO_SFX_CATALOG` (JSON) — sons choisis à la main
 *   2. Freesound via Openverse sans clé — des milliers de bruitages CC0
 *   3. Freesound (API directe) `FREESOUND_API_KEY` — tri par note des utilisateurs
 *   4. SFXMint sans clé        — bibliothèque CC0 dédiée au design sonore (pas de contenu voix/musique)
 *   5. synthèse ffmpeg          toujours disponible : le repli hors ligne, délibérément plus discret
 *
 * TRAITEMENT (ce qui rend un son de banque « propre ») : silence retiré au début
 * et à la fin, coupe à la durée utile, fondu de sortie, crête normalisée à
 * −3 dBFS (−8 dBFS pour la synthèse : un son de synthèse a peu de dynamique,
 * à crête égale il sonne plus fort qu'un son réel), passe-haut à 40 Hz,
 * 48 kHz stéréo. Les candidats hors gabarit (trop longs, trop faibles) sont
 * écartés.
 *
 * La sonothèque est construite une fois puis gardée sur disque
 * (`VIDEO_SFX_DIR`, sinon le dossier temporaire) : `npm run video:sfx` la
 * pré-construit en production.
 *
 * REPLI DÉGRADÉ (2026-10-18, retour utilisateur : « toujours les mêmes effets, trop
 * forts ») : si les sources en ligne ne renvoient rien pour un moment sonore (réseau
 * coupé en production, clés absentes, filtre trop strict), ce moment retombe sur l'unique
 * son de synthèse — identique à chaque vidéo. Ce repli était écrit sur disque comme une
 * sonothèque complète et jamais réessayé : un seul échec réseau au démarrage figeait tous
 * les effets pour la durée de vie du dossier `VIDEO_SFX_DIR`. La sonothèque garde
 * désormais si elle est `degraded` (au moins un moment sonore resté sur la synthèse) et
 * retente une construction en ligne au bout d'une heure (`DEGRADED_RETRY_MS`) plutôt que
 * de garder le repli pour toujours.
 */
import axios from 'axios';
import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import logger from '../../runtime/logger';
import { MotionStyle, SFX_KINDS, SfxKind, SfxSound } from '../contracts/model';
import { rng } from './music';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

interface KindSpec {
  queries: string[];
  /** Durée utile après nettoyage, en secondes. */
  min: number;
  max: number;
  ideal: number;
  /** Mots qui disqualifient un résultat (voix, musique, bruitage hors sujet). */
  exclude: RegExp;
  /** Le titre doit contenir l'un de ces mots : le résultat dit bien ce qu'il est. */
  keywords: RegExp;
}

// Les sons « dessin animé », jouet ou jeu vidéo 8 bits sont écartés (24/11/2026 : « on dirait un sfx de test ») —
// un film de marque n'a pas une bande-son de cartoon.
const COMMON_EXCLUDE = /\b(voice|vocal|speech|talk|scream|music loop|song|ambience|ambient|field recording|nature|rain|birds|crowd|horror|scary|creepy|fart|burp|cough|mouth|lips|spit|cartoon|comic|comedy|funny|toy|squeak[a-z]*|8.?bit|chiptune|arcade|retro game|game over|test tone|beep test)\b/i;

export const SFX_SPECS: Record<SfxKind, KindSpec> = {
  whoosh: { queries: ['whoosh', 'swoosh transition', 'swish'], min: 0.25, max: 1.6, ideal: 0.7, exclude: /\b(sword|punch|kick|wind loop)\b/i, keywords: /whoosh|swoosh|swish|swipe|woosh/i },
  softwhoosh: { queries: ['soft whoosh', 'air whoosh', 'gentle swoosh'], min: 0.3, max: 1.8, ideal: 0.9, exclude: /\b(sword|punch|heavy)\b/i, keywords: /whoosh|swoosh|swish|woosh|air/i },
  pop: { queries: ['pop', 'bubble pop', 'ui pop'], min: 0.05, max: 0.6, ideal: 0.2, exclude: /\b(popcorn|balloon burst|gun|cork)\b/i, keywords: /\bpop|bubble|blip/i },
  click: { queries: ['ui click', 'soft click', 'interface tap'], min: 0.02, max: 0.35, ideal: 0.08, exclude: /\b(mouse wheel|keyboard typing|camera|pen)\b/i, keywords: /click|tap|button|select|ui/i },
  tick: { queries: ['tick', 'ui tick', 'clock tick'], min: 0.02, max: 0.25, ideal: 0.06, exclude: /\b(loop|ticking loop|metronome)\b/i, keywords: /tick|click/i },
  impact: { queries: ['cinematic impact', 'impact hit', 'deep hit'], min: 0.3, max: 2.4, ideal: 1.2, exclude: /\b(glass|car crash|explosion|gun|metal|door|wood|kick)\b/i, keywords: /impact|hit|boom|thud|thump/i },
  shimmer: { queries: ['shimmer', 'sparkle chime', 'magic chime'], min: 0.6, max: 3.2, ideal: 1.6, exclude: /\b(loop|jump|game over|vox|voice)\b/i, keywords: /shimmer|sparkl|twinkl|chime|glimmer|gleam|glitter|magic|shine/i },
  riser: { queries: ['riser', 'swell transition', 'reverse cymbal'], min: 0.9, max: 3.5, ideal: 2, exclude: /\b(loop|siren|alarm)\b/i, keywords: /riser|rise|rising|swell|reverse|build ?up|uplifter/i },
};

/**
 * Niveau de chaque moment sonore dans le mixage (dB, sur des sons normalisés à −3 dBFS crête).
 *
 * Relevés de 6 à 9 dB (2026-10-09) : un son court normalisé en CRÊTE a peu d'énergie, et sous
 * une musique à −3 dB les effets disparaissaient. La musique est désormais à −7 dB et s'efface
 * nettement sous chaque effet (cf. `mixAudio`) ; un whoosh ou un impact se pose franchement,
 * un clic ou un tic reste un détail.
 *
 * Rebaissés de 2 à 3 dB (2026-10-18, retour utilisateur : « les volumes sont trop élevés,
 * pas professionnel ») : la cause principale était le repli de synthèse resté bloqué (voir
 * plus haut, `degraded`) — un son de synthèse à crête égale sonne nettement plus fort qu'un
 * son réel. Une fois la vraie sonothèque rétablie, whoosh/impact/pop n'ont plus besoin
 * d'être aussi près de 0 dB pour se faire sentir.
 *
 * Relevés et posés sur un son ÉGALISÉ (24/11/2026, retour utilisateur : « on n'entend pas les sfx ») : mesurés avant
 * le master contre la musique effacée, les anciens niveaux laissaient le whoosh 3,5 dB SOUS la musique, le softwhoosh
 * 11 dB, le pop 18 dB — l'effacement de la musique creusait un trou que l'effet ne remplissait pas. Chaque son est
 * désormais ramené à une sonie de référence (`SFX_REF_LEVEL_DB`, cf. `sfxLevelCompDb`) avant ce gain : deux prises
 * d'un même moment sonore (jusqu'à 11 dB d'écart en crête égale) sonnent pareil. Mesuré sur la musique à −7 dB,
 * effacée (moyenne des 3 prises) : whoosh ≈ +4 dB au-dessus, impact ≈ +4, softwhoosh ≈ +0,5, pop ≈ −1, tick ≈ −4 (un détail).
 */
export const SFX_GAIN_DB: Record<SfxKind, number> = {
  whoosh: 5,
  softwhoosh: 5,
  pop: 1,
  click: 1,
  tick: 0,
  impact: 2,
  shimmer: -5,
  riser: 1,
};

/**
 * Sonie de référence d'un effet (dB, moyenne mesurée sur au moins 0,3 s : un son très court est jugé sur la fenêtre
 * d'intégration de l'oreille, pas sur sa seule durée). Un son plus faible est relevé, un plus fort abaissé (±8 dB).
 */
export const SFX_REF_LEVEL_DB = -20;
const levelCache = new Map<string, Promise<number>>();
/** Correction (dB) qui ramène un fichier d'effet à la sonie de référence ; 0 si la mesure échoue. */
export function sfxLevelCompDb(file: string): Promise<number> {
  let job = levelCache.get(file);
  if (!job) {
    job = ffmpegRun(['-hide_banner', '-i', file, '-af', 'apad=whole_dur=0.3,volumedetect', '-f', 'null', '-'])
      .then((log) => {
        const mean = Number(log.match(/mean_volume: (-?[\d.]+) dB/)?.[1]);
        return Number.isFinite(mean) && mean > -80 ? Math.max(-8, Math.min(8, SFX_REF_LEVEL_DB - mean)) : 0;
      })
      .catch(() => 0);
    levelCache.set(file, job);
  }
  return job;
}

/** Densité par langage de mouvement : un style élégant ne cliquette pas. */
export const SFX_DENSITY: Record<MotionStyle, Partial<Record<SfxKind, number>>> = {
  energetic: {},
  playful: {},
  corporate: { click: -3, tick: -3 },
  // Premium : plus bas, jamais muet (un film élégant a quand même son design sonore).
  premium: { click: -6, tick: -6, pop: -4, whoosh: -2 },
};

/** Niveau de la musique dans le mixage (dB) : sous les effets, et plus bas encore sous une voix off. */
export const MUSIC_GAIN_DB = -7;
/**
 * Sous une voix off (2026-10-16, retour utilisateur : « on n'entend pas la voix ») : la musique descend à −18 dB et
 * les effets de 8 dB — la voix (−16 LUFS) passe toujours devant, la compression par la voix fait le reste.
 */
export const MUSIC_UNDER_VOICE_DB = -18;
// −8 → −4 (24/11/2026) : sous la voix, les effets égalisés restent ≈ 10 dB sous elle — présents, jamais devant un mot.
export const SFX_UNDER_VOICE_DB = -4;

/** Gain linéaire d'un effet dans l'aperçu (sans normalisation finale : 2 dB de plus qu'au rendu). */
export const previewGain = (db: number) => Math.min(1, Math.pow(10, (db + 2) / 20));

export interface LibrarySound extends SfxSound {
  /** Fichier traité, sur disque. */
  file: string;
  /** Score de sélection (plus haut = meilleur). */
  score: number;
}

export interface SfxLibrary {
  builtAt: string;
  /** Version de la sonothèque : une sonothèque plus ancienne est reconstruite (24/11/2026 : 10 sons par moment). */
  version?: number;
  /** Au moins un moment sonore est resté sur la synthèse (aucune source en ligne n'a fourni de candidat). */
  degraded: boolean;
  sounds: Record<SfxKind, LibrarySound[]>;
}

/** Une sonothèque dégradée est retentée en ligne au bout d'une heure plutôt que gardée pour toujours. */
const DEGRADED_RETRY_MS = 60 * 60 * 1000;

export const sfxDir = (): string => process.env.VIDEO_SFX_DIR || path.join(os.tmpdir(), 'idem-video-sfx');

// ─── Traitement ─────────────────────────────────────────────────────────────

function ffmpegRun(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    ff.stderr.on('data', (c) => (err += c.toString()));
    ff.on('error', reject);
    ff.on('close', (code) => (code === 0 ? resolve(err) : reject(new Error(`ffmpeg ${code}: ${err.slice(-400)}`))));
  });
}

/** Durée et crête d'un fichier (après traitement). */
async function measure(file: string): Promise<{ duration: number; peakDb: number; meanDb: number }> {
  const log = await ffmpegRun(['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-']);
  const duration = (() => {
    const m = log.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
    return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
  })();
  const peak = Number(log.match(/max_volume: (-?[\d.]+) dB/)?.[1] ?? -99);
  const mean = Number(log.match(/mean_volume: (-?[\d.]+) dB/)?.[1] ?? -99);
  return { duration, peakDb: peak, meanDb: mean };
}

/**
 * Nettoie un son de banque : silences retirés, coupé à la durée utile, fondu
 * de sortie, passe-haut, crête normalisée à `targetPeakDb`, MP3 48 kHz stéréo.
 */
export async function processSound(input: string, output: string, spec: KindSpec, targetPeakDb = -3): Promise<{ duration: number; meanDb: number }> {
  const trimmed = `${output}.trim.wav`;
  await ffmpegRun([
    '-y', '-v', 'error', '-i', input,
    '-af',
    [
      'highpass=f=40',
      'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.01',
      'areverse',
      'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02',
      'areverse',
      `atrim=0:${spec.max}`,
    ].join(','),
    '-ar', '48000', '-ac', '2', trimmed,
  ]);
  const m = await measure(trimmed);
  const gain = Math.min(24, targetPeakDb - m.peakDb);
  const fade = Math.min(0.25, m.duration * 0.3);
  await ffmpegRun([
    '-y', '-v', 'error', '-i', trimmed,
    '-af', `volume=${gain.toFixed(2)}dB,afade=t=in:d=0.004,afade=t=out:st=${Math.max(0, m.duration - fade).toFixed(3)}:d=${fade.toFixed(3)}`,
    '-ar', '48000', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '192k', output,
  ]);
  fs.rmSync(trimmed, { force: true });
  const out = await measure(output);
  return { duration: out.duration, meanDb: out.meanDb };
}

// ─── Synthèse (repli toujours disponible) ───────────────────────────────────

/** Expressions ffmpeg des sons de synthèse — sobres, sans clic, crête maîtrisée. */
const SYNTH: Record<SfxKind, { d: number; expr: string; af?: string }> = {
  whoosh: { d: 0.8, expr: '(random(0)*2-1)*sin(PI*t/0.8)^2', af: 'bandpass=f=1400:width_type=o:w=2.2,volume=6dB' },
  softwhoosh: { d: 1.0, expr: '(random(0)*2-1)*sin(PI*t/1.0)^3', af: 'lowpass=f=1800,highpass=f=300,volume=4dB' },
  pop: { d: 0.18, expr: 'sin(2*PI*(900-3200*t)*t)*exp(-26*t)' },
  click: { d: 0.06, expr: '(sin(2*PI*2400*t)+0.5*(random(0)*2-1))*exp(-90*t)' },
  tick: { d: 0.05, expr: 'sin(2*PI*3200*t)*exp(-120*t)' },
  impact: { d: 1.3, expr: 'sin(2*PI*(55+70*exp(-9*t))*t)*exp(-3.2*t)+0.35*(random(0)*2-1)*exp(-18*t)', af: 'lowpass=f=2600' },
  shimmer: {
    d: 1.8,
    expr: '(sin(2*PI*1568*t)+0.7*sin(2*PI*2093*t)+0.5*sin(2*PI*2637*t)+0.35*sin(2*PI*3136*t))*(1-exp(-30*t))*exp(-1.9*t)*(0.75+0.25*sin(2*PI*9*t))',
  },
  riser: { d: 2.0, expr: '(random(0)*2-1)*(t/2.0)^2', af: 'highpass=f=500,lowpass=f=6000,volume=5dB' },
};

/**
 * Les PRISES de synthèse (22/11/2026) : la même forme sonore à trois hauteurs (la prise 0 telle quelle, puis un ton
 * plus grave et plus lent, un ton plus aigu et plus vif) — un film hors ligne ne répète plus le même son à chaque coupe.
 */
const SYNTH_TAKES = [1, 0.89, 1.12];

export async function synthSound(kind: SfxKind, dir: string, take = 0): Promise<LibrarySound> {
  const s = SYNTH[kind];
  const rate = SYNTH_TAKES[take % SYNTH_TAKES.length];
  fs.mkdirSync(dir, { recursive: true });
  const suffix = take ? `-${take}` : '';
  const raw = path.join(dir, `synth-${kind}${suffix}.raw.wav`);
  const file = path.join(dir, `synth-${kind}${suffix}.mp3`);
  if (!fs.existsSync(file)) {
    const pitch = rate !== 1 ? `asetrate=48000*${rate},aresample=48000` : '';
    const af = [s.af, pitch].filter(Boolean).join(',');
    await ffmpegRun(['-y', '-v', 'error', '-f', 'lavfi', '-i', `aevalsrc='${s.expr}':s=48000:d=${s.d}`, ...(af ? ['-af', af] : []), '-ac', '2', raw]);
    // −8 dBFS (pas −3) : un son de synthèse (ton pur, peu de dynamique) sonne plus fort qu'un
    // son réel à crête égale — ce repli reste discret même quand il tourne en boucle.
    await processSound(raw, file, { ...SFX_SPECS[kind], max: s.d + 0.05 }, -8);
    fs.rmSync(raw, { force: true });
  }
  return {
    id: `synth:${kind}${suffix}`,
    kind,
    title: `${kind} (synthèse IDEM${take ? `, prise ${take + 1}` : ''})`,
    author: 'IDEM',
    license: 'generated',
    durationSec: Math.round((s.d / rate) * 1000) / 1000,
    file,
    score: -0.01 * take,
  };
}

/**
 * LA BANQUE LOCALE (22/11/2026) — des sons fabriqués hors ligne et gardés avec le code (`VIDEO_SFX_BANK`, sinon
 * `apps/ivision/core/assets/sfx-bank/`) : un `index.json` `{ "<sorte>": [{ "file", "title", "author", "license" }] }`.
 * Prévue pour Earshot (MIT, des sons rendus par du code, une nouvelle prise à chaque appel ; `scripts/build-sfx-bank.sh`
 * la construit) : servie EN LIGNE comme HORS LIGNE, avant la synthèse — un serveur sans réseau a ainsi plusieurs vrais
 * sons par moment sonore au lieu d'un seul son de synthèse.
 */
function bankDir(): string | null {
  const dir = process.env.VIDEO_SFX_BANK || path.resolve(__dirname, '../../../assets/sfx-bank');
  return fs.existsSync(path.join(dir, 'index.json')) ? dir : null;
}
export async function bankSounds(kind: SfxKind, dir: string): Promise<LibrarySound[]> {
  const bank = bankDir();
  if (!bank) return [];
  let index: Partial<Record<SfxKind, Array<{ file: string; title?: string; author?: string; license?: string }>>> = {};
  try {
    index = JSON.parse(fs.readFileSync(path.join(bank, 'index.json'), 'utf8'));
  } catch {
    return [];
  }
  const spec = SFX_SPECS[kind];
  const out: LibrarySound[] = [];
  for (const [k, e] of (index[kind] ?? []).entries()) {
    const src = path.join(bank, path.basename(e.file));
    if (!fs.existsSync(src)) continue;
    const file = path.join(dir, `bank-${kind}-${k}.mp3`);
    try {
      const processed = fs.existsSync(file) ? { duration: spec.ideal, meanDb: -20 } : await processSound(src, file, spec);
      if (processed.duration < spec.min || processed.duration > spec.max + 0.05) continue;
      out.push({ id: `bank:${kind}:${k}`, kind, title: e.title || `${kind} ${k + 1}`, author: e.author || 'earshot', license: (e.license as LibrarySound['license']) || 'generated', durationSec: Math.round(processed.duration * 1000) / 1000, file, score: 0.8 - k * 0.01 });
    } catch (error: any) {
      logger.warn('video.sfx.bank_failed', { kind, file: e.file, error: error.message });
    }
  }
  return out;
}

// ─── Banques ────────────────────────────────────────────────────────────────

interface Candidate {
  id: string;
  title: string;
  author: string;
  url: string;
  sourceUrl?: string;
  durationSec: number;
  rating?: number;
}

async function searchOpenverse(query: string): Promise<Candidate[]> {
  const res = await axios.get('https://api.openverse.org/v1/audio/', {
    params: { q: query, license: 'cc0', source: 'freesound', page_size: 20, mature: false },
    headers: process.env.OPENVERSE_TOKEN ? { Authorization: `Bearer ${process.env.OPENVERSE_TOKEN}` } : {},
    timeout: 8000,
  });
  return (res.data?.results || [])
    .filter((r: any) => r.url && r.license === 'cc0')
    .map((r: any) => ({
      id: `openverse:${r.id}`,
      title: r.title || 'sans titre',
      author: r.creator || 'inconnu',
      url: r.url,
      sourceUrl: r.foreign_landing_url,
      durationSec: (r.duration || 0) / 1000,
    }));
}

async function searchFreesound(query: string, spec: KindSpec): Promise<Candidate[]> {
  if (!process.env.FREESOUND_API_KEY) return [];
  const res = await axios.get('https://freesound.org/apiv2/search/text/', {
    params: {
      query,
      filter: `license:"Creative Commons 0" duration:[${spec.min} TO ${spec.max * 3}]`,
      fields: 'id,name,username,duration,previews,url,avg_rating,num_ratings',
      sort: 'rating_desc',
      page_size: 15,
      token: process.env.FREESOUND_API_KEY,
    },
    timeout: 8000,
  });
  return (res.data?.results || []).map((r: any) => ({
    id: `freesound:${r.id}`,
    title: r.name,
    author: r.username,
    url: r.previews?.['preview-hq-mp3'],
    sourceUrl: r.url,
    durationSec: Number(r.duration) || 0,
    rating: Number(r.avg_rating) || undefined,
  }));
}

/**
 * SFXMint : bibliothèque CC0 dédiée au design sonore (pas de musique/voix noyées dans
 * les résultats comme sur Freesound/Openverse), recherche libre, sans clé.
 * `VIDEO_SFX_SFXMINT=off` pour la désactiver (ex. environnement sans accès réseau sortant).
 */
async function searchSfxmint(query: string, spec: KindSpec): Promise<Candidate[]> {
  if (process.env.VIDEO_SFX_SFXMINT === 'off') return [];
  const res = await axios.get('https://sfxmint.com/api/v1/search', {
    params: { q: query, limit: 15, max_duration_ms: Math.round(spec.max * 3000) },
    timeout: 8000,
  });
  return (res.data?.results || res.data?.sounds || [])
    .filter((r: any) => (r.mp3_url || r.wav_url) && /cc0/i.test(r.license || 'cc0'))
    .map((r: any) => ({
      id: `sfxmint:${r.slug || r.id}`,
      title: r.title || r.slug || 'sans titre',
      author: 'SFXMint',
      url: r.mp3_url || r.wav_url,
      durationSec: (r.duration || 0) / 1000,
    }));
}

function loadCatalog(): Partial<Record<SfxKind, Candidate[]>> {
  const source = process.env.VIDEO_SFX_CATALOG;
  if (!source || !fs.existsSync(source)) return {};
  try {
    return JSON.parse(fs.readFileSync(source, 'utf8'));
  } catch (error: any) {
    logger.warn('video.sfx.catalog_failed', { error: error.message });
    return {};
  }
}

function scoreCandidate(c: Candidate, spec: KindSpec, kind: SfxKind, processed: { duration: number; meanDb: number }): number {
  const fit = 1 - Math.min(1, Math.abs(processed.duration - spec.ideal) / spec.ideal);
  const title = c.title.toLowerCase();
  const match = spec.queries.some((q) => title.includes(q.split(' ')[0])) ? 0.4 : 0;
  const level = processed.meanDb > -35 ? 0.2 : 0; // un son trop faible reste noyé après normalisation
  const rating = c.rating ? (c.rating - 3) * 0.15 : 0;
  const catalog = c.id.startsWith('catalog:') ? 1 : 0;
  return Math.round((fit + match + level + rating + catalog) * 100) / 100 + (kind === 'tick' && processed.duration < 0.12 ? 0.2 : 0);
}

/**
 * 10 sons par moment sonore (24/11/2026, retour utilisateur : « un sfx classique qui revient à chaque fois ») : chaque
 * vidéo tire SA palette dans ce vivier (`pickPalette`) au lieu des trois mêmes meilleurs sons pour toutes.
 */
const MAX_PER_KIND = 10;
const LIBRARY_VERSION = 2;

/** Construit (ou relit) la sonothèque. Une banque en panne n'empêche rien. */
export async function ensureSfxLibrary(opts: { offline?: boolean; force?: boolean } = {}): Promise<SfxLibrary> {
  const dir = sfxDir();
  const manifest = path.join(dir, 'library.json');
  if (!opts.force && fs.existsSync(manifest)) {
    try {
      const lib = JSON.parse(fs.readFileSync(manifest, 'utf8')) as SfxLibrary;
      const ok = SFX_KINDS.every((k) => (lib.sounds[k] || []).every((s) => fs.existsSync(s.file)));
      const staleEnoughToRetry = Date.now() - new Date(lib.builtAt).getTime() > DEGRADED_RETRY_MS;
      if (ok && (lib.version ?? 1) >= LIBRARY_VERSION && (opts.offline || !lib.degraded || !staleEnoughToRetry)) return lib;
      if (ok && lib.degraded) logger.warn('video.sfx.library_degraded_retry', { builtAt: lib.builtAt });
    } catch {
      /* reconstruit */
    }
  }
  fs.mkdirSync(path.join(dir, 'raw'), { recursive: true });
  const catalog = loadCatalog();
  // La sonothèque précédente : ses vrais sons restent candidats (une reconstruction avec un réseau lent ou coupé ne
  // perd plus les bons sons déjà téléchargés — observé le 24/11/2026 : 3 sons de banque à la place de 5 vrais).
  let previous: SfxLibrary | null = null;
  try {
    previous = fs.existsSync(manifest) ? (JSON.parse(fs.readFileSync(manifest, 'utf8')) as SfxLibrary) : null;
  } catch {
    previous = null;
  }
  const sounds = {} as Record<SfxKind, LibrarySound[]>;

  for (const kind of SFX_KINDS) {
    const spec = SFX_SPECS[kind];
    const list: LibrarySound[] = [];
    if (!opts.offline) {
      const found: Candidate[] = [...(catalog[kind] || []).map((c) => ({ ...c, id: `catalog:${c.id}` }))];
      for (const query of spec.queries) {
        const [ov, fsd, sfm] = await Promise.all([
          searchOpenverse(query).catch((e) => (logger.warn('video.sfx.openverse_failed', { query, error: e.message }), [])),
          searchFreesound(query, spec).catch(() => []),
          searchSfxmint(query, spec).catch((e) => (logger.warn('video.sfx.sfxmint_failed', { query, error: e.message }), [])),
        ]);
        found.push(...fsd, ...sfm, ...ov);
      }
      const seen = new Set<string>();
      const candidates = found.filter((c) => {
        const titleKey = c.title.toLowerCase().replace(/[^a-z]/g, '').replace(/\d+$/, '');
        if (!c.url || seen.has(c.id) || seen.has(titleKey)) return false;
        seen.add(c.id);
        seen.add(titleKey);
        if (COMMON_EXCLUDE.test(c.title) || spec.exclude.test(c.title)) return false;
        if (!c.id.startsWith('catalog:') && !spec.keywords.test(c.title)) return false;
        // Durée brute : un peu plus longue que la cible (les silences seront retirés).
        return c.durationSec === 0 || (c.durationSec >= spec.min && c.durationSec <= spec.max * 4);
      });
      // Téléchargements et traitements en parallèle (4 à la fois).
      const queue = candidates.slice(0, 20);
      const worker = async () => {
        for (let c = queue.shift(); c; c = queue.shift()) {
          const key = crypto.createHash('sha1').update(c.id).digest('hex').slice(0, 12);
          const raw = path.join(dir, 'raw', `${key}.src`);
          const file = path.join(dir, `${kind}-${key}.mp3`);
          try {
            if (!fs.existsSync(raw)) {
              const res = await axios.get(c.url, { responseType: 'arraybuffer', timeout: 15000, maxContentLength: 8 * 1024 * 1024 });
              fs.writeFileSync(raw, Buffer.from(res.data));
            }
            const processed = await processSound(raw, file, spec);
            if (processed.duration < spec.min || processed.duration > spec.max + 0.05) continue;
            list.push({
              id: c.id,
              kind,
              title: c.title,
              author: c.author,
              license: 'cc0',
              sourceUrl: c.sourceUrl,
              durationSec: Math.round(processed.duration * 1000) / 1000,
              file,
              score: scoreCandidate(c, spec, kind, processed),
            });
          } catch (error: any) {
            logger.warn('video.sfx.candidate_failed', { kind, id: c.id, error: error.message });
          }
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
    }
    for (const old of previous?.sounds[kind] || []) {
      if (old.license === 'generated' || list.some((x) => x.id === old.id) || !fs.existsSync(old.file)) continue;
      if (COMMON_EXCLUDE.test(old.title) || spec.exclude.test(old.title)) continue;
      list.push(old);
    }
    // La banque locale (Earshot), en ligne comme hors ligne.
    list.push(...(await bankSounds(kind, dir)));
    list.sort((a, b) => b.score - a.score);
    sounds[kind] = list.slice(0, MAX_PER_KIND);
    if (!sounds[kind].length) {
      if (!opts.offline) logger.warn('video.sfx.kind_fallback_synth', { kind, queries: spec.queries });
      // Trois prises de synthèse, jamais une seule (la rotation des transitions a de quoi tourner).
      sounds[kind] = [await synthSound(kind, dir, 0), await synthSound(kind, dir, 1), await synthSound(kind, dir, 2)];
    }
  }

  const degraded = SFX_KINDS.some((k) => sounds[k].every((s) => s.license === 'generated'));
  const lib: SfxLibrary = { builtAt: new Date().toISOString(), version: LIBRARY_VERSION, degraded, sounds };
  fs.writeFileSync(manifest, JSON.stringify(lib, null, 1));
  return lib;
}

let libraryPromise: Promise<SfxLibrary> | null = null;
// Horodatage + statut de la dernière résolution, tenus à jour en dehors de la promesse elle-même :
// un serveur qui tourne des jours ne doit pas garder une sonothèque dégradée en mémoire pour toujours.
let libraryResolvedAt = 0;
let libraryResolvedDegraded = false;

/** Sonothèque partagée par le processus (construite à la première vidéo). */
export function sfxLibrary(): Promise<SfxLibrary> {
  // VIDEO_SFX_OFFLINE=1 : sons de synthèse seulement (contrôles hors ligne, CI).
  if (process.env.VIDEO_SFX_OFFLINE === '1') {
    libraryPromise ??= ensureSfxLibrary({ offline: true });
    return libraryPromise;
  }
  if (libraryPromise && libraryResolvedDegraded && Date.now() - libraryResolvedAt > DEGRADED_RETRY_MS) {
    libraryPromise = null;
  }
  libraryPromise ??= ensureSfxLibrary()
    .then((lib) => {
      libraryResolvedAt = Date.now();
      libraryResolvedDegraded = lib.degraded;
      return lib;
    })
    .catch(async (error) => {
      logger.warn('video.sfx.library_failed', { error: error.message });
      libraryPromise = null;
      return ensureSfxLibrary({ offline: true });
    });
  return libraryPromise;
}

/**
 * LA PALETTE D'UNE VIDÉO (24/11/2026) : pour chaque moment sonore, des prises tirées par la graine dans tout le vivier
 * (les mieux notés plus souvent), jamais un son de synthèse quand un vrai son existe, et en évitant les sons des
 * vidéos précédentes de la marque (`avoid`) tant qu'il en reste d'autres. Le premier son est le son principal, les
 * suivants sont les prises de la rotation.
 */
export function pickPalette(lib: SfxLibrary, seed: number, opts: { avoid?: Iterable<string>; takes?: number } = {}): Partial<Record<SfxKind, LibrarySound[]>> {
  const r = rng(seed ^ 0x51f15e);
  const avoid = new Set(opts.avoid ?? []);
  const n = opts.takes ?? 3;
  const out: Partial<Record<SfxKind, LibrarySound[]>> = {};
  for (const kind of SFX_KINDS) {
    const all = lib.sounds[kind] || [];
    const real = all.filter((s) => !s.id.startsWith('synth:'));
    let pool = real.length ? real : all;
    const fresh = pool.filter((s) => !avoid.has(s.id));
    if (fresh.length >= Math.min(n, pool.length)) pool = fresh;
    // Tirage pondéré sans remise : poids = rang inverse (le meilleur son sort plus souvent, jamais toujours).
    const left = [...pool];
    const picked: LibrarySound[] = [];
    while (left.length && picked.length < n) {
      const weights = left.map((_, i) => 1 / (1 + i * 0.35));
      let x = r() * weights.reduce((a, b) => a + b, 0);
      let i = 0;
      while (i < left.length - 1 && (x -= weights[i]) > 0) i++;
      picked.push(left.splice(i, 1)[0]);
    }
    if (picked.length) out[kind] = picked;
  }
  return out;
}

/** Un son par moment sonore (le premier de la palette). */
export function pickSounds(lib: SfxLibrary, seed: number, avoid?: Iterable<string>): Record<SfxKind, LibrarySound> {
  const palette = pickPalette(lib, seed, { avoid });
  return Object.fromEntries(Object.entries(palette).map(([k, v]) => [k, v![0]])) as Record<SfxKind, LibrarySound>;
}

/** Les prises de la rotation (« the same whoosh on every cut is the most common tell » — HyperFrames, `sound.md`). */
export function pickTakes(lib: SfxLibrary, seed: number, avoid?: Iterable<string>, n = 3): Partial<Record<SfxKind, LibrarySound[]>> {
  const palette = pickPalette(lib, seed, { avoid, takes: n });
  return Object.fromEntries(Object.entries(palette).filter(([, v]) => (v?.length ?? 0) > 1)) as Partial<Record<SfxKind, LibrarySound[]>>;
}

/**
 * Retrouve le fichier d'un son retenu (rendu, aperçu). Un son disparu de la sonothèque (reconstruite depuis) est
 * remplacé par un son du même moment choisi d'après SON identifiant — avant, c'était toujours le premier : toutes les
 * prises d'une vidéo retombaient sur le même fichier, le même whoosh à chaque coupe.
 */
export async function soundFile(sound: SfxSound): Promise<string | null> {
  const lib = await sfxLibrary();
  const pool = (lib.sounds[sound.kind] || []).filter((s) => fs.existsSync(s.file));
  const found = pool.find((s) => s.id === sound.id);
  if (found) return found.file;
  if (!pool.length) return null;
  const h = crypto.createHash('sha1').update(sound.id).digest().readUInt32BE(0);
  return pool[h % pool.length].file;
}

/** Nom de fichier public d'un son (servi sans authentification : sons CC0). */
export function publicSoundName(file: string): string {
  return path.basename(file);
}

export function resolvePublicSound(name: string): string | null {
  // Sons de banque en ligne, de la banque locale (`bank-<sorte>-<n>`) et prises de synthèse (`synth-<sorte>[-n]`).
  if (!/^[a-z]+-[a-f0-9]{12}\.mp3$|^bank-[a-z]+-\d+\.mp3$|^synth-[a-z]+(-\d)?\.mp3$/.test(name)) return null;
  const file = path.join(sfxDir(), name);
  return fs.existsSync(file) ? file : null;
}

export interface SfxCue {
  t: number;
  kind: SfxKind;
  /** Gain relatif (0..1) décidé par la scène. */
  gain?: number;
  /** Prise (rotation) quand le moment sonore en a plusieurs. */
  take?: number;
  /** Énergie (1..5) de la scène qui porte le moment : une scène nerveuse sonne plus fort qu'une scène posée. */
  energy?: number;
}

// ─── Placement : synchronisation et niveau adaptés ──────────────────────────

const peakCache = new Map<string, Promise<number>>();
/**
 * L'instant (s) où un son frappe le plus fort (fenêtres de 20 ms). Un whoosh culmine de 0,04 à 0,4 s après son début,
 * un riser de 0,8 à 2,8 s : c'est CET instant qu'on cale sur l'image, pas le début du fichier.
 */
export function sfxPeakSec(file: string): Promise<number> {
  let job = peakCache.get(file);
  if (!job) {
    job = new Promise<number>((resolve) => {
      const ff = spawn(FFMPEG, ['-v', 'error', '-i', file, '-ac', '1', '-ar', '8000', '-f', 's16le', '-'], { stdio: ['ignore', 'pipe', 'ignore'] });
      const chunks: Buffer[] = [];
      ff.stdout.on('data', (c: Buffer) => chunks.push(c));
      ff.on('error', () => resolve(0));
      ff.on('close', () => {
        const buf = Buffer.concat(chunks);
        const w = 160;
        let best = 0;
        let bestAt = 0;
        for (let i = 0; i + w * 2 <= buf.length; i += w * 2) {
          let e = 0;
          for (let j = 0; j < w; j++) {
            const v = buf.readInt16LE(i + j * 2);
            e += v * v;
          }
          if (e > best) {
            best = e;
            bestAt = i / 2 / 8000;
          }
        }
        resolve(Math.round(bestAt * 1000) / 1000);
      });
    });
    peakCache.set(file, job);
  }
  return job;
}

/** L'enveloppe d'une musique (dB par fenêtre de 100 ms) sur l'extrait utilisé, et son niveau médian. */
export async function musicEnvelope(file: string, startAt: number, durationSec: number): Promise<{ at: (t: number, before?: number, after?: number) => number; median: number } | null> {
  const buf = await new Promise<Buffer>((resolve) => {
    const ff = spawn(FFMPEG, ['-v', 'error', '-ss', String(Math.max(0, startAt)), '-t', String(durationSec + 0.5), '-i', file, '-ac', '1', '-ar', '8000', '-f', 's16le', '-'], { stdio: ['ignore', 'pipe', 'ignore'] });
    const chunks: Buffer[] = [];
    ff.stdout.on('data', (c: Buffer) => chunks.push(c));
    ff.on('error', () => resolve(Buffer.alloc(0)));
    ff.on('close', () => resolve(Buffer.concat(chunks)));
  });
  const w = 800;
  const env: number[] = [];
  for (let i = 0; i + w * 2 <= buf.length; i += w * 2) {
    let e = 0;
    for (let j = 0; j < w; j++) {
      const v = buf.readInt16LE(i + j * 2) / 32768;
      e += v * v;
    }
    env.push(10 * Math.log10(e / w + 1e-10));
  }
  const audible = env.filter((x) => x > -60).sort((a, b) => a - b);
  if (audible.length < 5) return null;
  const median = audible[Math.floor(audible.length / 2)];
  const at = (t: number, before = 0.2, after = 0.4) => {
    const a = Math.max(0, Math.floor((t - before) * 10));
    const b = Math.min(env.length - 1, Math.ceil((t + after) * 10));
    let m = -100;
    for (let i = a; i <= b; i++) m = Math.max(m, env[i]);
    return m;
  };
  return { at, median };
}

/**
 * LE PLACEMENT D'UN EFFET (24/11/2026, retour utilisateur : « pas bien synchronisés », « ajuster le volume en fonction
 * de la vidéo et de la musique ») — calculé par le code, sur des mesures :
 *   synchro    `t` est l'instant VISÉ (la coupe, le texte qui se pose) : le son démarre `pic` secondes plus tôt pour que
 *              son point le plus fort tombe dessus (avant : un décalage fixe, un riser pouvait culminer 1,4 s trop tard) ;
 *   musique    là où la musique monte, l'effet monte d'autant (×0,6) ; dans un passage calme il descend (−5…+4 dB) :
 *              l'écart effet/musique reste le même d'un bout à l'autre du film ;
 *   image      l'énergie de la scène (1 posé → 5 nerveux) ajoute ou retire jusqu'à 2 dB.
 * La sonie propre du fichier est égalisée plus loin (`sfxLevelCompDb`, au mixage et dans l'aperçu).
 */
export async function placeCues<C extends SfxCue & { db: number }>(cues: C[], fileOf: (c: C) => string | undefined, music?: { file: string; startAt: number; durationSec: number } | null): Promise<C[]> {
  const env = music ? await musicEnvelope(music.file, music.startAt, music.durationSec).catch(() => null) : null;
  const out: C[] = [];
  for (const cue of cues) {
    const file = fileOf(cue);
    if (!file) continue;
    const peak = await sfxPeakSec(file);
    const musicDb = env ? Math.max(-5, Math.min(4, 0.6 * (env.at(cue.t) - env.median))) : 0;
    const energyDb = cue.energy ? Math.max(-2, Math.min(2, cue.energy - 3)) : 0;
    out.push({ ...cue, t: Math.round(Math.max(0, cue.t - peak) * 1000) / 1000, db: Math.round((cue.db + musicDb + energyDb) * 10) / 10 });
  }
  return out;
}

/**
 * Filtre les moments sonores : densité du style, espacement minimal par type
 * et plafond global (au-delà de 3 sons par seconde, l'oreille sature).
 */
export function refineCues(cues: SfxCue[], style: MotionStyle, duration: number, intensity: 'subtle' | 'normal' | 'punchy' = 'normal'): (SfxCue & { db: number })[] {
  const density = SFX_DENSITY[style] || {};
  // L'intensité choisie par le sound designer déplace tout le mixage des effets.
  const shift = intensity === 'subtle' ? -4 : intensity === 'punchy' ? 3 : 0;
  const minGap: Partial<Record<SfxKind, number>> = { click: 0.18, tick: 0.09, pop: 0.12, whoosh: 0.3, softwhoosh: 0.3, impact: 0.6, shimmer: 1, riser: 1.5 };
  const lastAt: Partial<Record<SfxKind, number>> = {};
  const out: (SfxCue & { db: number })[] = [];
  for (const cue of [...cues].sort((a, b) => a.t - b.t)) {
    if (cue.t < 0 || cue.t > duration - 0.05) continue;
    const db = SFX_GAIN_DB[cue.kind] + (density[cue.kind] ?? 0) + shift + 20 * Math.log10(Math.max(0.05, cue.gain ?? 1));
    if (db < -40) continue;
    if (lastAt[cue.kind] !== undefined && cue.t - (lastAt[cue.kind] as number) < (minGap[cue.kind] ?? 0.15)) continue;
    const window = out.filter((c) => cue.t - c.t < 1).length;
    if (window >= 3 && cue.kind !== 'whoosh' && cue.kind !== 'impact') continue;
    lastAt[cue.kind] = cue.t;
    out.push({ ...cue, db: Math.round(db * 10) / 10 });
  }
  return out;
}

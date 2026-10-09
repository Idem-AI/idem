/**
 * MUSIQUE LIBRE DE DROITS — plusieurs bibliothèques, interrogées ensemble.
 *
 * La diversité vient du nombre de sources : une seule banque fait entendre les
 * mêmes dix morceaux dans toutes les vidéos de la plateforme.
 *
 *   Source      Clé requise            Couverture
 *   ─────────   ────────────────────   ─────────────────────────────────────────
 *   local       non (catalogue IDEM)   pistes choisies à la main, les plus sûres
 *   openverse   non (OPENVERSE_TOKEN   agrège Jamendo, Freesound, Wikimedia
 *               en option : quota ↑)   Commons, ccMixter… (des milliers de titres)
 *   ccmixter    non                    remix et instrumentaux, tempo annoncé
 *   jamendo     JAMENDO_CLIENT_ID      plus de 500 000 titres, tri par popularité
 *   freesound   FREESOUND_API_KEY      boucles et ambiances
 *
 * Licences ACCEPTÉES : CC0, domaine public, CC BY (crédit affiché). Refusées :
 * NC (usage commercial interdit), ND (pas de montage), SA (contamine la vidéo).
 *
 * Toutes les requêtes passent par un cache de 24 h : une ambiance demandée cent
 * fois dans la journée coûte une requête par source.
 */
import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import https from 'https';
import os from 'os';
import path from 'path';
import logger from '../../../config/logger';
import { MotionStyle, MusicLicense, MusicMood, MusicTrack, VideoObjective } from '../../../models/motionVideo.model';

export type ConcreteMood = Exclude<MusicMood, 'auto' | 'none'>;

/** Mots de recherche par ambiance, par ordre de pertinence. */
export const MOOD_TERMS: Record<ConcreteMood, string[]> = {
  upbeat: ['upbeat', 'happy', 'energetic', 'pop'],
  calm: ['calm', 'chill', 'ambient', 'acoustic'],
  // « Épique » = élan, espoir : jamais la bande-annonce sombre.
  epic: ['inspiring', 'uplifting', 'hopeful', 'cinematic'],
  corporate: ['corporate', 'motivational', 'business', 'positive'],
  afro: ['afrobeat', 'african', 'afro', 'highlife', 'world percussion'],
};

/**
 * Ce qui contredit l'ambiance : une recherche par mot-clé ramène « Harsh Calm
 * [Hardcore Techno] » pour « calm ». Écarté sur le titre et les étiquettes.
 */
const MOOD_EXCLUDE: Record<ConcreteMood, RegExp> = {
  upbeat: /\b(dark|sad|horror|creepy|funeral|drone|doom|melanchol)/i,
  calm: /\b(hardcore|metal|techno|dubstep|trap|drum ?(and|&|n) ?bass|aggressive|scream|noise|punk|hard ?rock|epic)/i,
  epic: /\b(lullaby|sleep|lo-?fi|comedy|funny|dark|heavy|horror|war|battle|doom|trailer|villain|evil)/i,
  corporate: /\b(dark|horror|metal|hardcore|creepy|sad|punk)/i,
  afro: /\b(metal|hardcore|dubstep|horror)/i,
};
/** Jamais dans une publicité, quelle que soit l'ambiance (titres qui contredisent une marque). */
const ALWAYS_EXCLUDE = /\b(horror|scream|creepy|explicit|nsfw|gore|satan|war ?sound|gunshot|fail(ed|ure)?|parody|meme|funeral|depress\w*|suicid\w*|sad(ness)?|tears?|cry(ing)?|grief|lament)\b/i;

/** Ambiance par défaut : déduite du langage de mouvement et de l'objectif. */
export function resolveMood(mood: MusicMood, style: MotionStyle, objective: VideoObjective, brandText = ''): ConcreteMood | null {
  if (mood === 'none') return null;
  if (mood !== 'auto') return mood;
  // Le ton de la marque d'abord : une marque de motivation n'a pas la musique d'une boutique de luxe.
  const t = brandText.toLowerCase();
  if (/inspir|motiv|transform|confian|r[êe]ve|briller|r[ée]ussi|d[ée]passer|courage|ambition|espoir|rise|shine|grandir/.test(t)) return 'epic';
  if (/f[êe]te|festi|soir[ée]e|danse|afro|wax|pagne|maquis|ambiance/.test(t)) return objective === 'promotion' ? 'upbeat' : 'afro';
  if (/luxe|premium|[ée]l[ée]gan|raffin|spa|bien-[êe]tre|zen|soin/.test(t)) return 'calm';
  if (/b2b|entreprise|conseil|cabinet|logiciel|software|finance|assurance|juridique/.test(t)) return 'corporate';
  if (objective === 'recruitment' || objective === 'testimonial') return 'corporate';
  if (objective === 'event' || objective === 'opening') return style === 'premium' ? 'epic' : 'afro';
  switch (style) {
    case 'energetic':
      return 'upbeat';
    case 'premium':
      return 'calm';
    case 'playful':
      return 'upbeat';
    default:
      return 'corporate';
  }
}

export interface MusicQuery {
  mood: ConcreteMood;
  /** La piste doit couvrir au moins cette durée (vidéo + marge). */
  minDuration: number;
  limit?: number;
}

export interface MusicProvider {
  id: MusicTrack['provider'];
  /** Poids de confiance : le catalogue maison passe avant une banque ouverte. */
  weight: number;
  enabled(): boolean;
  search(query: MusicQuery): Promise<MusicTrack[]>;
}

const HTTP_TIMEOUT = 7000;
const memo = new Map<string, { at: number; tracks: MusicTrack[] }>();
const MEMO_TTL = 24 * 3600 * 1000;

async function cached(key: string, fn: () => Promise<MusicTrack[]>): Promise<MusicTrack[]> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < MEMO_TTL) return hit.tracks;
  const tracks = await fn();
  memo.set(key, { at: Date.now(), tracks });
  return tracks;
}

/** Ramène une URL de licence Creative Commons vers les licences acceptées. */
export function licenseFromUrl(url?: string, code?: string): MusicLicense | null {
  const v = `${code || ''} ${url || ''}`.toLowerCase();
  if (/publicdomain\/zero|\bcc0\b/.test(v)) return 'cc0';
  if (/publicdomain\/mark|\bpdm\b|public domain/.test(v)) return 'pdm';
  if (/-nc|\bnc\b|noncommercial|-nd|\bnd\b|noderiv/.test(v)) return null;
  if (/by-sa|\bsa\b|sharealike/.test(v)) return null;
  if (/licenses\/by\/|\bby\b|attribution/.test(v)) return 'cc-by';
  return null;
}

const LICENSE_LABEL: Record<MusicLicense, string> = {
  cc0: 'CC0',
  pdm: 'Domaine public',
  'cc-by': 'CC BY',
  'cc-by-sa': 'CC BY-SA',
  platform: 'Licence de la plateforme',
};

export function attributionLine(t: Pick<MusicTrack, 'title' | 'artist' | 'license' | 'licenseUrl' | 'provider'>): string {
  const base = `« ${t.title} » par ${t.artist}`;
  return `${base} — ${LICENSE_LABEL[t.license]}${t.licenseUrl ? ` (${t.licenseUrl})` : ''}`;
}

// ─── Sources ────────────────────────────────────────────────────────────────

let localTracks: MusicTrack[] | null = null;

/** Catalogue maison : `VIDEO_MUSIC_CATALOG` (chemin d'un JSON ou URL), ou pistes enregistrées. */
export function registerLocalTracks(tracks: MusicTrack[]): void {
  localTracks = [...(localTracks || []), ...tracks];
}

export function resetLocalTracks(): void {
  localTracks = null;
}

async function loadLocalCatalog(): Promise<MusicTrack[]> {
  if (localTracks) return localTracks;
  const source = process.env.VIDEO_MUSIC_CATALOG;
  if (!source) return (localTracks = []);
  try {
    const raw = /^https?:/.test(source)
      ? (await axios.get(source, { timeout: HTTP_TIMEOUT })).data
      : JSON.parse(fs.readFileSync(source, 'utf8'));
    const list: MusicTrack[] = (Array.isArray(raw) ? raw : raw?.tracks || []).map((t: any) => ({
      ...t,
      provider: 'local',
      attribution: t.attribution || attributionLine({ ...t, provider: 'local' }),
    }));
    localTracks = list.filter((t) => t.url && t.license);
  } catch (error: any) {
    logger.warn('video.music.local_catalog_failed', { error: error.message });
    localTracks = [];
  }
  return localTracks;
}

export const localProvider: MusicProvider = {
  id: 'local',
  weight: 1.4,
  enabled: () => true,
  async search(q) {
    const all = await loadLocalCatalog();
    return all.filter(
      (t) => t.durationSec >= q.minDuration && (t.moods || []).some((m) => m === q.mood || MOOD_TERMS[q.mood].includes(m))
    );
  },
};

export const openverseProvider: MusicProvider = {
  id: 'openverse',
  weight: 1,
  enabled: () => process.env.VIDEO_MUSIC_OPENVERSE !== 'off',
  async search(q) {
    const terms = MOOD_TERMS[q.mood].slice(0, 3);
    const results = await Promise.all(
      terms.map((term) =>
        cached(`openverse:${term}`, async () => {
          const res = await axios.get('https://api.openverse.org/v1/audio/', {
            params: { q: term, license: 'cc0,by,pdm', category: 'music', page_size: 20, mature: false },
            headers: process.env.OPENVERSE_TOKEN ? { Authorization: `Bearer ${process.env.OPENVERSE_TOKEN}` } : {},
            timeout: HTTP_TIMEOUT,
          });
          return (res.data?.results || [])
            .map((r: any): MusicTrack | null => {
              const license = licenseFromUrl(r.license_url, r.license);
              if (!license || !r.url) return null;
              const track: MusicTrack = {
                id: `openverse:${r.id}`,
                provider: 'openverse',
                title: r.title || 'Sans titre',
                artist: r.creator || 'Artiste inconnu',
                url: r.url,
                durationSec: (r.duration || 0) / 1000,
                license,
                licenseUrl: r.license_url,
                sourceUrl: r.foreign_landing_url,
                attribution: '',
                moods: [term, ...(r.genres || [])],
              };
              track.attribution = attributionLine(track);
              return track;
            })
            .filter(Boolean) as MusicTrack[];
        })
      )
    );
    return results.flat().filter((t) => t.durationSec >= q.minDuration);
  },
};

/**
 * GET JSON avec une limite d'en-têtes relevée : le serveur de ccMixter renvoie
 * des en-têtes plus gros que la limite par défaut de Node (16 Ko), qu'axios ne
 * permet pas de lever.
 */
function getJsonLargeHeaders(url: string, timeoutMs: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { maxHeaderSize: 128 * 1024, timeout: timeoutMs, headers: { Accept: 'application/json' } }, (res) => {
      if ((res.statusCode || 0) >= 400) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (c: Buffer) => {
        size += c.length;
        if (size > 5 * 1024 * 1024) req.destroy(new Error('response_too_large'));
        else chunks.push(c);
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

const BPM_TAG = /bpm_(\d{2,3})_(\d{2,3})/;
const VOCAL_TAGS = /(acappella|acapella|vocals?|singing|rap|spoken|lyrics)/;

function playtime(ps?: string): number {
  const m = (ps || '').match(/^(\d+):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

export const ccmixterProvider: MusicProvider = {
  id: 'ccmixter',
  weight: 0.9,
  enabled: () => process.env.VIDEO_MUSIC_CCMIXTER !== 'off',
  async search(q) {
    const term = MOOD_TERMS[q.mood][0].split(' ')[0];
    return cached(`ccmixter:${term}`, async () => {
      const query = new URLSearchParams({ f: 'json', tags: `instrumental+${term}`, lic: 'by', limit: '25', sort: 'rank' });
      const data = await getJsonLargeHeaders(`https://ccmixter.org/api/query?${query.toString().replace(/%2B/g, '+')}`, HTTP_TIMEOUT);
      return (Array.isArray(data) ? data : [])
        .map((r: any): MusicTrack | null => {
          const tags = String(r.upload_tags || '');
          if (VOCAL_TAGS.test(tags)) return null;
          const file = (r.files || []).find((f: any) => /mp3/i.test(f?.file_format_info?.['default-ext'] || f?.file_nicname || ''));
          const license = licenseFromUrl(r.license_url, r.license_name);
          if (!file?.download_url || !license) return null;
          const bpm = tags.match(BPM_TAG);
          const track: MusicTrack = {
            id: `ccmixter:${r.upload_id || file.file_upload}`,
            provider: 'ccmixter',
            title: r.upload_name || 'Sans titre',
            artist: r.user_name || 'Artiste inconnu',
            url: file.download_url,
            durationSec: playtime(file.file_format_info?.ps),
            license,
            licenseUrl: r.license_url,
            sourceUrl: r.file_page_url,
            attribution: '',
            moods: [term, ...tags.split(',').filter(Boolean).slice(0, 12)],
            bpm: bpm ? (Number(bpm[1]) + Number(bpm[2])) / 2 : undefined,
          };
          track.attribution = attributionLine(track);
          return track;
        })
        .filter(Boolean) as MusicTrack[];
    }).then((tracks) => tracks.filter((t) => t.durationSec >= q.minDuration));
  },
};

export const jamendoProvider: MusicProvider = {
  id: 'jamendo',
  weight: 1.1,
  enabled: () => !!process.env.JAMENDO_CLIENT_ID,
  async search(q) {
    const term = MOOD_TERMS[q.mood][0];
    return cached(`jamendo:${term}`, async () => {
      const res = await axios.get('https://api.jamendo.com/v3.0/tracks/', {
        params: {
          client_id: process.env.JAMENDO_CLIENT_ID,
          format: 'json',
          limit: 25,
          fuzzytags: term,
          vocalinstrumental: 'instrumental',
          audioformat: 'mp32',
          order: 'popularity_total',
          include: 'musicinfo',
          ccnc: false,
          ccnd: false,
          ccsa: false,
        },
        timeout: HTTP_TIMEOUT,
      });
      return (res.data?.results || [])
        .map((r: any): MusicTrack | null => {
          const license = licenseFromUrl(r.license_ccurl);
          if (!license || !r.audio) return null;
          const track: MusicTrack = {
            id: `jamendo:${r.id}`,
            provider: 'jamendo',
            title: r.name,
            artist: r.artist_name,
            url: r.audiodownload_allowed && r.audiodownload ? r.audiodownload : r.audio,
            durationSec: Number(r.duration) || 0,
            license,
            licenseUrl: r.license_ccurl,
            sourceUrl: r.shareurl,
            attribution: '',
            moods: [term, ...(r.musicinfo?.tags?.vartags || []), ...(r.musicinfo?.tags?.genres || [])],
          };
          track.attribution = attributionLine(track);
          return track;
        })
        .filter(Boolean) as MusicTrack[];
    }).then((tracks) => tracks.filter((t) => t.durationSec >= q.minDuration));
  },
};

export const freesoundProvider: MusicProvider = {
  id: 'freesound',
  weight: 0.8,
  enabled: () => !!process.env.FREESOUND_API_KEY,
  async search(q) {
    const term = MOOD_TERMS[q.mood][0];
    return cached(`freesound:${term}`, async () => {
      const res = await axios.get('https://freesound.org/apiv2/search/text/', {
        params: {
          query: `${term} music`,
          filter: 'duration:[20 TO 300] license:("Creative Commons 0" OR "Attribution")',
          fields: 'id,name,username,license,duration,previews,url,tags',
          sort: 'rating_desc',
          page_size: 25,
          token: process.env.FREESOUND_API_KEY,
        },
        timeout: HTTP_TIMEOUT,
      });
      return (res.data?.results || [])
        .map((r: any): MusicTrack | null => {
          const license = licenseFromUrl(r.license);
          const url = r.previews?.['preview-hq-mp3'];
          if (!license || !url) return null;
          const track: MusicTrack = {
            id: `freesound:${r.id}`,
            provider: 'freesound',
            title: r.name,
            artist: r.username,
            url,
            durationSec: Number(r.duration) || 0,
            license,
            licenseUrl: r.license,
            sourceUrl: r.url,
            attribution: '',
            moods: [term, ...(r.tags || []).slice(0, 10)],
          };
          track.attribution = attributionLine(track);
          return track;
        })
        .filter(Boolean) as MusicTrack[];
    }).then((tracks) => tracks.filter((t) => t.durationSec >= q.minDuration));
  },
};

export const MUSIC_PROVIDERS: MusicProvider[] = [
  localProvider,
  openverseProvider,
  ccmixterProvider,
  jamendoProvider,
  freesoundProvider,
];

// ─── Sélection ──────────────────────────────────────────────────────────────

/** PRNG déterministe (mulberry32) : même graine, même choix. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const normalizeKey = (t: MusicTrack) => `${t.title}|${t.artist}`.toLowerCase().replace(/[^a-z0-9|]/g, '');

/**
 * Toutes les pistes candidates, de toutes les sources disponibles, classées.
 * Une source en panne ou trop lente est simplement ignorée.
 */
export async function searchMusic(
  query: MusicQuery,
  providers: MusicProvider[] = MUSIC_PROVIDERS
): Promise<MusicTrack[]> {
  const active = providers.filter((p) => p.enabled());
  const attempt = (p: MusicProvider) =>
    Promise.race([
      p.search(query).then((tracks) => tracks.map((t) => ({ t, w: p.weight }))),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), HTTP_TIMEOUT + 1500)),
    ]);
  // Une seconde tentative par source : une coupure réseau passagère ne doit pas
  // laisser la vidéo sans musique.
  const settled = await Promise.allSettled(active.map((p) => attempt(p).catch(() => attempt(p))));
  const seen = new Set<string>();
  const ranked: { t: MusicTrack; score: number }[] = [];
  settled.forEach((result, i) => {
    if (result.status !== 'fulfilled') {
      const err = result.reason as { message?: string; code?: string; response?: { status?: number } };
      logger.warn('video.music.provider_failed', { provider: active[i].id, error: err?.message || err?.code || (err?.response?.status ? `HTTP ${err.response.status}` : 'unknown') });
      return;
    }
    for (const { t, w } of result.value) {
      const key = normalizeKey(t);
      if (seen.has(key) || t.durationSec > 900) continue;
      const descriptor = `${t.title} ${(t.moods || []).join(' ')}`;
      if (ALWAYS_EXCLUDE.test(descriptor) || MOOD_EXCLUDE[query.mood].test(descriptor)) continue;
      seen.add(key);
      const moodHits = (t.moods || []).filter((m) => MOOD_TERMS[query.mood].some((term) => m.toLowerCase().includes(term.split(' ')[0]))).length;
      const lengthFit = t.durationSec < query.minDuration + 240 ? 0.2 : 0;
      ranked.push({ t, score: w + Math.min(3, moodHits) * 0.25 + (t.bpm ? 0.15 : 0) + (t.license === 'cc0' ? 0.1 : 0) + lengthFit });
    }
  });
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, query.limit ?? 40).map((r) => r.t);
}

/**
 * Une piste pour une vidéo : tirée parmi les meilleures par la graine, en
 * évitant celles déjà utilisées dans le projet (diversité d'une vidéo à l'autre).
 */
export function pickTrack(candidates: MusicTrack[], seed: number, avoidIds: string[] = []): MusicTrack | null {
  if (!candidates.length) return null;
  const fresh = candidates.filter((t) => !avoidIds.includes(t.id));
  const pool = (fresh.length ? fresh : candidates).slice(0, 12);
  const r = rng(seed ^ 0x9e3779b9)();
  return pool[Math.floor(r * pool.length)];
}

// ─── Téléchargement ─────────────────────────────────────────────────────────

const MUSIC_CACHE_DIR = path.join(os.tmpdir(), 'idem-video-music');
const MAX_TRACK_BYTES = 30 * 1024 * 1024;

/** Copie locale de la piste (cache disque) : ffmpeg et l'analyse la lisent ici. */
export async function fetchTrack(track: Pick<MusicTrack, 'url' | 'provider'>): Promise<string> {
  // Fichier local : réservé au catalogue maison (jamais une URL venue d'ailleurs).
  if (track.provider === 'local') {
    const local = track.url.startsWith('file://') ? track.url.slice('file://'.length) : track.url;
    if (local.startsWith('/') && fs.existsSync(local)) return local;
  }
  if (!/^https?:\/\//.test(track.url)) throw new Error('unsupported_track_url');
  fs.mkdirSync(MUSIC_CACHE_DIR, { recursive: true });
  const name = crypto.createHash('sha1').update(track.url).digest('hex');
  const file = path.join(MUSIC_CACHE_DIR, `${name}.audio`);
  if (fs.existsSync(file) && fs.statSync(file).size > 1024) return file;
  // Deux essais : les serveurs des banques sont parfois lents à répondre.
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await axios.get(track.url, {
        responseType: 'arraybuffer',
        timeout: 60000,
        maxContentLength: MAX_TRACK_BYTES,
        maxRedirects: 5,
      });
      fs.writeFileSync(file, Buffer.from(res.data));
      return file;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error && lastError.message ? lastError : new Error(`track_download_failed: ${String((lastError as any)?.code || lastError)}`);
}

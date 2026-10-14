/**
 * LES IMAGES DE LA MARQUE, DÉCRITES — pour que chaque agent s'en serve au bon endroit.
 *
 * Captures du site et du produit (site lu par iVision), photos importées, visuels déjà faits :
 * avant, elles ne servaient qu'en dernier recours (après Pexels), et aucun agent ne savait ce
 * qu'elles montraient. Désormais chacune reçoit UNE ligne de description (modèle de vision, une
 * fois par image, gardée en mémoire et chez l'hôte) : le directeur sait que la n° 3 est « le
 * tableau des prévisions financières » et la montre quand le scénario dit « des prévisions
 * financières apparaissent ». Sans modèle de vision, une description générique suffit à les
 * proposer.
 */
import sharp from 'sharp';
import logger from '../runtime/logger';
import { coreHost } from '../runtime/host';
import { safeFetch } from '../render/safe-fetch';

export interface BrandMediaItem {
  url: string;
  /** `screen` : capture d'un site ou d'une application ; `photo` : une photographie. */
  kind: 'screen' | 'photo';
  /** Une ligne, en anglais (« screenshot: financial forecasts dashboard with revenue chart »). */
  note: string;
}

const NOTES = new Map<string, BrandMediaItem>();

const PROMPT = [
  'Describe this image for a video director, in at most 16 English words.',
  'Start with "screenshot:" if it is a screenshot of a website, app or software (say which page or feature it shows),',
  'or "photo:" if it is a photograph (say what it shows). Answer with that one line only.',
].join(' ');

/** Une ligne de description d'une image (cache ; repli générique sans vision). */
async function describe(url: string, hint?: 'screen' | 'photo'): Promise<BrandMediaItem> {
  const hit = NOTES.get(url);
  if (hit) return hit;
  const generic: BrandMediaItem = { url, kind: hint || 'photo', note: hint === 'screen' ? 'screenshot of the brand website or product' : 'photo of the brand' };
  const analyze = coreHost().analyzeImage;
  if (!analyze) return generic;
  try {
    const file = await safeFetch(url, { maxBytes: 12 * 1024 * 1024, timeoutMs: 15000, accept: ['image/'] });
    const jpeg = await sharp(file.buffer).rotate().resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    const answer = await analyze(jpeg.toString('base64'), 'image/jpeg', PROMPT, { maxOutputTokens: 80, temperature: 0, purpose: 'visual-analysis' });
    const line = String(answer || '').split('\n').map((l) => l.trim()).find(Boolean) || '';
    const kind: 'screen' | 'photo' = /^screenshot/i.test(line) ? 'screen' : /^photo/i.test(line) ? 'photo' : hint || 'photo';
    const note = line.replace(/["*_`]/g, '').slice(0, 140);
    const item = { url, kind, note: note || generic.note };
    if (NOTES.size > 500) NOTES.clear();
    NOTES.set(url, item);
    return item;
  } catch (error: any) {
    logger.warn('video.brand_media.describe_failed', { url: url.slice(0, 120), error: error?.message });
    return generic;
  }
}

/**
 * Les images de la marque, décrites (au plus `max`, trois à la fois). Les descriptions déjà
 * connues (gardées par l'hôte) ne repassent pas par la vision.
 */
export async function describeBrandMedia(items: { url: string; kind?: 'screen' | 'photo'; note?: string }[], max = 10): Promise<BrandMediaItem[]> {
  const list = items.filter((x) => /^https?:\/\/|^file:\/\//.test(x.url)).slice(0, max);
  const out: BrandMediaItem[] = new Array(list.length);
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const i = next++;
      const item = list[i];
      out[i] = item.note ? { url: item.url, kind: item.kind || (/^screenshot/i.test(item.note) ? 'screen' : 'photo'), note: item.note } : await describe(item.url, item.kind);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, list.length) }, worker));
  return out.filter(Boolean);
}

/** La description, telle que le directeur la lit (« screenshot of the brand product: … »). */
export function brandMediaLine(item: BrandMediaItem): string {
  const note = item.note.replace(/^(screenshot|photo)\s*:\s*/i, '');
  return `${item.kind === 'screen' ? 'SCREENSHOT of the brand product' : 'brand photo'}: ${note}`.slice(0, 160);
}

// ─── Choisir une capture sans modèle (crans Low à Max) ──────────────────────

/** Mots d'interface en français → leurs équivalents anglais (les descriptions sont en anglais). */
const BRIDGE: [RegExp, string][] = [
  [/business ?plan|plan d['’]affaires/i, 'business plan document'],
  [/pr[ée]visions?|financ|budget|tr[ée]sorerie|chiffre d['’]affaires|compte d['’]exploitation|rentab/i, 'financial forecast finance revenue chart table income statement'],
  [/[ée]tude de march[ée]|march[ée]|concurren/i, 'market study analysis competitors'],
  [/identit[ée] visuelle|logo|couleurs|typograph|charte|marque/i, 'brand identity logo colors typography'],
  [/site web|site internet|navigateur|page web|en ligne|landing/i, 'website homepage landing page browser hero'],
  [/pr[ée]sentation|pitch|deck|diapo/i, 'pitch deck presentation slides'],
  [/simulat|tester|sc[ée]nario/i, 'simulator simulation'],
  [/tableau de bord|dashboard|projet/i, 'dashboard project'],
  [/application|appli|mobile/i, 'app application mobile'],
  [/structure|sommaire|mod[èe]le/i, 'structure outline template'],
];

const tokens = (s: string) => new Set(String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));

/** Ce qu'une consigne (française ou anglaise) cherche, en mots anglais. */
function wanted(hint: string): Set<string> {
  const words = tokens(hint);
  for (const [re, en] of BRIDGE) if (re.test(hint)) for (const w of en.split(' ')) words.add(w);
  return words;
}

/**
 * Les captures de la marque pour des plans d'interface : la mieux décrite pour chaque consigne,
 * jamais deux fois la même tant qu'il en reste ; à défaut d'accord, la suivante (une capture du
 * produit vaut mieux qu'une interface dessinée).
 */
export function pickScreens(hints: string[], media: BrandMediaItem[], opts: { strict?: boolean[] } = {}): (BrandMediaItem | undefined)[] {
  const screens = media.filter((m) => m.kind === 'screen');
  const pool = screens.length ? screens : [];
  const used = new Set<string>();
  return hints.map((hint, i) => {
    if (!pool.length) return undefined;
    const want = wanted(hint);
    const scored = pool
      .filter((m) => !used.has(m.url) || used.size >= pool.length)
      .map((m) => ({ m, score: [...tokens(m.note)].filter((w) => want.has(w)).length }))
      .sort((a, b) => b.score - a.score);
    // Une interface que la demande DÉCRIT (un dossier et ses fichiers, une saisie) se dessine avec ses
    // mots, sauf si une capture lui correspond vraiment.
    if (opts.strict?.[i] && (scored[0]?.score || 0) < 2) return undefined;
    const best = scored[0]?.m;
    if (best) used.add(best.url);
    return best;
  });
}

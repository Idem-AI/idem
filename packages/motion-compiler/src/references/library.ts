/**
 * LA BIBLIOTHÈQUE DE SCÈNES DE RÉFÉRENCE — le petit modèle ÉDITE une référence soignée au lieu de tout inventer
 * (PPTAgent, EMNLP 2025) ; la référence la plus proche est choisie par similarité (LayoutPrompter, NeurIPS 2023).
 *
 * Amorcée à la main (24 scènes : les huit temps d'une vidéo produit × des compositions différentes, des entrées variées,
 * des titres immobiles une fois posés, une pause avant le moment fort) ; enrichie HORS LIGNE par le professeur
 * (`bench/references/teach.ts` : un grand modèle open-weight propose, le juge filtre, l'équipe trie, `promote.ts` ajoute
 * ici les scènes acceptées — `references.json`). Les clés de texte sont génériques : l'auteur les remplace par celles
 * de sa scène.
 */
import fs from 'fs';
import path from 'path';
import type { SceneIntent } from '../intent/types';

export interface ReferenceScene {
  id: string;
  /** Ce que la scène fait, en une ligne (anglais : la langue des prompts) — sert à la recherche. */
  purpose: string;
  tags: string[];
  /** Ce qu'elle suppose : nombre de textes et de médias. */
  texts: number;
  media: ('image' | 'video')[];
  intent: SceneIntent;
  /** D'où elle vient : écrite à la main, ou proposée par le professeur puis acceptée par l'équipe. */
  source: 'hand' | 'teacher';
}

const T = (id: string, key: string, rank: 1 | 2 | 3, extra: Record<string, unknown> = {}) => ({ id, kind: 'text' as const, text: `$${key}`, rank, ...extra });

export const SEED_REFERENCES: ReferenceScene[] = [
  { id: 'hook-kinetic-words', purpose: 'open the film: a bold question or claim lands word by word, one accent word', tags: ['hook', 'title', 'kinetic', 'question', 'opening', 'typography'], texts: 2, media: [], source: 'hand', intent: { role: 'hook', energy: 4, layout: 'hero', elements: [T('title', 'title', 1, { level: 'display', emphasis: 1 }), T('sub', 'sub', 2), { id: 'rule', kind: 'shape', shape: 'underline', rank: 3 }], beats: [{ verb: 'reveal', target: 'title', style: 'words', sync: 'downbeat' }, { verb: 'highlight', target: 'title', after: 'title' }, { verb: 'draw', target: 'rule', with: 'sub' }, { verb: 'blur-in', target: 'sub', after: 'title' }] } },
  { id: 'hook-photo-claim', purpose: 'open on a real photo filling the frame, the claim set in its calm zone', tags: ['hook', 'photo', 'full-bleed', 'lifestyle', 'opening'], texts: 2, media: ['image'], source: 'hand', intent: { role: 'hook', energy: 4, layout: 'full-bleed', elements: [{ id: 'shot', kind: 'image', media: 0, rank: 2, crop: 'subject' }, T('title', 'title', 1, { level: 'title' }), T('sub', 'sub', 3)], beats: [{ verb: 'zoom', target: 'shot' }, { verb: 'reveal', target: 'title', style: 'line' }, { verb: 'rise', target: 'sub', after: 'title' }] } },
  { id: 'hook-video-open', purpose: 'open on a filmed clip, one short line slides in from the side', tags: ['hook', 'video', 'clip', 'footage', 'opening'], texts: 1, media: ['video'], source: 'hand', intent: { role: 'hook', energy: 5, layout: 'full-bleed', elements: [{ id: 'clip', kind: 'video', media: 0, rank: 2 }, T('title', 'title', 1, { level: 'display' })], beats: [{ verb: 'push', target: 'world' }, { verb: 'slide-in', target: 'title', from: 'left', sync: 'downbeat' }] } },
  { id: 'problem-stat', purpose: 'state the problem with one real number that counts up and its short label', tags: ['problem', 'data', 'number', 'figure', 'stat', 'pain'], texts: 2, media: [], source: 'hand', intent: { role: 'problem', energy: 2, layout: 'figure', elements: [T('figure', 'figure', 1, { level: 'display' }), T('label', 'label', 2), { id: 'ring', kind: 'shape', shape: 'arc', rank: 3 }], beats: [{ verb: 'draw', target: 'ring' }, { verb: 'count', target: 'figure', with: 'ring' }, { verb: 'blur-in', target: 'label', after: 'figure' }] } },
  { id: 'problem-quiet-line', purpose: 'the old way failing, said in one calm line, left aligned with a bar', tags: ['problem', 'tension', 'statement', 'calm', 'typography'], texts: 2, media: [], source: 'hand', intent: { role: 'problem', energy: 2, layout: 'hero-left', elements: [T('title', 'title', 1, { level: 'title' }), T('sub', 'sub', 2), { id: 'bar', kind: 'shape', shape: 'bar', rank: 3 }], beats: [{ verb: 'draw', target: 'bar', from: 'top' }, { verb: 'reveal', target: 'title', style: 'line', with: 'bar' }, { verb: 'rise', target: 'sub', after: 'title' }] } },
  { id: 'problem-photo-split', purpose: 'show the pain on a photo beside the sentence that names it', tags: ['problem', 'photo', 'split', 'people'], texts: 2, media: ['image'], source: 'hand', intent: { role: 'problem', energy: 3, layout: 'media-split', elements: [{ id: 'shot', kind: 'image', media: 0, rank: 2, crop: 'subject' }, T('title', 'title', 1), T('sub', 'sub', 2)], beats: [{ verb: 'wipe', target: 'shot', from: 'left' }, { verb: 'reveal', target: 'title', style: 'words', after: 'shot' }, { verb: 'blur-in', target: 'sub', after: 'title' }] } },
  { id: 'reveal-logo-name', purpose: 'reveal the product: its mark pops, the name and one-line promise follow', tags: ['reveal', 'product', 'logo', 'introduce', 'name'], texts: 2, media: [], source: 'hand', intent: { role: 'reveal', energy: 5, layout: 'hero', elements: [{ id: 'logo', kind: 'logo', rank: 2 }, T('title', 'title', 1, { level: 'display' }), T('sub', 'sub', 2)], beats: [{ verb: 'pop', target: 'logo', intensity: 'strong', sync: 'downbeat' }, { verb: 'reveal', target: 'title', style: 'letters', after: 'logo' }, { verb: 'rise', target: 'sub', after: 'title' }] } },
  { id: 'reveal-product-shot', purpose: 'reveal the product photo with a frame that opens, then its name', tags: ['reveal', 'product', 'photo', 'packshot'], texts: 2, media: ['image'], source: 'hand', intent: { role: 'reveal', energy: 4, layout: 'media-split', elements: [{ id: 'shot', kind: 'image', media: 0, rank: 1, crop: 'subject' }, T('title', 'title', 2, { level: 'title' }), T('sub', 'sub', 3), { id: 'block', kind: 'shape', shape: 'block', rank: 3 }], beats: [{ verb: 'grow', target: 'block' }, { verb: 'wipe', target: 'shot', from: 'bottom', with: 'block' }, { verb: 'slide-in', target: 'title', from: 'right', after: 'shot' }, { verb: 'blur-in', target: 'sub', after: 'title' }] } },
  { id: 'feature-phone-demo', purpose: 'show the real app screen in a phone and name the one action it performs', tags: ['feature', 'app', 'screen', 'interface', 'demo', 'phone', 'mobile'], texts: 2, media: ['image'], source: 'hand', intent: { role: 'feature', energy: 3, layout: 'device', elements: [{ id: 'phone', kind: 'device', device: 'phone', media: 0, rank: 1 }, T('title', 'title', 2, { level: 'title' }), T('sub', 'sub', 3)], beats: [{ verb: 'grow', target: 'phone' }, { verb: 'reveal', target: 'title', style: 'words', after: 'phone' }, { verb: 'rise', target: 'sub', after: 'title' }], camera: { move: 'push' } } },
  { id: 'feature-browser-demo', purpose: 'show the website in a browser window with the feature named beside it', tags: ['feature', 'website', 'web', 'screen', 'interface', 'browser', 'saas', 'dashboard'], texts: 2, media: ['image'], source: 'hand', intent: { role: 'feature', energy: 3, layout: 'device', elements: [{ id: 'web', kind: 'device', device: 'browser', media: 0, rank: 1 }, T('title', 'title', 2), T('sub', 'sub', 3)], beats: [{ verb: 'slide-in', target: 'web', from: 'bottom' }, { verb: 'blur-in', target: 'title', after: 'web' }, { verb: 'rise', target: 'sub', after: 'title' }] } },
  { id: 'feature-icon-statement', purpose: 'one feature as an icon and a short line, no photo available', tags: ['feature', 'icon', 'service', 'statement', 'typography'], texts: 2, media: [], source: 'hand', intent: { role: 'feature', energy: 3, layout: 'hero-left', elements: [{ id: 'ico', kind: 'icon', icon: 'sparkles', rank: 3 }, T('title', 'title', 1), T('sub', 'sub', 2)], beats: [{ verb: 'pop', target: 'ico' }, { verb: 'reveal', target: 'title', style: 'words', after: 'ico' }, { verb: 'blur-in', target: 'sub', after: 'title' }] } },
  { id: 'benefits-list', purpose: 'three concrete benefits arrive one after the other under a short title', tags: ['benefits', 'list', 'advantages', 'points', 'features'], texts: 4, media: [], source: 'hand', intent: { role: 'benefits', energy: 3, layout: 'list', elements: [T('title', 'title', 1), { id: 'pts', kind: 'list', items: ['$p1', '$p2', '$p3'], rank: 2 }], beats: [{ verb: 'reveal', target: 'title', style: 'line' }, { verb: 'cascade', target: 'pts.*', after: 'title' }] } },
  { id: 'benefits-photo-list', purpose: 'benefits listed beside a photo that shows them in use', tags: ['benefits', 'list', 'photo', 'split'], texts: 4, media: ['image'], source: 'hand', intent: { role: 'benefits', energy: 3, layout: 'list', elements: [{ id: 'shot', kind: 'image', media: 0, rank: 2 }, T('title', 'title', 1), { id: 'pts', kind: 'list', items: ['$p1', '$p2', '$p3'], rank: 2 }], beats: [{ verb: 'wipe', target: 'shot', from: 'top' }, { verb: 'reveal', target: 'title', style: 'words', after: 'shot' }, { verb: 'stack', target: 'pts.*', after: 'title' }] } },
  { id: 'benefits-before-after', purpose: 'a benefit as a before/after contrast of two short lines', tags: ['benefits', 'comparison', 'before', 'after', 'contrast'], texts: 2, media: [], source: 'hand', intent: { role: 'benefits', energy: 3, layout: 'stacked', elements: [T('before', 'before', 2, { level: 'subtitle' }), T('after', 'after', 1, { level: 'title', emphasis: 0 })], beats: [{ verb: 'blur-in', target: 'before' }, { verb: 'reveal', target: 'after', style: 'words', after: 'before', intensity: 'strong' }, { verb: 'highlight', target: 'after' }] } },
  { id: 'proof-quote', purpose: 'a real customer quote, word by word, and who said it', tags: ['proof', 'testimonial', 'quote', 'review', 'customer'], texts: 2, media: [], source: 'hand', intent: { role: 'proof', energy: 2, layout: 'quote', elements: [T('quote', 'quote', 1, { level: 'title' }), T('author', 'author', 3, { level: 'caption' })], beats: [{ verb: 'reveal', target: 'quote', style: 'words' }, { verb: 'blur-in', target: 'author', after: 'quote' }] } },
  { id: 'proof-number', purpose: 'social proof as one real number that counts up, the payoff of the film', tags: ['proof', 'data', 'number', 'customers', 'payoff', 'figure'], texts: 2, media: [], source: 'hand', intent: { role: 'proof', energy: 5, layout: 'figure', elements: [T('figure', 'figure', 1, { level: 'display' }), T('label', 'label', 2), { id: 'dots', kind: 'shape', shape: 'dots', rank: 3 }], beats: [{ verb: 'count', target: 'figure', intensity: 'strong', sync: 'downbeat' }, { verb: 'rise', target: 'label', after: 'figure' }, { verb: 'reveal', target: 'dots', after: 'label' }] } },
  { id: 'proof-photo-face', purpose: 'a customer photo with their words set on a calm area of the image', tags: ['proof', 'testimonial', 'photo', 'face', 'people'], texts: 2, media: ['image'], source: 'hand', intent: { role: 'proof', energy: 3, layout: 'full-bleed', elements: [{ id: 'shot', kind: 'image', media: 0, rank: 2, crop: 'subject' }, T('quote', 'quote', 1, { level: 'title' }), T('author', 'author', 3, { level: 'caption' })], beats: [{ verb: 'zoom', target: 'shot' }, { verb: 'reveal', target: 'quote', style: 'line' }, { verb: 'blur-in', target: 'author', after: 'quote' }] } },
  { id: 'cta-button', purpose: 'the call to action: a short line and a real button that pops', tags: ['cta', 'call to action', 'button', 'offer', 'order'], texts: 2, media: [], source: 'hand', intent: { role: 'cta', energy: 4, layout: 'hero', elements: [T('title', 'title', 1, { level: 'title' }), { id: 'go', kind: 'button', text: '$cta', rank: 2 }], beats: [{ verb: 'reveal', target: 'title', style: 'words' }, { verb: 'pop', target: 'go', after: 'title', sync: 'downbeat' }] } },
  { id: 'cta-offer-chip', purpose: 'an offer with its condition chip and the address to visit', tags: ['cta', 'offer', 'promotion', 'discount', 'sale', 'website'], texts: 3, media: [], source: 'hand', intent: { role: 'cta', energy: 4, layout: 'hero-left', elements: [{ id: 'tag', kind: 'chip', text: '$tag', rank: 3 }, T('title', 'title', 1, { level: 'display' }), T('sub', 'sub', 2)], beats: [{ verb: 'pop', target: 'tag' }, { verb: 'slide-in', target: 'title', from: 'left', after: 'tag' }, { verb: 'rise', target: 'sub', after: 'title' }] } },
  { id: 'signature-endcard', purpose: 'the end card: the mark lands with weight, the tagline and the action hold', tags: ['signature', 'end', 'logo', 'outro', 'brand', 'closing'], texts: 2, media: [], source: 'hand', intent: { role: 'signature', energy: 2, layout: 'end-card', elements: [{ id: 'logo', kind: 'logo', rank: 1 }, T('tagline', 'tagline', 2, { level: 'subtitle' }), { id: 'go', kind: 'button', text: '$cta', rank: 3 }], beats: [{ verb: 'pop', target: 'logo', sync: 'downbeat' }, { verb: 'type', target: 'tagline', after: 'logo' }, { verb: 'rise', target: 'go', after: 'tagline' }] } },
  { id: 'signature-ring', purpose: 'end card where a ring draws around the mark before the tagline', tags: ['signature', 'end', 'logo', 'ring', 'closing'], texts: 1, media: [], source: 'hand', intent: { role: 'signature', energy: 2, layout: 'end-card', elements: [{ id: 'ring', kind: 'shape', shape: 'ring', rank: 3 }, { id: 'logo', kind: 'logo', rank: 1 }, T('tagline', 'tagline', 2, { level: 'subtitle' })], beats: [{ verb: 'draw', target: 'ring' }, { verb: 'grow', target: 'logo', with: 'ring' }, { verb: 'blur-in', target: 'tagline', after: 'logo' }] } },
  { id: 'statement-claim', purpose: 'the one thing to remember, one line, centred, nothing else', tags: ['statement', 'claim', 'message', 'promise', 'payoff', 'typography'], texts: 1, media: [], source: 'hand', intent: { role: 'statement', energy: 3, layout: 'hero', elements: [T('title', 'title', 1, { level: 'display', emphasis: 2 })], beats: [{ verb: 'reveal', target: 'title', style: 'words', sync: 'downbeat' }, { verb: 'highlight', target: 'title', after: 'title' }] } },
  { id: 'event-date-place', purpose: 'an event: its name, the date and the place, each on its own line', tags: ['event', 'date', 'place', 'announce', 'invitation'], texts: 3, media: [], source: 'hand', intent: { role: 'reveal', energy: 4, layout: 'hero-left', elements: [T('title', 'title', 1, { level: 'display' }), T('date', 'date', 2, { level: 'subtitle' }), T('place', 'place', 3), { id: 'bar', kind: 'shape', shape: 'bar', rank: 3 }], beats: [{ verb: 'reveal', target: 'title', style: 'letters' }, { verb: 'draw', target: 'bar', with: 'date' }, { verb: 'slide-in', target: 'date', from: 'left', after: 'title' }, { verb: 'rise', target: 'place', after: 'date' }] } },
  { id: 'grid-gallery', purpose: 'several products or photos shown together under a title', tags: ['gallery', 'grid', 'products', 'catalogue', 'menu', 'collection'], texts: 1, media: ['image', 'image', 'image'], source: 'hand', intent: { role: 'feature', energy: 3, layout: 'grid', elements: [T('title', 'title', 1), { id: 'a', kind: 'image', media: 0, rank: 2 }, { id: 'b', kind: 'image', media: 1, rank: 2 }, { id: 'c', kind: 'image', media: 2, rank: 2 }], beats: [{ verb: 'reveal', target: 'title', style: 'line' }, { verb: 'grow', target: 'a', after: 'title' }, { verb: 'grow', target: 'b', after: 'a' }, { verb: 'grow', target: 'c', after: 'b' }] } },
];

let teacherScenes: ReferenceScene[] | null = null;

/** Les scènes du professeur acceptées par l'équipe (`references.json`, produit par `bench/references/promote.ts`). */
function accepted(): ReferenceScene[] {
  if (teacherScenes) return teacherScenes;
  try {
    const file = process.env.VIDEO_REFERENCES || path.join(__dirname, '../../references.json');
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as { scenes?: ReferenceScene[] };
    teacherScenes = (raw.scenes || []).filter((s) => s && s.intent && s.id).map((s) => ({ ...s, source: 'teacher' as const }));
  } catch {
    teacherScenes = [];
  }
  return teacherScenes;
}

export function referenceLibrary(): ReferenceScene[] {
  return [...SEED_REFERENCES, ...accepted()];
}

// ─── Recherche par similarité (BM25 sur les mots, plus la forme de la scène) ─────────────────────────────────────────

const tokens = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 2);

export interface ReferenceQuery {
  /** L'intention de la scène, en clair (planificateur : rôle, but, idée visuelle). */
  text: string;
  role?: string;
  texts: number;
  media: ('image' | 'video')[];
}

/** Les `k` références les plus proches : mots (BM25), rôle, nombre de textes et médias compatibles. */
export function retrieveReferences(q: ReferenceQuery, k = 3, exclude: string[] = []): ReferenceScene[] {
  const lib = referenceLibrary().filter((r) => !exclude.includes(r.id));
  const docs = lib.map((r) => tokens(`${r.purpose} ${r.tags.join(' ')} ${r.intent.role || ''} ${r.intent.layout}`));
  const avg = docs.reduce((a, d) => a + d.length, 0) / Math.max(1, docs.length);
  const df = new Map<string, number>();
  for (const d of docs) for (const w of new Set(d)) df.set(w, (df.get(w) || 0) + 1);
  const query = tokens(q.text);
  const scored = lib.map((r, i) => {
    const d = docs[i];
    let s = 0;
    for (const w of query) {
      const tf = d.filter((x) => x === w).length;
      if (!tf) continue;
      const idf = Math.log(1 + (lib.length - (df.get(w) || 0) + 0.5) / ((df.get(w) || 0) + 0.5));
      s += idf * ((tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (d.length / avg))));
    }
    if (q.role && r.intent.role === q.role) s += 3;
    // La forme : des médias de même nature, un nombre de textes voisin.
    const images = q.media.filter((m) => m === 'image').length;
    const videos = q.media.filter((m) => m === 'video').length;
    const rImages = r.media.filter((m) => m === 'image').length;
    const rVideos = r.media.filter((m) => m === 'video').length;
    s += (images && rImages) || (videos && rVideos) || (!q.media.length && !r.media.length) ? 2 : q.media.length && !r.media.length ? -1 : !q.media.length && r.media.length ? -3 : 0;
    s -= Math.abs(r.texts - q.texts) * 0.6;
    return { r, s };
  });
  return scored.sort((a, b) => b.s - a.s).slice(0, k).map((x) => x.r);
}

/**
 * LE MONTEUR — choisit l'habillage d'une prise de parole, dans un MENU FERMÉ d'éléments.
 *
 * Le modèle lit la transcription (chaque mot précédé de son index), la demande de l'utilisateur
 * et la fiche de la marque, puis rend un JSON. Le code ne lui fait pas confiance : chaque élément
 * est validé (index existants, mots non coupés), chaque texte affiché est ANCRÉ dans ce qui est dit
 * (un mot-clé est un mot prononcé, un chiffre est un chiffre prononcé, un nom est dit ou écrit dans
 * la demande), la densité est bornée par le cran, et les zones de l'écran ne se chevauchent pas.
 *
 * Sans modèle (cran Low, ou panne), des règles posent un habillage sobre : chiffres en grand,
 * pictos sur les phrases qui en appellent un, zooms qui rythment, carton final.
 */
import type { CreativityLevel } from '../creativity/levels';
import logger from '../runtime/logger';
import type { CopyWriter } from '../video/video.copy';
import { conceptFor, ICON_CONCEPT_IDS, ICON_CONCEPTS } from '../video/video.icons';
import type { CaptionStyle, MontageElement, MontageElementType, MontageOutro, MontageWord } from './montage.model';
import { CAPTION_STYLES, ELEMENT_TYPES } from './montage.model';
import { elementWindows, sentences, TimedWord } from './montage.timeline';

export interface PlannerInput {
  words: MontageWord[];
  timed: TimedWord[];
  durationSec: number;
  prompt: string;
  brandName: string;
  /** Fiche de la marque (charte, ton, DA) commune aux agents. */
  sheet: string;
  /** Ce que la marque a d'écrit (site, téléphone) : seuls détails de contact acceptés hors de la parole. */
  contacts: string[];
  language: string;
  format: string;
  creativity: CreativityLevel;
}

export interface MontagePlan {
  title: string;
  captions: CaptionStyle;
  elements: MontageElement[];
  outro?: MontageOutro;
  source: 'llm' | 'rules';
}

/** Éléments (hors zooms) par minute, selon le cran. */
const DENSITY: Record<CreativityLevel, number> = { low: 4, medium: 6, high: 8, max: 9, ultra: 10 };
const OUTRO_SEC = 2.6;

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const tokens = (s: string) => (fold(s).match(/[\p{L}\p{N}]+/gu) || []);
const digits = (s: string) => (s.match(/\d+/g) || []).join(' ');
let seq = 0;
const newId = (type: string) => `${type}-${Date.now().toString(36)}${(seq++).toString(36)}`;

// ─── Le modèle ──────────────────────────────────────────────────────────────

function transcriptBlock(input: PlannerInput): string {
  return sentences(input.words, input.timed)
    .map((s) => {
      const parts: string[] = [];
      for (let i = s.from; i <= s.to; i++) if (input.timed[i]) parts.push(`${i}:${input.words[i].text}`);
      return `(${s.start.toFixed(1)}s) ${parts.join(' ')}`;
    })
    .join('\n');
}

export function buildPlannerPrompt(input: PlannerInput): { system: string; user: string } {
  const perMinute = DENSITY[input.creativity] ?? 6;
  const max = Math.max(2, Math.round((input.durationSec / 60) * perMinute));
  const system = [
    'You are the video editor of a social-media team. Someone filmed themself talking; you dress the cut so it is ready to post (Reels, TikTok, WhatsApp Status, LinkedIn).',
    'Every element is anchored on the words that trigger it: it appears when the person SAYS them. Words are given as index:word.',
    'MENU (use only these types):',
    '- keyword {from,to,text}: 1–3 words the person says, shown huge for a beat. text = those exact spoken words. The punchlines, not filler.',
    '- stat {from,to,value,label}: a number the person says (price, %, quantity, years). value = that number as written in the transcript (+ unit); label ≤ 4 words.',
    `- icon {from,to,icon,label?}: a pictogram for the idea being said. icon ∈ ${ICON_CONCEPT_IDS.join(', ')}.`,
    '- list {from,to,text?,items}: when the person enumerates 2–4 things; items ≤ 5 words each, in the order said; to = the last item word.',
    '- callout {from,to,text}: a short card (≤ 7 words) that sums up a key idea in the person’s own words.',
    '- broll {from,to,query,prompt,mode}: an illustration image while the person speaks of a concrete thing (product, place, activity). query = 2–4 English stock-photo keywords; prompt = one English sentence describing a photo (African context when people appear); mode "card" (image card, the speaker stays visible) or "full" (cutaway, max 4 s).',
    '- lowerThird {from,to,value,label}: when the person introduces themself: value = their name exactly as said, label = role ≤ 5 words.',
    '- cta {from,to,text,value?}: when the person asks the viewer to act (call, visit, order, follow). text ≤ 5 words; value = contact detail ONLY if said or written in the request/contacts.',
    '- zoom {from}: a punch-in on the speaker on an emphasised word (max one every 8 s).',
    'RULES:',
    `- At most ${max} elements in total (zooms not counted). Fewer, well placed, beats many. Leave breathing room: never two elements on the same second.`,
    '- Never invent a fact, number, name or contact. Displayed text comes from what is said (or from the request).',
    '- Respect the request: if it asks for a style, a call to action or specific elements, do it.',
    `- captions: pick "pop" (bold, word-by-word, energetic), "karaoke" (full line, the spoken word lights up) or "minimal" (calm, sober).`,
    `- outro: a 2.5 s end card after the speech — {text (≤ 6 words, the call or the brand promise), detail? (contact from request/contacts only)} — or null when the video must end on the speaker.`,
    '- title: ≤ 6 words naming the video, same language as the speech.',
    'Answer with ONE JSON object only: {"title":"…","captions":"pop|karaoke|minimal","elements":[…],"outro":{…}|null}',
  ].join('\n');
  const user = [
    input.sheet,
    input.contacts.length ? `CONTACTS: ${input.contacts.join(' · ')}` : '',
    `FORMAT: ${input.format} · DURATION: ${input.durationSec.toFixed(1)} s · LANGUAGE: ${input.language}`,
    `REQUEST: ${input.prompt.trim() || '(none — make it engaging and professional)'}`,
    'TRANSCRIPT:',
    transcriptBlock(input),
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}

function extractJson(raw: string): any {
  const s = raw.replace(/```(?:json)?/gi, '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}

// ─── La validation (le code tient les règles) ───────────────────────────────

const clip = (s: unknown, max: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const wordsMax = (s: string, n: number) => s.split(' ').slice(0, n).join(' ');

/** Valide un élément proposé ; null s'il ne tient pas. */
export function validateElement(raw: any, input: PlannerInput): MontageElement | null {
  const type = String(raw?.type || '') as MontageElementType;
  if (!ELEMENT_TYPES.includes(type)) return null;
  const n = input.words.length;
  const from = Math.round(Number(raw.from));
  let to = Math.round(Number(raw.to ?? raw.from));
  if (!Number.isFinite(from) || from < 0 || from >= n) return null;
  if (!Number.isFinite(to) || to < from) to = from;
  to = Math.min(n - 1, to, from + 45);
  if (!input.timed[from] && !input.timed.slice(from, to + 1).some(Boolean)) return null;
  // Ce qui est dit autour de l'ancre (marge de quelques mots : le modèle vise parfois à côté).
  const spoken = new Set(tokens(input.words.slice(Math.max(0, from - 3), Math.min(n, to + 4)).map((w) => w.text).join(' ')));
  const said = (text: string) => tokens(text).length > 0 && tokens(text).every((t) => spoken.has(t));
  const heard = fold(`${input.words.map((w) => w.text).join(' ')} ${input.prompt} ${input.contacts.join(' ')}`);
  const base = { id: newId(type), type, from, to };
  switch (type) {
    case 'keyword': {
      const text = wordsMax(clip(raw.text, 40), 3);
      return text && said(text) ? { ...base, text } : null;
    }
    case 'stat': {
      const value = clip(raw.value, 16);
      const d = digits(value);
      const spokenDigits = digits(input.words.slice(Math.max(0, from - 3), Math.min(n, to + 4)).map((w) => w.text).join(' '));
      if (!d || !d.split(' ').every((x) => spokenDigits.split(' ').includes(x))) return null;
      return { ...base, value, label: wordsMax(clip(raw.label, 40), 5) || undefined };
    }
    case 'icon': {
      const icon = String(raw.icon || '').toLowerCase();
      const resolved = ICON_CONCEPTS[icon] ? icon : conceptFor(input.words.slice(from, to + 1).map((w) => w.text).join(' '));
      return resolved ? { ...base, icon: resolved, label: wordsMax(clip(raw.label, 32), 4) || undefined } : null;
    }
    case 'list': {
      const items = (Array.isArray(raw.items) ? raw.items : []).map((x: unknown) => wordsMax(clip(x, 48), 5)).filter(Boolean).slice(0, 4);
      return items.length >= 2 ? { ...base, text: wordsMax(clip(raw.text, 40), 5) || undefined, items } : null;
    }
    case 'callout': {
      const text = wordsMax(clip(raw.text, 64), 7);
      return text ? { ...base, text } : null;
    }
    case 'broll': {
      const query = clip(raw.query, 60);
      const prompt = clip(raw.prompt, 300);
      if (!query && !prompt) return null;
      return { ...base, query: query || prompt.split(' ').slice(0, 4).join(' '), text: prompt || query, mode: raw.mode === 'full' ? 'full' : 'card' };
    }
    case 'lowerThird': {
      const value = clip(raw.value, 40);
      if (!value || !tokens(value).every((t) => heard.includes(t))) return null;
      return { ...base, value, label: wordsMax(clip(raw.label, 48), 5) || undefined };
    }
    case 'cta': {
      const text = wordsMax(clip(raw.text, 48), 5);
      if (!text) return null;
      const value = clip(raw.value, 60);
      // Un contact (site, numéro) n'est affiché que s'il est dit ou écrit : jamais inventé.
      const known = value && fold(value).replace(/\s+/g, '').length > 2 && heard.replace(/\s+/g, '').includes(fold(value).replace(/\s+/g, ''));
      return { ...base, text, ...(known ? { value } : {}) };
    }
    case 'zoom':
      return { ...base, to: from };
  }
  return null;
}

/**
 * Bornes du plan : densité du cran, zooms espacés, zones sans chevauchement. Au-delà de la densité,
 * `rank` dit ce qui passe d'abord (les règles : un prix avant un chiffre, un chiffre avant un picto).
 */
function finalize(elements: MontageElement[], input: PlannerInput, rank: (e: MontageElement) => number = () => 0): MontageElement[] {
  const max = Math.max(3, Math.round((input.durationSec / 60) * (DENSITY[input.creativity] ?? 6)));
  const out: MontageElement[] = [];
  let lastZoom = -Infinity;
  for (const e of [...elements].filter((x) => x.type === 'zoom').sort((a, b) => a.from - b.from)) {
    const at = input.timed[e.from]?.start ?? 0;
    if (at - lastZoom < 7) continue;
    lastZoom = at;
    out.push(e);
  }
  const others = elements.filter((x) => x.type !== 'zoom');
  const chosen = new Set(others.map((e, i) => ({ e, i })).sort((a, b) => rank(b.e) - rank(a.e) || a.i - b.i).slice(0, max).map((x) => x.e));
  out.push(...others.filter((e) => chosen.has(e)));
  out.sort((a, b) => a.from - b.from);
  // Les zones : ce que la ligne de temps écarte est retiré du plan (il ne serait jamais vu).
  const kept = new Set(elementWindows(out, input.timed, input.durationSec).map((w) => w.id));
  return out.filter((e) => kept.has(e.id));
}

function outroOf(raw: any, input: PlannerInput): MontageOutro | undefined {
  if (raw === null) return undefined;
  const heard = fold(`${input.words.map((w) => w.text).join(' ')} ${input.prompt} ${input.contacts.join(' ')}`).replace(/\s+/g, '');
  const text = wordsMax(clip(raw?.text, 60), 6) || input.brandName;
  const detail = clip(raw?.detail, 60);
  const known = detail && heard.includes(fold(detail).replace(/\s+/g, ''));
  return { text, ...(known ? { detail } : {}), durationSec: OUTRO_SEC };
}

// ─── Les règles (Low, ou modèle indisponible) ───────────────────────────────

export function rulesPlan(input: PlannerInput): MontagePlan {
  const elements: MontageElement[] = [];
  const list = sentences(input.words, input.timed);
  let lastIcon = -Infinity;
  let lastZoom = -Infinity;
  const usedIcons: string[] = [];
  for (const s of list) {
    // Les chiffres dits : en grand, avec leur unité quand elle suit.
    for (let i = s.from; i <= s.to; i++) {
      const w = input.words[i].text;
      const n = Number(w.replace(/[^\d]/g, ''));
      if (!/\d/.test(w) || /^(19|20)\d\d$/.test(w.replace(/\W/g, ''))) continue;
      const next = input.words[i + 1]?.text || '';
      const unit = /^(%|f|fcfa|cfa|francs?|€|euros?|\$|dollars?|ans|jours|mois|heures|h|km|kg|minutes?)[.,!?]*$/i.test(next) ? ` ${next.replace(/[.,!?]+$/, '')}` : '';
      // Un petit nombre sans unité (« 3 raisons ») ne mérite pas l'écran entier.
      if (!unit && !/%/.test(w) && n < 10) continue;
      elements.push({ id: newId('stat'), type: 'stat', from: i, to: unit ? i + 1 : i, value: `${w.replace(/[.,!?]+$/, '')}${unit}` });
    }
    // Un picto quand la phrase en appelle un, toutes les 8 s au plus (« aujourd'hui » n'est pas une date).
    const concept = conceptFor(s.text.replace(/aujourd['’]hui/gi, ''), usedIcons);
    if (concept && s.start - lastIcon >= 8) {
      lastIcon = s.start;
      usedIcons.push(concept);
      elements.push({ id: newId('icon'), type: 'icon', from: s.from, to: Math.min(s.to, s.from + 6), icon: concept });
    }
    // Un zoom sur les phrases qui portent (exclamation, ou une phrase sur trois).
    if ((/!$/.test(s.text) || list.indexOf(s) % 3 === 1) && s.start - lastZoom >= 8) {
      lastZoom = s.start;
      elements.push({ id: newId('zoom'), type: 'zoom', from: s.from, to: s.from });
    }
  }
  const title = list[0]?.text.split(' ').slice(0, 6).join(' ').replace(/[.,!?…]+$/, '') || input.brandName;
  // Ce qui passe d'abord : un prix, puis un chiffre avec unité, puis un chiffre, puis un picto.
  const rank = (e: MontageElement) => (e.type !== 'stat' ? 0 : /(f|fcfa|cfa|francs?|€|euros?|\$|dollars?)$/i.test(e.value || '') ? 3 : /\D\s*$/.test(e.value || '') ? 2 : 1);
  return { title, captions: 'pop', elements: finalize(elements, input, rank), outro: { text: input.brandName, ...(input.contacts[0] ? { detail: input.contacts[0] } : {}), durationSec: OUTRO_SEC }, source: 'rules' };
}

/** Le plan du monteur : modèle au-delà du cran Low, règles sinon (ou si le modèle échoue). */
export async function planMontage(input: PlannerInput, writer: CopyWriter | undefined): Promise<MontagePlan> {
  if (!writer || input.creativity === 'low' || !input.words.length) return rulesPlan(input);
  const { system, user } = buildPlannerPrompt(input);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const json = extractJson(await writer(system, user));
      if (!json || !Array.isArray(json.elements)) throw new Error('plan_unreadable');
      const proposed = json.elements.length;
      const elements = finalize(json.elements.map((e: any) => validateElement(e, input)).filter((e: MontageElement | null): e is MontageElement => !!e), input);
      logger.info('montage.planned', { event: 'montage.planned', proposed, kept: elements.length, attempt });
      if (!elements.length && proposed) throw new Error('plan_all_rejected');
      return {
        title: wordsMax(clip(json.title, 60), 6) || rulesPlan(input).title,
        captions: CAPTION_STYLES.includes(json.captions) && json.captions !== 'none' ? json.captions : 'pop',
        elements,
        outro: outroOf(json.outro, input),
        source: 'llm',
      };
    } catch (error: any) {
      logger.warn('montage.plan_failed', { event: 'montage.plan_failed', attempt, error: error?.message });
    }
  }
  return rulesPlan(input);
}

/**
 * LA COPIE — le seul endroit où un modèle intervient.
 *
 * Conçu pour le modèle le moins cher du marché :
 *
 *  1. Le modèle ne CHOISIT rien : il remplit des cases numérotées, chacune avec
 *     sa limite de caractères. Pas de JSON (un petit modèle oublie une virgule
 *     et tout est perdu) : une ligne `1.title: …` par case, ~40 % de tokens en
 *     moins, et une ligne ratée ne coûte que cette ligne.
 *  2. Le PARSEUR est tolérant : puces, guillemets, numérotation fantaisiste,
 *     préambule (« Voici les textes : ») et même un JSON sont acceptés.
 *  3. La RÉPARATION est faite par le code : coupe au mot, retrait de la
 *     ponctuation finale, et surtout le garde-fou anti-invention — un prix, une
 *     date ou un numéro qui n'apparaît pas dans le brief est supprimé.
 *  4. Le REPLI est complet : si le modèle ne répond pas (ou n'est pas
 *     disponible), une copie heuristique est tirée du brief. La vidéo sort
 *     toujours.
 *
 * Budget mesuré : ~350 tokens d'entrée, ~150 de sortie pour une vidéo de 15 s.
 */
import { VideoBrief, VideoObjective } from '../../../models/motionVideo.model';
import { SCENES, SlotDef } from './video.scenes';

// ─── Les faits du brief ─────────────────────────────────────────────────────

export interface BriefFacts {
  prices: string[];
  percents: string[];
  dates: string[];
  times: string[];
  phones: string[];
  urls: string[];
  stats: { value: string; label: string }[];
  quotes: { text: string; author?: string }[];
  places: string[];
}

const MONTHS =
  'janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre|january|february|march|april|may|june|july|august|september|october|november|december|janv?\\.?|f[ée]vr?\\.?|avr\\.?|juil\\.?|sept?\\.?|oct\\.?|nov\\.?|d[ée]c\\.?';
const DAYS = 'lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday';
const CURRENCY = 'F\\s?CFA|FCFA|CFA|XOF|XAF|FG|GNF|F|€|EUR|euros?|\\$|USD|GHS|NGN|₦|KES|KSh|MAD|DH|DA|DZD|TND|RWF|UGX|TZS|ZAR|R';

const RE = {
  price: new RegExp(
    `(?:(?:${CURRENCY})\\s?\\d[\\d\\s\\u202f\\u00a0.,]*\\d|\\d[\\d\\s\\u202f\\u00a0.,]*?\\d?\\s?(?:${CURRENCY}))(?![a-zA-Zà-ÿ])`,
    'gi'
  ),
  percent: /[-–−]?\s?\d{1,3}(?:[.,]\d)?\s?%/g,
  date: new RegExp(
    `\\b(?:(?:${DAYS})\\s+)?\\d{1,2}(?:er)?\\s+(?:${MONTHS})(?:\\s+\\d{4})?\\b|\\b\\d{1,2}[/.-]\\d{1,2}(?:[/.-]\\d{2,4})?\\b|\\b(?:${DAYS})(?:\\s+\\d{1,2}(?:er)?)?\\b`,
    'gi'
  ),
  time: /\b\d{1,2}\s?(?:h|H)\s?\d{0,2}\b|\b\d{1,2}:\d{2}\b|\b\d{1,2}\s?(?:am|pm)\b/g,
  phone: /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{1,4}\)?[\s.-]?){2,5}\d{2,4}/g,
  url: /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|africa|ci|sn|cm|ma|bj|tg|bf|ml|ne|gn|ga|cg|cd|ng|gh|ke|rw|fr|io|co|shop|store|app|biz)\b(?:\/[^\s]*)?/gi,
  // Un nombre suivi d'un nom (« 500 clients », « 12 developers ») ; les mois,
  // monnaies et unités de mesure sont écartés plus bas.
  stat: /(?:\+\s?)?\b\d+(?:[\s\u202f.,]\d{3})*\s?(?:\+|k|K|M)?\s?(?:%\s)?([A-Za-zÀ-ÿ]{3,}(?:\s(?:already|déjà|satisfaits|fidèles|happy|satisfied))?)/g,
  quote: /[«“"]\s?([^«»“”"]{12,160}?)\s?[»”"](?:\s*[-—–,]\s*([A-ZÀ-Ý][\p{L}'’-]+(?:\s[A-ZÀ-Ý][\p{L}'’-]*){0,3}))?/gu,
  place: /\b(?:à|au|aux|at|in)\s+((?:[A-ZÀ-Ý][\p{L}'’-]*|\d+)(?:\s+(?:de|du|des|la|le|d’|d'|[A-ZÀ-Ý][\p{L}'’-]*|\d+)){0,5})/gu,
};

/** Mots qui suivent un nombre sans en faire un chiffre-clé (dates, monnaies, unités). */
const STAT_STOP = new RegExp(
  `^(?:${MONTHS}|${DAYS}|fcfa|cfa|xof|xaf|euros?|usd|dollars?|francs?|naira|cedis?|shillings?|dirhams?|cl|ml|kg|km|cm|mm|grammes?|litres?|liters?|heures?|hours?|minutes?|min|jours?|days?|ans?|years?|am|pm|h)$`,
  'i'
);

const uniq = (values: string[]): string[] => {
  const seen = new Set<string>();
  return values
    .map((v) => v.replace(/\s+/g, ' ').trim())
    .filter((v) => {
      const key = v.toLowerCase();
      if (!v || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const digitsOf = (text: string): string => (text || '').replace(/\D/g, '');

export function extractFacts(text: string): BriefFacts {
  const source = (text || '').replace(/ | /g, ' ');
  const prices = uniq(source.match(RE.price) || []).filter((p) => digitsOf(p).length >= 2);
  const percents = uniq(source.match(RE.percent) || []);
  const dates = uniq(source.match(RE.date) || []).filter((d) => !/^\d{1,2}[/.-]\d{1,2}$/.test(d) || !prices.some((p) => p.includes(d)));
  const times = uniq(source.match(RE.time) || []);
  const phones = uniq(source.match(RE.phone) || []).filter((p) => digitsOf(p).length >= 8 && digitsOf(p).length <= 15);
  const urls = uniq(source.match(RE.url) || []);

  const stats: BriefFacts['stats'] = [];
  for (const m of source.matchAll(RE.stat)) {
    const full = m[0].trim();
    if (prices.some((p) => p.includes(full) || full.includes(p))) continue;
    if (times.some((t) => full.replace(/\s/g, '').toLowerCase() === t.replace(/\s/g, '').toLowerCase())) continue;
    if (phones.some((p) => digitsOf(p).includes(digitsOf(full)) && digitsOf(full).length > 4)) continue;
    const num = full.match(/^(?:\+\s?)?[\d\s .,]+\s?(?:\+|k|K|M|%)?/);
    if (!num) continue;
    const value = num[0].replace(/\s+$/, '').replace(/\s{2,}/g, ' ');
    const label = full.slice(num[0].length).trim();
    stats.push({ value: value.length <= 10 ? value : value.slice(0, 10), label });
  }

  const quotes: BriefFacts['quotes'] = [];
  for (const m of source.matchAll(RE.quote)) {
    quotes.push({ text: m[1].trim(), author: m[2]?.trim() });
  }

  const places = uniq(
    [...source.matchAll(RE.place)].map((m) => m[1]).filter((p) => !/^\d+$/.test(p) && !new RegExp(`^(${MONTHS})$`, 'i').test(p))
  );

  return { prices, percents, dates, times, phones, urls, stats, quotes, places };
}

// ─── La demande au modèle ───────────────────────────────────────────────────

export interface CopyPlanEntry {
  index: number;
  sceneId: string;
  slots: SlotDef[];
}

export interface CopyContext {
  brandName: string;
  businessType?: string;
  tone?: string;
  valueProposition?: string;
  keywords?: string[];
  language: string;
}

export type CopyResult = Record<number, Record<string, string>>;

/** Fonction d'appel au modèle : injectée (production = PromptService, tests = réponses écrites). */
export type CopyWriter = (system: string, user: string) => Promise<string>;

const LANG_NAMES: Record<string, string> = { fr: 'French', en: 'English', pt: 'Portuguese', ar: 'Arabic', es: 'Spanish', sw: 'Swahili' };

/** Case « 0 » : les mots-clés de recherche d'images et de vidéos (Pexels), en anglais. */
export const MEDIA_QUERY_ENTRY: CopyPlanEntry = {
  index: 0,
  sceneId: '_media',
  slots: [{ key: 'visual', max: 48, hint: '2-5 English words describing the footage/photos to search (subject, place)' }],
};

export function copyPlan(sceneIds: string[], withMediaQuery = false): CopyPlanEntry[] {
  const entries = sceneIds.map((sceneId, i) => ({ index: i + 1, sceneId, slots: SCENES[sceneId]?.slots ?? [] }));
  return withMediaQuery ? [MEDIA_QUERY_ENTRY, ...entries] : entries;
}

export function buildCopyPrompt(plan: CopyPlanEntry[], brief: VideoBrief, ctx: CopyContext): { system: string; user: string } {
  const lang = LANG_NAMES[(ctx.language || 'fr').slice(0, 2)] || 'French';
  const system = [
    'You write ON-SCREEN TEXT for a short promo video. Output ONLY lines "id: text", one per line. No other words.',
    `Language: ${lang}. Brand: ${ctx.brandName}${ctx.businessType ? ` (${ctx.businessType})` : ''}. Tone: ${ctx.tone || 'warm, confident'}.`,
    'Rules:',
    '- Respect the max characters. Short, concrete, punchy. Titles without final period.',
    '- No emoji, no hashtag, no quotation marks.',
    '- Prices, dates, figures, phone numbers: copy them EXACTLY from the brief. If absent, skip the line.',
    '- Every line says something different.',
    'Example:',
    '1.title: Vos soldes commencent ici',
    '2.price: 9 900 F',
  ].join('\n');

  const lines: string[] = [];
  for (const entry of plan) {
    for (const slot of entry.slots) {
      lines.push(`${entry.index}.${slot.key} (max ${slot.max}${slot.required ? ', required' : ''}): ${slot.hint}`);
    }
  }
  const user = [
    `BRIEF: ${clip(brief.message, 400)}`,
    brief.details ? `DETAILS: ${clip(brief.details, 500)}` : '',
    ctx.valueProposition ? `BRAND PROMISE: ${clip(ctx.valueProposition, 160)}` : '',
    'LINES:',
    ...lines,
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}

const clip = (text: string | undefined, max: number): string => {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : t.slice(0, max);
};

/** Estimation grossière (≈ 4 caractères par token) : sert à mesurer, pas à facturer. */
export const estimateTokens = (text: string): number => Math.ceil((text || '').length / 4);

// ─── Lecture de la réponse ──────────────────────────────────────────────────

const LINE_RE = /^\s*(?:[-*•>]|\d+[)\]]\s)?\s*\**\s*(\d{1,2})\s*[.\-_/ ]\s*([a-zA-Z][a-zA-Z0-9]*)\s*\**\s*(?:\([^)]*\))?\s*[:=–—-]\s*(.*?)\s*$/;

/**
 * Lit la réponse du modèle, quelle qu'en soit la forme.
 * Les clés inconnues sont ignorées ; la dernière valeur d'une clé gagne.
 */
export function parseCopy(raw: string, plan: CopyPlanEntry[]): CopyResult {
  const result: CopyResult = {};
  const valid = new Map<number, Set<string>>(plan.map((p) => [p.index, new Set(p.slots.map((s) => s.key))]));
  const put = (index: number, key: string, value: string) => {
    const keys = valid.get(index);
    if (!keys) return;
    const slotKey = [...keys].find((k) => k.toLowerCase() === key.toLowerCase());
    if (!slotKey) return;
    const clean = cleanValue(value);
    if (!clean) return;
    result[index] = result[index] || {};
    result[index][slotKey] = clean;
  };

  const text = (raw || '').replace(/```[a-z]*\n?/gi, '').trim();

  // Un modèle têtu répond en JSON malgré la consigne : on le prend aussi.
  if (/^[{[]/.test(text)) {
    try {
      const data = JSON.parse(text);
      const walk = (obj: any, prefix = '') => {
        if (!obj || typeof obj !== 'object') return;
        for (const [k, v] of Object.entries(obj)) {
          const key = prefix ? `${prefix}.${k}` : k;
          if (typeof v === 'string') {
            const m = key.match(/(\d{1,2})[^a-zA-Z0-9]+([a-zA-Z][a-zA-Z0-9]*)$/);
            if (m) put(Number(m[1]), m[2], v);
          } else walk(v, key);
        }
      };
      walk(data);
      if (Object.keys(result).length) return result;
    } catch {
      /* on retombe sur la lecture ligne à ligne */
    }
  }

  for (const line of text.split(/\r?\n/)) {
    const m = line.match(LINE_RE);
    if (m) put(Number(m[1]), m[2], m[3]);
  }
  return result;
}

function cleanValue(value: string): string {
  return (value || '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/#[\p{L}\d_]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s"'«»“”*_`,;]+|[\s"'«»“”*_`,;]+$/g, '')
    .trim();
}

// ─── Réparation ─────────────────────────────────────────────────────────────

const STOP_TAIL = /\s+(?:de|du|des|la|le|les|l'|d'|et|ou|à|au|aux|pour|avec|sur|par|en|un|une|vos|nos|votre|notre|qui|que|dont|tout|toute|tous|toutes|très|plus|the|a|an|and|or|of|to|for|with|on|in|your|our|which|that|who|all|very|more)$/i;

/** Mots qui allongent sans rien dire : retirés avant de couper. */
const FILLERS = /\s(?:vraiment|réellement|absolument|tellement|vraiment|really|truly|absolutely|just|so)(?=\s)/gi;

/** Coupe au mot (puis à la ponctuation forte si possible), sans points de suspension. */
export function fitLength(text: string, max: number): string {
  let t = (text || '').trim();
  if (t.length <= max) return t.replace(/[.;,]+$/, '');
  t = t.replace(FILLERS, '').replace(/\s{2,}/g, ' ');
  if (t.length <= max) return t.replace(/[.;,]+$/, '');
  const head = t.slice(0, max + 1);
  const punct = Math.max(head.lastIndexOf(','), head.lastIndexOf(';'), head.lastIndexOf(':'), head.lastIndexOf(' —'), head.lastIndexOf(' -'), head.lastIndexOf('.'));
  if (punct >= max * 0.55) t = head.slice(0, punct);
  else {
    const space = head.lastIndexOf(' ');
    t = space > 0 ? head.slice(0, space) : head.slice(0, max);
  }
  let guard = 0;
  while (STOP_TAIL.test(t) && guard++ < 4) t = t.replace(STOP_TAIL, '');
  return t.replace(/[\s.;,:—-]+$/, '');
}

/** Cases dont le contenu doit venir du brief, mot pour mot. */
const FACTUAL = new Set(['price', 'oldPrice', 'badge', 'value', 'date', 'time', 'contact', 'note', 'quote', 'author']);

/**
 * Le garde-fou anti-invention : chaque nombre écrit par le modèle doit exister
 * dans le brief. « 15 000 F » passe si le brief dit « 15000 FCFA » ; « 9 900 F »
 * inventé pour remplir la case est retiré.
 */
export function isGrounded(value: string, briefText: string): boolean {
  const runs = (value.match(/\d+(?:[\s .,]\d+)*/g) || []).map(digitsOf).filter(Boolean);
  if (!runs.length) return true;
  const source = digitsOfRuns(briefText);
  // Un prix ou un chiffre doit être EXACTEMENT un nombre du brief (« 5 000 »
  // n'est pas « 15 000 ») ; un long numéro (téléphone) peut en être un extrait.
  return runs.every((run) => source.some((s) => s === run || (run.length >= 6 && s.includes(run))));
}

const digitsOfRuns = (text: string): string[] =>
  ((text || '').replace(/ | /g, ' ').match(/\d+(?:[\s.,]\d+)*/g) || []).map(digitsOf);

export interface RepairInput {
  plan: CopyPlanEntry[];
  copy: CopyResult;
  brief: VideoBrief;
  facts: BriefFacts;
  ctx: CopyContext;
}

/** Copie finale : bornée, sans invention, cases obligatoires toujours remplies. */
export function repairCopy(input: RepairInput): { copy: CopyResult; dropped: number[] } {
  const { plan, brief, facts, ctx } = input;
  const briefText = `${brief.message || ''}\n${brief.details || ''}`;
  const out: CopyResult = {};
  const dropped: number[] = [];
  const seen = new Set<string>();

  for (const entry of plan) {
    const given = input.copy[entry.index] || {};
    const slots: Record<string, string> = {};
    for (const slot of entry.slots) {
      let value = given[slot.key] || '';
      if (value && FACTUAL.has(slot.key) && !isGrounded(value, briefText)) value = '';
      if (value && seen.has(value.toLowerCase())) value = '';
      if (!value && (slot.required || FACTUAL_OPTIONAL_FILL.has(slot.key))) {
        value = heuristicSlot(entry.sceneId, slot.key, entry.index, brief, facts, ctx);
        // Le repli ne doit pas répéter une ligne déjà à l'écran.
        if (value && seen.has(value.toLowerCase())) value = slot.required ? genericSlot(entry.sceneId, slot.key, ctx) : '';
      }
      value = fitLength(value, slot.max);
      if (slot.key === 'kicker') value = value.toUpperCase();
      if (value) {
        slots[slot.key] = value;
        if (value.length > 12) seen.add(value.toLowerCase());
      }
    }
    // Une pastille qui répète le prix n'apporte rien.
    if (slots.badge && slots.price && digitsOf(slots.badge) === digitsOf(slots.price)) delete slots.badge;
    const missingRequired = entry.slots.some((s) => s.required && !slots[s.key]);
    if (missingRequired && !['hook', 'logo', 'footage', 'kinetic', '_media'].includes(entry.sceneId)) {
      dropped.push(entry.index);
      continue;
    }
    out[entry.index] = slots;
  }
  return { copy: out, dropped };
}

/** Texte générique de dernier recours (jamais un fait). */
function genericSlot(sceneId: string, key: string, ctx: CopyContext): string {
  const L = (ctx.language || 'fr').startsWith('en') ? T.en : T.fr;
  if (sceneId === 'benefits') return L.benefits[(Number(key.slice(1)) || 1) - 1] || '';
  if (sceneId === 'wordswap' && key !== 'lead') return L.words[(Number(key.slice(1)) || 1) - 1] || '';
  return '';
}

/** Cases facultatives qu'on remplit depuis les faits quand le modèle les a omises. */
const FACTUAL_OPTIONAL_FILL = new Set(['oldPrice', 'badge', 'note', 'time', 'place', 'contact']);

// ─── Copie heuristique (sans modèle) ────────────────────────────────────────

const T = {
  fr: {
    kicker: { promotion: 'Offre spéciale', product: 'Nouveau', announce: 'Annonce', event: 'Événement', opening: 'Ouverture', testimonial: 'Ils en parlent', recruitment: 'On recrute' },
    benefits: ['Qualité garantie', 'Service rapide', 'Prix justes'],
    words: ['Qualité', 'Proximité', 'Confiance'],
    lead: 'Chez nous, c’est',
    cta: { promotion: 'Profitez-en maintenant', product: 'Découvrez-le dès aujourd’hui', announce: 'Restez connectés', event: 'Réservez votre place', opening: 'On vous attend', testimonial: 'Rejoignez nos clients', recruitment: 'Rejoignez l’équipe' },
    action: { whatsapp: 'Écrivez-nous sur WhatsApp', phone: 'Appelez-nous', url: 'Rendez-vous sur le site', default: 'Contactez-nous' },
    until: 'Jusqu’au',
    benefitsTitle: 'Pourquoi nous',
  },
  en: {
    kicker: { promotion: 'Special offer', product: 'New', announce: 'Announcement', event: 'Event', opening: 'Grand opening', testimonial: 'They say it best', recruitment: 'We’re hiring' },
    benefits: ['Guaranteed quality', 'Fast service', 'Fair prices'],
    words: ['Quality', 'Care', 'Trust'],
    lead: 'With us, it’s',
    cta: { promotion: 'Grab it now', product: 'Discover it today', announce: 'Stay tuned', event: 'Book your seat', opening: 'See you there', testimonial: 'Join our customers', recruitment: 'Join the team' },
    action: { whatsapp: 'Message us on WhatsApp', phone: 'Call us', url: 'Visit our website', default: 'Get in touch' },
    until: 'Until',
    benefitsTitle: 'Why us',
  },
};

const sentences = (text: string): string[] =>
  (text || '')
    .split(/(?<=[.!?])\s+|\n+|\s[—–]\s/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

const clauses = (text: string): string[] =>
  (text || '')
    .split(/[,;:\n•]|\s(?:et|and)\s/)
    .map((s) => s.replace(/^[-–\s]+/, '').trim())
    .filter((s) => s.length > 2 && s.length <= 48);

function stripFacts(text: string, facts: BriefFacts): string {
  let t = text;
  for (const f of [...facts.prices, ...facts.percents, ...facts.phones, ...facts.urls]) t = t.split(f).join(' ');
  return t.replace(/\s{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();
}

const capitalize = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function heuristicSlot(
  sceneId: string,
  key: string,
  index: number,
  brief: VideoBrief,
  facts: BriefFacts,
  ctx: CopyContext
): string {
  const L = (ctx.language || 'fr').startsWith('en') ? T.en : T.fr;
  const obj = (brief.objective || 'promotion') as VideoObjective;
  const msgSentences = sentences(brief.message);
  const detailSentences = sentences(brief.details || '');
  const all = [...msgSentences, ...detailSentences];
  const pick = (n: number) => all[n % Math.max(1, all.length)] || brief.message || ctx.brandName;
  const contactAction = () =>
    /whats\s?app/i.test(`${brief.message} ${brief.details}`)
      ? L.action.whatsapp
      : facts.phones[0]
        ? L.action.phone
        : facts.urls[0]
          ? L.action.url
          : L.action.default;

  switch (`${sceneId}.${key}`) {
    case 'hook.kicker':
      return L.kicker[obj] || '';
    case 'hook.title':
      return capitalize(stripFacts(msgSentences[0] || brief.message, facts).split(/[,:;]/)[0]);
    case 'statement.title':
      return capitalize(stripFacts(pick(index), facts));
    case 'statement.sub':
      return ctx.valueProposition ? sentences(ctx.valueProposition)[0] || '' : '';
    case 'product.name': {
      const first = detailSentences[0] || msgSentences[0] || ctx.brandName;
      const head = stripFacts(first, facts).split(/[,:;(]|\s(?:à|au|aux|dès|pour|au lieu|at|for|from|only)\s/i)[0];
      return capitalize(head.trim());
    }
    case 'product.tagline':
      return ctx.valueProposition ? sentences(ctx.valueProposition)[0] || '' : '';
    case 'product.price':
      return facts.prices[0] || '';
    case 'benefits.title':
      return L.benefitsTitle;
    case 'benefits.b1':
    case 'benefits.b2':
    case 'benefits.b3': {
      const n = Number(key.slice(1)) - 1;
      const own = clauses(stripFacts(brief.details || '', facts)).filter((c) => c.split(' ').length <= 6);
      return capitalize(own[n] || L.benefits[n]);
    }
    case 'stat.value':
      return facts.stats[0]?.value || '';
    case 'stat.label':
      return capitalize(facts.stats[0]?.label || '');
    case 'offer.kicker':
      return L.kicker.promotion;
    case 'offer.price': {
      // Deux prix : le plus bas est le nouveau prix ; sinon la remise en %.
      if (facts.prices.length) return [...facts.prices].sort((a, b) => Number(digitsOf(a)) - Number(digitsOf(b)))[0];
      return facts.percents[0] || '';
    }
    case 'offer.oldPrice': {
      if (facts.prices.length < 2) return '';
      const sorted = [...facts.prices].sort((a, b) => Number(digitsOf(b)) - Number(digitsOf(a)));
      return sorted[0];
    }
    case 'offer.badge':
      return facts.percents[0] && facts.prices[0] ? facts.percents[0].replace(/\s/g, '') : '';
    case 'offer.note':
      return facts.dates[0] ? `${L.until} ${facts.dates[0]}` : '';
    case 'quote.quote':
      return facts.quotes[0]?.text || '';
    case 'quote.author':
      return facts.quotes[0]?.author || '';
    case 'event.title':
      return capitalize(stripFacts(msgSentences[0] || brief.message, facts).split(/[,:;]/)[0]);
    case 'event.date':
      return facts.dates[0] || '';
    case 'event.time':
      return facts.times[0] || '';
    case 'event.place':
      return facts.places[0] || '';
    case 'gallery.caption':
      return ctx.brandName;
    case 'wordswap.lead':
      return L.lead;
    case 'wordswap.w1':
    case 'wordswap.w2':
    case 'wordswap.w3': {
      const n = Number(key.slice(1)) - 1;
      const kw = (ctx.keywords || []).filter((k) => k && k.length <= 16 && !/\s/.test(k));
      return capitalize(kw[n] || L.words[n]);
    }
    case 'cta.title':
      return L.cta[obj] || L.cta.promotion;
    case 'cta.action':
      return contactAction();
    case 'cta.contact':
      return facts.phones[0] || facts.urls[0] || '';
    case 'footage.kicker':
      return L.kicker[obj] || '';
    case 'footage.title':
    case 'lottie.title':
    case 'showcase3d.title':
      return capitalize(stripFacts(pick(index - 1), facts).split(/[,:;]/)[0]);
    case 'footage.sub':
    case 'lottie.sub':
    case 'showcase3d.sub':
      return ctx.valueProposition ? sentences(ctx.valueProposition)[0] || '' : '';
    case 'kinetic.l1':
    case 'kinetic.l2':
    case 'kinetic.l3': {
      const n = Number(key.slice(1)) - 1;
      const words = stripFacts(brief.message, facts).split(/\s+/).filter((w) => w.length > 2);
      const kw = (ctx.keywords || []).filter((k) => k && k.length <= 16);
      const pool = [...kw, ...L.words, ...words.map(capitalize)];
      return capitalize(pool[n] || '');
    }
    case 'kinetic.l4':
      return capitalize(stripFacts(msgSentences[0] || brief.message, facts).split(/[,:;]/)[0]);
    case '_media.visual':
      return [ctx.businessType, ...(ctx.keywords || []).slice(0, 2)].filter(Boolean).join(' ');
    case 'logo.tagline':
      return ctx.valueProposition ? fitLength(sentences(ctx.valueProposition)[0] || '', 48) : '';
    default:
      return '';
  }
}

/** Copie entièrement heuristique : la vidéo sort même sans modèle. */
export function heuristicCopy(plan: CopyPlanEntry[], brief: VideoBrief, facts: BriefFacts, ctx: CopyContext): CopyResult {
  const out: CopyResult = {};
  for (const entry of plan) {
    out[entry.index] = {};
    for (const slot of entry.slots) {
      const value = heuristicSlot(entry.sceneId, slot.key, entry.index, brief, facts, ctx);
      if (value) out[entry.index][slot.key] = value;
    }
  }
  return out;
}

export interface WriteCopyResult {
  copy: CopyResult;
  dropped: number[];
  source: 'llm' | 'heuristic';
  tokens: { input: number; output: number };
}

/** Rédaction complète : un seul appel au modèle, puis réparation par le code. */
export async function writeCopy(
  sceneIds: string[],
  brief: VideoBrief,
  ctx: CopyContext,
  writer?: CopyWriter,
  opts: { mediaQuery?: boolean } = {}
): Promise<WriteCopyResult> {
  const plan = copyPlan(sceneIds, !!opts.mediaQuery);
  const facts = extractFacts(`${brief.message}\n${brief.details || ''}`);
  let raw = '';
  let source: 'llm' | 'heuristic' = 'heuristic';
  const prompt = buildCopyPrompt(plan, brief, ctx);
  if (writer) {
    try {
      raw = await writer(prompt.system, prompt.user);
      source = 'llm';
    } catch {
      raw = '';
    }
  }
  let parsed = raw ? parseCopy(raw, plan) : {};
  const filled = Object.values(parsed).reduce((n, slots) => n + Object.keys(slots).length, 0);
  if (!filled) {
    parsed = heuristicCopy(plan, brief, facts, ctx);
    source = 'heuristic';
  }
  const { copy, dropped } = repairCopy({ plan, copy: parsed, brief, facts, ctx });
  return {
    copy,
    dropped,
    source,
    tokens: source === 'llm' ? { input: estimateTokens(prompt.system + prompt.user), output: estimateTokens(raw) } : { input: 0, output: 0 },
  };
}

/**
 * LES FAITS DU BRIEF — ce que la demande contient de vérifiable (prix, dates, numéros, adresses…).
 *
 * Sert au garde-fou anti-invention des textes : un nombre écrit par un modèle doit exister dans la
 * demande de l'utilisateur (`isGrounded`). Ce n'est pas un contrôle esthétique : un prix inventé
 * est une erreur de fond.
 */

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

/** Fonction d'appel au modèle (system, user → texte) : injectée par l'hôte, simulée par les contrôles. */
export type CopyWriter = (system: string, user: string) => Promise<string>;

/** Estimation grossière (≈ 4 caractères par token) : sert à mesurer, pas à facturer. */
export const estimateTokens = (text: string): number => Math.ceil((text || '').length / 4);

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

/** L'adresse web figure-t-elle dans la demande (au protocole et au « www. » près) ? */
export function urlInBrief(value: string, briefText: string): boolean {
  const bare = (v: string) => v.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
  const v = bare(value.trim());
  return v.length >= 4 && bare(briefText).includes(v);
}

/** Le contexte rédactionnel de la marque (ton, promesse, secteur), pour les agents qui écrivent. */
export interface CopyContext {
  brandName: string;
  businessType?: string;
  tone?: string;
  valueProposition?: string;
  keywords?: string[];
  language: string;
}

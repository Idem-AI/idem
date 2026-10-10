/**
 * Les MOTS d'un visuel : l'intention, les faits du brief, et les cases à remplir.
 *
 *  - les faits (date, heure, lieu, prix, offre, contact) sont LUS dans la demande, jamais
 *    inventés : un chiffre, une date ou un lieu absent du brief est retiré ;
 *  - le titre est un message, pas la consigne : « Une story pour annoncer… » ne finit jamais sur
 *    l'affiche, ni « visuel », « professionnel », « propose autre chose » ;
 *  - la langue est celle de la marque (un titre anglais pour une marque française est refusé) ;
 *  - chaque case a sa longueur : le gabarit sait alors tenir le titre en grand.
 */
import type { AgentTask } from '../../creativity/orchestrator';
import { agentLines } from '../../creativity/agent-io';
import type { PosterCopy, PosterFact, PosterIntent } from './poster.types';

export interface PosterBrief {
  /** Le message (la demande sans sa formule). */
  message: string;
  /** La demande complète (ton, public, détails). */
  details?: string;
  brandName: string;
  businessType?: string;
  valueProposition?: string;
  tone?: string;
  language: string;
}

const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const clip = (text: string | undefined, max: number) => {
  const t = (text || '').replace(/\s+/g, ' ').trim().replace(/^["'«»“”]+|["'«»“”]+$/g, '');
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/\s+\S*$/, '').replace(/[,;:\-–—]$/, '').trim();
};
const wordsOf = (t: string) => t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
const digits = (t: string) => (t.match(/\d+/g) || []).map((d) => d.replace(/^0+(?=\d)/, ''));

// ─── Intention ──────────────────────────────────────────────────────────────

export function inferPosterIntent(text: string): PosterIntent {
  const t = fold(text);
  const has = (re: RegExp) => re.test(t);
  if (has(/["«“].{8,}["»”]|temoign|avis client|ils parlent de nous|testimonial|review/)) return 'quote';
  if (has(/recrut|on recrute|nous recrutons|postul|candidat|offre d.emploi|hiring|join the team|stage|alternance/)) return 'recruit';
  if (has(/-?\d+\s?%|promo|soldes|reduction|remise|offre speciale|black friday|bon plan|\bsale\b|discount|prix casse/)) return 'promo';
  if (has(/evenement|event|soiree|atelier|conference|meetup|webinaire|webinar|concert|salon|rencontre|hackathon|formation le|rendez-vous|ce samedi|ce dimanche|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche/)) return 'event';
  if (has(/lancement|lance|nouveau|nouvelle|disponible|ouverture|launch|introducing|new |now available|arrive/)) return 'launch';
  if (has(/produit|collection|menu|plat|gamme|article|modele|product/)) return 'product';
  return 'info';
}

// ─── Faits lus dans la demande ──────────────────────────────────────────────

const DAYS = '(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday)';
const MONTHS = '(?:janv(?:ier)?|f[ée]v(?:rier)?|mars|avr(?:il)?|mai|juin|juil(?:let)?|ao[uû]t|sept(?:embre)?|oct(?:obre)?|nov(?:embre)?|d[ée]c(?:embre)?|jan(?:uary)?|feb(?:ruary)?|march|apr(?:il)?|may|june|july|aug(?:ust)?|sep(?:tember)?|october|november|december)\\.?';

/** Date, heure, prix, offre, contact : ce qui est écrit dans le brief, tel quel. */
export function extractFacts(text: string): { facts: PosterFact[]; offer?: string } {
  const facts: PosterFact[] = [];
  const add = (kind: PosterFact['kind'], value?: string) => {
    const v = (value || '').replace(/\s+/g, ' ').trim().replace(/[.,;:]$/, '');
    if (v && !facts.some((f) => fold(f.text) === fold(v))) facts.push({ kind, text: v.charAt(0).toUpperCase() + v.slice(1) });
  };
  const date =
    text.match(new RegExp(`\\b${DAYS}\\s+\\d{1,2}(?:er)?\\s+${MONTHS}(?:\\s+\\d{4})?`, 'i'))?.[0] ||
    text.match(new RegExp(`\\b\\d{1,2}(?:er)?\\s+${MONTHS}(?:\\s+\\d{4})?`, 'i'))?.[0] ||
    text.match(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/)?.[0] ||
    text.match(new RegExp(`\\b${DAYS}(?:\\s+(?:soir|matin|apr[eè]s-midi))?`, 'i'))?.[0] ||
    text.match(/\b(?:demain|ce week-end|this weekend|tomorrow)\b/i)?.[0];
  add('date', date);
  add('time', text.match(/\b(?:[01]?\d|2[0-3])\s?h\s?(?:[0-5]\d)?\b|\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\b\d{1,2}\s?(?:am|pm)\b/i)?.[0]?.replace(/\s/g, ''));
  const offer = text.match(/[-−–]\s?\d{1,2}\s?%/)?.[0]?.replace(/[-–]\s?/, '−').replace(/\s?%/, ' %');
  add('price', text.match(/\b\d[\d\s.,]{0,9}\s?(?:F\s?CFA|FCFA|XOF|XAF|€|\$|euros?|francs?)\b/i)?.[0]);
  add('contact', text.match(/(?:\+?\d[\d\s.-]{7,}\d)|(?:\b[a-z0-9-]+\.(?:com|africa|org|net|fr|ci|sn|cm|io)\b)|(?:@[a-z0-9_.]{3,})/i)?.[0]);
  return { facts, ...(offer ? { offer } : {}) };
}

/** Un fait proposé par le modèle n'est gardé que si ses mots et ses chiffres sont dans le brief. */
export function groundedIn(source: string, value: string): boolean {
  const src = fold(source);
  if (!digits(value).every((d) => digits(source).includes(d))) return false;
  const tokens = fold(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (!tokens.length) return true;
  return tokens.filter((w) => src.includes(w)).length / tokens.length >= 0.6;
}

/** Un fait déjà porté par le titre n'est pas répété dessous ; chaque fait prend une majuscule. */
export function dedupeFacts(facts: PosterFact[], headline: string): PosterFact[] {
  const h = fold(headline);
  return facts
    .filter((f) => !(f.kind === 'date' && h.includes(fold(f.text))))
    .map((f) => ({ ...f, text: f.text.charAt(0).toUpperCase() + f.text.slice(1) }));
}

// ─── Validation des textes ──────────────────────────────────────────────────

/** Les mots de la CONSIGNE, jamais du message affiché. */
const META = /\b(visuel|visuels|affiche|story|stories|publication|post|flyer|banni[eè]re|poster|design|graphisme|professionn?el|propose[rz]?|autre chose|refai[st]|template|image|mise en page|layout|instagram|facebook)\b/i;
const ENGLISH = /\b(the|and|for|with|your|our|join|official|launch|now|is|are|we|you|community|discover|get|new)\b/gi;
const FRENCH = /\b(le|la|les|des|du|un|une|et|pour|avec|nous|vous|notre|votre|est|sont|au|aux|en)\b/gi;

export function languageMatches(text: string, language: string): boolean {
  const en = (text.match(ENGLISH) || []).length;
  const fr = (text.match(FRENCH) || []).length;
  if (language.startsWith('fr')) return en < 2 || fr >= en;
  if (language.startsWith('en')) return fr < 2 || en >= fr;
  return true;
}

/** Des mots qui décrivent un FORMAT (soirée, atelier, en ligne, gratuit…) : seulement s'ils sont dans la demande. */
const FORMAT_WORDS = /\b(soir[ée]e|soir|atelier|webinaire|webinar|conf[ée]rence|gala|concert|d[iî]ner|d[ée]jeuner|brunch|afterwork|ap[ée]ro|en ligne|online|gratuit|gratuite|free|offert|offerte|masterclass|hackathon|meetup|table ronde|panel|festival|salon|f[eê]te|tournoi|webinars?)\b/gi;
export function inventsFormat(text: string, source: string): boolean {
  const src = fold(source);
  return (text.match(FORMAT_WORDS) || []).some((w) => !src.includes(fold(w)));
}

const STOP_END = /\b(et|de|du|des|la|le|les|pour|avec|à|a|en|sur|par|ou|and|the|of|for|with|to|in)\s*$/i;

/** Un fait n'est gardé que s'il a la forme de son genre (une date ressemble à une date…). */
export function factLooksRight(kind: PosterFact['kind'], value: string): boolean {
  if (kind === 'date') return new RegExp(`${DAYS}|${MONTHS}|\\d|demain|week-?end|tomorrow`, 'i').test(value) && wordsOf(value).length <= 5;
  if (kind === 'time') return /\d/.test(value) && wordsOf(value).length <= 4;
  if (kind === 'price') return /\d/.test(value);
  if (kind === 'place') return wordsOf(value).length <= 6 && !/lancement|launch|événement|evenement|communaut/i.test(value);
  return true;
}

export function validHeadline(headline: string, brief: PosterBrief): boolean {
  if (!headline || wordsOf(headline).length > 9 || headline.length > 60) return false;
  if (STOP_END.test(headline)) return false;
  if (inventsFormat(headline, `${brief.message} ${brief.details || ''}`)) return false;
  if (META.test(headline) && !META.test(brief.brandName)) return false;
  if (/[#\u{1F300}-\u{1FAFF}]/u.test(headline)) return false;
  if (!languageMatches(headline, brief.language)) return false;
  // Pas un chiffre absent du brief.
  return digits(headline).every((d) => digits(`${brief.message} ${brief.details || ''}`).includes(d));
}

// ─── Repli sans modèle ──────────────────────────────────────────────────────

const LEAD = /^\s*(?:(?:je\s+(?:veux|voudrais)|j['’]aimerais|fais(?:-moi)?|cr[ée]e(?:-moi)?)\s+)?(?:une?|des|la|le|mon|ma)\s+(?:petite?s?\s+)?(?:affiches?|visuels?|publications?|posts?|stor(?:y|ies)|banni[eè]res?|flyers?|images?)\s*(?:pour|sur|qui|afin\s+d[e'])?\s*(?:annoncer|pr[ée]senter|promouvoir|f[eê]ter|c[ée]l[ée]brer)?\s*/i;

/** Les mots du visuel sans modèle : le message raccourci, les faits du brief. */
export function heuristicCopy(brief: PosterBrief, intent: PosterIntent): PosterCopy {
  const { facts, offer } = extractFacts(`${brief.message} ${brief.details || ''}`);
  let message = brief.message.replace(LEAD, '').replace(/^(?:de|du|d['’]|des|pour)\s+/i, '').trim();
  message = message.charAt(0).toUpperCase() + message.slice(1);
  const first = message.split(/(?<=[.!?:])\s/)[0];
  let headline = clip(first, 44);
  if (!validHeadline(headline, brief)) headline = intent === 'event' ? (brief.language.startsWith('fr') ? 'On se retrouve' : 'See you there') : brief.brandName;
  const rest = clip(message.slice(first.length), 110);
  return {
    kicker: intent === 'event' ? brief.brandName : undefined,
    headline,
    // (faits dédoublonnés plus bas)
    sub: rest && rest !== headline ? rest : clip(brief.valueProposition, 100) || undefined,
    facts: dedupeFacts(facts.filter((f) => !offer || f.kind !== 'price'), headline),
    ...(offer ? { offer } : {}),
  };
}

// ─── Le rédacteur ───────────────────────────────────────────────────────────

const INTENT_HINT: Record<PosterIntent, string> = {
  event: 'an EVENT poster: the title says what happens, the facts say when and where',
  promo: 'a PROMOTION: the offer is the hero, the headline says on what',
  launch: 'a LAUNCH / announcement: the news in a few strong words',
  product: 'a PRODUCT visual: the product and its benefit',
  quote: 'a TESTIMONIAL: one sentence quoted, and who said it',
  recruit: 'a RECRUITMENT visual: the role and why join',
  info: 'an INFORMATION visual: one clear message',
};

export function copyTask(brief: PosterBrief, intent: PosterIntent, feedback?: string): AgentTask<PosterCopy> {
  const source = `${brief.message} ${brief.details || ''}`;
  const read = extractFacts(source);
  const lang = brief.language.startsWith('fr') ? 'French' : brief.language.startsWith('en') ? 'English' : brief.language;
  return {
    role: 'posterCopywriter',
    minLevel: 'low',
    prompt: () => ({
      system: [
        `You write the words of ONE social-media visual (${INTENT_HINT[intent]}) for the brand ${brief.brandName}. Write ONLY in ${lang}.`,
        'Output ONLY these lines (write "none" when empty):',
        'kicker: 1-3 words above the title (category, series, brand), or none',
        'headline: the message, 3 to 7 words, strong and concrete — NOT the request ("A story to announce…"), never the words visual, poster, story, post, design',
        'sub: one sentence of at most 14 words that adds information, or none',
        'date: the date copied from the request, or none',
        'time: the time copied from the request, or none',
        'place: the place copied from the request, or none',
        'price: a price copied from the request, or none',
        'offer: a discount/figure copied from the request (e.g. −20 %), or none',
        intent === 'quote' ? 'quote: the quoted sentence (max 20 words)\nauthor: who said it, or none' : '',
        'emphasis: the single most important word of the headline, copied exactly',
        'Never invent a date, a time, a place, a price, a number, a name, a format (evening, online, workshop…) that is not in the request.',
        'If the request is thin, make the headline strong from the brand promise and the occasion (e.g. what the brand stands for, said with energy) — still without inventing facts.',
        'The headline must not repeat the date; the date goes on its own line.',
      ]
        .filter(Boolean)
        .join('\n'),
      user: [
        `BRAND: ${brief.brandName}${brief.businessType ? ` — ${brief.businessType}` : ''}${brief.tone ? ` · tone: ${brief.tone}` : ''}`,
        brief.valueProposition ? `BRAND PROMISE: ${brief.valueProposition.slice(0, 240)}` : '',
        `REQUEST: ${source.slice(0, 900)}`,
        feedback ? `THE USER DISLIKED THE PREVIOUS VERSION: "${feedback.slice(0, 200)}" — write something more striking, still true.` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    }),
    parse: (raw) => {
      const l = agentLines(raw);
      const none = (v?: string) => !v || /^(none|aucun|aucune|n\/a|-|rien|null)$/i.test(v.trim());
      const headline = clip(l.headline || l.titre || l.title, 60);
      if (!validHeadline(headline, brief)) return undefined;
      const copy: PosterCopy = { headline, facts: [] };
      if (!none(l.kicker) && wordsOf(l.kicker).length <= 4 && !META.test(l.kicker) && languageMatches(l.kicker, brief.language)) copy.kicker = clip(l.kicker, 30);
      if (!none(l.sub) && wordsOf(l.sub).length <= 18 && !META.test(l.sub) && !inventsFormat(l.sub, source) && !STOP_END.test(l.sub) && languageMatches(l.sub, brief.language) && digits(l.sub).every((d) => digits(source).includes(d))) copy.sub = clip(l.sub, 120);
      const facts: PosterFact[] = [];
      for (const kind of ['date', 'time', 'place', 'price'] as const) {
        const v = l[kind];
        if (!none(v) && groundedIn(source, v) && factLooksRight(kind, v)) facts.push({ kind, text: clip(v, 40) });
      }
      // Ce que la lecture du brief a trouvé et que le modèle a oublié revient.
      for (const f of read.facts) if (!facts.some((x) => x.kind === f.kind)) facts.push(f);
      copy.facts = dedupeFacts(facts, headline).slice(0, 4);
      const offer = !none(l.offer) && groundedIn(source, l.offer) ? clip(l.offer, 12) : read.offer;
      if (offer) copy.offer = offer;
      if (intent === 'quote' && !none(l.quote) && wordsOf(l.quote).length <= 24) copy.quote = { text: clip(l.quote, 160), ...(!none(l.author) ? { author: clip(l.author, 50) } : {}) };
      const w = fold(l.emphasis || '').replace(/[^a-z0-9%'-]/g, '');
      const at = w ? wordsOf(headline).findIndex((x) => fold(x).replace(/[^a-z0-9%'-]/g, '') === w) : -1;
      if (at >= 0) copy.emphasis = at;
      return copy;
    },
    fallback: () => heuristicCopy(brief, intent),
  };
}

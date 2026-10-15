/**
 * LA LECTURE DE LA DEMANDE — ce que l'utilisateur a écrit devient un cahier des charges.
 *
 * Avant toute décision créative, la demande est lue EN ENTIER (jamais tronquée à 400 signes) :
 *
 *   langue      consigne explicite (« Langue : français ») > langue du texte > interface > marque
 *               (`text/language.ts`) — jamais la langue de la page par défaut ;
 *   scénario    les scènes écrites (« SCÈNE 1 — L'IDÉE (00:00–00:08) »), leur minutage, les textes
 *               à l'écran MOT POUR MOT, les textes DANS l'image (« un dossier intitulé « MON
 *               BUSINESS » »), la voix off écrite ;
 *   périmètre   durée, format (16:9), demandes techniques non tenues (4K, 24 i/s) — dites, jamais
 *               ignorées en silence ;
 *   consignes   à faire / à éviter, couleurs nommées, musique décrite, personnage récurrent ;
 *   supports    pour chaque scène, CE QU'IL FAUT PRODUIRE ET AVEC QUEL OUTIL (`SpecMedium`) :
 *               un plan filmé (générateur vidéo), l'interface du produit (captures de la marque),
 *               du motion design (le code), la signature (le logo).
 *
 * Le code lit tout ce qui se lit sans modèle. Un agent LECTEUR complète ce qui demande de
 * comprendre (supports d'une scène, description anglaise d'un plan filmé, personnage, lumière).
 * Ses réponses sont validées : il ne peut ni réécrire un texte de l'utilisateur, ni ajouter une
 * scène ; sans lui, les règles du code suffisent.
 */
import { agentLines } from '../../creativity/agent-io';
import { explicitLanguage, resolveLanguage } from '../../text/language';
import type { CopyWriter } from './facts';
import type { MusicMood, VideoFormat } from '../contracts/model';

/** Longueur maximale d'une demande lue (une page de script fait 6 000 à 10 000 signes). */
export const MAX_REQUEST_CHARS = 20000;

/**
 * Le support d'un plan, donc l'outil qui le produit :
 *   footage  plan filmé (personnes, lieux, gestes réels) → générateur vidéo (Seedance), puis
 *            banque de vidéos libres, puis image générée animée ;
 *   screen   l'interface du produit → captures de la marque (site lu, imports), sinon interface
 *            dessinée par le moteur avec les textes de la demande ;
 *   motion   motion design → le moteur (typographie, formes, lignes, graphiques, transitions) ;
 *   logo     la signature → animation du logo de la charte.
 */
export type SpecMedium = 'footage' | 'screen' | 'motion' | 'logo';
export const SPEC_MEDIA: SpecMedium[] = ['footage', 'screen', 'motion', 'logo'];

export interface SpecScene {
  index: number;
  /** Le nom donné par l'utilisateur (« L'IDÉE »). */
  label?: string;
  /** Minutage écrit (s), s'il l'est. */
  start?: number;
  end?: number;
  /** Ce qui se passe, tel que l'utilisateur l'a écrit (sans les blocs de texte à l'écran). */
  description: string;
  /** Textes à l'écran, MOT POUR MOT, dans l'ordre. */
  texts: string[];
  /** Textes DANS l'image (interface, dossier, saisie) : montrés tels quels, jamais en titre. */
  props: string[];
  /** Voix off écrite par l'utilisateur pour cette scène. */
  voice: string[];
  /** Les supports de la scène, dans l'ordre où elle les demande. */
  media: SpecMedium[];
  /** Plan filmé : ce que le générateur vidéo doit filmer (anglais), écrit par le lecteur. */
  footage?: string;
  /** Plan filmé : requête de banque de vidéos (anglais, 2 à 4 mots). */
  query?: string;
}

export interface RequestSpec {
  v: 1;
  language: string;
  languageSource: 'explicit' | 'detected' | 'fallback';
  /** Voix off dans une autre langue que les textes (« voix off en anglais »). */
  voiceLanguage?: string;
  /** `script` : l'utilisateur a écrit le film scène par scène — il est suivi tel quel. */
  mode: 'script' | 'brief';
  title?: string;
  /** L'intention (le paragraphe « objectif », sinon la première phrase utile). */
  objective?: string;
  durationSec?: number;
  format?: VideoFormat;
  /** Ce qui a été demandé mais ne peut pas être tenu tel quel (4K, 24 i/s…). */
  unsupported: string[];
  scenes: SpecScene[];
  /** Textes exigés hors scénario (« avec le slogan « … » »). */
  texts: string[];
  musts: string[];
  avoid: string[];
  colors: { hex: string; name?: string }[];
  /** La musique décrite, et l'ambiance qu'on en déduit. */
  music?: string;
  musicMood?: MusicMood;
  /** Le ou les personnages récurrents des plans filmés (même personne d'un plan à l'autre). */
  cast?: string;
  /** Lumière et rendu communs aux plans filmés. */
  look?: string;
  /** Voix off demandée en toutes lettres, ou refusée. */
  voiceOver?: 'wanted' | 'none';
  source: 'parser' | 'reader';
}

// ─── Outils de texte ────────────────────────────────────────────────────────

const normalizeNewlines = (raw: string) =>
  String(raw || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[​-‍﻿]/g, '')
    .replace(/ | /g, ' ');

/** Une ligne sans balisage Markdown (titre, puce, gras, citation). */
export function plainLine(line: string): string {
  return String(line || '')
    .replace(/^[\s>]*#{1,6}\s*/, '')
    .replace(/^\s*(?:[-*•]|\d{1,2}[.)])\s+/, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/^\s*\*(?=\S)|(?<=\S)\*\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Comparaison de deux textes à l'apostrophe, à la casse et aux espaces près. */
export function sameText(a: string, b: string): boolean {
  return normText(a) === normText(b);
}

export function normText(value: string): string {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[’‘`´]/g, "'")
    .replace(/[«»“”"]/g, '')
    .replace(/\s+([?!:;»])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Les citations d'une ligne (« … », “…”, "…"). */
export function quotesIn(line: string): string[] {
  return [...String(line || '').matchAll(/«\s*([^«»]{1,240}?)\s*»|“([^“”]{1,240})”|"([^"\n]{1,240})"/gu)].map((m) => (m[1] ?? m[2] ?? m[3] ?? '').trim()).filter(Boolean);
}

const toSeconds = (value: string) => Number(String(value).replace(',', '.'));

/** Un intervalle de temps écrit : « 00:00–00:08 », « 0 à 8 s », « 12-18s », « 0:45 - 1:00 ». */
export function timeRange(text: string): { start: number; end: number } | undefined {
  let m = String(text || '').match(/(\d{1,2})[:h](\d{2})(?:[.,]\d+)?\s*(?:[–—-]+|à|a|to|au|jusqu['’]à)\s*(\d{1,2})[:h](\d{2})/i);
  let range: { start: number; end: number } | undefined;
  if (m) range = { start: Number(m[1]) * 60 + Number(m[2]), end: Number(m[3]) * 60 + Number(m[4]) };
  else {
    m = String(text || '').match(/(\d{1,3}(?:[.,]\d+)?)\s*(?:s|sec|secondes?|seconds?)?\s*(?:[–—-]+|à|to|au)\s*(\d{1,3}(?:[.,]\d+)?)\s*(?:s\b|sec\b|secondes?|seconds?)/i);
    if (m) range = { start: toSeconds(m[1]), end: toSeconds(m[2]) };
  }
  if (!range || !(range.end > range.start) || range.end > 900) return undefined;
  return range;
}

// ─── Les champs d'en-tête ───────────────────────────────────────────────────

/** La durée demandée dans le texte (s). */
export function durationIn(text: string): number | undefined {
  const t = String(text || '');
  const sec =
    t.match(/(?:dur[ée]e|duration|longueur|length|dauer|duraci[óo]n|dura[çc][ãa]o)[^\n\d]{0,30}(\d{1,3})\s*(?:s\b|sec\b|secondes?|seconds?|segundos?|sekunden)/iu) ||
    t.match(/\b(\d{1,3})\s*(?:secondes|seconds|segundos)\s+(?:exactement|exactly|pile|maximum|max\b|au total|in total)/iu) ||
    t.match(/\bvid[ée]o\s+(?:de|d['’]une dur[ée]e de)\s+(\d{1,3})\s*(?:s\b|sec\b|secondes?)/iu) ||
    t.match(/\b(\d{1,3})[\s-]*(?:s|sec|second)[\s-]+(?:video|vid[ée]o|clip|spot|film|ad)\b/iu);
  if (sec) {
    const n = Number(sec[1]);
    if (n >= 3 && n <= 600) return n;
  }
  const min = t.match(/(?:dur[ée]e|duration|length|longueur)[^\n\d]{0,30}(\d|une|one)\s*min(?:ute)?s?\b/iu) || t.match(/\b(une|one|1)\s+minute\s+(?:exactement|exactly|pile|vid[ée]o|video)\b/iu);
  if (min) return (/\d/.test(min[1]) ? Number(min[1]) : 1) * 60;
  return undefined;
}

/** Le format demandé : une ligne « Format : … », sinon un ratio écrit n'importe où. */
export function formatIn(text: string): VideoFormat | undefined {
  const t = String(text || '');
  const line = t.match(/(?:^|\n)[\s*_#>\-•]*format[\s*_]*[:=]\s*([^\n]+)/iu)?.[1] || '';
  const ratio = (s: string): VideoFormat | undefined =>
    /\b16\s*[:/x×]\s*9\b/.test(s) ? 'landscape' : /\b9\s*[:/x×]\s*16\b/.test(s) ? 'story' : /\b4\s*[:/x×]\s*5\b/.test(s) ? 'portrait' : /\b1\s*[:/x×]\s*1\b/.test(s) ? 'square' : undefined;
  if (line) {
    const r = ratio(line);
    if (r) return r;
    if (/paysage|landscape|horizontal|youtube|cin[ée]ma/i.test(line)) return 'landscape';
    if (/vertical|story|stories|reels?|tiktok|shorts|statut/i.test(line)) return 'story';
    if (/portrait/i.test(line)) return 'portrait';
    if (/carr[ée]|square/i.test(line)) return 'square';
  }
  return ratio(t);
}

/** Les demandes techniques que le rendu ne tient pas tel quel (dites à l'utilisateur). */
export function unsupportedIn(text: string): string[] {
  const t = String(text || '');
  const out: string[] = [];
  if (/\b(?:4k|uhd|2160p|8k)\b/i.test(t)) out.push('4K');
  const fps = t.match(/\b(\d{2,3})\s*(?:fps|i\/s|ips|images?\s*(?:par|\/)\s*s(?:econde)?|frames?\s*per\s*second)\b/i);
  if (fps && ![30, 60].includes(Number(fps[1]))) out.push(`${fps[1]} fps`);
  return out;
}

/** Les couleurs écrites (#1447E6), avec le mot qui les nomme (« bleu nuit »). */
export function colorsIn(text: string): { hex: string; name?: string }[] {
  const out: { hex: string; name?: string }[] = [];
  for (const m of String(text || '').matchAll(/(?:([\p{L}][\p{L} -]{0,24}?)\s*[:(]?\s*)?#([0-9a-f]{6}|[0-9a-f]{3})\b/giu)) {
    const hex = `#${m[2].length === 3 ? m[2].split('').map((c) => c + c).join('') : m[2]}`.toLowerCase();
    if (out.some((c) => c.hex === hex)) continue;
    const name = (m[1] || '').trim().split(/\s+/).slice(-2).join(' ').replace(/^(?:et|and|,)\s*/i, '');
    out.push({ hex, ...(name && !/couleurs?|colou?rs?|idem/i.test(name) ? { name } : {}) });
  }
  return out.slice(0, 8);
}

/** L'ambiance musicale qu'une description de musique appelle. */
export function moodOfMusic(text: string | undefined): MusicMood | undefined {
  const t = String(text || '').toLowerCase();
  if (!t) return undefined;
  if (/sans musique|pas de musique|no music|aucune musique|without music/.test(t)) return 'none';
  if (/afro|amapiano|coup[ée][- ]d[ée]cal[ée]|makossa|ndombolo|highlife|bikutsi|mbalax/.test(t)) return 'afro';
  if (/[ée]lectro|electronic|cin[ée]mato|cinematic|[ée]pique|epic|orchestr|trailer|mont[ée]e|build[- ]?up|hybrid/.test(t)) return 'epic';
  if (/calme|calm|doux|douce|soft|piano|acoustique|acoustic|ambient|lounge|chill/.test(t)) return 'calm';
  if (/[ée]nergique|energetic|upbeat|dynamique|festi|joyeu|pop\b|danse|dance/.test(t)) return 'upbeat';
  if (/corporate|institutionnel|entreprise|business/.test(t)) return 'corporate';
  return undefined;
}

// ─── Les supports d'une scène (règles du code) ──────────────────────────────

const FOOTAGE_HINT =
  /\bgros plan\b|\bclose[- ]?up\b|\bplan (?:sur|de)\b|\bshot of\b|\btravelling\b|\bdrone\b|\bralenti\b|slow[- ]?motion|plan (?:cin[ée]matographique|film[ée]|r[ée]el|large|serr[ée]|moyen|am[ée]ricain|rapproch[ée]|d['’]ensemble)|cin[ée]matographi|\bfilm[ée]e?s?\b|prise de vue|live[- ]action|cinematic|\bfilmed\b|\bfootage\b|retour au personnage|\b(?:personnage|entrepreneur|entrepreneuse|homme|femme|jeune|enfant|client|cliente|famille|vendeu(?:r|se)|commer[çc]ante?|founder|man|woman|person|people|customer)\b|\b(?:il|elle|ils|elles|he|she|they)\s+(?:[ée]crit|regarde|sourit|ouvre|ferme|marche|parle|copie|partage|prend|tient|entre|sort|court|danse|cuisine|writes|looks|smiles|opens|walks|talks|holds|shares)\b/iu;
const SCREEN_HINT = /[ée]cran(?! noir)|\bscreen\b(?! goes black)|interface|navigateur|browser|site web|site de|website|\bapplication\b|\bapp\b|dashboard|tableau de bord|dossier|folder|fichiers?\b|\bfiles?\b|curseur|cursor|clique|click|corbeille|trash|smartphone|t[ée]l[ée]phone|saisit|\btape\b|\btypes\b|formulaire|page web|page d['’]accueil|\blien\b|\blink\b/iu;
const LOGO_HINT = /\blogo\b|signature|packshot|carton de fin|end ?card|end ?screen/iu;
const MOTION_HINT = /motion design|animation|anim[ée]e?s?|typographi|kinetic|infographi|graphiques?|charts?|se construisent|se structure|appara[iî]t|apparaissent|se compose|composition|ligne (?:lumineuse|bleue)|point (?:bleu|lumineux)|fond (?:noir|sombre|blanc|uni)|[ée]cran noir|black screen|se transforme|morph|particules?|textes? (?:courts?|successifs)/iu;

/**
 * Une demande SANS scénario qui décrit une scène filmée : une personne en action (« un jeune
 * entrepreneur qui travaille sur son ordinateur », « une femme qui cuisine ») ou un plan filmé
 * nommé (« plan cinématographique », « footage »). Plus strict que `mediaOfScene` : un mot seul
 * (« nos clients ») n'appelle pas de clip.
 */
export function describesFilmedAction(text: string): boolean {
  const t = String(text || '');
  if (/plan (?:cin[ée]matographique|film[ée])|cin[ée]matographi|\bfilm[ée]e?s?\b|live[- ]action|\bcinematic\b|\bfootage\b|\bfilmed\b/i.test(t)) return true;
  return /\b(?:un|une|des|le|la|les|a|an|the|our|nos|notre)\s+(?:jeunes?\s+|young\s+)?(?:hommes?|femmes?|entrepreneurs?|entrepreneuses?|enfants?|familles?|clients?|clientes?|vendeu(?:r|se)s?|commer[çc]antes?|personnages?|man|men|woman|women|founders?|family|customers?|people|chef|cuisini[èe]re?s?|coiffeu(?:r|se)s?|artisans?)\b[^.\n]{0,60}?\b(?:qui|who|en train de|that|is|are)\s+\p{L}+/iu.test(t);
}

/** Les supports d'une scène, dans l'ordre où sa description les appelle (règles du code). */
export function mediaOfScene(description: string, opts: { last?: boolean; label?: string; texts?: string[] } = {}): SpecMedium[] {
  const d = `${opts.label || ''} ${description}`;
  const found: { medium: SpecMedium; at: number }[] = [];
  const at = (re: RegExp) => {
    const m = d.match(re);
    return m && m.index != null ? m.index : -1;
  };
  const footage = at(FOOTAGE_HINT);
  const screen = at(SCREEN_HINT);
  const motion = at(MOTION_HINT);
  const logo = at(LOGO_HINT);
  // La signature est la dernière scène qui parle du logo (au milieu du film, un logo qui se révèle est du motion design).
  if (logo >= 0 && (opts.last || /signature|final|fin\b|end/i.test(opts.label || ''))) return ['logo'];
  if (footage >= 0) found.push({ medium: 'footage', at: footage });
  if (screen >= 0) found.push({ medium: 'screen', at: screen });
  if (motion >= 0 || logo >= 0) found.push({ medium: 'motion', at: Math.min(...[motion, logo].filter((x) => x >= 0)) });
  found.sort((a, b) => a.at - b.at);
  const media = found.map((f) => f.medium);
  if (!media.length) return ['motion'];
  // Des textes à l'écran sans motion design nommé : ils se posent sur le dernier plan.
  return media;
}

// ─── L'analyse ──────────────────────────────────────────────────────────────

/**
 * Une ligne de titre de section (Markdown, ou capitales de deux mots au moins) — qui n'est pas une
 * scène. Une ligne en gras (« **IDEM** ») est un texte à l'écran, jamais un titre.
 */
function headingLevel(line: string): number {
  const md = line.match(/^\s*(#{1,6})\s/);
  if (md) return md[1].length;
  if (/^\s*(?:\*\*|__|[-*•]\s)/.test(line)) return 0;
  // « TEXTE À L'ÉCRAN : » est l'annonce d'un bloc de textes, pas une section.
  if (TEXT_LABEL.test(plainLine(line)) || VOICE_LABEL.test(plainLine(line))) return 0;
  const p = plainLine(line).replace(/\s*:$/, '');
  if (p.length >= 6 && p.length <= 70 && p.split(/\s+/).length >= 2 && !quotesIn(p).length && !/[\d/:.]/.test(p) && /\p{Lu}/u.test(p) && p === p.toUpperCase() && /\p{L}{3}/u.test(p)) return 2;
  return 0;
}

const SCENE_LINE = /^(?:sc[eè]ne|scene|plan|shot|s[ée]quence|sequence|partie|part|acte?|segment|tableau)\s*(\d{1,2})\b\s*(.*)$/iu;

/** Une ligne de titre de scène (« ### SCÈNE 1 — L'IDÉE (00:00–00:08) », « Plan 2 : … »). */
export function sceneHeading(line: string): { n: number; rest: string } | null {
  if (!line || line.length > 170) return null;
  const marked = /^\s*(?:#{1,6}\s|\*\*|__)/.test(line);
  const p = plainLine(line);
  const m = p.match(SCENE_LINE);
  if (!m) return null;
  const rest = m[2].trim();
  // « Plan 2 : … » ou « SCÈNE 1 — … » ; jamais « plan 3 fois plus rapide » au fil d'une phrase.
  if (!marked && rest && !/^[—–:.\-)|(]/.test(rest) && !timeRange(rest)) return null;
  return { n: Number(m[1]), rest };
}

/** Une ligne de minutage seule (« 0-5 s : le produit », « [00:05–00:10] — … »). */
function timelineLine(line: string): { range: { start: number; end: number }; rest: string } | null {
  const p = plainLine(line);
  const m = p.match(/^\[?\(?((?:\d{1,2}[:h]\d{2}|\d{1,3}(?:[.,]\d)?\s*s?)\s*(?:[–—-]+|à|to)\s*(?:\d{1,2}[:h]\d{2}|\d{1,3}(?:[.,]\d)?\s*(?:s|sec|secondes?|seconds?)))\)?\]?\s*[:—–-]?\s*(.*)$/iu);
  if (!m) return null;
  const range = timeRange(/\d[:h]\d/.test(m[1]) ? m[1] : `${m[1]}${/s|sec/i.test(m[1]) ? '' : ' s'}`);
  return range ? { range, rest: m[2] } : null;
}

const TEXT_LABEL = /^(?:textes?|texts?|on[- ]screen(?:\s+texts?)?|incrustations?|titres?|title|headline|sous[- ]titres?|captions?|overlay|afficher(?:\s+clairement)?|à l['’]écran|carton|super|slogan|tagline|accroche|mention)\b[^:\n]{0,48}:\s*(.*)$/iu;
const VOICE_LABEL = /^(?:voix[\s-]*off|vo|narrat(?:eur|rice|ion|or)|voice[\s-]*over|commentaire|dialogue)\b[^:\n]{0,30}:\s*(.*)$/iu;
const TEXT_INLINE_LABEL = /^(?:textes?|texts?|titres?|title|headline|slogan|accroche|caption|message|mention)\b[^«“"\n:]{0,24}[«“"]/iu;

/** Une ligne qui appartient à un bloc de textes : citation, gras seul, adresse web, puce courte. */
function isTextLine(raw: string): boolean {
  const t = raw.trim();
  const p = plainLine(t);
  if (!p) return false;
  if (/^[«“"].*[»”"][.!?]?$/.test(p)) return true;
  if (/^\*\*[^*]{1,140}\*\*$/.test(t) || /^__[^_]{1,140}__$/.test(t)) return true;
  if (/^(?:https?:\/\/|www\.)\S+$/i.test(p)) return true;
  if (/^\s*[-*•]\s+/.test(t) && quotesIn(t).length) return true;
  return false;
}

/** Les textes d'une ligne de bloc : ses citations, sinon la ligne elle-même (gras, adresse). */
function textsOfLine(raw: string): string[] {
  const q = quotesIn(raw);
  if (q.length) return q;
  const p = plainLine(raw).replace(/^[«“"]|[»”"]$/g, '').trim();
  return p && p.length <= 160 ? [p] : [];
}

/** Les textes DANS l'image d'une ligne de description : citations, liste en capitales après « : ». */
function propsOfLine(line: string): string[] {
  const out = quotesIn(line);
  const list = line.match(/:\s*((?:[\p{Lu}0-9][\p{Lu}0-9 '’&/-]{1,40},\s*){2,}[\p{Lu}0-9][\p{Lu}0-9 '’&/-]{1,40})\s*\.?\s*$/u);
  if (list) out.push(...list[1].split(/,\s*/).map((s) => s.trim()).filter(Boolean));
  return out;
}

/** Ce qui se dit « à éviter » : une ligne qui commence par une négation. */
const AVOID_LINE = /^(?:ne\s+(?:pas|jamais|plus)|n['’]\p{L}+\s+(?:pas|jamais)|pas\s+d[e'’]|aucun(?:e)?\b|jamais\b|[ée]vite[rz]?\b|interdit|do\s+not\b|don['’]t\b|never\b|no\s+\p{L}|avoid\b|without\b)/iu;

/** Les phrases qui décrivent les personnages (repli du lecteur pour la cohérence des plans filmés). */
const CAST_SENTENCE = /\b(?:personnages?|protagoniste|h[ée]ros|h[ée]ro[ïi]ne|acteurs?|actrices?|entrepreneur|entrepreneuse|character|actor|main character|cast)\b/iu;
/** …et qui le décrit (âge, origine, apparence), pas seulement qui le fait agir. */
const CAST_TRAIT = /\b(?:jeunes?|[âa]g[ée]e?s?|\d{2}\s*ans|noire?s?|africaine?s?|blanche?s?|m[ée]tisse?s?|asiatiques?|barbe|cheveux|tresses|tenue|habill[ée]e?|porte|exclusivement|young|old|aged|black|african|white|asian|beard|hair|braids|wearing|dressed|years)\b/iu;

/** Les citations exigées hors scénario : « avec le texte « … » », « slogan : « … » ». */
const INLINE_TEXT = /(?:texte|titre|slogan|accroche|message|phrase|mention|afficher|[ée]crire|inscrire|\btext\b|headline|tagline|caption|that reads|saying)\b[^«“"\n]{0,30}[«“"]\s*([^»”"\n]{1,160}?)\s*[»”"]/giu;

export interface ParseOptions {
  /** Langues de repli, dans l'ordre (interface, puis marque). */
  fallbackLanguages?: (string | undefined)[];
}

/** La demande lue par le code seul (sans modèle). */
export function parseRequest(raw: string, opts: ParseOptions = {}): RequestSpec {
  const text = normalizeNewlines(raw).slice(0, MAX_REQUEST_CHARS);
  const lines = text.split('\n');
  const guess = resolveLanguage(text, opts.fallbackLanguages || []);
  const explicit = explicitLanguage(text);

  // 1. Les scènes : titres de scène, sinon lignes de minutage.
  type Head = { at: number; n: number; rest: string; level: number; range?: { start: number; end: number } };
  let heads: Head[] = [];
  lines.forEach((line, i) => {
    const h = sceneHeading(line);
    if (h) heads.push({ at: i, n: h.n, rest: h.rest, level: headingLevel(line) || 7, range: timeRange(h.rest) });
  });
  if (heads.length < 2) {
    const timed: Head[] = [];
    lines.forEach((line, i) => {
      const t = timelineLine(line);
      if (t) timed.push({ at: i, n: timed.length + 1, rest: t.rest, level: 7, range: t.range });
    });
    if (timed.length >= 2) heads = timed;
  }
  const isTimeline = heads.length >= 2 && heads.every((h) => !sceneHeading(lines[h.at]));
  const inScene = new Set<number>();
  const scenes: SpecScene[] = [];
  if (heads.length >= 2) {
    heads.forEach((h, k) => {
      const next = heads[k + 1]?.at ?? lines.length;
      let end = next;
      // Une section du même niveau (ou plus haute) qui n'est pas une scène clôt le scénario.
      for (let i = h.at + 1; i < next; i++) {
        const level = headingLevel(lines[i]);
        if (level && level <= h.level && !sceneHeading(lines[i])) {
          end = i;
          break;
        }
        if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i]) && k === heads.length - 1) {
          end = i;
          break;
        }
      }
      for (let i = h.at; i < end; i++) inScene.add(i);
      const body = lines.slice(h.at + 1, end);
      const scene: SpecScene = { index: k, description: '', texts: [], props: [], voice: [], media: [] };
      const label = plainLine(h.rest.replace(/\(?\s*\d{1,2}[:h]\d{2}[^)]*\)?/g, '').replace(/\(?\s*\d{1,3}\s*(?:s|sec)?\s*(?:[–—-]|à|to)\s*\d{1,3}\s*(?:s|sec|secondes?)\)?/gi, ''))
        .replace(/^[—–:.\-|)\s]+|[—–:.\-|(\s]+$/g, '')
        .trim();
      // « SCÈNE 1 — L'IDÉE » nomme la scène ; « Scene 1: A young woman walks… » la décrit déjà.
      const describes = isTimeline || label.split(/\s+/).length > 4 || /[.!?»"]$/.test(label) || /https?:\/\/|www\.|\d/.test(label);
      if (label && describes) body.unshift(isTimeline ? h.rest : label);
      else if (label) scene.label = label.slice(0, 60);
      if (h.range) {
        scene.start = h.range.start;
        scene.end = h.range.end;
      }
      const desc: string[] = [];
      let block: 'text' | 'voice' | null = null;
      for (const rawLine of body) {
        const line = rawLine.trim();
        if (!line) continue;
        const p = plainLine(line);
        const voiceLabel = p.match(VOICE_LABEL);
        const textLabel = voiceLabel ? null : p.match(TEXT_LABEL);
        const label = voiceLabel || textLabel;
        if (label) {
          block = voiceLabel ? 'voice' : 'text';
          const rest = label[1].trim();
          if (rest) (block === 'voice' ? scene.voice : scene.texts).push(...textsOfLine(rest));
          continue;
        }
        if (block && isTextLine(line)) {
          (block === 'voice' ? scene.voice : scene.texts).push(...textsOfLine(line));
          continue;
        }
        block = null;
        // « texte « 5 000 FCFA seulement » », « Title "Fresh every morning" » : sans deux-points.
        if (TEXT_INLINE_LABEL.test(p) && quotesIn(p).length) {
          scene.texts.push(...quotesIn(p));
          continue;
        }
        // Une citation seule hors bloc (« saisit : » puis « Je veux lancer mon business. ») est un
        // texte DANS l'image (interface, saisie) ; un minutage dans la description n'y reste pas.
        scene.props.push(...propsOfLine(line));
        if (!scene.start && !scene.end) {
          const r = timeRange(p);
          if (r && p.length < 40) {
            scene.start = r.start;
            scene.end = r.end;
            continue;
          }
        }
        desc.push(p);
      }
      scene.description = desc.join(' ').replace(/\s+/g, ' ').trim().slice(0, 900);
      // La signature qui cite une adresse web sans bloc de texte : l'adresse est à l'écran.
      const lastScene = k === heads.length - 1;
      if (lastScene && !scene.texts.some((t) => /https?:\/\/|www\.|\.[a-z]{2,}\b/i.test(t))) {
        const site = scene.description.match(/\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|africa|net|org|io|co|app|shop|store|ci|sn|cm|ng|gh|ke|ma|tn|dz|bj|tg|bf|ml|ne|ga|cd|cg|rw|ug|tz|za|fr|be|ch|ca)\b(?:\/\S*)?/i);
        if (site) scene.texts.push(site[0].replace(/[.,;)]+$/, ''));
      }
      scene.texts = dedupe(scene.texts).slice(0, 12);
      scene.props = dedupe(scene.props.filter((x) => !scene.texts.some((t) => sameText(t, x)))).slice(0, 16);
      scene.voice = dedupe(scene.voice).slice(0, 6);
      scene.media = mediaOfScene(scene.description, { last: k === heads.length - 1, label: scene.label, texts: scene.texts });
      scenes.push(scene);
    });
  }

  // 2. Les sections hors scénario : titre, objectif, consignes.
  let title: string | undefined;
  let section = '';
  const sections: Record<string, string[]> = {};
  lines.forEach((line, i) => {
    if (inScene.has(i)) return;
    const level = headingLevel(line);
    if (level) {
      const p = plainLine(line);
      if (!title && /^\s*#\s/.test(line)) title = p.replace(/^(?:prompt|brief|demande|request)\s*[—–:-]+\s*/i, '').trim();
      section = p.toLowerCase();
      return;
    }
    const p = plainLine(line);
    if (p) (sections[section] ||= []).push(p);
  });
  const sectionLines = (re: RegExp) => Object.entries(sections).filter(([name]) => re.test(name)).flatMap(([, v]) => v);
  const header = /^(?:dur[ée]e|duration|format|style|langue|language|ton|tone|cible|target|public|audience)\s*:/i;
  const objectiveLines = sectionLines(/objectif|objective|goal|\bbut\b|brief|contexte|context|pitch|concept|intention/);
  const looseProse = Object.values(sections)
    .flat()
    .filter((l) => !header.test(l) && !AVOID_LINE.test(l) && l.split(/\s+/).length >= 6);
  const objective = (objectiveLines.length ? objectiveLines : looseProse).join(' ').replace(/\s+/g, ' ').trim().slice(0, 600) || undefined;

  // 3. Consignes : à éviter (partout, phrase par phrase), à faire (sections de direction et de contraintes).
  const allPlain = lines.map((l) => plainLine(l)).filter(Boolean);
  const sentences = allPlain.flatMap((l) => l.split(/(?<=[.!?])\s+(?=\p{Lu})/u)).map((s) => s.trim()).filter(Boolean);
  const avoid = dedupe(sentences.filter((l) => AVOID_LINE.test(l)).map((l) => l.slice(0, 220))).slice(0, 14);
  const musts = dedupe(
    sectionLines(/direction|style|ton\b|tone|contrainte|constraint|r[èe]gle|rule|exigence|requirement|consigne|guideline|identit[ée]|charte/)
      .filter((l) => !AVOID_LINE.test(l) && !/^(?:la dur[ée]e|the duration)/i.test(l))
      .map((l) => l.slice(0, 200))
  ).slice(0, 12);

  // 4. Textes exigés hors scénario (une demande courte : « avec le slogan « … » »).
  const required: string[] = [];
  if (!scenes.length) {
    for (const m of text.matchAll(INLINE_TEXT)) required.push(m[1].trim());
    let block = false;
    for (const line of lines) {
      const p = plainLine(line);
      if (!p) continue;
      const label = p.match(TEXT_LABEL);
      if (label) {
        block = true;
        required.push(...quotesIn(label[1]));
        continue;
      }
      if (block && isTextLine(line)) required.push(...quotesIn(line));
      else block = false;
    }
  }

  // 5. Musique (la ligne qui la décrit, pas celle qui la cite), voix off, personnages.
  const musicLines = allPlain.filter((l) => /musique|music|bande[- ]son|soundtrack|ambiance sonore/i.test(l) && !/^(?:sans|no)\b/i.test(l));
  const music = (musicLines.find((l) => /^(?:musique|music|bande[- ]son|soundtrack|ambiance sonore)\b/i.test(l)) || musicLines.find((l) => moodOfMusic(l)) || musicLines[0])?.slice(0, 220);
  const noVoice = /(?:^|[^\p{L}])(?<!m[êe]me\s)(?<!even\s)(?:pas de voix[\s-]*off|aucune voix[\s-]*off|sans voix[\s-]*off|no voice[\s-]*over|without (?:a |any )?voice[\s-]*over)/iu.test(text);
  const wantsVoice = /(?:avec|with)\s+(?:une\s+|a\s+)?(?:voix[\s-]*off|voice[\s-]*over|narrat)|(?:^|\n)[\s*_-]*(?:voix[\s-]*off|voice[\s-]*over)\s*:/iu.test(text) || scenes.some((s) => s.voice.length);
  const cast = dedupe(sentences.filter((s) => CAST_SENTENCE.test(s) && CAST_TRAIT.test(s)).map((s) => s.slice(0, 200)))
    .slice(0, 3)
    .join(' ');

  const durationFromScenes = scenes.length && scenes[scenes.length - 1].end ? scenes[scenes.length - 1].end : undefined;
  return {
    v: 1,
    language: guess.code,
    languageSource: guess.source,
    ...(explicit.voice ? { voiceLanguage: explicit.voice } : {}),
    mode: scenes.length >= 2 ? 'script' : 'brief',
    ...(title ? { title: title.slice(0, 120) } : {}),
    ...(objective ? { objective } : {}),
    ...(durationIn(text) || durationFromScenes ? { durationSec: durationIn(text) || durationFromScenes } : {}),
    ...(formatIn(text) ? { format: formatIn(text) } : {}),
    unsupported: unsupportedIn(text),
    scenes,
    texts: dedupe(required).slice(0, 8),
    musts,
    avoid,
    colors: colorsIn(text),
    ...(music ? { music, ...(moodOfMusic(music) ? { musicMood: moodOfMusic(music) } : {}) } : {}),
    ...(cast ? { cast } : {}),
    ...(noVoice ? { voiceOver: 'none' as const } : wantsVoice ? { voiceOver: 'wanted' as const } : {}),
    source: 'parser',
  };
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((v) => {
    const k = normText(v);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** La phrase qui résume la demande (le « message » du brief) : l'objectif, sinon le titre, sinon le début. */
export function requestMessage(spec: RequestSpec, raw: string): string {
  const first = (s?: string) => (s || '').split(/(?<=[.!?])\s+/)[0]?.trim() || '';
  const fallback = normalizeNewlines(raw)
    .split('\n')
    .map(plainLine)
    .find((l) => l.length >= 8 && !/^(?:dur[ée]e|format|style|langue|language)\s*:/i.test(l));
  return (first(spec.objective) || spec.title || fallback || String(raw || '').trim()).replace(/\s+/g, ' ').slice(0, 400);
}

// ─── Le minutage du scénario ────────────────────────────────────────────────

/**
 * Le temps de chaque scène du scénario, ramené à la durée achetée : le minutage écrit d'abord,
 * à l'échelle si la durée diffère ; les scènes sans minutage se partagent le reste au prorata
 * de ce qu'elles ont à montrer. Chaque scène garde au moins 1,6 s (2,2 s pour la signature).
 */
export function sceneTimeline(spec: RequestSpec, total: number): { start: number; duration: number }[] {
  const n = spec.scenes.length;
  if (!n) return [];
  const written = spec.scenes.map((s) => (s.start != null && s.end != null && s.end > s.start ? s.end - s.start : undefined));
  const weight = (s: SpecScene) => 2.5 + s.texts.join(' ').split(/\s+/).filter(Boolean).length / 3 + (s.media.includes('footage') ? 1.5 : 0);
  const knownSum = written.reduce<number>((a, d) => a + (d || 0), 0);
  const unknown = spec.scenes.map((s, i) => (written[i] ? 0 : weight(s)));
  const unknownWeight = unknown.reduce((a, b) => a + b, 0);
  // Le scénario dit sa durée (dernière fin, ou durée écrite) ; sinon, la durée achetée.
  const scriptTotal = Math.max(knownSum, spec.durationSec || 0, unknownWeight ? knownSum + unknownWeight * 1.2 : knownSum) || total;
  const rest = Math.max(0, scriptTotal - knownSum);
  let durations = spec.scenes.map((_, i) => written[i] ?? (unknownWeight ? (rest * unknown[i]) / unknownWeight : 0));
  const sum = durations.reduce((a, b) => a + b, 0) || 1;
  durations = durations.map((d) => (d * total) / sum);
  const floor = (i: number) => (spec.scenes[i].media[0] === 'logo' ? Math.min(2.2, total / n) : Math.min(1.6, total / n));
  for (let pass = 0; pass < 4; pass++) {
    const short = durations.map((d, i) => Math.max(0, floor(i) - d));
    const need = short.reduce((a, b) => a + b, 0);
    if (need < 0.01) break;
    const room = durations.map((d, i) => Math.max(0, d - floor(i) - 0.5));
    const roomSum = room.reduce((a, b) => a + b, 0);
    if (roomSum <= 0) break;
    durations = durations.map((d, i) => (short[i] > 0 ? floor(i) : d - (need * room[i]) / roomSum));
  }
  let start = 0;
  const out = durations.map((d) => {
    const at = Math.round(start * 1000) / 1000;
    start += d;
    return { start: at, duration: Math.round(d * 1000) / 1000 };
  });
  const last = out[out.length - 1];
  last.duration = Math.round((total - last.start) * 1000) / 1000;
  return out;
}

// ─── L'agent lecteur ────────────────────────────────────────────────────────

/** Ce que le lecteur ajoute (supports, plans filmés, personnage, lumière, musique). */
export function buildReaderPrompt(spec: RequestSpec, raw: string): { system: string; user: string } {
  const system = [
    'You read a client brief for a short brand video and tell the production team WHAT to produce for each scene and WITH WHICH TOOL.',
    'TOOLS: footage = a filmed live-action shot made by an AI video generator (people, places, real gestures) · screen = the brand\'s real product interface (screenshots of its website or app) · motion = motion design coded by our engine (typography, shapes, lines, charts, transitions) · logo = the brand signature.',
    'Output ONLY these lines (English, never translate or rewrite the client\'s on-screen texts):',
    'cast: the recurring person(s) of the filmed shots — age, skin tone, hair, clothes, attitude — so a video model shows the SAME person every time; or none',
    'look: light, palette, lens and mood shared by every filmed shot',
    'music: one of upbeat | calm | epic | corporate | afro | none',
    'N.media: the tools scene N needs, in the order they appear, comma separated (footage, screen, motion, logo)',
    'N.footage: (only when scene N uses footage) what the video model must film — subject, action, setting, framing, camera move, light; concrete; no text, no logo, no readable screen; max 60 words',
    'N.query: (only when scene N uses footage) 2 to 4 words to find a similar clip in a stock video library',
    'Rules: never add a scene; respect every constraint of the brief (who appears, what to avoid); a person typing on a laptop is footage, the laptop\'s interface itself is screen.',
  ].join('\n');
  const scenes = spec.scenes.map((s, i) => `${i + 1}. ${s.label ? `${s.label} — ` : ''}${s.description.slice(0, 500)}${s.texts.length ? ` | on-screen: ${s.texts.map((t) => `"${t}"`).join(' / ')}` : ''}`);
  const user = [`BRIEF:\n${normalizeNewlines(raw).slice(0, 9000)}`, scenes.length ? `SCENES:\n${scenes.join('\n')}` : 'SCENES: none written (answer cast, look and music only)'].join('\n\n');
  return { system, user };
}

/** Une description de plan filmé utilisable : sans texte à imprimer, sans marque d'autrui. */
export function cleanFootage(value: string, max = 420): string {
  return String(value || '')
    .replace(/["«»“”`*_#]/g, '')
    .replace(/\b(?:text|caption|logo|watermark|letters?|signage|subtitles?|sign that reads)\b[^,.]*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Les réponses du lecteur, validées, fusionnées dans le cahier des charges. */
export function mergeReader(spec: RequestSpec, raw: string): RequestSpec | null {
  const text = String(raw || '').replace(/```[a-z]*\n?/gi, '');
  if (!text.trim()) return null;
  const kv = agentLines(text);
  const out: RequestSpec = { ...spec, scenes: spec.scenes.map((s) => ({ ...s })) };
  let kept = 0;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^[\s*_#>-]*(?:scene\s*)?(\d{1,2})\s*[.)]\s*(media|footage|query)\s*[:=]\s*(.+)$/i);
    if (!m) continue;
    const scene = out.scenes[Number(m[1]) - 1];
    if (!scene) continue;
    const key = m[2].toLowerCase();
    const value = m[3].trim();
    if (key === 'media') {
      const media = [...new Set(value.toLowerCase().split(/[,;/+&]|\band\b/).map((x) => x.trim()).filter((x): x is SpecMedium => (SPEC_MEDIA as string[]).includes(x)))];
      if (media.length) {
        // La signature reste la signature ; un plan filmé n'apparaît que si la scène montre une action réelle.
        scene.media = scene.media[0] === 'logo' && scene.index === out.scenes.length - 1 ? ['logo'] : media;
        kept++;
      }
    } else if (key === 'footage') {
      const shot = cleanFootage(value);
      if (shot.split(/\s+/).length >= 5) {
        scene.footage = shot;
        kept++;
      }
    } else {
      const q = cleanFootage(value, 48).split(/\s+/).slice(0, 5).join(' ');
      if (q) scene.query = q;
    }
  }
  // Une scène sans plan filmé n'en garde pas la description.
  for (const s of out.scenes) {
    if (!s.media.includes('footage')) {
      delete s.footage;
      delete s.query;
    }
  }
  const cast = cleanFootage(kv.cast || '', 300);
  if (cast && !/^none\b/i.test(cast)) {
    out.cast = cast;
    kept++;
  }
  const look = cleanFootage(kv.look || '', 240);
  if (look && !/^none\b/i.test(look)) {
    out.look = look;
    kept++;
  }
  const mood = (kv.music || '').toLowerCase().match(/upbeat|calm|epic|corporate|afro|none/)?.[0] as MusicMood | undefined;
  // La musique écrite par l'utilisateur passe avant celle que le lecteur devine.
  if (mood && !spec.musicMood) out.musicMood = mood;
  if (!kept) return null;
  return { ...out, source: 'reader' };
}

/**
 * La demande lue : le code, puis le lecteur quand la demande est un scénario ou une longue
 * consigne (au moins une scène filmée ou 600 signes). Le lecteur en panne ne bloque rien.
 */
export async function readRequest(raw: string, opts: ParseOptions & { writer?: CopyWriter; skipReader?: boolean } = {}): Promise<{ spec: RequestSpec; tokens: { input: number; output: number }; ms: number; source: 'parser' | 'reader' }> {
  const spec = parseRequest(raw, opts);
  const worth = spec.mode === 'script' || String(raw || '').length >= 600;
  if (!opts.writer || opts.skipReader || !worth) return { spec, tokens: { input: 0, output: 0 }, ms: 0, source: 'parser' };
  const prompt = buildReaderPrompt(spec, raw);
  const started = Date.now();
  let answer = '';
  try {
    answer = await Promise.race([opts.writer(prompt.system, prompt.user), new Promise<string>((_, reject) => setTimeout(() => reject(new Error('reader_timeout')), 40000))]);
  } catch {
    answer = '';
  }
  const merged = mergeReader(spec, answer);
  return {
    spec: merged || spec,
    tokens: { input: Math.ceil((prompt.system.length + prompt.user.length) / 4), output: Math.ceil(answer.length / 4) },
    ms: Date.now() - started,
    source: merged ? 'reader' : 'parser',
  };
}

// ─── Ce que les agents reçoivent ────────────────────────────────────────────

/** Les consignes de l'utilisateur, en quelques lignes, pour tous les agents (directeur, codeurs, critique). */
export function specConstraints(spec: RequestSpec | undefined): string {
  if (!spec) return '';
  const lines = [
    spec.musts.length ? `CLIENT MUSTS: ${spec.musts.slice(0, 8).join(' · ')}` : '',
    spec.avoid.length ? `CLIENT FORBIDS: ${spec.avoid.slice(0, 10).join(' · ')}` : '',
    spec.cast ? `CAST (same person in every filmed shot): ${spec.cast}` : '',
    spec.look ? `LOOK OF FILMED SHOTS: ${spec.look}` : '',
    spec.colors.length ? `COLOURS NAMED BY THE CLIENT: ${spec.colors.map((c) => `${c.name ? `${c.name} ` : ''}${c.hex}`).join(', ')}` : '',
    spec.music ? `MUSIC WANTED: ${spec.music}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

/** Les mots interdits par la demande, pour les modèles d'image et de vidéo (« no robots, no holograms »). */
export function negativeCues(spec: RequestSpec | undefined): string {
  if (!spec) return '';
  const words = new Set<string>();
  const all = spec.avoid.join(' ').toLowerCase();
  if (/robot/.test(all)) words.add('no robots');
  if (/hologra/.test(all)) words.add('no holograms');
  if (/futuris/.test(all)) words.add('no futuristic sci-fi effects');
  if (/g[ée]n[ée]rique|generic|ia\b|\bai\b/.test(all)) words.add('no generic AI imagery');
  if (/richesse|luxe|wealth|luxury|argent|money/.test(all)) words.add('no displays of wealth');
  if (/texte|text/.test(all)) words.add('no text');
  return [...words].join(', ');
}

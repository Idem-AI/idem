/**
 * LA LANGUE D'UNE DEMANDE — celle que l'utilisateur écrit, pas celle de l'interface.
 *
 * Une vidéo (un visuel) se fait dans la langue de la demande : une page en anglais et une demande
 * en français donnent une vidéo en français, voix off comprise. Ordre de décision :
 *
 *   1. une consigne explicite (« Langue : français », « vidéo en anglais », « in English ») ;
 *   2. la langue du texte : alphabet (arabe, éthiopien, chinois…), puis mots outils et
 *      signes propres à chaque langue (élisions et guillemets français, ñ, ß…) ;
 *   3. les replis donnés par l'appelant (langue de l'interface, puis de la marque), seulement
 *      quand le texte est trop court ou trop mêlé pour trancher.
 *
 * Rien ici n'appelle un modèle : c'est rapide, gratuit et déterministe.
 */

export interface LanguageGuess {
  /** Code court (ISO 639-1 quand il existe : fr, en, es, pt, ar, sw, wo…). */
  code: string;
  /** D'où vient la décision. */
  source: 'explicit' | 'detected' | 'fallback';
  /** Confiance de la détection (1 pour une consigne explicite). */
  confidence: number;
}

/** Noms de langues (dans plusieurs langues) → code. L'ordre compte : le premier qui tient gagne. */
const NAMES: [RegExp, string][] = [
  [/^(?:fran[çc]ais|french|franc[ée]s|francese|franz[öo]sisch|kifaransa|fr)$/i, 'fr'],
  [/^(?:anglais|english|ingl[ée]s|inglese|englisch|kiingereza|en)$/i, 'en'],
  [/^(?:espagnol|spanish|espa[ñn]ol|espanhol|spagnolo|spanisch|es)$/i, 'es'],
  [/^(?:portugais|portuguese|portugu[êe]s|portoghese|portugiesisch|pt)$/i, 'pt'],
  [/^(?:arabe|arabic|[áa]rabe|arabo|arabisch|kiarabu|ar)$/i, 'ar'],
  [/^(?:swahili|kiswahili|sw)$/i, 'sw'],
  [/^(?:allemand|german|alem[áa]n|alem[ãa]o|tedesco|deutsch|de)$/i, 'de'],
  [/^(?:italien|italian|italiano|italienisch|it)$/i, 'it'],
  [/^(?:chinois|chinese|chino|chin[êe]s|cinese|chinesisch|mandarin|zh)$/i, 'zh'],
  [/^(?:wolof|wo)$/i, 'wo'],
  [/^(?:lingala|ln)$/i, 'ln'],
  [/^(?:haoussa|hausa|ha)$/i, 'ha'],
  [/^(?:yoruba|yor[ùu]b[áa]|yo)$/i, 'yo'],
  [/^(?:amharique|amharic|am)$/i, 'am'],
  [/^(?:zoulou|zulu|zu)$/i, 'zu'],
  [/^(?:bambara|bm)$/i, 'bm'],
  [/^(?:peul|pulaar|fulfulde|fula|ff)$/i, 'ff'],
  [/^(?:igbo|ig)$/i, 'ig'],
  [/^(?:kinyarwanda|rw)$/i, 'rw'],
  [/^(?:malgache|malagasy|mg)$/i, 'mg'],
];

/** « version française » : l'adjectif → code. */
const ADJECTIVES: Record<string, string> = { francaise: 'fr', anglaise: 'en', espagnole: 'es', portugaise: 'pt', arabe: 'ar', allemande: 'de', italienne: 'it', chinoise: 'zh' };

const LANGUAGE_WORD =
  'fran[çc]ais|french|anglais|english|espagnol|spanish|espa[ñn]ol|portugais|portuguese|portugu[êe]s|arabe|arabic|swahili|kiswahili|allemand|german|deutsch|italien|italian|italiano|chinois|chinese|mandarin|wolof|lingala|haoussa|hausa|yoruba|amharique|amharic|zoulou|zulu|bambara|peul|pulaar|fulfulde|igbo|kinyarwanda|malgache|malagasy';

/** Le code d'un nom de langue (« français », « English », « fr »), sinon `undefined`. */
export function languageCode(name: string | undefined): string | undefined {
  const n = (name || '').trim().replace(/[*_.,;:!?)»"'’]+$/g, '').replace(/^[*_("«'‘]+/g, '');
  if (!n) return undefined;
  for (const [re, code] of NAMES) if (re.test(n)) return code;
  return undefined;
}

/** Ce que le texte dit en toutes lettres de sa langue : la vidéo, puis la voix off si elle diffère. */
export function explicitLanguage(text: string): { language?: string; voice?: string } {
  const t = String(text || '');
  const out: { language?: string; voice?: string } = {};
  // « Langue : français », « **Language:** English », « Langue de la vidéo : anglais ».
  const field = t.match(new RegExp(`(?:^|\\n)[\\s*_#>\\-•]*(?:langue|language|langage|idioma|lingua|sprache|lugha)(?:\\s+(?:de la vid[ée]o|du film|des textes|of the video|du rendu))?[\\s*_]*[:=][\\s*_]*(${LANGUAGE_WORD})\\b`, 'iu'));
  if (field) out.language = languageCode(field[1]);
  // « voix off en anglais », « voice-over in French » : la langue de la voix.
  const voice = t.match(new RegExp(`(?:voix[\\s-]*off|narration|narrateur|voice[\\s-]*over|narrator)[^.\\n]{0,24}?\\b(?:en|in)\\s+(${LANGUAGE_WORD})\\b`, 'iu'));
  if (voice) out.voice = languageCode(voice[1]);
  if (!out.language) {
    // « une vidéo en anglais », « les textes en wolof », « tout en français », « version anglaise ».
    const inline = t.match(new RegExp(`\\b(?:vid[ée]o|film|clip|textes?|sous[\\s-]*titres?|version|rendu|tout|message|video|texts?|subtitles?|captions?)\\b[^.\\n]{0,30}?\\b(?:en|in)\\s+(${LANGUAGE_WORD})\\b`, 'iu'));
    if (inline) out.language = languageCode(inline[1]);
  }
  if (!out.language) {
    const english = t.match(new RegExp(`\\b(${LANGUAGE_WORD})\\s+(?:video|version|voice[\\s-]*over|subtitles|captions|copy)\\b`, 'iu'));
    if (english) out.language = languageCode(english[1]);
  }
  if (!out.language) {
    const adjective = t.match(/\bversion\s+(fran[çc]aise|anglaise|espagnole|portugaise|arabe|allemande|italienne|chinoise)\b/iu);
    if (adjective) out.language = ADJECTIVES[adjective[1].toLowerCase().replace('ç', 'c')];
  }
  // Une voix dans la langue de la vidéo n'a pas à être notée à part.
  if (out.voice && out.voice === out.language) delete out.voice;
  if (out.voice && !out.language) out.language = out.voice;
  return out;
}

/** Mots outils par langue : fréquents, courts, peu partagés. */
const STOPWORDS: Record<string, Set<string>> = Object.fromEntries(
  Object.entries({
    fr: 'le la les des une un et est pour dans avec sur qui que pas plus vous nous ce cette ces son sa ses du au aux par il elle je tu mon ma mes votre vos notre nos être sont où très faire tout toute tous doit comme mais leur aussi si ne avoir sans entre chaque dont puis lorsque quand encore',
    en: 'the and is for in with on to of an that this these those are be you we our your it its not no as by from at or will can should must their have has was what when which into more each every than then there while without about',
    es: 'el los las y es para en con una que del por se su sus no como más muy este esta pero al lo nuestro nuestra usted cada también cuando sin entre',
    pt: 'os as é para em com uma um que do da dos das não como mais muito este esta mas ou ao seu sua você nós cada também quando sem entre',
    de: 'der die das und ist für mit auf ein eine nicht zu den dem von sie wir ihr es im auch als bei oder wie sich noch wird werden',
    it: 'il lo gli le è per con una che del della non come più molto questo questa ma al sono anche ogni quando senza tra',
    sw: 'na ya wa kwa ni za katika hii huu kama lakini sana pia yetu yako wetu kwenye hapa kila',
  }).map(([code, words]) => [code, new Set(words.split(/\s+/))])
);

/** Signes propres à une langue (comptés en plus des mots outils). */
const MARKS: Record<string, RegExp> = {
  fr: /[«»œ]|\b(?:l|d|qu|c|j|n|s|m|t)['’]\p{L}/giu,
  es: /[ñ¿¡]/giu,
  pt: /[ãõ]|\bção\b|ções\b/giu,
  de: /[ßäöü]/giu,
};

/** Alphabets qui suffisent à dire la langue. */
const SCRIPTS: [RegExp, string][] = [
  [/[؀-ۿ]/gu, 'ar'],
  [/[ሀ-፿]/gu, 'am'],
  [/[一-鿿]/gu, 'zh'],
  [/[぀-ヿ]/gu, 'ja'],
  [/[Ѐ-ӿ]/gu, 'ru'],
];

/** La langue d'un texte, ou `undefined` s'il est trop court ou trop mêlé pour trancher. */
export function detectLanguage(text: string): { code: string; confidence: number } | undefined {
  const t = String(text || '')
    .replace(/https?:\/\/\S+|www\.\S+|#[0-9a-f]{3,8}\b/gi, ' ')
    .replace(/[`*_#>|]/g, ' ');
  const letters = (t.match(/\p{L}/gu) || []).length;
  if (!letters) return undefined;
  for (const [re, code] of SCRIPTS) {
    const n = (t.match(re) || []).length;
    if (n / letters > 0.3) return { code, confidence: Math.min(1, n / letters + 0.3) };
  }
  const tokens = t.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
  if (tokens.length < 3) return undefined;
  const scores = Object.keys(STOPWORDS).map((code) => {
    let hits = 0;
    for (const w of tokens) if (STOPWORDS[code].has(w)) hits++;
    const marks = MARKS[code] ? (t.match(MARKS[code]) || []).length : 0;
    return { code, score: (hits + marks * 0.6) / tokens.length, hits: hits + marks };
  });
  scores.sort((a, b) => b.score - a.score);
  const [best, second] = scores;
  if (!best || best.hits < 2 || best.score < 0.06) return undefined;
  const margin = best.score - (second?.score || 0);
  if (second && best.score < second.score * 1.35 && margin < 0.05) return undefined;
  return { code: best.code, confidence: Math.min(1, Math.round((margin * 4 + best.score) * 100) / 100) };
}

/**
 * La langue de la création : consigne explicite, sinon langue du texte, sinon les replis dans
 * l'ordre (interface, marque…), sinon le français.
 */
export function resolveLanguage(text: string, fallbacks: (string | undefined | null)[] = []): LanguageGuess {
  const explicit = explicitLanguage(text).language;
  if (explicit) return { code: explicit, source: 'explicit', confidence: 1 };
  const detected = detectLanguage(text);
  if (detected) return { code: detected.code, source: 'detected', confidence: detected.confidence };
  const fallback = fallbacks.map((f) => languageCode(String(f || '').slice(0, 2)) || (f ? String(f).toLowerCase().slice(0, 2) : '')).find(Boolean);
  return { code: fallback || 'fr', source: 'fallback', confidence: 0 };
}

/** Nom anglais d'une langue (consignes aux modèles). */
export const LANGUAGE_NAMES: Record<string, string> = {
  fr: 'French',
  en: 'English',
  es: 'Spanish',
  pt: 'Portuguese',
  ar: 'Arabic',
  sw: 'Swahili',
  de: 'German',
  it: 'Italian',
  zh: 'Chinese',
  wo: 'Wolof',
  ln: 'Lingala',
  ha: 'Hausa',
  yo: 'Yoruba',
  am: 'Amharic',
  zu: 'Zulu',
  bm: 'Bambara',
  ff: 'Fula',
  ig: 'Igbo',
  rw: 'Kinyarwanda',
  mg: 'Malagasy',
  ja: 'Japanese',
  ru: 'Russian',
};

export const languageName = (code: string | undefined): string => LANGUAGE_NAMES[(code || 'fr').toLowerCase().slice(0, 2)] || 'French';

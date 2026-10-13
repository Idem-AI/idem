/**
 * Ce que le modèle affirme sans que les faits du projet le disent.
 *
 * La consigne « n'invente rien » ne suffit pas : le premier essai réel a donné
 * des horaires (« du lundi au samedi, de 8 h à 18 h »), un rappel « sous
 * 48 heures », une « fenêtre de deux heures », un quartier qui n'existe pas et
 * un formulaire que le site n'a pas. Sur le site d'une vraie entreprise, chacune
 * de ces phrases est une promesse que personne n'a faite.
 *
 * On vérifie donc mécaniquement ce qui se vérifie : les nombres, les durées
 * écrites en lettres, les jours de la semaine, les lieux introduits par une
 * préposition, et — en français — les mots anglais égarés. Tout ce qui n'est
 * pas dans les faits (ou dans la demande de l'utilisateur) est signalé ; la
 * réponse est refusée et le modèle relancé, avec la liste de ce qu'il doit
 * retirer.
 */

/** Petits nombres d'usage courant (« en 2 temps ») : pas des affirmations. */
const SMALL_NUMBERS = new Set(['0', '1', '2', '3']);

const SPELLED_FR = 'deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|quinze|vingt|trente|quarante|cinquante|soixante|cent';
const SPELLED_EN = 'two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|hundred';

/**
 * Bornes de mot qui connaissent les accents. `\b` ne les connaît pas : « thé »
 * y passerait pour l'anglais « the », et « où » couperait un mot en deux.
 */
const START = '(?<![\\p{L}\\d])';
const END = '(?![\\p{L}\\d])';

const DURATION_FR = new RegExp(
  `${START}(?:${SPELLED_FR})\\s+(?:heures?|minutes?|jours?|semaines?|mois|ans|années?)${END}`,
  'gu'
);
const DURATION_EN = new RegExp(
  `${START}(?:${SPELLED_EN})\\s+(?:hours?|minutes?|days?|weeks?|months?|years?)${END}`,
  'gu'
);

const WEEKDAYS = new RegExp(
  `${START}(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?${END}`,
  'gu'
);

/** Un lieu : une préposition, puis un ou plusieurs mots à majuscule. */
const PLACE_FR = /(?:^|[\s(])(?:[àÀ]|[aA]ux?|[eE]n|[dD]ans|[vV]ers|[dD]epuis|[sS]ur|[dD]e|[dD]u|[dD]es)\s+([A-ZÀ-Ý][\p{L}'’-]+(?:\s+[A-ZÀ-Ý][\p{L}'’-]+)*)/gu;
const PLACE_EN = /(?:^|[\s(])(?:[iI]n|[aA]t|[aA]cross|[fF]rom|[nN]ear|[aA]round|[tT]hroughout)\s+([A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+)*)/gu;

/** Noms propres d'usage courant, qui ne sont pas des lieux. */
const NOT_PLACES = new Set([
  'afrique',
  'africa',
  'internet',
  'whatsapp',
  'mobile',
  'orange',
  'mtn',
  'wave',
  'google',
  'facebook',
  'instagram',
  'tiktok',
  'linkedin',
]);

/** Mots anglais qui n'existent pas en français : leur présence trahit un mélange de langues. */
const ENGLISH_WORDS = new RegExp(
  `${START}(?:the|and|with|your|our|then|elsewhere|which|while|also|just|into|about|very|only|each|other|should|would|could|will|this|these|those|there|their|they|what|when|where|here|some|batch|anyway|however|through|without|within)${END}`,
  'gu'
);

/**
 * Texte comparable : minuscules, espaces insécables ramenées à des espaces, et
 * séparateurs de milliers retirés (« 1 500 » et « 1500 » sont le même nombre).
 */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[  ]/g, ' ')
    .replace(/(\d)[ .](?=\d{3}\b)/g, '$1');
}

function textsOf(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => textsOf(item, out));
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      // Les liens et les prix sont posés par le code, à partir des faits.
      if (key === 'href' || key === 'price') continue;
      textsOf(item, out);
    }
  }
  return out;
}

export type FactCheck = (value: unknown) => string[];

/**
 * Prépare la vérification pour un projet : `allowed` réunit les faits et la
 * demande de l'utilisateur, seules sources autorisées.
 */
export function createFactGuard(allowed: string, language: string): FactCheck {
  const reference = normalize(allowed);
  const numbers = new Set(reference.match(/\d+(?:[.,]\d+)?/g) ?? []);
  const fr = language === 'fr';

  return (value: unknown): string[] => {
    const problems = new Set<string>();

    for (const original of textsOf(value)) {
      const text = normalize(original);

      for (const number of text.match(/\d+(?:[.,]\d+)?/g) ?? []) {
        if (!numbers.has(number) && !SMALL_NUMBERS.has(number)) problems.add(number);
      }

      for (const duration of text.match(fr ? DURATION_FR : DURATION_EN) ?? []) {
        if (!reference.includes(duration)) problems.add(duration);
      }

      for (const day of text.match(WEEKDAYS) ?? []) {
        if (!reference.includes(day.replace(/s$/, ''))) problems.add(day);
      }

      for (const match of Array.from(original.matchAll(fr ? PLACE_FR : PLACE_EN))) {
        const place = match[1];
        const first = place.split(/\s+/)[0].toLowerCase();
        if (NOT_PLACES.has(first)) continue;
        if (!reference.includes(first)) problems.add(place);
      }

      if (fr) {
        for (const word of text.match(ENGLISH_WORDS) ?? []) problems.add(word);
      }
    }

    return Array.from(problems);
  };
}

/**
 * Retire d'une réponse les phrases qui portent une affirmation non vérifiée.
 *
 * Dernier recours, quand les essais sont épuisés : une FAQ privée d'une phrase
 * vaut mieux qu'une FAQ absente. Le résultat repasse ensuite la validation de
 * forme, qui écarte ce qui serait devenu vide.
 */
export function stripSentences(value: unknown, problems: string[]): unknown {
  // Chaque élément signalé, cherché comme un mot entier : « then » ne doit pas
  // faire tomber une phrase qui dit « authentique ».
  const patterns = problems.map(
    (problem) =>
      new RegExp(`${START}${normalize(problem).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${END}`, 'u')
  );
  const hits = (sentence: string) => {
    const text = normalize(sentence);
    return patterns.some((pattern) => pattern.test(text));
  };

  const clean = (item: unknown, key?: string): unknown => {
    if (typeof item === 'string') {
      if (key === 'href' || key === 'price') return item;
      const sentences = item.split(/(?<=[.!?])\s+/);
      return sentences.filter((sentence) => !hits(sentence)).join(' ').trim();
    }
    if (Array.isArray(item)) {
      return item.map((entry) => clean(entry)).filter((entry) => entry !== '');
    }
    if (item && typeof item === 'object') {
      return Object.fromEntries(Object.entries(item).map(([name, entry]) => [name, clean(entry, name)]));
    }
    return item;
  };

  return clean(value);
}

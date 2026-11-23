/**
 * L'ÉCRIT ET LE DIT (22/11/2026, leçon d'explainroo : `{acme.example|acme dot example}`) — ce que la voix off doit
 * PRONONCER n'est pas toujours ce que l'écran ÉCRIT. Avant la synthèse, le texte d'une ligne est mis en forme pour la
 * voix, sans modèle :
 *
 *   {écrit|dit}          le dit l'emporte (le storyboard ou le client l'écrivent quand l'écrit ne se lit pas) ;
 *   idem.africa          « idem point africa » ; une adresse électronique : « contact arobase idem point africa » ;
 *   2 500 FCFA, 2 500 F  « deux mille cinq cents francs CFA » (le séparateur de milliers ne coupe plus le nombre) ;
 *   30 %                 « trente pour cent » ; 2,5 « deux virgule cinq » ;
 *   9h30, 24h            « 9 heures 30 », « 24 heures » ; 1er, 2e « premier », « deuxième » ;
 *   +237 6 99 12 34 56   les groupes séparés par des virgules (la voix marque une pause entre eux).
 *
 * Le texte affiché (sous-titres, écran) reste l'écrit : seule la requête de synthèse reçoit le dit.
 */

const FR_UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const FR_TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

function frBelow100(n: number): string {
  if (n < 20) return FR_UNITS[n];
  if (n < 70) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? FR_TENS[t] : u === 1 ? `${FR_TENS[t]} et un` : `${FR_TENS[t]}-${FR_UNITS[u]}`;
  }
  if (n < 80) return n === 71 ? 'soixante et onze' : `soixante-${FR_UNITS[n - 60]}`;
  if (n === 80) return 'quatre-vingts';
  return `quatre-vingt-${FR_UNITS[n - 80]}`;
}

function frBelow1000(n: number, last: boolean): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const head = h === 0 ? '' : h === 1 ? 'cent' : `${FR_UNITS[h]} cent${r === 0 && last ? 's' : ''}`;
  const tail = r === 0 ? '' : frBelow100(r);
  // « quatre-vingts » perd son s devant « mille ».
  return [head, last ? tail : tail.replace(/^quatre-vingts$/, 'quatre-vingt')].filter(Boolean).join(' ');
}

/** Un entier en toutes lettres (français, jusqu'aux milliards). */
export function frNumber(n: number): string {
  if (!Number.isFinite(n) || n < 0 || n >= 1e12) return String(n);
  if (n === 0) return 'zéro';
  const parts: string[] = [];
  const billions = Math.floor(n / 1e9);
  const millions = Math.floor((n % 1e9) / 1e6);
  const thousands = Math.floor((n % 1e6) / 1000);
  const rest = n % 1000;
  if (billions) parts.push(`${frBelow1000(billions, true)} milliard${billions > 1 ? 's' : ''}`);
  if (millions) parts.push(`${frBelow1000(millions, true)} million${millions > 1 ? 's' : ''}`);
  if (thousands) parts.push(thousands === 1 ? 'mille' : `${frBelow1000(thousands, false)} mille`);
  if (rest) parts.push(frBelow1000(rest, true));
  return parts.join(' ');
}

const EN_UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function enBelow1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const tail = r === 0 ? '' : r < 20 ? EN_UNITS[r] : `${EN_TENS[Math.floor(r / 10)]}${r % 10 ? `-${EN_UNITS[r % 10]}` : ''}`;
  return [h ? `${EN_UNITS[h]} hundred` : '', tail].filter(Boolean).join(' ');
}
/** Un entier en toutes lettres (anglais). */
export function enNumber(n: number): string {
  if (!Number.isFinite(n) || n < 0 || n >= 1e12) return String(n);
  if (n === 0) return 'zero';
  const scales: Array<[number, string]> = [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']];
  const parts: string[] = [];
  let rest = n;
  for (const [v, name] of scales) {
    const q = Math.floor(rest / v);
    if (q) parts.push(`${enBelow1000(q)} ${name}`);
    rest %= v;
  }
  if (rest) parts.push(enBelow1000(rest));
  return parts.join(' ');
}

const ORDINALS_FR: Record<string, string> = { '1er': 'premier', '1re': 'première', '1ère': 'première' };

/** Le texte d'une ligne, mis en forme pour être DIT (voir l'en-tête). Les langues autres que fr/en gardent les règles neutres. */
export function speakableText(text: string, language = 'fr'): string {
  const fr = !String(language).toLowerCase().startsWith('en');
  const num = (digits: string) => {
    const n = Number(digits.replace(/[\s  .]/g, ''));
    return Number.isFinite(n) ? (fr ? frNumber(n) : enNumber(n)) : digits;
  };
  let t = String(text || '');
  // 1. Ce que l'auteur a dit explicitement : {écrit|dit}.
  t = t.replace(/\{([^{}|]{1,120})\|([^{}|]{1,160})\}/g, (_m, _w: string, said: string) => said.trim());
  // 2. Adresses électroniques, puis noms de domaine (jamais dans une adresse déjà traitée).
  t = t.replace(/\b([\w.+-]+)@([a-z0-9-]+(?:\.[a-z0-9-]+)+)\b/gi, (_m, user: string, host: string) => `${user.replace(/\./g, fr ? ' point ' : ' dot ')} ${fr ? 'arobase' : 'at'} ${host.replace(/\./g, fr ? ' point ' : ' dot ')}`);
  t = t.replace(/\b(?:https?:\/\/)?(?:www\.)?([a-z0-9-]{2,})((?:\.[a-z0-9-]{2,})*\.[a-z]{2,10})(\/[^\s]*)?\b/gi, (m, name: string, tld: string) => (/\d+\.\d+/.test(m) ? m : `${name}${tld.replace(/\./g, fr ? ' point ' : ' dot ')}`));
  // 3. Téléphones : un indicatif et des groupes de chiffres → des groupes séparés par une pause.
  t = t.replace(/\+\s?(\d{1,3})((?:[\s.-]\d{1,4}){3,6})/g, (_m, cc: string, groups: string) => `${fr ? 'plus' : 'plus'} ${cc}, ${groups.trim().split(/[\s.-]+/).join(', ')}`);
  // 4. Montants : nombre (séparateurs de milliers compris) + franc CFA.
  t = t.replace(/(\d{1,3}(?:[\s  .]\d{3})+|\d+)\s?(F\s?CFA|FCFA|XAF|XOF|francs?\s?CFA|F)\b/gi, (_m, n: string) => `${num(n)} ${fr ? 'francs CFA' : 'CFA francs'}`);
  // 5. Pourcentages, décimales, heures, ordinaux.
  t = t.replace(/(\d+)(?:[,.](\d+))?\s?%/g, (_m, a: string, b?: string) => `${num(a)}${b ? ` ${fr ? 'virgule' : 'point'} ${num(b)}` : ''} ${fr ? 'pour cent' : 'percent'}`);
  t = t.replace(/\b(\d{1,2})\s?h\s?(\d{2})\b/gi, (_m, h: string, mm: string) => (fr ? `${h} heures ${mm}` : `${h} ${mm}`));
  t = t.replace(/\b(\d{1,3})\s?h\b/gi, (_m, h: string) => (fr ? `${h} heures` : `${h} hours`));
  if (fr) {
    t = t.replace(/\b(1er|1re|1ère)\b/gi, (m) => ORDINALS_FR[m.toLowerCase()] ?? m);
    t = t.replace(/\b(\d+)e\b/g, (_m, n: string) => `${frNumber(Number(n)).replace(/(un|cinq|neuf)$/, (x) => ({ un: 'un', cinq: 'cinqu', neuf: 'neuv' })[x] as string)}ième`);
    t = t.replace(/(\d+),(\d+)/g, (_m, a: string, b: string) => `${num(a)} virgule ${num(b)}`);
  }
  // 6. Un grand nombre écrit avec ses séparateurs de milliers : un seul nombre, en lettres.
  t = t.replace(/\b\d{1,3}(?:[\s  ]\d{3})+\b/g, (m) => num(m));
  return t.replace(/\s+/g, ' ').trim();
}

/** Le texte AFFICHÉ d'une ligne qui porte des paires {écrit|dit} : l'écrit. */
export function writtenText(text: string): string {
  return String(text || '').replace(/\{([^{}|]{1,120})\|([^{}|]{1,160})\}/g, (_m, written: string) => written.trim());
}

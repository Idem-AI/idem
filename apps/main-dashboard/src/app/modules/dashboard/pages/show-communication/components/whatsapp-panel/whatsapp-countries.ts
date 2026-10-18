/** Un pays proposé dans le champ téléphone. */
export interface DialCountry {
  /** ISO 3166-1 alpha-2 — c'est aussi ce qui est affiché dans la pastille (les drapeaux emoji ne s'affichent pas sous Windows). */
  iso: string;
  name: string;
  /** Indicatif, sans « + ». */
  dial: string;
  /** Le 0 qu'on compose en national disparaît à l'international (06 12… → +33 6 12…). */
  dropZero?: boolean;
}

/**
 * L'Afrique d'abord (les utilisateurs d'IDEM), puis les pays où vit la diaspora.
 * En Côte d'Ivoire le 0 fait partie du numéro depuis 2021 : il est gardé.
 */
export const DIAL_COUNTRIES: readonly DialCountry[] = [
  { iso: 'CI', name: 'Côte d’Ivoire', dial: '225' },
  { iso: 'SN', name: 'Sénégal', dial: '221' },
  { iso: 'CM', name: 'Cameroun', dial: '237' },
  { iso: 'BJ', name: 'Bénin', dial: '229' },
  { iso: 'TG', name: 'Togo', dial: '228' },
  { iso: 'BF', name: 'Burkina Faso', dial: '226' },
  { iso: 'ML', name: 'Mali', dial: '223' },
  { iso: 'NE', name: 'Niger', dial: '227' },
  { iso: 'GN', name: 'Guinée', dial: '224' },
  { iso: 'GA', name: 'Gabon', dial: '241' },
  { iso: 'CG', name: 'Congo', dial: '242' },
  { iso: 'CD', name: 'RD Congo', dial: '243', dropZero: true },
  { iso: 'TD', name: 'Tchad', dial: '235' },
  { iso: 'CF', name: 'Centrafrique', dial: '236' },
  { iso: 'MG', name: 'Madagascar', dial: '261', dropZero: true },
  { iso: 'RW', name: 'Rwanda', dial: '250' },
  { iso: 'BI', name: 'Burundi', dial: '257' },
  { iso: 'MR', name: 'Mauritanie', dial: '222' },
  { iso: 'MA', name: 'Maroc', dial: '212', dropZero: true },
  { iso: 'DZ', name: 'Algérie', dial: '213', dropZero: true },
  { iso: 'TN', name: 'Tunisie', dial: '216' },
  { iso: 'EG', name: 'Égypte', dial: '20', dropZero: true },
  { iso: 'NG', name: 'Nigeria', dial: '234', dropZero: true },
  { iso: 'GH', name: 'Ghana', dial: '233', dropZero: true },
  { iso: 'KE', name: 'Kenya', dial: '254', dropZero: true },
  { iso: 'TZ', name: 'Tanzanie', dial: '255', dropZero: true },
  { iso: 'UG', name: 'Ouganda', dial: '256', dropZero: true },
  { iso: 'ZA', name: 'Afrique du Sud', dial: '27', dropZero: true },
  { iso: 'FR', name: 'France', dial: '33', dropZero: true },
  { iso: 'BE', name: 'Belgique', dial: '32', dropZero: true },
  { iso: 'CH', name: 'Suisse', dial: '41', dropZero: true },
  { iso: 'CA', name: 'Canada', dial: '1' },
  { iso: 'US', name: 'États-Unis', dial: '1' },
  { iso: 'GB', name: 'Royaume-Uni', dial: '44', dropZero: true },
];

export const DEFAULT_COUNTRY = DIAL_COUNTRIES[0];

/** Le pays par défaut se devine sur la région de la langue du navigateur (fr-CM → Cameroun), sinon Côte d’Ivoire. */
export function guessCountry(language: string | undefined): DialCountry {
  const region = /[-_]([A-Za-z]{2})\b/.exec(language ?? '')?.[1]?.toUpperCase();
  return DIAL_COUNTRIES.find((country) => country.iso === region) ?? DEFAULT_COUNTRY;
}

/** Les chiffres seuls. */
export const digitsOf = (value: string): string => value.replace(/\D/g, '');

/**
 * Le numéro international (« +225 07… ») reconnu dans une saisie collée.
 * Le plus long indicatif gagne (« 225 » avant « 2 »), « 00 » vaut « + ».
 */
export function parseInternational(raw: string): { country: DialCountry; national: string } | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('+') && !trimmed.startsWith('00')) return null;
  const digits = trimmed.startsWith('+') ? digitsOf(trimmed) : digitsOf(trimmed).replace(/^00/, '');
  const candidates = [...DIAL_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  const country = candidates.find((candidate) => digits.startsWith(candidate.dial));
  return country ? { country, national: digits.slice(country.dial.length) } : null;
}

/** Le numéro tel que l'API l'attend : « +» + indicatif + numéro national (sans le 0 de trunk quand il saute). */
export function toInternational(country: DialCountry, national: string): string {
  const digits = digitsOf(national);
  const local = country.dropZero ? digits.replace(/^0+/, '') : digits;
  return `+${country.dial}${local}`;
}

/** « 07 00 00 00 00 » : des paires, plus faciles à relire que dix chiffres collés. */
export function groupDigits(digits: string): string {
  return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
}

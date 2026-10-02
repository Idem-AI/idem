/**
 * Lecture d'un tableau collé — sans IA.
 *
 * Les utilisateurs ont souvent leurs chiffres ailleurs : un classeur Excel,
 * une feuille Google, ou la réponse d'un assistant (ChatGPT, Claude…) qu'ils
 * copient. Le presse-papiers arrive alors sous l'une de ces formes :
 *   - HTML avec une balise <table> (Google Sheets, réponses d'assistants) ;
 *   - texte séparé par des tabulations (Excel, Numbers, Sheets) ;
 *   - tableau Markdown « | a | b | » (texte brut d'un assistant) ;
 *   - CSV au point-virgule ou à la virgule.
 *
 * Le format est imposé (`PLAN_COLUMNS`) : c'est lui qui rend la lecture
 * possible sans IA. Une ligne d'en-têtes collée avec le tableau est sautée.
 * Les montants
 * acceptent « 150 000 FCFA », « 1,5 M » ou « 150k » ; les mois « 3 », « M3 »,
 * « mars 2026 » ou « 03/2026 ».
 */

import { FiscalCalendar } from '../../../models/finance.model';

/**
 * Le format imposé : UNE ligne par élément du prévisionnel, et toujours ces
 * six colonnes, dans cet ordre. La première colonne dit où ranger la ligne.
 * C'est ce format fixe qui permet de tout lire sans IA : l'utilisateur colle
 * en une fois produits, ventes, dépenses, salaires, achats et financement.
 */
export const PLAN_COLUMNS = ['section', 'name', 'amount', 'unitCost', 'start', 'growth'] as const;
export type PlanColumn = (typeof PLAN_COLUMNS)[number];

export type PlanSection = 'product' | 'sale' | 'variable' | 'fixed' | 'salary' | 'purchase' | 'funding';

export const PLAN_SECTIONS: readonly PlanSection[] = ['product', 'sale', 'variable', 'fixed', 'salary', 'purchase', 'funding'];

/** Reconnaît la rubrique, au singulier comme au pluriel, avec ou sans accents. */
const SECTION_WORDS: [RegExp, PlanSection][] = [
  [/^(produits?|offres?|services?|products?)\b/, 'product'],
  [/^(ventes?|quantites? vendues?|sales?)\b/, 'sale'],
  [/^(depenses? liees?|charges? variables?|depenses? variables?|couts? des ventes|variable|sales.related)/, 'variable'],
  [/^(depenses? fixes?|charges? fixes?|frais fixes?|fixed)/, 'fixed'],
  [/^(start.up|achats? de demarrage)/, 'purchase'],
  [/^(salaires?|personnel|equipe|employes?|salary|salaries)\b/, 'salary'],
  [/^(achats?|investissements?|equipements?|purchases?|investments?)\b/, 'purchase'],
  [/^(financements?|funding|financing)\b/, 'funding'],
];

export function parseSection(raw: string): PlanSection | null {
  const s = normalizeText(raw ?? '');
  return SECTION_WORDS.find(([re]) => re.test(s))?.[1] ?? null;
}

export type FundingKey = 'apportCapital' | 'compteCourantAssocies' | 'cmt' | 'creditBail' | 'subvention';

/** Le nom d'une ligne « Financement » dit de quel financement il s'agit. */
export function parseFunding(raw: string): FundingKey | null {
  const s = normalizeText(raw ?? '');
  if (/apport|capital|fonds propres|economies|epargne|tontine|equity|contribution|own money|savings/.test(s)) return 'apportCapital';
  if (/associ|compte courant|partner|shareholder/.test(s)) return 'compteCourantAssocies';
  if (/leasing|credit.?bail|location/.test(s)) return 'creditBail';
  if (/subvention|don\b|grant|aide/.test(s)) return 'subvention';
  if (/pret|emprunt|banque|bancaire|credit|microfinance|loan/.test(s)) return 'cmt';
  return null;
}

/** Les titres de colonnes reconnus, pour sauter une ligne d'en-têtes collée avec le tableau. */
const HEADER_WORDS = /^(rubrique|section|categorie|category|type|nom|name|libelle|designation|montant|amount|prix|price|cout|unit|mois|month|start|debut|hausse|croissance|monthly|growth)/;

export function isHeaderRow(row: string[]): boolean {
  const hits = row.filter((c) => HEADER_WORDS.test(normalizeText(c))).length;
  return hits >= 3 && !row.some((c) => /\d{2,}/.test(c));
}

// ---------------------------------------------------------------------------
// Presse-papiers → matrice de cellules
// ---------------------------------------------------------------------------

/** Rend le contenu collé sous forme de lignes de cellules, quelle que soit sa forme. */
export function parseClipboard(html: string, text: string): string[][] {
  if (html && /<table[\s>]/i.test(html) && typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rows = Array.from(doc.querySelectorAll('tr')).map((tr) =>
      Array.from(tr.querySelectorAll('th,td')).map((cell) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim()),
    );
    const kept = rows.filter((r) => r.some((c) => c));
    if (kept.length) return kept;
  }
  return parseText(text ?? '');
}

function parseText(raw: string): string[][] {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim());
  if (!lines.length) return [];

  // Tableau Markdown : « | a | b | », avec sa ligne « |---|---| ».
  if (lines.filter((l) => l.trim().startsWith('|')).length >= Math.ceil(lines.length / 2)) {
    return lines
      .filter((l) => l.includes('|') && !/^\s*\|?[\s:|-]+\|?\s*$/.test(l))
      .map((l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(clean));
  }
  if (lines.some((l) => l.includes('\t'))) return lines.map((l) => l.split('\t').map(clean));
  if (lines.every((l) => l.includes(';'))) return lines.map((l) => l.split(';').map(clean));
  // Virgule : seulement si chaque ligne en a autant — sinon ce sont des décimales.
  const commas = lines.map((l) => (l.match(/,/g) ?? []).length);
  if (commas[0] > 0 && commas.every((c) => c === commas[0])) return lines.map((l) => splitCsv(l));
  return lines.map((l) => [clean(l)]);
}

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) {
      out.push(clean(current));
      current = '';
    } else current += ch;
  }
  out.push(clean(current));
  return out;
}

const clean = (s: string) => s.replace(/\*\*/g, '').replace(/^["']|["']$/g, '').trim();

export const normalizeText = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// ---------------------------------------------------------------------------
// Cellules → valeurs
// ---------------------------------------------------------------------------

/** « 150 000 FCFA », « 1,5 M », « 150k », « 2 millions » → nombre ; NaN si illisible. */
export function parseAmount(raw: string): number {
  let s = normalizeText(raw ?? '');
  if (!s) return NaN;
  let factor = 1;
  if (/\d\s*(m|millions?|mio)\b/.test(s)) factor = 1e6;
  else if (/\d\s*(k|mille)\b/.test(s)) factor = 1e3;
  s = s.replace(/[\s  ]/g, '').replace(/[^\d.,-]/g, '');
  if (!/\d/.test(s)) return NaN;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    const decimal = lastComma > lastDot ? ',' : '.';
    s = s.split(decimal === ',' ? '.' : ',').join('').replace(decimal, '.');
  } else if (lastComma > -1) {
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  const n = Number(s) * factor;
  return Number.isFinite(n) ? n : NaN;
}

const MONTHS = [
  /^(janv?|jan|january|janvier)/,
  /^(fevr?|feb|february|fevrier)/,
  /^(mars?|march)\b|^mar$/,
  /^(avr|apr|avril|april)/,
  /^(mai|may)\b/,
  /^(juin|june?)\b/,
  /^(juil|july?|juillet)/,
  /^(aout|aug|august)/,
  /^(sept?|september|septembre)/,
  /^(oct|october|octobre)/,
  /^(nov|november|novembre)/,
  /^(dec|december|decembre)/,
];

/**
 * Mois du plan, de 1 à 36. Vide : 1. Illisible : NaN.
 * Accepte un rang (« 3 », « M3 », « mois 3 ») ou une date (« mars 2026 »,
 * « 03/2026 », « 2026-03 »), calée sur le calendrier du prévisionnel.
 */
export function parseMonth(raw: string, calendar: FiscalCalendar | undefined): number {
  const s = normalizeText(raw ?? '');
  if (!s) return 1;
  const firstYear = calendar?.firstYear || new Date().getFullYear();
  const start = (calendar?.fiscalYearEndMonth ?? 12) % 12;
  const fromDate = (month: number, year: number) => {
    const index = (year - firstYear) * 12 + (month - start) + 1;
    return index >= 1 && index <= 36 ? index : NaN;
  };

  const rank = /^(?:m|mois\s*)?(\d{1,2})$/.exec(s);
  if (rank) {
    const n = Number(rank[1]);
    return n >= 1 && n <= 36 ? n : NaN;
  }
  const monthYear = /^(\d{1,2})[/.-](\d{4})$/.exec(s);
  if (monthYear) return fromDate(Number(monthYear[1]) - 1, Number(monthYear[2]));
  const yearMonth = /^(\d{4})[/.-](\d{1,2})$/.exec(s);
  if (yearMonth) return fromDate(Number(yearMonth[2]) - 1, Number(yearMonth[1]));

  const month = MONTHS.findIndex((re) => re.test(s));
  if (month >= 0) {
    const year = /(\d{4})/.exec(s);
    if (year) return fromDate(month, Number(year[1]));
    const inFirstYear = fromDate(month, firstYear);
    return Number.isNaN(inFirstYear) ? fromDate(month, firstYear + 1) : inFirstYear;
  }
  return NaN;
}

/** Mots qui désignent une catégorie — lus dans la colonne « Type » ou, à défaut, dans le libellé. */
const CATEGORY_WORDS: Record<'variable' | 'fixed' | 'investment', [RegExp, string][]> = {
  variable: [
    [/marchandis|revente|stock|achat de/, 'achatsMarchandises'],
    [/matiere|ingredient|intrant/, 'matieresPremieres'],
    [/emballag|packag|sachet|carton/, 'achatsEmballages'],
    [/livraison|transport|expedition|coursier/, 'transportSurVentes'],
    [/sous.?trait/, 'sousTraitance'],
    [/commission|intermediaire|apporteur/, 'remunerationsIntermediaires'],
    [/pub|marketing|facebook|ads\b|annonce|sponsor/, 'publiciteRelationsPubliques'],
    [/telephon|internet|data|credit tel|forfait/, 'fraisTelecommunications'],
    [/banc|mobile money|momo|orange money|transaction/, 'fraisBancaires'],
  ],
  fixed: [
    [/loyer|location|bail/, 'locations'],
    [/assuranc/, 'primesAssurances'],
    [/entretien|repar|maintenance|nettoyage/, 'entretienReparation'],
    [/comptab|conseil|avocat|honorair|expert/, 'etudesRecherche'],
    [/formation/, 'formationProfessionnelle'],
    [/patente|licence/, 'patentesLicences'],
    [/impot|taxe/, 'autresImpotsDirects'],
    [/abonnement|cotisation|electric|eau|internet|logiciel|saas|energie|carburant/, 'cotisations'],
  ],
  investment: [
    [/creation|constitution|statut|notaire|immatricul/, 'fraisConstitution'],
    [/logiciel|site|appli|web|application/, 'logiciels'],
    [/lancement|campagne/, 'publiciteLancement'],
    [/brevet|marque|licence/, 'brevetsLicences'],
    [/amenag|travaux|renov|peinture|installation du local/, 'amenagementBureaux'],
    [/vehicule|moto|voiture|camion|tricycle|velo/, 'materielTransport'],
    [/mobilier|table|chaise|etagere|comptoir|rayonnage/, 'mobilier'],
    [/machine|outil|four|equipement de production|congelateur|refrigerateur/, 'materielOutillageIndustriel'],
    [/terrain/, 'terrains'],
    [/batiment|construction/, 'batiments'],
    [/caution|depot|garantie/, 'depotsCautionnements'],
  ],
};

const CATEGORY_DEFAULT = { variable: 'autresChargesExternes', fixed: 'cotisations', investment: 'autresMateriels' } as const;

/**
 * Catégorie d'une ligne. `labels` associe chaque clé à son libellé affiché :
 * un utilisateur qui recopie « Loyer » de notre liste est reconnu tel quel.
 */
export function guessCategory(
  group: 'variable' | 'fixed' | 'investment',
  typeCell: string,
  labelCell: string,
  labels: Record<string, string>,
): string {
  const type = normalizeText(typeCell);
  if (type) {
    const exact = Object.entries(labels).find(([key, label]) => normalizeText(label) === type || normalizeText(key) === type);
    if (exact) return exact[0];
  }
  for (const source of [type, normalizeText(labelCell)]) {
    if (!source) continue;
    const hit = CATEGORY_WORDS[group].find(([re]) => re.test(source));
    if (hit) return hit[1];
  }
  return CATEGORY_DEFAULT[group];
}

/** Retrouve un produit par son nom, à l'accent et à la casse près. */
export function matchProduct(cell: string, products: { id: string; name: string }[]): string | null {
  const s = normalizeText(cell);
  if (!s) return products.length === 1 ? products[0].id : null;
  const exact = products.find((p) => normalizeText(p.name) === s);
  if (exact) return exact.id;
  const partial = products.filter((p) => {
    const n = normalizeText(p.name);
    return n && (n.includes(s) || s.includes(n));
  });
  return partial.length === 1 ? partial[0].id : null;
}

/**
 * Opération A, volet structure : le manifeste du site.
 *
 * Un appel, une réponse JSON : les pages, et pour chacune ses sections décrites
 * en une ou deux phrases (ce qu'elles montrent, ce qu'elles disent), le visuel
 * qu'elles attendent et les composants optionnels dont elles ont besoin.
 * Aucune section type, aucun gabarit : l'architecte décide de tout ce qui
 * compose le site. Le code ne contrôle que la forme (chemins, identifiants,
 * valeurs permises) et en tire les noms de fichiers.
 */

import { ChatLogger } from '../utils/logger.js';
import { OPTIONAL_MODULES } from './catalog.js';
import { cleanText } from './json.js';
import { ModelCaller, Verdict } from './modelCaller.js';
import { SiteFacts } from './siteFacts.js';
import { FUNCTIONAL_DEPENDENCIES } from './template.js';

export type VisualKind = 'photo' | 'illustration' | 'video' | 'none';

export interface ManifestSection {
  /** Identifiant kebab-case, unique dans la page : l'ancre de la section. */
  id: string;
  /** Nom du composant React, tiré de l'identifiant. */
  component: string;
  /** Ce que la section montre et dit. */
  brief: string;
  visual: VisualKind;
  /** Libellé dans le menu (site d'une seule page). */
  navLabel?: string;
  /** Refonte : les sections de l'ancien site qu'elle reprend (`p2.s3`). */
  sources?: string[];
  /** Sa composition, dans le vocabulaire fermé `LAYOUTS` (variété garantie par `diversifyLayouts`). */
  layout?: LayoutId;
}

export interface ManifestPage {
  /** `home` pour l'accueil, sinon le segment d'adresse. */
  key: string;
  /** `/` ou `/<slug>/`. */
  path: string;
  label: string;
  purpose: string;
  seoTitle: string;
  seoDescription: string;
  sections: ManifestSection[];
  /** Refonte : la page de l'ancien site qu'elle remplace (`p2` → 2). */
  source?: number;
}

export interface SiteManifest {
  pages: ManifestPage[];
  /**
   * Refonte : le menu de l'ancien site, dans son ordre et avec ses libellés, chaque lien mené à la page qui reprend
   * la sienne. Sans lui, le menu listait chaque page (articles, conditions générales…).
   */
  menu?: { label: string; href: string }[];
  header: string;
  footer: string;
  /** Composants optionnels du catalogue utilisés par le site. */
  components: string[];
  /** Dépendances fonctionnelles demandées (liste fermée). */
  dependencies: string[];
  keywords: string[];
  businessType: string;
  /** Les langues que la demande réclame en plus de celle du site (codes ISO : `en`, `es`…). Vide le plus souvent. */
  languages: string[];
}

const BUSINESS_TYPES = [
  'LocalBusiness',
  'Restaurant',
  'Store',
  'ProfessionalService',
  'HealthAndBeautyBusiness',
  'MedicalBusiness',
  'EducationalOrganization',
  'LodgingBusiness',
  'AutomotiveBusiness',
  'TravelAgency',
  'Organization',
];

const VISUALS: VisualKind[] = ['photo', 'illustration', 'video', 'none'];
const RESERVED = new Set(['src', 'public', 'scripts', 'dist', 'node_modules', 'assets', 'index']);

export const slugify = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    // Coupé à 40 caractères, il pouvait finir sur un tiret.
    .replace(/-+$/, '');

const pascal = (slug: string): string => {
  const name = slug
    .split('-')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
  return /^[A-Z]/.test(name) ? name : `S${name}`;
};

/** La page d'origine la plus reprise par des sections, quand l'architecte n'en a déclaré aucune. */
function dominantOrigin(sections: ManifestSection[]): { source?: number } {
  const counts = new Map<number, number>();
  for (const id of sections.flatMap((section) => section.sources ?? [])) {
    const n = Number(id.match(/^p(\d+)\./)?.[1] ?? NaN);
    if (Number.isInteger(n)) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  return best ? { source: best[0] } : {};
}

/** Ce qu'une refonte impose au manifeste : une page par page d'origine, chaque section d'origine placée. */
export interface Coverage {
  pageCount: number;
  sectionIds: string[];
}

/** Les pages d'origine qu'une page reprend : sa `source`, et chaque page dont une de ses sections reprend le contenu. */
export function originPagesOf(page: ManifestPage): number[] {
  const fromSections = page.sections.flatMap((s) => (s.sources ?? []).map((id) => Number(id.match(/^p(\d+)\./)?.[1] ?? NaN))).filter((n) => Number.isInteger(n));
  return [...new Set([...(typeof page.source === 'number' ? [page.source] : []), ...fromSections])];
}

/**
 * Les pages et sections de l'ancien site absentes du manifeste. Une page d'origine est reprise dès qu'une page
 * déclare la reprendre (`source`) OU qu'une de ses sections y puise : l'architecte remplit ses sections et oublie
 * souvent la page. Comptée seulement par `source`, chaque page d'origine semblait manquer, et le code en recréait une
 * copie vide — onze pages en double dans le menu d'une refonte réelle (« About », « services-2 »…).
 */
export function missingCoverage(manifest: SiteManifest, coverage: Coverage): { pages: number[]; sections: string[] } {
  const pages = new Set(manifest.pages.flatMap(originPagesOf));
  const placed = new Set(manifest.pages.flatMap((p) => p.sections.flatMap((s) => s.sources ?? [])));
  return {
    pages: Array.from({ length: coverage.pageCount }, (_, i) => i).filter((i) => !pages.has(i)),
    sections: coverage.sectionIds.filter((id) => !placed.has(id)),
  };
}

/**
 * Le dernier recours d'une refonte : ce que l'architecte n'a pas placé l'est par le code — une page par page
 * d'origine manquante, chaque section manquante à la fin de la page qui remplace la sienne. Rien ne disparaît.
 */
export function completeCoverage(manifest: SiteManifest, coverage: Coverage, pageTitles: string[], pagePaths: string[], fr: boolean): SiteManifest {
  const missing = missingCoverage(manifest, coverage);
  const pages = manifest.pages.map((page) => ({ ...page, sections: [...page.sections] }));
  for (const index of missing.pages) {
    const slug = slugify(pagePaths[index]?.split('/').filter(Boolean).pop() ?? pageTitles[index]) || `page-${index}`;
    let key = slug;
    for (let n = 2; pages.some((p) => p.key === key); n++) key = `${slug}-${n}`;
    pages.push({ key, path: `/${key}/`, label: (pageTitles[index] || key).split(/\s[-|–]\s/)[0].slice(0, 40), purpose: '', seoTitle: (pageTitles[index] || '').slice(0, 70), seoDescription: '', sections: [], source: index });
  }
  for (const id of missingCoverage({ ...manifest, pages }, coverage).sections) {
    const pageIndex = Number(id.match(/^p(\d+)\./)?.[1] ?? 0);
    const page = pages.find((p) => p.source === pageIndex) ?? pages.find((p) => originPagesOf(p).includes(pageIndex)) ?? pages[0];
    let component = pascal(slugify(`origine-${id}`));
    while (page.sections.some((s) => s.component === component)) component = `${component}Bis`;
    page.sections.push({
      id: slugify(`origine-${id}`),
      component,
      brief: fr ? `Reprend intégralement le contenu de la section ${id} de l'ancien site, présenté avec soin.` : `Carries the full content of the old site's section ${id}, carefully presented.`,
      visual: 'none',
      sources: [id],
    });
  }
  return { ...manifest, pages };
}

/**
 * LES COMPOSITIONS — le vocabulaire fermé dans lequel l'architecte choisit la forme de chaque section. Ce n'est
 * pas un gabarit (rien n'est écrit à la place de l'auteur) : c'est la contrainte qui empêche un site de devenir
 * une pile de « titre + trois cartes à icône », la forme la plus reconnaissable d'un site généré.
 *
 * Variété garantie par le code (`diversifyLayouts`) : jamais deux fois la même composition de suite, les cartes au
 * plus une fois par page, aucune composition plus de deux fois par page.
 *
 * Rangées par catégorie (18/11/2026, catalogue iCode ×4) : la même liste que les schémas `ikind.*` du dépôt
 * idem-templates (`catalog/icode/shared/kinds/<catégorie>/`). L'architecte les lit par catégorie.
 */
export const LAYOUT_CATEGORIES = {
  hero: ['Ouvertures de page', 'Page openers'],
  content: ['Contenu et récit', 'Content and story'],
  features: ['Atouts et services', 'Features and services'],
  proof: ['Preuve et confiance', 'Proof and trust'],
  pricing: ['Offres et tarifs', 'Offers and pricing'],
  process: ['Méthode et étapes', 'Method and steps'],
  people: ['Équipe et maison', 'Team and company'],
  media: ['Visuels', 'Visuals'],
  data: ['Chiffres et tableaux', 'Figures and tables'],
  conversion: ['Action et contact', 'Action and contact'],
  support: ['Informations pratiques', 'Practical information'],
} as const;
export type LayoutCategory = keyof typeof LAYOUT_CATEGORIES;

export const LAYOUTS = {
  // Ouvertures (la première section d'une page)
  hero: ['ouverture : grand titre, chapeau, une ou deux actions, quelques points forts, un visuel', 'opener: large heading, lede, one or two actions, a few highlights, a visual', 'hero'],
  'hero-stats': ['ouverture appuyée sur 2 à 4 chiffres RÉELS sous le titre', 'opener backed by 2 to 4 REAL figures under the heading', 'hero'],
  'hero-checklist': ['ouverture avec une courte liste de garanties ou de bénéfices cochés', 'opener with a short checked list of guarantees or benefits', 'hero'],
  'hero-quote': ['ouverture avec un avis RÉEL de client mis en avant', 'opener with one REAL customer review set forward', 'hero'],
  'hero-offer': ['ouverture centrée sur l’offre phare et son prix RÉEL', 'opener centred on the flagship offer and its REAL price', 'hero'],
  // Contenu et récit
  'split-media': ['texte d’un côté, visuel de l’autre, colonnes inégales (7/5), le visuel déborde ou s’aligne sur le titre', 'copy on one side, visual on the other, unequal columns (7/5), the visual bleeds or aligns with the heading', 'content'],
  editorial: ['mise en page de magazine : grand titre, texte en colonnes, une citation ou un chiffre réel en exergue', 'magazine layout: large heading, copy in columns, a pull quote or real figure set apart', 'content'],
  statement: ['une seule grande phrase forte, beaucoup d’espace, une action', 'one large strong sentence, lots of space, one action', 'content'],
  intro: ['courte présentation centrée : titre, chapeau, un ou deux paragraphes', 'short centred introduction: heading, lede, one or two paragraphs', 'content'],
  manifesto: ['3 à 8 affirmations courtes, posées comme un manifeste', '3 to 8 short statements set as a manifesto', 'content'],
  events: ['agenda d’événements datés RÉELS : date, titre, lieu', 'agenda of REAL dated events: date, title, place', 'content'],
  articles: ['actualités ou articles : date, titre, résumé', 'news or articles: date, title, summary', 'content'],
  // Atouts et services
  cards: ['cartes, chacune différente par son contenu (une seule fois par page)', 'cards, each different by its content (once per page)', 'features'],
  bento: ['grille de cases de tailles différentes (une grande, plusieurs petites), chacune avec son contenu propre', 'grid of different-sized tiles (one large, several small), each with its own content', 'features'],
  'list-rows': ['liste en rangées séparées par des filets fins, titre à gauche, détail à droite (pas de cartes)', 'list in rows separated by thin rules, title left, detail right (no cards)', 'features'],
  features: ['grille d’atouts (3 à 9), titre et explication courte chacun', 'grid of features (3 to 9), each with a title and a short explanation', 'features'],
  'feature-tabs': ['atouts présentés en onglets, un texte détaillé par onglet', 'features shown in tabs, one detailed text per tab', 'features'],
  'feature-rows': ['rangées alternées texte / visuel, une par atout (2 à 4)', 'alternating copy / visual rows, one per feature (2 to 4)', 'features'],
  services: ['catalogue de prestations : nom, description, précision (durée, format)', 'service catalogue: name, description, detail (duration, format)', 'features'],
  checklist: ['liste cochée de ce qui est inclus ou garanti (4 à 12 lignes)', 'checked list of what is included or guaranteed (4 to 12 lines)', 'features'],
  contrast: ['deux colonnes opposées : avant / après, sans / avec', 'two opposed columns: before / after, without / with', 'features'],
  'use-cases': ['cas d’usage par public : à qui c’est destiné et ce que ça change', 'use cases by audience: who it is for and what it changes', 'features'],
  // Preuve et confiance
  quote: ['une citation ou un témoignage RÉEL en très grand, avec son auteur', 'one REAL quote or testimonial set very large, with its author', 'proof'],
  testimonials: ['plusieurs témoignages RÉELS (2 à 6), avec auteur et fonction', 'several REAL testimonials (2 to 6), with author and role', 'proof'],
  reviews: ['note moyenne RÉELLE et avis clients RÉELS', 'REAL average rating and REAL customer reviews', 'proof'],
  'case-study': ['étude de cas RÉELLE : client, besoin, solution, résultats', 'REAL case study: client, need, solution, results', 'proof'],
  credentials: ['agréments, certifications, partenaires ou distinctions RÉELS', 'REAL accreditations, certifications, partners or awards', 'proof'],
  'trust-bar': ['bande de noms RÉELS de clients ou partenaires', 'band of REAL client or partner names', 'proof'],
  // Offres et tarifs
  pricing: ['formules côte à côte (1 à 4) : nom, prix RÉEL, inclus', 'plans side by side (1 to 4): name, REAL price, inclusions', 'pricing'],
  'price-list': ['carte ou grille de prix RÉELS, façon menu', 'menu-style list of REAL prices', 'pricing'],
  offer: ['une offre unique détaillée : prix RÉEL, ce qui est inclus, une action', 'one detailed offer: REAL price, what is included, one action', 'pricing'],
  'plans-compare': ['tableau comparatif des formules, ligne par ligne', 'plan comparison table, row by row', 'pricing'],
  table: ['tableau comparatif ou de tarifs lisible', 'readable comparison or pricing table', 'pricing'],
  // Méthode et étapes
  timeline: ['étapes numérotées le long d’un fil vertical ou horizontal', 'numbered steps along a vertical or horizontal line', 'process'],
  process: ['déroulé en étapes avec la durée ou le moment de chacune', 'step-by-step flow with each step’s duration or timing', 'process'],
  method: ['méthode en phases, avec ce que chaque phase livre', 'method in phases, with what each phase delivers', 'process'],
  // Équipe et maison
  team: ['membres RÉELS de l’équipe : nom, rôle, courte bio', 'REAL team members: name, role, short bio', 'people'],
  about: ['histoire de la maison et ses valeurs', 'the company story and its values', 'people'],
  values: ['3 à 6 valeurs ou engagements expliqués', '3 to 6 values or commitments explained', 'people'],
  'founder-note': ['lettre signée du fondateur ou de la fondatrice', 'signed letter from the founder', 'people'],
  'mission-vision': ['la mission et la vision, côte à côte', 'mission and vision side by side', 'people'],
  milestones: ['dates RÉELLES de l’histoire de la maison', 'REAL dates in the company history', 'people'],
  careers: ['postes ouverts RÉELS : intitulé, lieu, type', 'REAL open positions: title, place, type', 'people'],
  // Visuels
  'full-bleed-media': ['visuel pleine largeur, texte posé dessus (voile lisible) ou juste dessous', 'full-width visual, copy over it (readable scrim) or just below', 'media'],
  gallery: ['mosaïque d’images de tailles variées, légendes sobres', 'mosaic of images in varied sizes, sober captions', 'media'],
  showcase: ['réalisations ou projets, chacun avec son visuel et sa catégorie', 'work or projects, each with its visual and category', 'media'],
  'before-after': ['deux visuels comparés : avant / après', 'two visuals compared: before / after', 'media'],
  // Chiffres et tableaux
  'stats-band': ['bande de chiffres RÉELS (des faits uniquement), grands nombres, libellés courts', 'band of REAL figures (facts only), large numbers, short labels', 'data'],
  'stats-detail': ['chiffres RÉELS, chacun expliqué en une phrase', 'REAL figures, each explained in one sentence', 'data'],
  specs: ['fiche technique : caractéristique et valeur', 'spec sheet: attribute and value', 'data'],
  // Action et contact
  'cta-band': ['bande d’appel à l’action pleine largeur, une phrase et un bouton', 'full-width call-to-action band, one sentence and one button', 'conversion'],
  'cta-split': ['appel à l’action avec visuel, deux actions et quelques arguments', 'call to action with a visual, two actions and a few arguments', 'conversion'],
  'contact-cta': ['invitation à écrire ou appeler, avec les coordonnées RÉELLES', 'invitation to write or call, with the REAL contact details', 'conversion'],
  contact: ['coordonnées RÉELLES complètes : canaux, ville', 'full REAL contact details: channels, city', 'conversion'],
  form: ['formulaire et coordonnées côte à côte', 'form and contact details side by side', 'conversion'],
  announcement: ['annonce courte et une action (nouveauté, ouverture)', 'short announcement and one action (news, opening)', 'conversion'],
  // Informations pratiques
  faq: ['questions et réponses en accordéon', 'questions and answers in an accordion', 'support'],
  'faq-categories': ['questions rangées par thème (2 à 4 thèmes)', 'questions grouped by topic (2 to 4 topics)', 'support'],
  hours: ['horaires d’ouverture RÉELS, jour par jour', 'REAL opening hours, day by day', 'support'],
  location: ['adresse RÉELLE et indications pour venir', 'REAL address and directions', 'support'],
  guarantees: ['garanties et engagements RÉELS (2 à 6)', 'REAL guarantees and commitments (2 to 6)', 'support'],
} as const;

export type LayoutId = keyof typeof LAYOUTS;
const LAYOUT_IDS = Object.keys(LAYOUTS) as LayoutId[];
/** Les compositions qui ouvrent une page (jamais ailleurs). */
export const OPENING_LAYOUTS = LAYOUT_IDS.filter((id) => LAYOUTS[id][2] === 'hero');

/** Le vocabulaire des compositions pour l'architecte, rangé par catégorie (une ligne par catégorie). */
export function layoutMenu(fr: boolean): string {
  return (Object.keys(LAYOUT_CATEGORIES) as LayoutCategory[])
    .map((cat) => {
      const ids = LAYOUT_IDS.filter((id) => LAYOUTS[id][2] === cat);
      return `    - ${LAYOUT_CATEGORIES[cat][fr ? 0 : 1]} : ${ids.map((id) => `"${id}" (${LAYOUTS[id][fr ? 0 : 1]})`).join(' ; ')}`;
    })
    .join('\n');
}

/** La description d'une composition, dans la langue du site. */
export function layoutBrief(layout: LayoutId | undefined, fr: boolean): string {
  return layout ? LAYOUTS[layout][fr ? 0 : 1] : '';
}

/** Les compositions de repli, selon que la section a un visuel ou non. */
const WITH_VISUAL: LayoutId[] = ['split-media', 'full-bleed-media', 'gallery', 'bento', 'editorial'];
const WITHOUT_VISUAL: LayoutId[] = ['editorial', 'list-rows', 'statement', 'timeline', 'bento', 'cta-band'];

/**
 * La variété, garantie par le code (sans rappeler le modèle) : une composition absente, répétée juste après la
 * même, des cartes une seconde fois sur la page, ou une composition déjà utilisée deux fois, est remplacée par la
 * première de repli qui ne crée pas de nouvelle répétition. Rend le nombre de compositions changées.
 */
export function diversifyLayouts(manifest: SiteManifest): number {
  let changed = 0;
  for (const page of manifest.pages) {
    const used = new Map<LayoutId, number>();
    let previous: LayoutId | undefined;
    page.sections.forEach((section, index) => {
      const count = (id: LayoutId) => used.get(id) ?? 0;
      // Une ouverture (`hero*`) n'a de sens qu'en tête de page, et une seule fois.
      const fits = (id: LayoutId | undefined): id is LayoutId =>
        !!id && id !== previous && !(id === 'cards' && count('cards') >= 1) && count(id) < 2 && !(index > 0 && OPENING_LAYOUTS.includes(id));
      if (!fits(section.layout)) {
        const pool = section.visual === 'none' ? WITHOUT_VISUAL : WITH_VISUAL;
        const next = [...pool, ...LAYOUT_IDS].find((id) => fits(id) && id !== 'cards') ?? section.layout ?? pool[0];
        if (next !== section.layout) changed += 1;
        section.layout = next;
      }
      used.set(section.layout!, count(section.layout!) + 1);
      previous = section.layout;
    });
  }
  return changed;
}

/** Lecture structurelle de la réponse ; rend la liste des problèmes de forme. */
export function readManifest(raw: unknown, limits: { maxPages?: number; maxSections?: number } = {}): { manifest: SiteManifest | null; problems: string[] } {
  const problems: string[] = [];
  const data = raw && typeof raw === 'object' ? (raw as Record<string, any>) : null;
  if (!data || !Array.isArray(data.pages) || !data.pages.length) {
    return { manifest: null, problems: ['"pages" doit être une liste non vide'] };
  }

  const pages: ManifestPage[] = [];
  const keys = new Set<string>();

  for (const [index, entry] of (data.pages as any[]).slice(0, limits.maxPages ?? 7).entries()) {
    const slug = index === 0 ? '' : slugify(entry?.slug ?? entry?.path ?? entry?.label);
    const key = index === 0 ? 'home' : slug;
    const label = cleanText(entry?.label, 40);
    if (!label) problems.push(`page ${index + 1} : "label" manquant`);
    if (index > 0 && (!slug || RESERVED.has(slug) || slug === 'home')) {
      problems.push(`page ${index + 1} : "slug" invalide (kebab-case, ni "home" ni "index")`);
      continue;
    }
    if (keys.has(key)) {
      problems.push(`page ${index + 1} : "slug" déjà utilisé (${slug})`);
      continue;
    }
    keys.add(key);

    const sections: ManifestSection[] = [];
    const ids = new Set<string>();
    const components = new Set<string>();
    for (const item of Array.isArray(entry?.sections) ? (entry.sections as any[]).slice(0, limits.maxSections ?? 10) : []) {
      const id = slugify(item?.id ?? item?.name);
      const brief = cleanText(item?.brief, 500);
      if (!id || !brief || ids.has(id)) continue;
      let component = pascal(id);
      while (components.has(component) || component === 'SiteHeader' || component === 'SiteFooter') component = `${component}Section`;
      ids.add(id);
      components.add(component);
      const visual = VISUALS.includes(item?.visual) ? (item.visual as VisualKind) : 'none';
      const navLabel = cleanText(item?.navLabel, 28);
      const layout = typeof item?.layout === 'string' && item.layout in LAYOUTS ? (item.layout as LayoutId) : undefined;
      const sources = Array.isArray(item?.sources) ? item.sources.map((v: unknown) => String(v).trim()).filter((v: string) => /^p\d+\.s\d+$/.test(v)).slice(0, 12) : [];
      sections.push({ id, component, brief, visual, ...(navLabel ? { navLabel } : {}), ...(sources.length ? { sources } : {}), ...(layout ? { layout } : {}) });
    }
    if (sections.length < 2) {
      problems.push(`page « ${label || index + 1} » : au moins deux sections, chacune avec "id" et "brief"`);
      continue;
    }

    pages.push({
      key,
      path: index === 0 ? '/' : `/${slug}/`,
      label: label || key,
      purpose: cleanText(entry?.purpose, 300),
      seoTitle: cleanText(entry?.seoTitle, 70),
      seoDescription: cleanText(entry?.seoDescription, 180),
      sections,
      // La page d'origine : celle que l'architecte déclare, sinon celle où ses sections puisent le plus (les liens
      // de l'ancien site vers cette page mènent ici).
      ...(/^p?\d+$/.test(String(entry?.source ?? '')) ? { source: Number(String(entry.source).replace('p', '')) } : dominantOrigin(sections)),
    });
  }

  if (!pages.length || pages[0].key !== 'home') return { manifest: null, problems };

  const manifest: SiteManifest = {
    pages,
    header: cleanText(data.header, 400),
    footer: cleanText(data.footer, 400),
    components: (Array.isArray(data.components) ? data.components : []).filter((name: unknown) =>
      OPTIONAL_MODULES.includes(String(name))
    ),
    dependencies: (Array.isArray(data.dependencies) ? data.dependencies : []).filter(
      (name: unknown) => typeof name === 'string' && name in FUNCTIONAL_DEPENDENCIES
    ),
    keywords: (Array.isArray(data.keywords) ? data.keywords : [])
      .map((item: unknown) => cleanText(item, 60).toLowerCase())
      .filter(Boolean)
      .slice(0, 10),
    businessType: BUSINESS_TYPES.includes(data.businessType) ? data.businessType : '',
    languages: [...new Set((Array.isArray(data.languages) ? data.languages : []).map((code: unknown) => String(code).trim().slice(0, 2).toLowerCase()).filter((code: string) => /^[a-z]{2}$/.test(code)))].slice(0, 6) as string[],
  };

  return { manifest, problems };
}

function prompt(facts: SiteFacts, factsText: string, request: string, language: string, redesign?: RedesignPlan): string {
  const brief = request.trim();
  const fr = language === 'fr';
  return `# Le projet
${factsText}
${brief && brief !== facts.description ? `\n# La demande\n${brief.slice(0, 1500)}\n` : ''}${redesign ? `\n${redesign.brief}\n\n# Le plan de l'ancien site (chaque identifiant doit être placé)\n${redesign.outline}\n\n${coverageRule(fr, redesign.keepStructure)}\n` : ''}
# Ta tâche
Tu es l'architecte du site de ce projet. À partir des informations ci-dessus (secteur, offres, équipe, cible, localisation, description) et de la demande, analyse les besoins réels du projet pour concevoir son architecture sur mesure : la liste des pages à créer et, pour chacune, ses sections dans l'ordre.

## 1. DÉCISION DYNAMIQUE DE L'ARBORESCENCE DES PAGES
- **Analyse le projet** : n'applique aucun schéma préconçu ou rigide. C'est le contenu réel du projet, son secteur et sa clientèle qui déterminent quelles pages doivent être présentes.
- **Définis la liste des pages pertinentes** :
  * Évalue ce que le projet a à dire et à montrer : crée des pages dédiées dès que le contenu le justifie pour offrir une expérience complète et professionnelle (par exemple selon le domaine : services/prestations, carte/menu, catalogue/produits, histoire/à propos, réalisations/galerie, équipe, tarifs, FAQ, contact & accès...).
  * Si la consistance du projet ou la demande justifie une approche plus compacte ou une page unique avec ancres, adapte la structure en conséquence.
  * Chaque page créée doit avoir un objectif clair et contenir des sections substantielles (au moins 2 à 5 sections par page).
- La première page est obligatoirement l'accueil (slug: "").

## 2. SCÉNARISATION ET RICHESSE DES SECTIONS
- Pour chaque page que tu as décidé de créer, ordonne ses sections selon une progression narrative captivante.
- Chaque section possède :
  * Un identifiant "id" (kebab-case).
  * Un "brief" précis de 2 à 4 phrases décrivant son contenu exact, ce qu'elle valorise, et sa disposition (grille de cartes, colonnes asymétriques, étapes pas à pas, citations fortes, liste de bénéfices...).
  * Un type visuel "visual" : "photo", "illustration", "video" (au plus une sur le site) ou "none".
  * Une composition "layout", rangée ici par catégorie :
${layoutMenu(true)}
    Varie-les : jamais la même deux fois de suite, "cards" au plus une fois par page. Les ouvertures ("hero…") servent UNIQUEMENT à la première section d'une page. Choisis celle qui sert le contenu, pas la plus facile : une composition qui annonce des faits (chiffres, avis, prix, dates, horaires, noms) n'est choisie que si ces faits figurent dans les informations du projet.
  * Si le site est sur une seule page, renseigne "navLabel" sur les sections principales pour le menu d'ancres.
- La première section de l'accueil présente le projet avec force et oriente vers l'action principale.
- Les données factuelles (coordonnées, canaux de contact, offres réelles, localisation) s'appuient sur les faits du projet.
- Les briefs ne citent que ce que disent les faits : aucun délai, horaire, zone, prix, moyen de paiement, témoignage ou promesse (« gratuit », « express ») absent des informations du projet. Les auteurs des sections écrivent d'après tes briefs. Un formulaire de contact est possible : il ouvre WhatsApp ou l'e-mail.
- Tous les textes de structure (label, purpose, seoTitle, seoDescription, briefs) sont rédigés ${fr ? 'en français' : 'in English'}.

# Forme exacte de la réponse
Renvoie UNIQUEMENT un objet JSON valide avec la liste des pages que tu as choisies pour ce projet :
{
  "pages": [
    {
      "slug": "",
      "label": "${fr ? 'Accueil' : 'Home'}",
      "purpose": "${fr ? "Présenter l'activité et susciter l'intérêt immédiat" : 'Introduce the business and capture immediate interest'}",
      "seoTitle": "${fr ? 'titre SEO engageant (45 à 60 caractères)' : 'engaging SEO title (45 to 60 chars)'}",
      "seoDescription": "${fr ? 'description engageante (140 à 160 caractères)' : 'engaging meta description (140 to 160 chars)'}",
      "sections": [
        { "id": "hero", "brief": "…", "visual": "photo", "layout": "hero" },
        { "id": "presentation", "brief": "…", "visual": "none", "layout": "editorial" },
        { "id": "points-cles", "brief": "…", "visual": "illustration", "layout": "bento" }
      ]
    },
    {
      "slug": "slug-kebab-selon-le-projet",
      "label": "${fr ? 'Nom de la page' : 'Page Name'}",
      "purpose": "${fr ? 'Rôle et valeur apportée par cette page dédiée' : 'Purpose of this dedicated page'}",
      "seoTitle": "…",
      "seoDescription": "…",
      "sections": [
        { "id": "section-1", "brief": "…", "visual": "photo" },
        { "id": "section-2", "brief": "…", "visual": "none" }
      ]
    }
  ],
  "header": "${fr ? "Description de l'en-tête (marque, navigation vers les pages, action principale)" : 'Header description (brand, navigation to pages, primary CTA)'}",
  "footer": "${fr ? "Description du pied de page (liens des pages, coordonnées réelles, mentions)" : 'Footer description (page links, real contact details, notices)'}",
  "components": ["card", "badge"],
  "dependencies": [],
  "keywords": ["expressions clés pertinentes"],
  "businessType": "un type parmi : ${BUSINESS_TYPES.join(', ')}",
  "languages": []
}
${fr ? '« languages » : les autres langues du site (codes ISO : "en", "es"…) SEULEMENT si la demande en réclame explicitement (« en français et en anglais », « bilingue ») ; sinon une liste vide. Tu écris tout dans la langue du site : la traduction est faite après toi.' : '"languages": the site’s other languages (ISO codes: "fr", "es"…) ONLY if the request explicitly asks for them ("in English and French", "bilingual"); otherwise an empty list. Write everything in the site language: translation happens after you.'}
`;
}

/** Une refonte : la mission, le plan de l'ancien site, et ce que le manifeste doit couvrir. */
export interface RedesignPlan {
  brief: string;
  outline: string;
  coverage: Coverage;
  pageTitles: string[];
  pagePaths: string[];
  /** La forme de chaque section d'origine (`oldShapes`) : la composition retenue doit en changer. */
  shapes?: Record<string, string>;
  /** « Surtout le design » : les pages de l'ancien site restent des pages ; sinon l'architecture est libre. */
  keepStructure?: boolean;
}

function coverageRule(fr: boolean, keepStructure = false): string {
  if (keepStructure)
    return fr
      ? `# Règle de la refonte : RIEN ne disparaît, la structure reste
- Chaque page de l'ancien site (p0, p1, …) a sa page dans le nouveau site, avec "source": "p<n>" (p0 = l'accueil, en premier). Garde son adresse quand elle est lisible.
- Chaque section de l'ancien site (p<n>.s<m>) est reprise par une section du nouveau site : indique-la dans "sources" (une section peut en reprendre plusieurs, de la même page, quand elles vont ensemble).
- La « forme actuelle » d'une section est sa mise en page sur l'ancien site : choisis TOUJOURS une autre composition ("layout") — même contenu, mise en page neuve.
- Les articles cités mais non relevés sont listés sur la page qui regroupe les articles.
Forme : { "slug": "", "source": "p0", …, "sections": [ { "id": "hero", "sources": ["p0.s0"], "brief": "…", "visual": "photo", "layout": "…" }, … ] }`
      : `# Redesign rule: NOTHING disappears, the structure stays
- Every page of the old site (p0, p1, …) has its page in the new site, with "source": "p<n>" (p0 = home, first). Keep its address when it is readable.
- Every section of the old site (p<n>.s<m>) is carried by a section of the new site: list it in "sources" (one section may carry several from the same page when they belong together).
- A section's "current shape" is its layout on the old site: ALWAYS pick another composition ("layout") — same content, new layout.
- Articles mentioned but not read are listed on the page that groups articles.
Shape: { "slug": "", "source": "p0", …, "sections": [ { "id": "hero", "sources": ["p0.s0"], "brief": "…", "visual": "photo", "layout": "…" }, … ] }`;
  return fr
    ? `# Règle de la refonte : le CONTENU reste, la FORME est neuve
- Aucun contenu ne disparaît : chaque section de l'ancien site (p<n>.s<m>) est reprise par une section du nouveau site, indiquée dans "sources". Une section neuve peut en reprendre plusieurs (de pages différentes si elles parlent de la même chose), et une section d'origine trop chargée peut être répartie : liste-la alors dans chaque section qui en reprend une partie.
- Le découpage de l'ancien site n'est PAS un modèle : regroupe, sépare, réordonne, fusionne des pages trop minces ou crée la page qui manquait. "source": "p<n>" indique la page d'origine principale d'une page (p0 = l'accueil, toujours en premier, slug ""). Garde l'adresse d'une page quand elle existe encore.
- La « forme actuelle » d'une section est sa mise en page sur l'ancien site : choisis TOUJOURS une autre composition ("layout") pour ce contenu. Une grille de cartes devient une mosaïque, des rangées, des onglets ; un texte à côté d'une image devient une mise en page éditoriale ou un visuel pleine largeur.
- N'imite ni l'ordre des sections, ni le menu, ni les tournures de l'ancien site : c'est le parcours du visiteur qui décide (promesse → preuve → offre → action).
- Les articles cités mais non relevés sont listés sur la page qui regroupe les articles.
Forme : { "slug": "", "source": "p0", …, "sections": [ { "id": "hero", "sources": ["p0.s0", "p2.s1"], "brief": "…", "visual": "photo", "layout": "…" }, … ] }`
    : `# Redesign rule: the CONTENT stays, the FORM is new
- No content disappears: every section of the old site (p<n>.s<m>) is carried by a section of the new site, listed in "sources". A new section may carry several (from different pages when they are about the same thing), and an overloaded old section may be split: list it in every section that carries part of it.
- The old site's breakdown is NOT a model: group, split, reorder, merge pages that are too thin, or create the page that was missing. "source": "p<n>" names a page's main original page (p0 = home, always first, slug ""). Keep a page's address when it still exists.
- A section's "current shape" is its layout on the old site: ALWAYS pick another composition ("layout") for that content. A grid of cards becomes a bento, rows or tabs; copy beside an image becomes an editorial layout or a full-width visual.
- Do not imitate the old site's section order, menu or wording: the visitor's journey decides (promise → proof → offer → action).
- Articles mentioned but not read are listed on the page that groups articles.
Shape: { "slug": "", "source": "p0", …, "sections": [ { "id": "hero", "sources": ["p0.s0", "p2.s1"], "brief": "…", "visual": "photo", "layout": "…" }, … ] }`;
}

/**
 * Les compositions qui remplacent la forme qu'avait un contenu sur l'ancien site (`oldShapeOf`, inventory.ts). Rien
 * qui exige des faits que le contenu n'a pas (chiffres, avis, prix) : seulement d'autres façons de montrer la même
 * chose. Une galerie et un formulaire restent ce qu'ils sont (la mosaïque du catalogue n'est déjà pas une grille).
 */
const DEPARTURES: Partial<Record<string, LayoutId[]>> = {
  cards: ['bento', 'feature-rows', 'list-rows', 'feature-tabs'],
  features: ['bento', 'list-rows', 'feature-tabs', 'feature-rows'],
  'split-media': ['editorial', 'full-bleed-media', 'feature-rows'],
  intro: ['editorial', 'statement'],
  'cta-band': ['cta-split', 'statement'],
};
const NEEDS_VISUAL = new Set<LayoutId>(['full-bleed-media', 'feature-rows']);

/**
 * Une refonte ne remet pas un contenu dans la forme qu'il avait : une section dont la composition reproduit la forme
 * de ses sections d'origine en reçoit une autre (même famille, sans répétition sur la page). Les ouvertures de page
 * gardent la leur. Rend le nombre de compositions changées.
 */
export function departFromOld(manifest: SiteManifest, shapes: Record<string, string>): number {
  let changed = 0;
  for (const page of manifest.pages) {
    page.sections.forEach((section, index) => {
      if (!section.layout || OPENING_LAYOUTS.includes(section.layout) || !section.sources?.length) return;
      const old = section.sources.map((id) => shapes[id]).filter(Boolean);
      if (!old.includes(section.layout)) return;
      const used = new Set(page.sections.map((s) => s.layout));
      const previous = page.sections[index - 1]?.layout;
      const next = page.sections[index + 1]?.layout;
      const pool = (DEPARTURES[section.layout] ?? []).filter((id) => !(section.visual === 'none' && NEEDS_VISUAL.has(id)));
      const pick = pool.find((id) => !used.has(id) && id !== previous && id !== next && !old.includes(id)) ?? pool.find((id) => id !== previous && id !== next && !old.includes(id));
      if (!pick) return;
      section.layout = pick;
      changed += 1;
    });
  }
  return changed;
}

/** Le manifeste du site, ou `null` si aucun modèle n'a donné de réponse bien formée. */
export async function designManifest(options: {
  facts: SiteFacts;
  factsText: string;
  request: string;
  language: string;
  caller: ModelCaller;
  /** Refonte d'un site existant : la mission, le plan de l'ancien site et la couverture exigée. */
  redesign?: RedesignPlan;
}): Promise<{ manifest: SiteManifest | null; providerDown: boolean }> {
  const { facts, factsText, request, language, caller, redesign } = options;
  const fr = language === 'fr';
  const limits = redesign ? { maxPages: Math.max(7, redesign.coverage.pageCount + 2), maxSections: 16 } : {};

  const outcome = await caller.json(
    'manifest',
    "Tu es architecte de sites vitrines. Tu réponds UNIQUEMENT par un objet JSON valide, sans texte autour.",
    prompt(facts, factsText, request, language, redesign),
    (raw): Verdict<SiteManifest> => {
      const { manifest, problems } = readManifest(raw, limits);
      if (manifest && redesign) {
        // Une refonte qui oublie une page ou une section de l'ancien site repart au modèle, avec la liste ; au
        // dernier essai, le code place lui-même ce qui manque.
        const missing = missingCoverage(manifest, redesign.coverage);
        if (missing.pages.length || missing.sections.length) {
          return {
            problem: `${fr ? 'Il manque des éléments de l’ancien site' : 'Parts of the old site are missing'} — ${missing.pages.length ? `pages : ${missing.pages.map((n) => `p${n}`).join(', ')} ; ` : ''}${missing.sections.length ? `sections : ${missing.sections.slice(0, 60).join(', ')}` : ''}. ${fr ? 'Renvoie le manifeste complet en les plaçant toutes (champs "source" et "sources").' : 'Send the complete manifest placing them all ("source" and "sources" fields).'}`,
            salvage: () => completeCoverage(manifest, redesign.coverage, redesign.pageTitles, redesign.pagePaths, fr),
          };
        }
      }
      if (manifest) return { value: manifest };
      return {
        problem: `Votre réponse n'a pas la forme demandée : ${problems.slice(0, 4).join(' ; ') || 'objet JSON illisible'}. Renvoyez UNIQUEMENT l'objet JSON complet.`,
      };
    },
    redesign ? 14000 : 7000
  );

  // Une refonte change la forme de chaque contenu repris ; puis la variété des compositions, garantie par le code,
  // sans rappeler le modèle.
  const departed = outcome.value && redesign?.shapes ? departFromOld(outcome.value, redesign.shapes) : 0;
  const diversified = outcome.value ? diversifyLayouts(outcome.value) : 0;
  if (outcome.value) {
    ChatLogger.info('SITE_MANIFEST', 'Architecture du site', {
      layoutsAdjusted: diversified,
      ...(redesign ? { layoutsChangedFromOldSite: departed } : {}),
      pages: outcome.value.pages.map((page) => `${page.path} (${page.sections.length})`),
      components: outcome.value.components,
    });
  }

  return { manifest: outcome.value, providerDown: outcome.providerDown };
}

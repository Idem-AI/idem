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
  header: string;
  footer: string;
  /** Composants optionnels du catalogue utilisés par le site. */
  components: string[];
  /** Dépendances fonctionnelles demandées (liste fermée). */
  dependencies: string[];
  keywords: string[];
  businessType: string;
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
    .slice(0, 40);

const pascal = (slug: string): string => {
  const name = slug
    .split('-')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
  return /^[A-Z]/.test(name) ? name : `S${name}`;
};

/** Ce qu'une refonte impose au manifeste : une page par page d'origine, chaque section d'origine placée. */
export interface Coverage {
  pageCount: number;
  sectionIds: string[];
}

/** Les pages et sections de l'ancien site absentes du manifeste. */
export function missingCoverage(manifest: SiteManifest, coverage: Coverage): { pages: number[]; sections: string[] } {
  const pages = new Set(manifest.pages.map((p) => p.source).filter((n): n is number => typeof n === 'number'));
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
    const page = pages.find((p) => p.source === pageIndex) ?? pages[0];
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
      const sources = Array.isArray(item?.sources) ? item.sources.map((v: unknown) => String(v).trim()).filter((v: string) => /^p\d+\.s\d+$/.test(v)).slice(0, 12) : [];
      sections.push({ id, component, brief, visual, ...(navLabel ? { navLabel } : {}), ...(sources.length ? { sources } : {}) });
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
      ...(/^p?\d+$/.test(String(entry?.source ?? '')) ? { source: Number(String(entry.source).replace('p', '')) } : {}),
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
  };

  return { manifest, problems };
}

function prompt(facts: SiteFacts, factsText: string, request: string, language: string, redesign?: RedesignPlan): string {
  const brief = request.trim();
  const fr = language === 'fr';
  return `# Le projet
${factsText}
${brief && brief !== facts.description ? `\n# La demande\n${brief.slice(0, 1500)}\n` : ''}${redesign ? `\n${redesign.brief}\n\n# Le plan de l'ancien site (chaque identifiant doit être placé)\n${redesign.outline}\n\n${coverageRule(fr)}\n` : ''}
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
        { "id": "hero", "brief": "…", "visual": "photo" },
        { "id": "presentation", "brief": "…", "visual": "none" },
        { "id": "points-cles", "brief": "…", "visual": "illustration" }
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
  "businessType": "un type parmi : ${BUSINESS_TYPES.join(', ')}"
}
`;
}

/** Une refonte : la mission, le plan de l'ancien site, et ce que le manifeste doit couvrir. */
export interface RedesignPlan {
  brief: string;
  outline: string;
  coverage: Coverage;
  pageTitles: string[];
  pagePaths: string[];
}

function coverageRule(fr: boolean): string {
  return fr
    ? `# Règle de la refonte : RIEN ne disparaît
- Chaque page de l'ancien site (p0, p1, …) a sa page dans le nouveau site, avec "source": "p<n>" (p0 = l'accueil, en premier). Garde son adresse quand elle est lisible.
- Chaque section de l'ancien site (p<n>.s<m>) est reprise par une section du nouveau site : indique-la dans "sources" (une section peut en reprendre plusieurs, de la même page, quand elles vont ensemble ; tu peux réordonner).
- Tu améliores la présentation, l'ordre, les titres et les textes pour la cible ; tu n'enlèves aucun contenu.
- Les articles cités mais non relevés sont listés sur la page qui regroupe les articles.
Forme : { "slug": "", "source": "p0", …, "sections": [ { "id": "hero", "sources": ["p0.s0"], "brief": "…", "visual": "photo" }, … ] }`
    : `# Redesign rule: NOTHING disappears
- Every page of the old site (p0, p1, …) has its page in the new site, with "source": "p<n>" (p0 = home, first). Keep its address when it is readable.
- Every section of the old site (p<n>.s<m>) is carried by a section of the new site: list it in "sources" (one section may carry several from the same page when they belong together; you may reorder).
- You improve presentation, order, headings and copy for the audience; you remove no content.
- Articles mentioned but not read are listed on the page that groups articles.
Shape: { "slug": "", "source": "p0", …, "sections": [ { "id": "hero", "sources": ["p0.s0"], "brief": "…", "visual": "photo" }, … ] }`;
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

  if (outcome.value) {
    ChatLogger.info('SITE_MANIFEST', 'Architecture du site', {
      pages: outcome.value.pages.map((page) => `${page.path} (${page.sections.length})`),
      components: outcome.value.components,
    });
  }

  return { manifest: outcome.value, providerDown: outcome.providerDown };
}

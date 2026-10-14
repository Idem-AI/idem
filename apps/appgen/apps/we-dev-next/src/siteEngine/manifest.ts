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

/** Lecture structurelle de la réponse ; rend la liste des problèmes de forme. */
export function readManifest(raw: unknown): { manifest: SiteManifest | null; problems: string[] } {
  const problems: string[] = [];
  const data = raw && typeof raw === 'object' ? (raw as Record<string, any>) : null;
  if (!data || !Array.isArray(data.pages) || !data.pages.length) {
    return { manifest: null, problems: ['"pages" doit être une liste non vide'] };
  }

  const pages: ManifestPage[] = [];
  const keys = new Set<string>();

  for (const [index, entry] of (data.pages as any[]).slice(0, 7).entries()) {
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
    for (const item of Array.isArray(entry?.sections) ? (entry.sections as any[]).slice(0, 10) : []) {
      const id = slugify(item?.id ?? item?.name);
      const brief = cleanText(item?.brief, 500);
      if (!id || !brief || ids.has(id)) continue;
      let component = pascal(id);
      while (components.has(component) || component === 'SiteHeader' || component === 'SiteFooter') component = `${component}Section`;
      ids.add(id);
      components.add(component);
      const visual = VISUALS.includes(item?.visual) ? (item.visual as VisualKind) : 'none';
      const navLabel = cleanText(item?.navLabel, 28);
      sections.push({ id, component, brief, visual, ...(navLabel ? { navLabel } : {}) });
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

function prompt(facts: SiteFacts, factsText: string, request: string, language: string): string {
  const brief = request.trim();
  const fr = language === 'fr';
  return `# Le projet
${factsText}
${brief && brief !== facts.description ? `\n# La demande\n${brief.slice(0, 1500)}\n` : ''}
# Ta tâche
Tu conçois l'architecture COMPLÈTE et HAUT DE GAMME du site vitrine de ce projet : ses pages et, pour chaque page, ses sections dans l'ordre.

## 1. STRUCTURE MULTI-PAGES OBLIGATOIRE (par défaut)
Sauf si la demande de l'utilisateur exige explicitement un site "one-page" ou une "page unique", conçois TOUJOURS un site multi-pages riche et immersif de 3 à 5 pages distinctes :
- Page 1 : **Accueil** (slug: "", label: "${fr ? 'Accueil' : 'Home'}") avec 4 à 6 sections riches (Hero d'impact avec proposition de valeur, Présentation / Mission, Services phares ou Offres vedettes, Pourquoi nous choisir / Atouts majeurs, Démarche / Processus, Appel à l'action final).
- Page 2 : **À propos** (slug: "a-propos", label: "${fr ? 'À propos' : 'About'}") avec 3 à 5 sections (Histoire & Genèse du projet, Vision & Valeurs fondatrices, Notre savoir-faire & Équipe / Passion, Engagements qualité & démarche responsable).
- Page 3 : **Services / Offres** (slug: "services" ou "offres", label: "${fr ? 'Nos Services' : 'Services'}") avec 3 à 5 sections (Catalogue détaillé des prestations ou produits, Méthodologie pas à pas, Modalités / Garanties pratiques, FAQ spécifique aux services).
- Page 4 : **Contact & Accès** (slug: "contact", label: "Contact") avec 2 à 4 sections (Canaux d'échange directs et coordonnées réelles, Horaires / Disponibilités & Modalités d'accès, FAQ pratique avant de contacter).
- *(Optionnel selon le projet)* : Réalisations / Portfolio (slug: "realisations"), ou Tarifs (slug: "tarifs").

## 2. RICHESSE ET VARIÉTÉ DES SECTIONS
- Chaque section a un "brief" précis de 2 à 4 phrases : ce qu'elle montre, ce qu'elle dit avec force, et la disposition scénarisée (grille de cartes, colonnes asymétriques, frise d'étapes ordonnée, citation d'impact, visuel pleine largeur, liste de bénéfices avec icônes...).
- Varie les dispositions d'une section à l'autre pour créer un rythme éditorial dynamique. Pas de section fade ou générique.
- La première section de l'accueil présente le projet de façon saisissante et mène à l'action principale.
- Les prix, l'équipe, la localisation et les coordonnées viennent des faits du projet.
- "visual" : "photo" (scène réelle), "illustration" (dessin), "video" (au plus une sur tout le site) ou "none".
- "components" : composants optionnels dont le site a besoin, parmi : ${OPTIONAL_MODULES.join(', ')}.
- Tous les textes de structure (label, purpose, seoTitle, seoDescription, briefs) sont rédigés ${fr ? 'en français' : 'in English'}.

# Forme exacte de la réponse
Renvoie UNIQUEMENT cet objet JSON structuré avec TOUTES ses pages :
{
  "pages": [
    {
      "slug": "",
      "label": "${fr ? 'Accueil' : 'Home'}",
      "purpose": "${fr ? "Présenter l'activité, séduire les visiteurs et exposer la proposition de valeur" : 'Introduce the business, engage visitors and present the core value proposition'}",
      "seoTitle": "${fr ? 'titre captivant pour les moteurs de recherche, 45 à 60 caractères' : 'engaging SEO title, 45 to 60 characters'}",
      "seoDescription": "${fr ? 'description engageante de 140 à 160 caractères' : 'engaging meta description, 140 to 160 characters'}",
      "sections": [
        { "id": "hero", "brief": "…", "visual": "photo" },
        { "id": "presentation", "brief": "…", "visual": "none" },
        { "id": "apercu-services", "brief": "…", "visual": "illustration" },
        { "id": "pourquoi-nous-choisir", "brief": "…", "visual": "none" },
        { "id": "demarche", "brief": "…", "visual": "none" },
        { "id": "appel-action", "brief": "…", "visual": "none" }
      ]
    },
    {
      "slug": "a-propos",
      "label": "${fr ? 'À propos' : 'About'}",
      "purpose": "${fr ? 'Partager notre histoire, nos valeurs et les visages derrière le projet' : 'Share our story, core values, and the people behind the project'}",
      "seoTitle": "${fr ? 'Histoire et engagements' : 'Our Story and Values'}",
      "seoDescription": "…",
      "sections": [
        { "id": "histoire-vision", "brief": "…", "visual": "photo" },
        { "id": "nos-valeurs", "brief": "…", "visual": "none" },
        { "id": "notre-expertise", "brief": "…", "visual": "illustration" }
      ]
    },
    {
      "slug": "services",
      "label": "${fr ? 'Nos Services' : 'Services'}",
      "purpose": "${fr ? 'Présenter en détail chaque offre et le déroulement de nos prestations' : 'Detail every offering and describe our work process'}",
      "seoTitle": "${fr ? 'Nos Prestations et Solutions' : 'Our Services and Solutions'}",
      "seoDescription": "…",
      "sections": [
        { "id": "catalogue-prestations", "brief": "…", "visual": "photo" },
        { "id": "processus-collaboration", "brief": "…", "visual": "none" },
        { "id": "faq-services", "brief": "…", "visual": "none" }
      ]
    },
    {
      "slug": "contact",
      "label": "Contact",
      "purpose": "${fr ? 'Fournir tous les moyens de nous joindre, nos horaires et plan d\'accès' : 'Provide direct contact channels, hours, and location'}",
      "seoTitle": "${fr ? 'Contact et Accès' : 'Contact and Access'}",
      "seoDescription": "…",
      "sections": [
        { "id": "coordonnees-directes", "brief": "…", "visual": "illustration" },
        { "id": "horaires-et-acces", "brief": "…", "visual": "none" }
      ]
    }
  ],
  "header": "${fr ? "En-tête soigné avec la marque, la navigation fluide entre toutes les pages et le bouton d'action principal." : 'Refined header with brand mark, seamless navigation across all pages and primary action button.'}",
  "footer": "${fr ? "Pied de page complet avec la marque, la liste des pages, les coordonnées directes et les mentions légales." : 'Comprehensive footer with brand mark, page links, direct contact details and legal notices.'}",
  "components": ["card", "badge", "accordion"],
  "dependencies": [],
  "keywords": ["6 à 10 expressions que les clients tapent réellement"],
  "businessType": "un type parmi : ${BUSINESS_TYPES.join(', ')}"
}
`;
}

/** Le manifeste du site, ou `null` si aucun modèle n'a donné de réponse bien formée. */
export async function designManifest(options: {
  facts: SiteFacts;
  factsText: string;
  request: string;
  language: string;
  caller: ModelCaller;
}): Promise<{ manifest: SiteManifest | null; providerDown: boolean }> {
  const { facts, factsText, request, language, caller } = options;

  const outcome = await caller.json(
    'manifest',
    "Tu es architecte de sites vitrines. Tu réponds UNIQUEMENT par un objet JSON valide, sans texte autour.",
    prompt(facts, factsText, request, language),
    (raw): Verdict<SiteManifest> => {
      const { manifest, problems } = readManifest(raw);
      if (manifest) return { value: manifest };
      return {
        problem: `Votre réponse n'a pas la forme demandée : ${problems.slice(0, 4).join(' ; ') || 'objet JSON illisible'}. Renvoyez UNIQUEMENT l'objet JSON complet.`,
      };
    },
    7000
  );

  if (outcome.value) {
    ChatLogger.info('SITE_MANIFEST', 'Architecture du site', {
      pages: outcome.value.pages.map((page) => `${page.path} (${page.sections.length})`),
      components: outcome.value.components,
    });
  }

  return { manifest: outcome.value, providerDown: outcome.providerDown };
}

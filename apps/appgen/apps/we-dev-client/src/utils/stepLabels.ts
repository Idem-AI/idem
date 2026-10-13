/**
 * Ce que l'utilisateur lit pendant la génération.
 *
 * La conversation montrait des chemins de fichiers et des commandes npm. C'est
 * la trace d'un outil, pas le récit d'un travail : la personne qui attend son
 * site n'a pas à savoir qu'il existe un `src/content/hero.js`, ni ce qu'est un
 * `npx shadcn add`.
 *
 * Chaque action est donc traduite en une phrase qui dit ce qui se passe. Le
 * chemin reste accessible au survol et au clic — rien n'est caché, c'est le
 * vocabulaire qui change.
 */

/** Les contenus, nommés comme on en parlerait à voix haute. */
const CONTENT_LABELS: Record<string, string> = {
  nav: 'la navigation',
  hero: "l'accroche",
  logos: 'les références',
  features: 'les atouts',
  steps: 'les étapes',
  stats: 'les chiffres',
  testimonials: 'les avis',
  pricing: 'les tarifs',
  faq: 'les questions fréquentes',
  team: "l'équipe",
  contact: 'le contact',
  cta: "l'appel à l'action",
  footer: 'le pied de page',
};

/**
 * Contenus d'un site rédigé par l'orchestrateur : `<page>-<rôle>`.
 * `home-hero` → « l'accroche de l'accueil », `offers-pricing` → « les tarifs
 * de la page Offres ».
 */
const PAGE_NAMES: Record<string, string> = {
  home: "de l'accueil",
  offers: 'de la page Offres',
  about: 'de la page À propos',
  contact: 'de la page Contact',
};

const ROLE_LABELS: Record<string, string> = {
  hero: "l'accroche",
  header: "l'en-tête",
  features: 'les points forts',
  'split-a': "l'offre en détail",
  'split-b': 'le public visé',
  split: 'le déroulé',
  steps: 'les étapes',
  pricing: 'les tarifs',
  team: "l'équipe",
  faq: 'les questions fréquentes',
  contact: 'le contact',
  channels: 'les moyens de contact',
  story: "l'histoire",
  values: 'les engagements',
  cta: "l'appel à l'action",
};

function orchestratedContentLabel(name: string): string | null {
  const match = name.match(/^(home|offers|about|contact)-(.+)$/);
  if (!match) return null;
  const role = ROLE_LABELS[match[2]];
  return role ? `${role} ${PAGE_NAMES[match[1]]}` : null;
}

const readableSlug = (slug: string): string =>
  slug.replace(/[-_]/g, ' ').replace(/\.(jsx?|tsx?|css|json)$/, '').trim();

/** Nom de page lisible : `/` → l'accueil, `/notre-methode` → « notre methode ». */
const pageLabel = (segment: string): string =>
  segment ? `la page « ${readableSlug(segment)} »` : "la page d'accueil";

export function describeFile(path: string): string {
  const clean = path.replace(/^\.?\//, '');

  if (clean === 'idem.plan.json') return 'Je choisis les pages et les sections du site';
  if (clean === 'src/seo.js') return 'Je règle le référencement';
  if (clean === 'public/brand/pattern.svg') return 'Je reprends le motif de la charte';
  if (clean === 'src/sections/BrandPattern.jsx') return 'Je prépare les visuels au motif de la charte';
  if (clean.endsWith('globals.css') || clean.endsWith('styles/index.css')) {
    return "J'applique la charte graphique";
  }

  const content = clean.match(/^src\/content\/(.+)\.jsx?$/);
  if (content) {
    const name = content[1];
    const known = CONTENT_LABELS[name] ?? orchestratedContentLabel(name);
    return `J'écris ${known ?? `le contenu « ${readableSlug(name)} »`}`;
  }

  const page = clean.match(/^src\/app\/(?:(.+)\/)?page\.jsx?$/);
  if (page) return `J'assemble ${pageLabel(page[1] ?? '')}`;

  const layout = clean.match(/^src\/app\/.*layout\.jsx?$/);
  if (layout) return 'Je pose le cadre commun à toutes les pages';

  const section = clean.match(/^src\/sections\/(\w+)\.jsx?$/);
  if (section) return `Je façonne la section ${readableSlug(section[1])}`;

  const component = clean.match(/^src\/(?:components|ui)\/(?:.*\/)?(\w+)\.jsx?$/);
  if (component) return `Je prépare le composant ${readableSlug(component[1])}`;

  // Site vitrine : une page par fichier dans `src/pages/`.
  const sitePage = clean.match(/^src\/pages\/([\w-]+)\.jsx?$/);
  if (sitePage) return `J'assemble ${pageLabel(sitePage[1] === 'home' ? '' : sitePage[1])}`;

  const screen = clean.match(/^src\/screens\/(\w+)\.jsx?$/);
  if (screen) return `Je construis l'écran ${readableSlug(screen[1])}`;

  if (/^backend\/src\/routes\//.test(clean)) return "J'ouvre une route de l'API";
  if (clean.endsWith('schema.sql')) return 'Je dessine la base de données';
  if (clean.endsWith('seed.sql')) return 'Je prépare des données de départ';

  return `Je prépare ${readableSlug(clean.split('/').pop() ?? clean)}`;
}

/** Les bibliothèques, par leur nom d'usage plutôt que par leur paquet npm. */
const PACKAGE_LABELS: Record<string, string> = {
  motion: 'les animations',
  'framer-motion': 'les animations',
  'embla-carousel-react': 'les carrousels',
  recharts: 'les graphiques',
  'react-hook-form': 'les formulaires',
  zod: 'la validation des formulaires',
  '@tabler/icons-react': 'un jeu d’icônes',
  cobe: 'le globe animé',
  'react-router-dom': 'la navigation',
};

export function describeCommand(command: string): string {
  const trimmed = command.trim();

  const registry = trimmed.match(/shadcn@latest add\s+(?:@([\w-]+)\/)?([\w-]+)/);
  if (registry) {
    const [, source, component] = registry;
    const origin = source === 'magicui' ? ' (Magic UI)' : source === 'aceternity' ? ' (Aceternity)' : '';
    return `J'ajoute le composant ${readableSlug(component)}${origin}`;
  }

  const install = trimmed.match(/^(?:cd\s+\S+\s*&&\s*)?npm (?:install|i|add)\s*(.*)$/);
  if (install) {
    const packages = install[1].split(/\s+/).filter((part) => part && !part.startsWith('-'));
    if (!packages.length) return "J'installe les dépendances";
    const named = packages.map((pkg) => PACKAGE_LABELS[pkg] ?? pkg);
    return `J'ajoute ${named.join(', ')}`;
  }

  if (/\b(run\s+)?(dev|start)\b/.test(trimmed)) return "Je démarre l'aperçu";
  if (/\bbuild\b/.test(trimmed)) return 'Je construis le site';

  return 'Je prépare le projet';
}

/**
 * Le texte d'un message, débarrassé de ce qui n'est pas de la conversation.
 *
 * Le modèle glisse régulièrement du code hors des actions de fichier : un bloc
 * JSON de référencement, un module de contenu, un extrait « pour information ».
 * Ce code est récupéré ailleurs et écrit dans le projet ; l'afficher en plus
 * dans la conversation ne renseigne personne et noie ce qui compte.
 *
 * On retire donc les blocs de code et les objets JSON isolés. Ce qui reste —
 * les phrases — s'affiche normalement.
 */
export function sanitizeChatProse(text: string): string {
  if (!text) return '';

  let clean = text
    // Blocs de code, avec ou sans langage.
    .replace(/```[\s\S]*?```/g, '')
    // Balises d'artefact mal fermées, qui laissent du XML à l'écran.
    .replace(/<\/?bolt(Artifact|Action)[^>]*>/g, '');

  // Un objet JSON posé seul sur plusieurs lignes : c'est une donnée, pas une
  // phrase. On ne touche pas aux accolades en milieu de texte.
  clean = clean.replace(/(^|\n)\s*\{[\s\S]*?\n\s*\}\s*(?=\n|$)/g, '$1');

  return clean.replace(/\n{3,}/g, '\n\n').trim();
}

/* -------------------------------------------------------------------------- */
/*  Messages de l'atelier                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Marque invisible d'un message envoyé par l'atelier lui-même : relance des
 * contenus manquants, référencement, revue de design, reprise d'une réponse
 * coupée. Ces messages partent comme des messages « utilisateur » (c'est ainsi
 * que le modèle les reçoit), mais l'utilisateur ne les a pas écrits : la
 * conversation les montre comme une ligne d'état, pas comme une bulle à son nom.
 */
export const INTERNAL_MARK = '\u2063';

export const internalMessage = (text: string): string => `${INTERNAL_MARK}${text}`;

export const isInternalMessage = (content: unknown): boolean =>
  typeof content === 'string' && content.startsWith(INTERNAL_MARK);

export const internalText = (content: string): string => content.replace(INTERNAL_MARK, '').trim();

/**
 * La prose du modèle, si elle se lit comme une phrase adressée à quelqu'un.
 *
 * En mode Build, la conversation raconte ce qui se passe : la liste des étapes
 * le fait déjà. Ce que le modèle écrit autour n'est montré que si c'est une
 * vraie phrase. Un texte à titres, à tableaux, à balises, ou un pavé — le
 * modèle qui recopie ses consignes (« Signature move », tableaux de jetons),
 * le récapitulatif technique de fin de réponse — n'est pas une phrase : il
 * n'est pas affiché.
 */
export function conversationalProse(text: string): string {
  const clean = sanitizeChatProse(text);
  if (!clean) return '';

  const documentLike =
    /^\s{0,3}#{1,6}\s/m.test(clean) || // titres markdown
    /^\s*\|.*\|\s*$/m.test(clean) || // tableaux
    /<\/?[a-zA-Z][\w-]*(\s[^>]*)?>/.test(clean) || // balises
    /`[^`]*[/.][^`]*`/.test(clean) || // chemins et noms de fichiers en code
    /\b(src|public|node_modules)\/[\w./-]+/.test(clean) || // chemins nus
    clean.length > 600 ||
    clean.split(/\n\s*[-*]\s/).length > 6; // listes à rallonge

  return documentLike ? '' : clean;
}

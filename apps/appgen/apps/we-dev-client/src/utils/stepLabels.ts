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

const readableSlug = (slug: string): string =>
  slug.replace(/[-_]/g, ' ').replace(/\.(jsx?|tsx?|css|json)$/, '').trim();

/** Nom de page lisible : `/` → l'accueil, `/notre-methode` → « notre methode ». */
const pageLabel = (segment: string): string =>
  segment ? `la page « ${readableSlug(segment)} »` : "la page d'accueil";

export function describeFile(path: string): string {
  const clean = path.replace(/^\.?\//, '');

  if (clean === 'idem.plan.json') return 'Je choisis les pages et les sections du site';
  if (clean === 'src/seo.js') return 'Je règle le référencement';
  if (clean.endsWith('globals.css') || clean.endsWith('styles/index.css')) {
    return "J'applique la charte graphique";
  }

  const content = clean.match(/^src\/content\/(.+)\.jsx?$/);
  if (content) {
    const name = content[1];
    const known = CONTENT_LABELS[name];
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

  const screen = clean.match(/^src\/(?:screens|pages)\/(\w+)\.jsx?$/);
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

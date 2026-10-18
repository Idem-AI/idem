/**
 * Le nom d'une application générée, lu dans ses propres fichiers — pour le proposer partout où il
 * sert ensuite (nom de l'application en ligne, nom de domaine), quand elle n'est rattachée à aucun
 * projet IDEM (iCode ouvert directement).
 *
 * Dans l'ordre de confiance : le titre de la page (`<title>`, que le modèle écrit avec le nom de
 * l'activité), le nom du manifeste (application installable), puis `package.json` s'il n'est pas un
 * nom de gabarit (« vite-react-app »…). Rien de convaincant : chaîne vide, jamais un nom inventé.
 */
const GENERIC = /^(vite|react|app|my|web|frontend|backend|client|server|project|template|starter|demo|test|untitled|site|website|mon|nouvelle|new)([-_ ]?(react|vite|app|ts|typescript|project|template|starter|site|web|application))*$/i;

/** Les mots des gabarits (« Vite + React + TS », « React App ») : un titre fait seulement d'eux n'est pas un nom. */
const TEMPLATE_WORDS = new Set(['vite', 'react', 'ts', 'typescript', 'js', 'app', 'application', 'tailwind', 'starter', 'template', 'my', 'new', 'project', 'next', 'capacitor', 'pwa']);
const isTemplate = (value: string): boolean => {
  const words = value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return words.length > 0 && words.every((w) => TEMPLATE_WORDS.has(w));
};

/** Une partie de titre qui décrit la page plutôt que l'activité (« Accueil », « Home »…). */
const PAGE_WORD = /^(accueil|home|bienvenue|welcome|landing|index|page d'accueil)$/i;

function fromTitle(html: string | undefined): string {
  if (!html) return '';
  const title = /<title[^>]*>([^<]{1,120})<\/title>/i.exec(html)?.[1]?.trim() ?? '';
  // « Salon Awa | Coiffure à Douala » → « Salon Awa » ; la partie qui nomme l'activité, pas la page.
  const parts = title.split(/\s[|–—·:-]\s/).map((p) => p.trim()).filter(Boolean);
  const name = parts.find((p) => !PAGE_WORD.test(p) && !GENERIC.test(p) && !isTemplate(p)) ?? '';
  return name.length >= 2 ? name : '';
}

function fromJson(text: string | undefined, keys: string[]): string {
  if (!text) return '';
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    for (const key of keys) {
      const value = typeof data[key] === 'string' ? (data[key] as string).trim() : '';
      if (value && !GENERIC.test(value) && !isTemplate(value) && !/^@/.test(value)) return value;
    }
  } catch {
    /* fichier en cours d'écriture : on regardera au prochain passage */
  }
  return '';
}

export function deriveAppName(files: Record<string, unknown>): string {
  const text = (path: string): string | undefined => (typeof files[path] === 'string' ? (files[path] as string) : undefined);
  return (
    fromTitle(text('index.html')) ||
    fromTitle(text('frontend/index.html')) ||
    fromJson(text('public/manifest.webmanifest') ?? text('public/manifest.json') ?? text('frontend/public/manifest.webmanifest'), ['name', 'short_name']) ||
    fromJson(text('package.json') ?? text('frontend/package.json'), ['displayName', 'productName', 'name']).replace(/[-_]+/g, ' ')
  );
}

/** « Salon Awa & Fils » → « salon-awa-fils » : la forme qu'un nom de domaine peut prendre. */
export function domainLabel(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

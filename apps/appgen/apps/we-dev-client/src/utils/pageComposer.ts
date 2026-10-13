/**
 * Compositeur de page : le modèle décide, le code assemble.
 *
 * Écrire une page entière en JSX demande, en un seul jet, de tenir la mise en
 * page, le responsive, les imports, les exports et le contenu. Un petit modèle
 * échoue sur au moins un des cinq, et l'échec est total : un import oublié et
 * l'aperçu est mort.
 *
 * On découpe donc le travail en tâches qu'un petit modèle réussit :
 *
 *   1. un plan — quelles sections, dans quel ordre, quelles bibliothèques ;
 *   2. un fichier de contenu par section — un objet de données, pas du JSX ;
 *   3. l'assemblage — écrit ICI, par du code.
 *
 * Chaque tâche est courte, indépendante et vérifiable. Et l'étape où les
 * erreurs tuaient l'aperçu — les imports, l'ordre, la composition — n'est plus
 * confiée à personne : elle est déterministe.
 *
 * Sans plan dans l'espace de travail, ce module ne fait rien : un modèle qui
 * préfère écrire son `App.jsx` lui-même garde la main.
 */

/** Sections fournies par le socle (voir `scaffold/sections.ts`). */
const KIT = new Set([
  'Contact',
  'Cta',
  'Faq',
  'Features',
  'Footer',
  'Hero',
  'Logos',
  'Nav',
  'Pricing',
  'Split',
  'Stats',
  'Steps',
  'Team',
  'Testimonials',
]);

/**
 * Variantes réellement prévues par le kit.
 *
 * Le modèle en invente (« swiss », « modern »…). Une variante inconnue ne
 * casserait rien — la section retomberait sur son cas par défaut — mais elle
 * ferait croire à un choix qui n'a pas eu lieu. On la retire et on le dit.
 */
const VARIANTS: Record<string, Set<string>> = {
  Hero: new Set(['split', 'centered', 'editorial']),
  Features: new Set(['bento', 'rows', 'cards']),
  Pricing: new Set(['cards', 'table']),
};

export interface PlanVisual {
  /** Nom du composant à rendre dans l'emplacement visuel. */
  component: string;
  /** D'où il vient (chemin écrit par le CLI shadcn, par exemple). */
  import: string;
  /** Export nommé plutôt que par défaut. */
  named?: boolean;
}

export interface PlanSection {
  component: string;
  /** Nom du module de contenu dans `src/content/`. */
  content?: string;
  variant?: string;
  visual?: PlanVisual;
  /** `id` de la section : la cible d'un lien « #tarifs » de la navigation. */
  anchor?: string;
}

export interface PlanPage {
  /** Adresse de la page : `/` pour l'accueil, `/methode` ensuite. */
  path: string;
  /** Titre de l'onglet et des moteurs de recherche. */
  title?: string;
  /** Description de CETTE page, pour les résultats de recherche. */
  description?: string;
  sections: PlanSection[];
}

export interface PagePlan {
  /** `idem-site` : plan écrit par l'orchestrateur du serveur, pas par un modèle. */
  origin?: string;
  /** Langue du site (`fr`, `en`) : celle du contenu, qui peut différer de l'interface. */
  language?: string;
  /** Un site a des pages. Une page unique reste un cas particulier. */
  pages?: PlanPage[];
  /** Forme courte, conservée : un plan sans `pages` décrit l'accueil. */
  sections?: PlanSection[];
  libraries?: string[];
  registryComponents?: Record<string, string[]>;
}

export interface LibraryEntry {
  install?: string[];
  /** Vrai pour un registre shadcn (composants écrits dans le projet). */
  isRegistry?: boolean;
  /** Préfixe du registre (`@magicui`) ; vide pour shadcn/ui, qui s'appelle nu. */
  registryPrefix?: string;
}

export interface ComposeResult {
  writes: Record<string, string>;
  commands: string[];
  issues: string[];
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
/** Un nom de module de contenu, jamais un chemin : pas d'échappement possible. */
const CONTENT_NAME = /^[a-z0-9][a-z0-9-]*$/i;
/** Une ancre : minuscules, chiffres et tirets, comme dans une adresse. */
const ANCHOR = /^[a-z][a-z0-9-]*$/;

/**
 * Le nom de variable d'un module de contenu : `home-split-a` → `homeSplitAContent`.
 *
 * L'ancienne conversion ne remontait que les lettres : `home-split-1` donnait
 * `homeSplit-1Content`, un identifiant invalide, et la page entière ne
 * compilait plus.
 */
function contentBinding(name: string): string {
  const camel = name
    .split('-')
    .filter(Boolean)
    .map((part, index) => (index === 0 ? part : part[0].toUpperCase() + part.slice(1)))
    .join('');
  return `${/^[0-9]/.test(camel) ? '_' : ''}${camel}Content`;
}

/** Les sections qui encadrent la page : hors du `<main>`. */
const FRAME = new Set(['Nav', 'Footer']);

/** Les clés d'un plan écrit par l'orchestrateur du serveur. */
export const ORCHESTRATED_ORIGIN = 'idem-site';

/** Le plan du site a-t-il été écrit par l'orchestrateur (et non par un modèle) ? */
export function isOrchestratedSite(files: Record<string, string>): boolean {
  const plan = parseJson<PagePlan>(files['idem.plan.json'] ?? '');
  return plan?.origin === ORCHESTRATED_ORIGIN;
}

const parseJson = <T>(raw: string): T | null => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

/**
 * Les trois fichiers d'une page.
 *
 * Un site multi-pages Vite : un composant, un point d'entrée qui le monte, et
 * un document HTML qui porte les balises de référencement. Les trois sont
 * écrits par le code — c'est ce qui garantit que les imports, les chemins et
 * les balises concordent.
 */
function pageFilesOf(path: string): { name: string; page: string; entry: string; html: string } | null {
  const clean = (path || '/').trim().replace(/^\/+|\/+$/g, '');

  if (!clean) {
    return { name: 'home', page: 'src/pages/home.jsx', entry: 'src/entries/home.jsx', html: 'index.html' };
  }

  // Un seul niveau, en minuscules : une adresse est une promesse publique, pas
  // un endroit où accepter ce qui passe.
  if (!/^[a-z0-9][a-z0-9-]*$/.test(clean)) return null;

  return {
    name: clean,
    page: `src/pages/${clean}.jsx`,
    entry: `src/entries/${clean}.jsx`,
    html: `${clean}/index.html`,
  };
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Compose les pages du site à partir du plan et des contenus présents.
 *
 * Tout ce qui ne se vérifie pas est écarté plutôt que recopié : une section
 * inconnue, un contenu absent, une adresse douteuse. Le pire résultat
 * acceptable est un site plus court, jamais un site mort.
 */
export function composePage(
  files: Record<string, string>,
  planPath = 'idem.plan.json'
): ComposeResult | null {
  const raw = files[planPath];
  if (typeof raw !== 'string') return null;

  const plan = parseJson<PagePlan>(raw);
  if (!plan) {
    return { writes: {}, commands: [], issues: [`${planPath} illisible`] };
  }

  // Forme courte : un plan sans `pages` décrit l'accueil.
  const pages: PlanPage[] =
    Array.isArray(plan.pages) && plan.pages.length
      ? plan.pages
      : Array.isArray(plan.sections) && plan.sections.length
        ? [{ path: '/', sections: plan.sections }]
        : [];

  if (!pages.length) {
    return { writes: {}, commands: [], issues: [`${planPath} ne décrit aucune page`] };
  }

  const issues: string[] = [];
  const writes: Record<string, string> = {};

  const template = files['idem.page.html'];
  const manifest: Array<{ path: string; module: string; html: string }> = [];

  for (const page of pages) {
    const target = pageFilesOf(page?.path ?? '/');

    if (!target) {
      issues.push(`adresse « ${page?.path} » refusée, page ignorée`);
      continue;
    }

    const composed = composeOne(files, page, '../', issues);
    if (!composed) continue;

    writes[target.page] = composed;
    writes[target.entry] = `import { hydrateRoot } from 'react-dom/client';
import Page from '../pages/${target.name}.jsx';
import '../styles/index.css';

hydrateRoot(document.getElementById('root'), <Page />);
`;

    // Le document : titre et description de CETTE page dans le HTML servi.
    if (typeof template === 'string') {
      const lang = typeof plan.language === 'string' && /^[a-z]{2}$/.test(plan.language) ? plan.language : null;
      const localized = lang
        ? template
            .replace(/<html lang="[^"]*"/, `<html lang="${lang}"`)
            .replace(/(<meta property="og:locale" content=")[^"]*"/, `$1${lang}"`)
        : template;
      writes[target.html] = localized
        .replace(/\{\{title\}\}/g, escapeHtml(page.title ?? ''))
        .replace(/\{\{description\}\}/g, escapeHtml(page.description ?? ''))
        .replace('{{entry}}', `/${target.entry}`);
    }

    manifest.push({ path: target.html === 'index.html' ? '/' : `/${target.name}/`, module: target.page, html: target.html });
  }

  // Le pré-rendu a besoin de savoir quelle page rendre dans quel document.
  if (manifest.length) {
    writes['idem.pages.json'] = `${JSON.stringify({ pages: manifest }, null, 2)}\n`;
  }

  if (!Object.keys(writes).length) {
    return { writes: {}, commands: [], issues: [...issues, 'aucune page exploitable dans le plan'] };
  }

  return { writes, commands: resolveCommands(files, plan, issues), issues };
}

/** Le code d'une page : ses imports, ses sections, ses métadonnées. */
function composeOne(
  files: Record<string, string>,
  page: PlanPage,
  up: string,
  issues: string[]
): string | null {
  const imports: string[] = [];
  const before: string[] = [];
  const body: string[] = [];
  const after: string[] = [];
  const kitUsed = new Set<string>();
  const bindings = new Set<string>();

  (page.sections ?? []).forEach((section, index) => {
    const name = section?.component;

    if (!name || !KIT.has(name)) {
      issues.push(`section « ${name ?? '?'} » inconnue du kit, ignorée`);
      return;
    }

    const props: string[] = [];

    if (section.content) {
      if (!CONTENT_NAME.test(section.content)) {
        issues.push(`nom de contenu invalide pour ${name}, section ignorée`);
        return;
      }

      const contentPath = `src/content/${section.content}.js`;
      if (files[contentPath] === undefined) {
        // Une section annoncée dont le contenu manque s'afficherait vide — un
        // titre absent et une liste vide. On la retire : une page plus courte
        // se lit, une section creuse se remarque.
        issues.push(`${contentPath} absent → section ${name} retirée de la page`);
        return;
      }

      const binding = contentBinding(section.content);
      // Un même contenu cité deux fois sur la page : un seul import.
      if (!bindings.has(binding)) {
        bindings.add(binding);
        imports.push(`import ${binding} from '${up}content/${section.content}.js';`);
      }
      props.push(`{...${binding}}`);
    }

    if (section.anchor) {
      if (ANCHOR.test(section.anchor)) props.push(`id="${section.anchor}"`);
      else issues.push(`ancre « ${section.anchor} » refusée pour ${name}`);
    }

    if (section.variant) {
      if (VARIANTS[name]?.has(section.variant)) {
        props.push(`variant="${section.variant}"`);
      } else {
        issues.push(
          `variante « ${section.variant} » inconnue pour ${name} → celle de la direction artistique`
        );
      }
    }

    if (section.visual) {
      const { component, import: from, named } = section.visual;
      const safePath = typeof from === 'string' && /^[@.][\w@/.-]*$/.test(from);

      if (!IDENTIFIER.test(component ?? '') || !safePath) {
        issues.push(`visuel de ${name} ignoré (composant ou chemin non valide)`);
      } else {
        const binding = `Visual${index}`;
        imports.push(
          named
            ? `import { ${component} as ${binding} } from '${from}';`
            : `import ${binding} from '${from}';`
        );
        props.push(`visual={<${binding} />}`);
      }
    }

    kitUsed.add(name);
    const element = `<${name}${props.length ? ` ${props.join(' ')}` : ''} />`;
    // La navigation avant le contenu, le pied de page après : tout le reste
    // dans <main>, le repère que cherchent les lecteurs d'écran.
    if (FRAME.has(name)) (body.length ? after : before).push(`      ${element}`);
    else body.push(`        ${element}`);
  });

  if (!body.length) return null;

  const kitImport = `import { ${Array.from(kitUsed).sort().join(', ')} } from '${up}sections/index.js';`;

  // Le titre et la description de la page ne vivent pas ici : ils sont écrits
  // dans son document HTML (voir `composePage`), là où les lit un moteur.
  return `/**
 * Page assemblée par IDEM d'après \`idem.plan.json\`.
 *
 * Les sections viennent du kit, le contenu de \`src/content/\`. Pour changer la
 * page, demandez-le dans la conversation : le plan et les contenus sont
 * réécrits, et ce fichier recomposé.
 */
${[kitImport, ...imports].join('\n')}

export default function Page() {
  return (
    <>
${[...before, '      <main>', ...body, '      </main>', ...after].join('\n')}
    </>
  );
}
`;
}

/**
 * Commandes d'installation des bibliothèques choisies.
 *
 * Le catalogue est écrit par le serveur dans l'espace de travail
 * (`idem.libraries.json`) : l'atelier n'en garde pas de copie, qui finirait par
 * diverger.
 */
function resolveCommands(
  files: Record<string, string>,
  plan: PagePlan,
  issues: string[]
): string[] {
  const catalog = parseJson<Record<string, LibraryEntry>>(files['idem.libraries.json'] ?? '');
  if (!catalog) return [];

  const commands: string[] = [];
  const add = (command: string) => {
    if (!commands.includes(command)) commands.push(command);
  };

  for (const id of plan.libraries ?? []) {
    const entry = catalog[id];
    if (!entry) {
      issues.push(`bibliothèque « ${id} » hors catalogue, ignorée`);
      continue;
    }
    (entry.install ?? []).forEach(add);
  }

  for (const [id, components] of Object.entries(plan.registryComponents ?? {})) {
    const entry = catalog[id];
    if (!entry?.isRegistry) {
      issues.push(`« ${id} » n'est pas un registre, composants ignorés`);
      continue;
    }

    (entry.install ?? []).forEach(add);

    for (const component of components ?? []) {
      // Nom de composant uniquement : jamais une commande déguisée.
      if (!/^[a-z0-9][a-z0-9-]*$/i.test(component)) {
        issues.push(`composant « ${component} » ignoré (nom non valide)`);
        continue;
      }
      const reference = entry.registryPrefix ? `${entry.registryPrefix}/${component}` : component;
      add(`npx --yes shadcn@latest add ${reference} --yes --overwrite`);
    }
  }

  return commands;
}

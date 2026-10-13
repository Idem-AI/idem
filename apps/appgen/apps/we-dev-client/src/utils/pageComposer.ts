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

const parseJson = <T>(raw: string): T | null => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

/** Chemin du fichier de page Next pour une adresse du plan. */
function pageFileOf(path: string): string | null {
  const clean = (path || '/').trim().replace(/^\/+|\/+$/g, '');
  if (!clean) return 'src/app/page.jsx';
  // Un seul niveau, en minuscules : une adresse est une promesse publique, pas
  // un endroit où accepter ce qui passe.
  if (!/^[a-z0-9][a-z0-9-]*$/.test(clean)) return null;
  return `src/app/${clean}/page.jsx`;
}

/** Profondeur de l'import relatif depuis `src/app/<...>/page.jsx` vers `src/`. */
const upTo = (file: string): string => '../'.repeat(file.split('/').length - 2);

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

  for (const page of pages) {
    const file = pageFileOf(page?.path ?? '/');

    if (!file) {
      issues.push(`adresse « ${page?.path} » refusée, page ignorée`);
      continue;
    }

    const composed = composeOne(files, page, upTo(file), issues);
    if (composed) writes[file] = composed;
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
  const body: string[] = [];
  const kitUsed = new Set<string>();

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

      const binding = `${section.content.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}Content`;
      imports.push(`import ${binding} from '${up}content/${section.content}.js';`);
      props.push(`{...${binding}}`);
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
    body.push(`      <${name}${props.length ? ` ${props.join(' ')}` : ''} />`);
  });

  if (!body.length) return null;

  const kitImport = `import { ${Array.from(kitUsed).sort().join(', ')} } from '${up}sections/index.js';`;

  // Les métadonnées de la page partent dans le HTML servi : c'est ce que lit un
  // moteur de recherche, et la raison d'être de Next ici.
  const metadata =
    page.title || page.description
      ? `\nexport const metadata = {${page.title ? `\n  title: ${JSON.stringify(page.title)},` : ''}${
          page.description ? `\n  description: ${JSON.stringify(page.description)},` : ''
        }\n};\n`
      : '';

  return `/**
 * Page assemblée par IDEM d'après \`idem.plan.json\`.
 *
 * Les sections viennent du kit, le contenu de \`src/content/\`. Pour changer la
 * page, demandez-le dans la conversation : le plan et les contenus sont
 * réécrits, et ce fichier recomposé.
 */
${[kitImport, ...imports].join('\n')}
${metadata}
export default function Page() {
  return (
    <>
${body.join('\n')}
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

/**
 * Catalogue de bibliothèques : le menu dans lequel l'agent choisit.
 *
 * Trois façons d'ajouter du composant à un projet, et une seule est écrite par
 * le modèle :
 *
 * 1. le socle — déjà là, rien à faire ;
 * 2. un paquet npm — une commande, déterministe, hors ligne une fois en cache ;
 * 3. un registre shadcn (shadcn/ui, Magic UI, Aceternity) — le CLI écrit les
 *    fichiers dans le projet, donc le composant arrive *en code source*, pas en
 *    dépendance opaque.
 *
 * Le modèle ne branche rien lui-même : il NOMME ce qu'il veut, et le code pose
 * les commandes. Choisir dans un menu est à la portée d'un petit modèle ;
 * écrire une intégration ne l'est pas. C'est le même principe que la trousse de
 * composants et le kit de sections, poussé jusqu'aux bibliothèques tierces.
 *
 * Les registres shadcn sont marqués `réseau` : le CLI télécharge au moment de
 * la génération. Quand il échoue, rien n'est cassé — le projet tourne déjà sans
 * eux, et le portail de compilation remplace l'import manquant.
 */

import { BuildTarget } from '../config/buildTarget.js';

export type LibraryKind = 'package' | 'registry';

export interface Library {
  id: string;
  name: string;
  kind: LibraryKind;
  /** Ce que ça apporte, en une ligne — c'est ce que l'agent lit pour choisir. */
  what: string;
  /** Quand le prendre, et quand s'en passer. */
  pick: string;
  /** Paquets npm à installer (le CLI shadcn pose le reste). */
  packages: string[];
  /** Comment l'importer, pour que le modèle n'invente pas le chemin. */
  usage?: string;
  /** Cibles concernées ; vide = toutes. */
  targets?: BuildTarget[];
  /** Le CLI a besoin du réseau au moment de la génération. */
  network?: boolean;
}

/**
 * Le catalogue.
 *
 * Tenu court volontairement : un menu de quarante entrées ne fait pas choisir
 * mieux, il fait choisir au hasard. Chaque entrée est stable, maintenue, et
 * compatible Vite + React 18 + Tailwind v3 — ce que le socle pose.
 */
export const LIBRARIES: Library[] = [
  {
    id: 'motion',
    name: 'Motion (ex-Framer Motion)',
    kind: 'package',
    what: 'Animations React : entrées au défilement, transitions, gestes.',
    pick: "Quand le mouvement sert le propos — une démonstration, un chiffre qui monte. Pas pour animer tout ce qui bouge.",
    packages: ['motion'],
    usage: "import { motion } from 'motion/react'",
  },
  {
    id: 'shadcn',
    name: 'shadcn/ui',
    kind: 'registry',
    what: "Composants d'interface accessibles (Radix + Tailwind), écrits dans le projet par le CLI.",
    pick: "Dès qu'il faut un dialogue, un menu déroulant, un onglet, une infobulle — tout ce qui a un comportement clavier à respecter.",
    packages: [],
    usage: "npx shadcn@latest add dialog (puis import { Dialog } from '@/components/ui/dialog')",
    network: true,
  },
  {
    id: 'embla',
    name: 'Embla Carousel',
    kind: 'package',
    what: 'Carrousel tactile, léger, sans dépendance.',
    pick: 'Galerie de produits, avis qui défilent, étapes sur téléphone.',
    packages: ['embla-carousel-react'],
    usage: "import useEmblaCarousel from 'embla-carousel-react'",
  },
  {
    id: 'recharts',
    name: 'Recharts',
    kind: 'package',
    what: 'Graphiques React (lignes, barres, aires, camemberts).',
    pick: "Un tableau de bord, ou une page qui montre des chiffres. Jamais pour décorer.",
    packages: ['recharts'],
    usage: "import { LineChart, Line, XAxis } from 'recharts'",
    targets: ['web-app', 'mobile-app'],
  },
  {
    id: 'forms',
    name: 'React Hook Form + Zod',
    kind: 'package',
    what: 'Formulaires contrôlés avec validation déclarée et messages par champ.',
    pick: "Dès qu'un formulaire a plus de trois champs, ou qu'une erreur doit être lisible.",
    packages: ['react-hook-form', 'zod', '@hookform/resolvers'],
    usage: "import { useForm } from 'react-hook-form'",
  },
  {
    id: 'tabler-icons',
    name: 'Tabler Icons',
    kind: 'package',
    what: "Jeu d'icônes au trait, complémentaire de Lucide (déjà installé).",
    pick: "Seulement si Lucide n'a pas l'icône métier qu'il faut. Jamais deux jeux pour le même écran.",
    packages: ['@tabler/icons-react'],
    usage: "import { IconBrandWhatsapp } from '@tabler/icons-react'",
  },
];

const byId = new Map(LIBRARIES.map((library) => [library.id, library]));

/** Les paquets que le portail de compilation accepte d'installer tout seul. */
export const catalogPackages = (): string[] =>
  Array.from(new Set(LIBRARIES.flatMap((library) => library.packages)));

/** Le menu envoyé au modèle : identifiant, apport, quand le prendre. */
export function renderLibraryMenu(target: BuildTarget): string {
  const available = LIBRARIES.filter(
    (library) => !library.targets || library.targets.includes(target)
  );

  const lines = available.map(
    (library) => `- \`${library.id}\` — ${library.name}. ${library.what} ${library.pick}`
  );

  return [
    '### Bibliothèques disponibles (vous CHOISISSEZ, le code installe)',
    "Nommez celles qui servent ce projet dans le plan ci-dessous. N'écrivez aucune commande d'installation et n'inventez aucun autre paquet : ce qui n'est pas dans cette liste n'existe pas.",
    ...lines,
    'Prenez-en zéro à deux. Le socle suffit à une page professionnelle ; une bibliothèque ne se justifie que par un besoin précis.',
  ].join('\n');
}

/**
 * Traduit les choix en commandes.
 *
 * Les paquets d'abord, les registres ensuite : le CLI shadcn s'appuie sur les
 * dépendances (Motion, notamment) et sur `components.json`, que le socle pose.
 */
export function resolveLibraryCommands(
  ids: string[],
  components: Record<string, string[]> = {}
): { commands: string[]; chosen: Library[]; unknown: string[] } {
  const chosen: Library[] = [];
  const unknown: string[] = [];
  const packages = new Set<string>();
  const registryCommands: string[] = [];

  for (const id of ids) {
    const library = byId.get(id);
    if (!library) {
      unknown.push(id);
      continue;
    }

    chosen.push(library);
    library.packages.forEach((pkg) => packages.add(pkg));

    for (const component of components[id] ?? []) {
      // Le nom vient du modèle : on n'accepte que ce qui ressemble à un
      // composant de registre, jamais une commande déguisée.
      if (!/^[@a-z0-9][a-z0-9/-]*$/i.test(component)) continue;
      const reference = library.id === 'shadcn' ? component : `@${library.id.replace('-ui', '')}/${component}`;
      registryCommands.push(`npx --yes shadcn@latest add ${reference} --yes --overwrite`);
    }
  }

  const commands: string[] = [];
  if (packages.size) commands.push(`npm install ${Array.from(packages).sort().join(' ')}`);
  commands.push(...registryCommands);

  return { commands, chosen, unknown };
}

/**
 * Le catalogue déposé dans l'espace de travail (`idem.libraries.json`).
 *
 * L'atelier en a besoin pour traduire les choix du plan en commandes, et il ne
 * peut pas importer ce module (il tourne dans le navigateur). Le passer par un
 * fichier du socle évite d'en tenir une seconde copie côté client, qui finirait
 * par diverger de celle-ci.
 */
export function renderLibraryManifest(target: BuildTarget): string {
  const entry: Record<string, unknown> = {};

  for (const library of LIBRARIES) {
    if (library.targets && !library.targets.includes(target)) continue;

    entry[library.id] = {
      install: library.packages.length ? [`npm install ${library.packages.join(' ')}`] : [],
      isRegistry: library.kind === 'registry',
      // shadcn/ui s'installe par son nom nu ; les autres registres ont un
      // préfixe déclaré dans `components.json`.
      registryPrefix: library.kind === 'registry' && library.id !== 'shadcn'
        ? `@${library.id.replace('-ui', '')}`
        : '',
    };
  }

  return `${JSON.stringify(entry, null, 2)}\n`;
}

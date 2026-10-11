/**
 * Starter préconfiguré — le socle que le modèle n'écrit plus.
 *
 * Avant : chaque génération commençait par réécrire la même vingtaine de
 * fichiers de configuration (manifeste npm, Vite, PostCSS, Tailwind avec les
 * jetons de la charte, `index.html`, point d'entrée, service worker, cadre
 * d'écran mobile, bascule PGlite/`pg`…). C'étaient des jetons de sortie — les
 * plus chers — dépensés pour un contenu que nous connaissons d'avance, et une
 * occasion de rater le `<script type="module">` ou une nuance de la palette.
 *
 * Maintenant : le client demande ce starter, le monte dans l'espace de travail,
 * et le modèle ne produit que le produit (écrans, sections, routes, données).
 * Les fichiers du starter sont « verrouillés » : ils ne partent pas dans le
 * contexte et une tentative de réécriture est ignorée côté client.
 *
 * Le starter est déterministe : même projet, même cible, mêmes octets. La
 * charte vient de la forge de jetons, donc l'identité du projet est déjà dans
 * `tailwind.config.js` et dans `index.html` avant le premier mot du modèle.
 */

import { BuildTarget } from '../config/buildTarget.js';
import { DesignSystem, forgeDesignSystem } from '../design/tokenForge.js';
import { ProjectModel } from '../types/project.js';
import { buildMobileScaffold } from './mobileApp.js';
import { buildSiteScaffold } from './site.js';
import { buildWebAppScaffold } from './webApp.js';

/**
 * Version du starter. À incrémenter dès que le contenu d'un fichier verrouillé
 * change : le client s'en sert pour savoir qu'un espace de travail ouvert
 * tourne sur un socle périmé.
 */
export const SCAFFOLD_VERSION = '1';

export interface Scaffold {
  version: string;
  target: BuildTarget;
  /** Chemin → contenu, à monter tel quel dans l'espace de travail. */
  files: Record<string, string>;
  /** Fichiers posés par le code : le modèle ne doit jamais les émettre. */
  locked: string[];
  commands: { install: string; start: string };
}

export interface ScaffoldOptions {
  target: BuildTarget;
  projectData?: ProjectModel;
  /** Langue de l'interface : sert l'attribut `lang` du document. */
  language?: string;
  /** Charte déjà forgée (évite de la recalculer dans la chaîne de génération). */
  system?: DesignSystem;
}

export function buildScaffold(options: ScaffoldOptions): Scaffold {
  const { target, projectData } = options;
  const system = options.system ?? forgeDesignSystem(projectData);
  const language = (options.language ?? 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en';

  const { files, locked } =
    target === 'site'
      ? buildSiteScaffold(system, projectData, language)
      : target === 'mobile-app'
        ? buildMobileScaffold(system, projectData, language)
        : buildWebAppScaffold(system, projectData, language);

  return {
    version: SCAFFOLD_VERSION,
    target,
    files,
    locked,
    commands: { install: 'npm install', start: 'npm run dev' },
  };
}

/**
 * Rappel envoyé au modèle quand l'espace de travail porte déjà le starter.
 *
 * Court par construction : le contrat détaillé (arborescence, trousse de
 * composants, interdits) vit dans la skill `webcontainer-*`, qui voyage dans le
 * préfixe système mis en cache. Ici, seulement ce qui dépend du projet.
 */
export function renderScaffoldNotice(scaffold: Scaffold): string {
  return [
    '## STARTER IN PLACE — CONFIRMED FOR THIS WORKSPACE',
    `The preconfigured starter listed in the build contract above is mounted in \`/home/project\` (v${scaffold.version}, ${scaffold.locked.length} locked files) and the project already starts.`,
    "The design system above is **already** in `tailwind.config.js`, and the fonts are **already** linked in `index.html`. Do not emit a configuration file, a `package.json`, an entry point or a component-kit file: the workspace drops those actions, so writing them costs you output and changes nothing.",
    'Write only the product files. A package that is not installed yet: `<boltAction type="shell">npm install name</boltAction>`.',
  ].join('\n');
}

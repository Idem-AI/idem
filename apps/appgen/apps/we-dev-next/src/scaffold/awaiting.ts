/**
 * L'écran que l'utilisateur voit pendant que le modèle écrit.
 *
 * Le serveur de développement ne démarre plus à la fin de la génération mais
 * dès que les dépendances sont en place — soit une dizaine de secondes après
 * l'ouverture. L'aperçu apparaît donc *avant* que le produit existe, et ce
 * qu'il montre à ce moment-là devient la première impression de l'atelier.
 *
 * Ce que montrait le socle jusqu'ici : « Espace de travail prêt. », en gris, au
 * milieu d'une page blanche. Juste, et désolant. Un utilisateur qui vient de
 * demander un site y lit une panne.
 *
 * Ce qu'il montre maintenant : **un squelette de la mise en page qui arrive**,
 * dans les couleurs du projet. La règle du design system le dit mieux que moi —
 * « un squelette ne dit pas *ça tourne*, il dit *voilà la forme de ce qui
 * arrive*, et c'est meilleur dès qu'on connaît la mise en page à venir ». Ici
 * on la connaît : le socle sait s'il construit un site vitrine, un tableau de
 * bord ou une application de téléphone.
 *
 * Et il s'efface tout seul : le premier fichier écrit par le modèle remplace
 * cette page, et le rechargement à chaud de Vite l'affiche à sa place. Le
 * marqueur `idem:placeholder` reste en tête — l'atelier s'en sert pour savoir
 * qu'un projet n'a pas encore été généré.
 *
 * ## Deux vocabulaires, et pourquoi
 *
 * Les cibles ne parlent pas la même langue Tailwind. Le socle applicatif a ses
 * jetons (`bg-surface`, `text-ink`, `px-block`) ; le template du site, lui,
 * **remplace** la palette de Tailwind par celle de son design system
 * (`bg-background`, `text-muted-foreground`) — `bg-neutral-200` n'y existe
 * tout simplement pas, et une barre de squelette écrite avec cette classe
 * serait invisible. Donc une page d'attente sans aucun contenu visible, c'est-
 * à-dire exactement la panne qu'on cherche à éviter. Le vocabulaire est choisi
 * par la cible, et les deux sont listés ci-dessous.
 */

import { BuildTarget } from '../config/buildTarget.js';
import { ProjectModel } from '../types/project.js';

const TEXTS = {
  fr: {
    building: 'Votre projet est en train de s’écrire',
    detail: 'Les écrans apparaissent ici au fur et à mesure.',
  },
  en: {
    building: 'Your project is being written',
    detail: 'Screens appear here as they are built.',
  },
} as const;

interface Vocabulary {
  page: string;
  heading: string;
  text: string;
  muted: string;
  /** Le gris d'une barre de squelette : la seule couleur de forme utilisée. */
  bar: string;
  border: string;
  /** Marge intérieure horizontale de la page. */
  gutter: string;
  /** Écart entre deux blocs. */
  block: string;
  /** Écart serré, entre les lignes d'une même liste. */
  tight: string;
  /** Marge basse, pour que le squelette ne colle pas au pied de l'écran. */
  bottom: string;
  measure: string;
}

/** Le socle applicatif : jetons forgés depuis la charte du projet. */
const SCAFFOLD_VOCABULARY: Vocabulary = {
  page: 'bg-surface',
  heading: 'font-display text-base text-ink',
  text: 'text-sm text-ink',
  muted: 'text-sm text-ink-muted',
  bar: 'bg-neutral-200',
  border: 'border-neutral-200',
  gutter: 'px-block',
  block: 'mt-block',
  tight: 'space-y-tight',
  bottom: 'pb-section',
  measure: 'max-w-measure',
};

/** Le template du site : palette du design system, sans les couleurs Tailwind. */
const SITE_VOCABULARY: Vocabulary = {
  page: 'bg-background',
  heading: 'font-heading text-base text-foreground',
  text: 'text-sm text-foreground',
  muted: 'text-sm text-muted-foreground',
  bar: 'bg-muted',
  border: 'border-border',
  gutter: 'px-6',
  block: 'mt-8',
  tight: 'space-y-3',
  bottom: 'pb-24',
  measure: 'max-w-prose',
};

const vocabularyFor = (target: BuildTarget): Vocabulary =>
  target === 'site' ? SITE_VOCABULARY : SCAFFOLD_VOCABULARY;

/** Du texte sûr dans du JSX : les accolades y sont du code. */
const escapeJsx = (value: string): string => value.replace(/[{}]/g, '');

const title = (projectData?: ProjectModel): string => projectData?.name?.trim() || 'IDEM';

/**
 * Le squelette, en JSX prêt à coller.
 *
 * Un seul `animate-pulse`, posé sur le conteneur : l'animation doit être *une*
 * chose qui respire, pas quinze qui clignotent à contretemps.
 */
function skeleton(target: BuildTarget, vocabulary: Vocabulary): string {
  const bar = (classes: string) => `<div className="${classes} rounded ${vocabulary.bar}" />`;

  if (target === 'mobile-app') {
    return `      <div className="animate-pulse ${vocabulary.gutter} ${vocabulary.block} ${vocabulary.tight}">
        ${bar('h-6 w-2/3')}
        ${bar('h-40 w-full')}
        ${bar('h-14 w-full')}
        ${bar('h-14 w-full')}
        ${bar('h-14 w-5/6')}
      </div>`;
  }

  if (target === 'web-app') {
    return `      <div className="animate-pulse ${vocabulary.gutter} ${vocabulary.block}">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          ${bar('h-20')}
          ${bar('h-20')}
          ${bar('h-20')}
          ${bar('h-20')}
        </div>
        <div className="${vocabulary.block} ${vocabulary.tight}">
          ${bar('h-10 w-full')}
          ${bar('h-10 w-full')}
          ${bar('h-10 w-11/12')}
          ${bar('h-10 w-10/12')}
        </div>
      </div>`;
  }

  return `      <div className="animate-pulse ${vocabulary.gutter} ${vocabulary.block}">
        <div className="${vocabulary.tight}">
          ${bar(`h-10 w-3/4 ${vocabulary.measure}`)}
          ${bar(`h-4 w-1/2 ${vocabulary.measure}`)}
        </div>
        ${bar(`${vocabulary.block} h-48 w-full`)}
        <div className="${vocabulary.block} grid gap-3 sm:grid-cols-3">
          ${bar('h-28')}
          ${bar('h-28')}
          ${bar('h-28')}
        </div>
      </div>`;
}

/**
 * Le corps de la page d'attente, sans import ni export : chaque cible l'insère
 * dans son propre cadre.
 *
 * Aucun import de composant, volontairement — ni la trousse du socle, ni le
 * design system du site. Ce sont exactement les fichiers que le modèle est en
 * train d'écrire, et un import vers un fichier encore absent remplacerait
 * l'attente par l'écran d'erreur de Vite.
 */
export function awaitingBody(options: {
  target: BuildTarget;
  projectData?: ProjectModel;
  language?: string;
}): string {
  const language = (options.language ?? 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en';
  const text = TEXTS[language];
  const vocabulary = vocabularyFor(options.target);

  return `    <div className="min-h-screen ${vocabulary.page} ${vocabulary.bottom}">
      <header className="border-b ${vocabulary.border} ${vocabulary.gutter} py-4">
        <p className="${vocabulary.heading}">${escapeJsx(title(options.projectData))}</p>
      </header>

      <div className="${vocabulary.gutter} ${vocabulary.block}">
        <p className="${vocabulary.text}">${escapeJsx(text.building)}</p>
        <p className="${vocabulary.muted}">${escapeJsx(text.detail)}</p>
      </div>

${skeleton(options.target, vocabulary)}
    </div>`;
}

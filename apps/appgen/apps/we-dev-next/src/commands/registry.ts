/**
 * LES COMMANDES D'iCODE — « /redesign monsite.com », « /charter »… Chacune est un déroulé déjà pensé pour
 * atteindre un résultat précis : les bonnes questions (à cliquer, la recommandation en tête), puis le bon moteur.
 *
 *   server   le serveur mène le déroulé (questions, génération) : la commande part comme un message ;
 *   client   l'atelier la règle sur place (ouvrir la mise en ligne, mener au module Communication…).
 *
 * Une seule liste : l'atelier la lit (`GET /api/commands`) pour son menu « / », le serveur pour reconnaître la
 * commande tapée. Toutes les commandes s'écrivent en anglais (décision du 27/10/2026) ; leurs libellés et
 * descriptions suivent la langue de l'interface.
 */

export type CommandName = 'redesign' | 'site' | 'charter' | 'publish' | 'domain' | 'communication' | 'fix' | 'help';

export interface CommandSpec {
  name: CommandName;
  aliases: string[];
  run: 'server' | 'client';
  /** Ce qu'il faut avoir pour s'en servir : un projet IDEM ouvert. */
  needs?: 'project';
  label: { fr: string; en: string };
  description: { fr: string; en: string };
  /** Ce que la commande attend après son nom, s'il y a lieu. */
  args?: { fr: string; en: string };
}

export const COMMANDS: readonly CommandSpec[] = [
  {
    name: 'redesign',
    aliases: ['rebuild'],
    run: 'server',
    label: { fr: 'Refaire un site existant', en: 'Redesign an existing site' },
    description: {
      fr: 'Je lis votre site (logo, couleurs, polices, photos, textes) et je le refais plus moderne et plus clair pour vos clients.',
      en: 'I read your site (logo, colours, fonts, photos, copy) and rebuild it more modern and clearer for your customers.',
    },
    args: { fr: 'adresse du site', en: 'site address' },
  },
  {
    name: 'site',
    aliases: ['website'],
    run: 'server',
    label: { fr: 'Créer mon site vitrine', en: 'Create my showcase website' },
    description: {
      fr: 'Trois questions (pages, action du visiteur, style), puis le site est écrit à partir de votre projet.',
      en: 'Three questions (pages, visitor action, style), then the site is written from your project.',
    },
  },
  {
    name: 'charter',
    aliases: ['brand'],
    run: 'server',
    needs: 'project',
    label: { fr: 'Créer ma charte graphique', en: 'Create my brand guidelines' },
    description: {
      fr: 'Logo décliné, couleurs, typographies et règles d’usage dans un document, généré dans votre projet IDEM.',
      en: 'Logo variations, colours, typefaces and usage rules in one document, generated in your IDEM project.',
    },
  },
  {
    name: 'publish',
    aliases: ['deploy'],
    run: 'client',
    label: { fr: 'Mettre en ligne', en: 'Go live' },
    description: { fr: 'Publier le site ou l’application, avec une adresse à partager.', en: 'Publish the site or app, with an address to share.' },
  },
  {
    name: 'domain',
    aliases: [],
    run: 'client',
    label: { fr: 'Choisir mon nom de domaine', en: 'Choose my domain name' },
    description: { fr: 'Une adresse à votre nom, achetée et reliée pour vous.', en: 'An address in your name, bought and connected for you.' },
  },
  {
    name: 'communication',
    aliases: ['social'],
    run: 'client',
    needs: 'project',
    label: { fr: 'Faire connaître mon site', en: 'Get my site seen' },
    description: {
      fr: 'Publications pour les réseaux et calendrier, aux couleurs de votre marque, dans IDEM.',
      en: 'Social posts and a calendar, in your brand colours, in IDEM.',
    },
  },
  {
    name: 'fix',
    aliases: ['repair'],
    run: 'client',
    label: { fr: 'Corriger les erreurs', en: 'Fix the errors' },
    description: { fr: 'Les erreurs de l’aperçu, corrigées automatiquement.', en: 'The preview errors, fixed automatically.' },
  },
  {
    name: 'help',
    aliases: ['commands'],
    run: 'client',
    label: { fr: 'Voir les commandes', en: 'See the commands' },
    description: { fr: 'Tout ce que vous pouvez lancer d’un « / ».', en: 'Everything you can start with a “/”.' },
  },
];

const fold = (value: string) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** `/redesign monsite.com` → la commande et ce qui la suit ; `null` si le message n'en est pas une. */
export function parseCommand(text: string): { command: CommandSpec; args: string } | null {
  const match = String(text || '').trim().match(/^\/([a-zA-ZÀ-ſ-]+)(?:\s+([\s\S]*))?$/);
  if (!match) return null;
  const word = fold(match[1]);
  const command = COMMANDS.find((c) => c.name === word || c.aliases.includes(word));
  return command ? { command, args: (match[2] ?? '').trim() } : null;
}

/** Le message commence-t-il par « /mot » (une commande, connue ou non) ? */
export const looksLikeCommand = (text: string) => /^\/[a-zA-ZÀ-ſ-]+(\s|$)/.test(String(text || '').trim());

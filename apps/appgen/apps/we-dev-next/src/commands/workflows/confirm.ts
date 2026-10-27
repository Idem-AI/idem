/**
 * L'agent a reconnu une demande que l'atelier règle sur place (mettre en ligne, choisir un nom de domaine, faire
 * connaître le site) : on confirme d'un clic plutôt que de faire écrire du code au modèle. « Non, continuer » renvoie
 * la demande d'origine telle quelle, sans la réinterpréter.
 */
import { ChatChoices, createTextStream } from '../choices.js';
import type { Intent } from '../intent.js';
import { CommandContext, Responder } from '../types.js';

type ClientIntent = Extract<Intent, 'publish' | 'domain' | 'communication'>;

const COPY: Record<ClientIntent, { fr: [string, string, string]; en: [string, string, string] }> = {
  publish: {
    fr: ['Vous voulez mettre votre site en ligne ?', 'Mettre en ligne maintenant', 'Une adresse à partager, le HTTPS déjà réglé.'],
    en: ['Do you want to put your site online?', 'Go live now', 'An address to share, HTTPS included.'],
  },
  domain: {
    fr: ['Vous voulez votre propre nom de domaine ?', 'Choisir mon nom', 'IDEM l’achète et le relie pour vous (le site doit être en ligne).'],
    en: ['Do you want your own domain name?', 'Choose my name', 'IDEM buys and connects it for you (the site must be online).'],
  },
  communication: {
    fr: ['Vous voulez faire connaître votre site ?', 'Gérer ma communication', 'Publications et calendrier pour les réseaux, dans IDEM, sur ce projet.'],
    en: ['Do you want to get your site seen?', 'Manage my communication', 'Social posts and a calendar, in IDEM, for this project.'],
  },
};

/** `null` quand la confirmation n'a pas de sens ici (la communication sans projet) : chemin habituel. */
export function startConfirm(ctx: CommandContext, intent: ClientIntent): Responder | null {
  if (intent === 'communication' && !ctx.projectData?.id) return null;
  const [question, label, description] = COPY[intent][ctx.fr ? 'fr' : 'en'];
  const choices: ChatChoices = {
    purpose: 'confirm',
    questions: [
      {
        id: 'confirm',
        question,
        options: [
          { value: intent, recommended: true, clientAction: intent, label, description },
          {
            value: 'continue',
            passthrough: true,
            label: ctx.fr ? 'Non, continuer ma demande' : 'No, carry on with my request',
            description: ctx.fr ? 'Je traite votre message tel quel.' : 'I handle your message as it is.',
          },
        ],
      },
    ],
    context: { original: ctx.text },
  };
  return createTextStream('', choices);
}

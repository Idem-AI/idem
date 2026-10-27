/**
 * La question posée avant une refonte : « une identité visuelle pro d'abord, ou la refonte tout de suite ? »
 *
 * Répondue sans modèle ni débit : une phrase, et une marque `<!-- idem:ask {…} -->` que l'atelier dessine en
 * choix à cliquer (chaque option expliquée, une seule « Recommandé »), avec la case d'accord aux politiques
 * d'IDEM quand un projet doit être créé — jamais cochée d'avance. Le clic renvoie `siteRedesign` au serveur.
 */
import type { Response } from 'express';
import { SiteStream } from '../stream.js';
import type { RedesignIntent } from './intent.js';

/** Marque invisible des messages envoyés par l'atelier lui-même (même valeur que `utils/stepLabels.ts` du client). */
export const INTERNAL_MARK = '\u2063';

export interface RedesignAsk {
  purpose: 'redesign';
  url: string;
  host: string;
  question: string;
  options: { value: 'direct' | 'identity'; label: string; description: string; recommended?: boolean }[];
  /** Un projet sera créé : l'accord est demandé (case, liens vers les politiques). */
  consent: boolean;
}

export function redesignAsk(intent: RedesignIntent, options: { fr: boolean; needsConsent: boolean }): RedesignAsk {
  const { fr } = options;
  return {
    purpose: 'redesign',
    url: intent.url,
    host: intent.host,
    question: fr ? 'Par où commence-t-on ?' : 'Where do we start?',
    options: [
      {
        value: 'direct',
        recommended: true,
        label: fr ? 'Refaire mon site maintenant' : 'Redesign my site now',
        description: fr
          ? 'Je reprends votre logo, vos couleurs, vos polices et vos photos, et je refais la mise en page, les textes et le message pour vos clients.'
          : 'I keep your logo, colours, fonts and photos, and redo the layout, the copy and the message for your customers.',
      },
      {
        value: 'identity',
        label: fr ? 'D’abord une identité visuelle pro' : 'A professional brand identity first',
        description: fr
          ? 'IDEM crée votre charte graphique complète à partir de votre site (logo décliné, palette, typographies, motifs), puis refait le site avec. La charte se règle depuis votre portefeuille IDEM, au prix habituel.'
          : 'IDEM builds your complete brand guidelines from your site (logo variations, palette, typefaces, patterns), then redesigns the site with them. The guidelines are paid from your IDEM wallet, at the usual price.',
      },
    ],
    consent: options.needsConsent,
  };
}

/** La marque lue par l'atelier : JSON dans un commentaire, sans `--` qui le refermerait. */
export function marker(name: 'ask' | 'project' | 'journey', payload: unknown): string {
  return `<!-- idem:${name} ${JSON.stringify(payload).replace(/--/g, '\\u002d\\u002d')} -->`;
}

/** La réponse au message de refonte : la question, rien d'autre. */
export function createRedesignAskStream(intent: RedesignIntent, options: { fr: boolean; needsConsent: boolean }) {
  return {
    async pipeDataStreamToResponse(res: Response): Promise<void> {
      const stream = new SiteStream(res);
      stream.open('none');
      const { fr } = options;
      stream.text(
        fr
          ? `Je vais refaire **${intent.host}** : je lis votre site (couleurs, polices, logo, photos, textes), je comprends à qui il parle et ce qui lui manque, puis je le reconstruis plus moderne et plus clair pour vos clients.\n\n`
          : `I'll redesign **${intent.host}**: I read your site (colours, fonts, logo, photos, copy), work out who it speaks to and what it lacks, then rebuild it more modern and clearer for your customers.\n\n`
      );
      stream.text(marker('ask', redesignAsk(intent, options)));
      stream.close({ promptTokens: 0, completionTokens: 0 });
    },
  };
}

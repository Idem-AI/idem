/**
 * /charter — la charte graphique du projet, générée dans IDEM (même route et même prix que le dashboard), suivie
 * étape par étape dans la conversation, puis un bouton pour l'ouvrir. Toujours confirmée avant : elle se paie.
 */
import type { Response } from 'express';
import { SiteStream } from '../../siteEngine/stream.js';
import { generateCharter, IdemApiError } from '../../siteEngine/redesign/idemClient.js';
import { ChatChoices, ChoicesAnswer, createTextStream, marker } from '../choices.js';
import { CommandContext, hasCharter, Responder } from '../types.js';

export function startCharter(ctx: CommandContext): Responder {
  const { fr } = ctx;
  if (!ctx.projectData?.id) {
    return createTextStream(
      fr
        ? 'La charte se crée dans un projet IDEM : ouvrez iCode depuis votre projet, ou tapez `/redesign` suivi de l’adresse de votre site pour en créer un à partir de lui.'
        : 'Brand guidelines live in an IDEM project: open iCode from your project, or type `/redesign` followed by your site address to create one from it.'
    );
  }
  const exists = hasCharter(ctx.projectData);
  const choices: ChatChoices = {
    purpose: 'charter',
    questions: [
      {
        id: 'confirm',
        question: exists ? (fr ? 'Votre charte existe déjà. Que fait-on ?' : 'Your guidelines already exist. What now?') : fr ? 'On crée votre charte maintenant ?' : 'Shall we create your guidelines now?',
        help: fr ? 'Elle se règle depuis votre portefeuille IDEM, au prix habituel.' : 'It is paid from your IDEM wallet, at the usual price.',
        options: exists
          ? [
              { value: 'open', recommended: true, label: fr ? 'Ouvrir ma charte' : 'Open my guidelines', description: fr ? 'Elle s’ouvre dans votre projet IDEM.' : 'It opens in your IDEM project.' },
              { value: 'create', label: fr ? 'La refaire entièrement' : 'Redo it entirely', description: fr ? 'Une nouvelle charte remplace l’actuelle.' : 'New guidelines replace the current ones.' },
              { value: 'later', dismiss: true, label: fr ? 'Pas maintenant' : 'Not now' },
            ]
          : [
              { value: 'create', recommended: true, label: fr ? 'Créer ma charte' : 'Create my guidelines', description: fr ? 'Logo décliné, couleurs, typographies, motifs et règles d’usage.' : 'Logo variations, colours, typefaces, patterns and usage rules.' },
              { value: 'later', dismiss: true, label: fr ? 'Pas maintenant' : 'Not now' },
            ],
      },
    ],
  };
  return createTextStream(
    fr ? 'Votre charte graphique rassemble tout ce qui fait votre marque, pour que chaque création reste cohérente.' : 'Your brand guidelines gather everything that makes your brand, so every creation stays consistent.',
    choices
  );
}

/** Le bouton qui ouvre la charte dans IDEM (adresse posée par l'atelier, qui connaît celle du dashboard). */
const openCharter = (projectId: string, fr: boolean) => marker('open', { destination: 'charter', projectId, label: fr ? 'Voir ma charte' : 'See my guidelines' });

export function runCharter(ctx: CommandContext, answer: ChoicesAnswer): Responder {
  const { fr } = ctx;
  const projectId = ctx.projectData?.id;
  if (!projectId) return startCharter(ctx);
  if (answer.values.confirm === 'open') return createTextStream(`${fr ? 'La voici.' : 'Here it is.'}\n\n${openCharter(projectId, fr)}`);
  if (answer.values.confirm !== 'create') return createTextStream(fr ? 'D’accord, on la fera plus tard.' : 'All right, we’ll do it later.');

  return {
    async pipeDataStreamToResponse(res: Response): Promise<void> {
      const abort = new AbortController();
      res.on('close', () => {
        if (!res.writableEnded) abort.abort();
      });
      const stream = new SiteStream(res);
      stream.open('idem');
      stream.text(fr ? 'Je crée votre charte graphique dans votre projet IDEM.\n\n' : 'Creating your brand guidelines in your IDEM project.\n\n');
      stream.text(`<boltArtifact id="idem-charter" title="${fr ? 'Charte graphique' : 'Brand guidelines'}">\n`);
      let last = '';
      let failure: string | null = null;
      try {
        await generateCharter({
          projectId,
          credentials: ctx.credentials,
          creativity: ctx.creativity,
          signal: abort.signal,
          onStep: (name) => {
            if (name === last) return;
            last = name;
            stream.note(name);
          },
        });
      } catch (error) {
        const e = error as IdemApiError;
        failure =
          e.status === 402
            ? fr
              ? 'Votre portefeuille IDEM n’est pas assez approvisionné pour la charte. Rechargez-le, puis relancez `/charter`.'
              : 'Your IDEM wallet balance is too low for the guidelines. Top it up, then run `/charter` again.'
            : e.status === 429
              ? String(e.body?.message || (fr ? 'Limite atteinte pour aujourd’hui : réessayez plus tard.' : 'Limit reached for today: try again later.'))
              : fr
                ? 'La charte n’a pas pu être générée. Réessayez dans un instant, ou lancez-la depuis votre projet IDEM.'
                : 'The guidelines could not be generated. Try again shortly, or start them from your IDEM project.';
      }
      if (abort.signal.aborted) return;
      stream.text('</boltArtifact>\n');
      if (failure) stream.text(failure);
      else {
        stream.text(`${fr ? 'Votre charte est prête : logo décliné, couleurs, typographies et règles d’usage.' : 'Your guidelines are ready: logo variations, colours, typefaces and usage rules.'}\n\n`);
        stream.text(openCharter(projectId, fr));
        stream.text(marker('journey', { event: 'charter.generated', projectId }));
      }
      stream.close({ promptTokens: 0, completionTokens: 0 });
    },
  };
}

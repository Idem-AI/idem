/**
 * LA REFONTE, AVANT LE MOTEUR DE SITES — ce qui se passe entre le clic sur la réponse et la première section.
 *
 *   1. le site est lu par l'API IDEM (couleurs, polices, logo et déclinaisons, direction artistique, textes,
 *      photos recopiées) et devient un projet IDEM — ou complète celui qui est ouvert dans iCode ;
 *   2. la génération est facturée à CE projet, seulement maintenant : un site illisible ne coûte rien ;
 *   3. « identité visuelle pro » : la charte se génère dans IDEM pendant que le site s'écrit ;
 *   4. le moteur de sites reçoit le projet et le contenu du site à refaire.
 *
 * Chaque étape est dite dans la conversation, en mots simples.
 */
import { consumeGeneration } from '../../services/billingService.js';
import { ProjectModel } from '../../types/project.js';
import { ChatLogger } from '../../utils/logger.js';
import type { SiteStream } from '../stream.js';
import type { RedesignFocus } from './brief.js';
import { fetchProject, generateCharter, IdemApiError, importSite, SiteContent, SiteImportStep } from './idemClient.js';

export interface RedesignContext {
  content: SiteContent;
  choice: 'identity' | 'direct';
  focus: RedesignFocus;
  /** La charte en cours de génération (identité visuelle pro) ; se résout avec un message d'échec, ou `null`. */
  charter?: Promise<string | null>;
  /** Le projet vient d'être créé (l'atelier s'y rattache à la fin). */
  created: boolean;
}

export interface Prepared {
  projectData: ProjectModel;
  redesign: RedesignContext;
}

const STEP_LABEL: Record<SiteImportStep, [string, string] | null> = {
  open: ["J'ouvre votre site", 'Opening your website'],
  colors: ['Je relève vos couleurs', 'Reading your colours'],
  fonts: ['Je reconnais vos polices', 'Recognising your fonts'],
  logo: ['Je récupère votre logo', 'Fetching your logo'],
  content: ['Je lis vos textes', 'Reading your copy'],
  voice: ['Je comprends votre activité et votre cible', 'Understanding your business and audience'],
  art: ['J’analyse votre style', 'Analysing your style'],
  project: ['Je crée votre projet IDEM', 'Creating your IDEM project'],
  'logo-variations': ['Je décline votre logo', 'Making your logo variations'],
  typography: ['Je prépare vos typographies', 'Preparing your typefaces'],
  'art-direction': ['Je fixe votre direction artistique', 'Setting your art direction'],
  patterns: ['Je dessine vos motifs de marque', 'Drawing your brand patterns'],
  done: null,
};

function failureText(error: unknown, host: string, fr: boolean): string {
  const e = error instanceof IdemApiError ? error : null;
  const message = String(e?.body?.message || e?.message || '').slice(0, 240);
  if (e?.status === 401) return fr ? 'Votre session a expiré : reconnectez-vous, puis renvoyez votre demande.' : 'Your session expired: sign in again, then resend your request.';
  if (e?.status === 403) return fr ? 'Pour créer votre projet IDEM, cochez l’accord aux politiques d’IDEM sous la question, puis choisissez à nouveau.' : 'To create your IDEM project, tick the IDEM policies box under the question, then choose again.';
  if (e?.status === 429) return message || (fr ? 'Vous avez atteint votre limite pour aujourd’hui. Réessayez plus tard.' : 'You reached your limit for today. Try again later.');
  return fr
    ? `Je n’arrive pas à lire **${host}**${message ? ` (${message})` : ''}. Vérifiez l’adresse et que le site est en ligne, puis renvoyez votre demande. Rien n’a été modifié ni facturé.`
    : `I can't read **${host}**${message ? ` (${message})` : ''}. Check the address and that the site is online, then resend your request. Nothing was changed or charged.`;
}

/**
 * Prépare la refonte. Rend `null` quand elle s'arrête (le message est déjà écrit et le flux fermé par
 * l'appelant) ; sinon le projet et le contenu à refaire.
 */
export async function prepareRedesign(options: {
  stream: SiteStream;
  signal: AbortSignal;
  url: string;
  choice: 'identity' | 'direct';
  focus: RedesignFocus;
  consent: boolean;
  fr: boolean;
  credentials: Record<string, string>;
  /** Le projet ouvert dans iCode, s'il y en a un : le site lui est rattaché. */
  projectId?: string;
  creativity?: string;
}): Promise<Prepared | { stop: string }> {
  const { stream, fr, signal } = options;
  const host = (() => {
    try {
      return new URL(options.url).hostname.replace(/^www\./, '');
    } catch {
      return options.url;
    }
  })();

  let imported;
  try {
    imported = await importSite({
      url: options.url,
      credentials: options.credentials,
      projectId: options.projectId,
      consent: options.consent,
      signal,
      onStep: (step) => {
        const label = STEP_LABEL[step];
        if (label) stream.note(fr ? label[0] : label[1]);
      },
    });
  } catch (error) {
    ChatLogger.warn('SITE_REDESIGN', 'Lecture du site impossible', { url: options.url, status: (error as IdemApiError).status, message: (error as Error).message });
    return { stop: failureText(error, host, fr) };
  }
  if (!imported.content) return { stop: failureText(null, host, fr) };

  // La génération est facturée au projet, maintenant qu'il existe et que le site a pu être lu.
  const billing = await consumeGeneration({ credentials: options.credentials, action: 'initial_generation', projectId: imported.projectId });
  if (!billing.allowed) {
    const message = String((billing.refusal as { message?: string } | undefined)?.message || '');
    return {
      stop: fr
        ? `Votre projet IDEM est prêt (votre marque y est), mais la refonte n'a pas pu démarrer : ${message || 'génération refusée'}.`
        : `Your IDEM project is ready (your brand is in it), but the redesign could not start: ${message || 'generation refused'}.`,
    };
  }

  let projectData: ProjectModel;
  try {
    projectData = await fetchProject(imported.projectId, options.credentials, signal);
  } catch (error) {
    return { stop: failureText(error, host, fr) };
  }

  const found = [
    imported.logo ? (fr ? 'votre logo' : 'your logo') : '',
    imported.fonts.display ? (fr ? `vos polices (${[imported.fonts.display, imported.fonts.body].filter((f, i, all) => f && all.indexOf(f) === i).join(', ')})` : `your fonts (${[imported.fonts.display, imported.fonts.body].filter((f, i, all) => f && all.indexOf(f) === i).join(', ')})`) : '',
    imported.content.images.length ? (fr ? `${imported.content.images.length} photo${imported.content.images.length > 1 ? 's' : ''}` : `${imported.content.images.length} photo${imported.content.images.length > 1 ? 's' : ''}`) : '',
    imported.content.pages.length ? (fr ? `${imported.content.pages.length} page${imported.content.pages.length > 1 ? 's' : ''} lue${imported.content.pages.length > 1 ? 's' : ''}` : `${imported.content.pages.length} page${imported.content.pages.length > 1 ? 's' : ''} read`) : '',
  ].filter(Boolean);
  if (found.length) stream.note(fr ? `Trouvé sur votre site : ${found.join(', ')}` : `Found on your site: ${found.join(', ')}`);

  // L'identité visuelle pro : la charte se génère dans IDEM pendant que le site s'écrit (elle ne change ni
  // le logo, ni les couleurs, ni les polices que le site emploie : elle les met en règles).
  let charter: Promise<string | null> | undefined;
  if (options.choice === 'identity') {
    stream.note(fr ? 'Je lance votre charte graphique dans IDEM' : 'Starting your brand guidelines in IDEM');
    let lastStep = '';
    charter = generateCharter({
      projectId: imported.projectId,
      credentials: options.credentials,
      creativity: options.creativity,
      signal,
      onStep: (name) => {
        if (name === lastStep || signal.aborted) return;
        lastStep = name;
        stream.note(fr ? `Charte : ${name}` : `Guidelines: ${name}`);
      },
    })
      .then(() => null)
      .catch((error: IdemApiError) => {
        ChatLogger.warn('SITE_REDESIGN', 'Charte non générée', { status: error.status, message: error.message });
        if (error.status === 402)
          return fr
            ? 'Votre charte graphique n’a pas été générée : votre portefeuille IDEM n’est pas assez approvisionné. Rechargez-le, puis lancez-la depuis votre projet.'
            : 'Your brand guidelines were not generated: your IDEM wallet balance is too low. Top it up, then start them from your project.';
        return fr ? 'Votre charte graphique n’a pas pu être générée ici : vous pouvez la lancer depuis votre projet IDEM.' : 'Your brand guidelines could not be generated here: you can start them from your IDEM project.';
      });
  }

  ChatLogger.info('SITE_REDESIGN', 'Site lu, refonte lancée', {
    url: options.url,
    projectId: imported.projectId,
    created: !imported.reused,
    choice: options.choice,
    images: imported.content.images.length,
    pages: imported.content.pages.length,
  });

  return {
    projectData,
    redesign: { content: imported.content, choice: options.choice, focus: options.focus, charter, created: !options.projectId },
  };
}

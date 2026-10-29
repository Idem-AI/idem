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
import type { ChatChoices } from '../../commands/choices.js';
import type { RedesignFocus } from './brief.js';
import { languageLabel } from '../i18n.js';
import { chooseSitePalette, fetchProject, fetchSiteContent, generateCharter, IdemApiError, importSite, SiteContent, SiteImportStep } from './idemClient.js';

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
  pages: ['Je relève toutes les pages de votre site', 'Reading every page of your site'],
  assets: ['Je recopie vos images, votre logo et votre favicon', 'Copying your images, logo and favicon'],
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
  /**
   * Reprise après la question des couleurs : le site est déjà relevé et le projet existe ; seule la palette
   * choisie est appliquée.
   */
  resume?: { projectId: string; colors: 'site' | 'logo'; languages?: string[]; billed?: boolean };
}): Promise<Prepared | { stop: string } | { ask: { text: string; choices: ChatChoices } }> {
  const { stream, fr, signal } = options;
  const host = (() => {
    try {
      return new URL(options.url).hostname.replace(/^www\./, '');
    } catch {
      return options.url;
    }
  })();

  // Reprise : rien n'est relu, la palette choisie est appliquée au projet.
  if (options.resume) {
    try {
      const content = await fetchSiteContent(options.resume.projectId, options.credentials, signal);
      if (options.resume.colors === 'logo') {
        stream.note(fr ? 'J’applique des couleurs fidèles à votre logo' : 'Applying colours true to your logo');
        await chooseSitePalette(options.resume.projectId, 'logo', options.credentials, signal);
      }
      return await finish(options, { projectId: options.resume.projectId, content, logo: content.logo, fonts: null });
    } catch (error) {
      return { stop: failureText(error, host, fr) };
    }
  }

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

  // Deux décisions peuvent revenir à l'utilisateur, posées ensemble avant toute génération (rien n'est facturé) :
  //   - le logo et les couleurs du site ne vont pas ensemble (par défaut, la marque reste telle qu'elle est) ;
  //   - le site propose des langues par un traducteur automatique, sans page vraiment traduite : les reprendre
  //     toutes coûterait une traduction par langue, on propose la plus utile.
  const check = imported.content.brandCheck;
  const inventory = imported.content.inventory;
  const main = inventory.language || 'fr';
  const real = new Set((inventory.languages ?? []).filter((l) => l.via !== 'widget').map((l) => l.code));
  const widget = (inventory.languages ?? []).filter((l) => l.via === 'widget' && l.code !== main && !real.has(l.code)).map((l) => l.code);
  const questions: ChatChoices['questions'] = [];
  const said: string[] = [
    fr
      ? `J’ai tout relevé : ${inventory.pages.length} pages, ${imported.content.images.length} images, votre logo et vos polices.`
      : `I’ve read everything: ${inventory.pages.length} pages, ${imported.content.images.length} images, your logo and fonts.`,
  ];
  if (check && !check.coherent && imported.content.palettes?.logo) {
    said.push(
      fr
        ? `Une chose me frappe : la couleur principale de votre site (${check.sitePrimary}) ne reprend pas celles de votre logo (${check.logoColors.join(', ')}).`
        : `One thing stands out: your site’s main colour (${check.sitePrimary}) doesn’t match your logo’s (${check.logoColors.join(', ')}).`
    );
    questions.push({
      id: 'colors',
      question: fr ? 'Quelles couleurs pour le nouveau site ?' : 'Which colours for the new site?',
      options: [
        {
          value: 'logo',
          recommended: true,
          label: fr ? 'Des couleurs fidèles à mon logo' : 'Colours true to my logo',
          description: fr ? 'Le site et le logo parlent enfin d’une seule voix ; vos polices et vos images restent.' : 'Site and logo finally speak with one voice; your fonts and images stay.',
        },
        {
          value: 'site',
          label: fr ? 'Garder les couleurs actuelles du site' : 'Keep the site’s current colours',
          description: fr ? 'Vos visiteurs retrouvent exactement les couleurs qu’ils connaissent.' : 'Your visitors find exactly the colours they know.',
        },
      ],
    });
  }
  if (widget.length) {
    // La langue la plus utile en plus : l'anglais, ou le français pour un site anglophone.
    const second = widget.includes(main === 'en' ? 'fr' : 'en') ? (main === 'en' ? 'fr' : 'en') : widget[0];
    const names = (codes: string[]) => codes.map((code) => languageLabel(code, fr)).join(fr ? ' et ' : ' and ');
    said.push(
      fr
        ? `Votre site propose aussi ${widget.length} langue${widget.length > 1 ? 's' : ''} par un traducteur automatique : aucune page n’y est vraiment traduite. Le nouveau site peut l’être, avec de vraies traductions.`
        : `Your site also offers ${widget.length} language${widget.length > 1 ? 's' : ''} through an automatic translator: no page is actually translated. The new site can be, with real translations.`
    );
    questions.push({
      id: 'languages',
      question: fr ? 'Dans quelles langues le nouveau site ?' : 'Which languages for the new site?',
      options: [
        {
          value: 'pair',
          recommended: true,
          label: fr ? `En ${names([main, second])}` : `In ${names([main, second])}`,
          description: fr ? 'Une vraie traduction, relue pour vos clients ; une page par langue, bien référencée.' : 'A real translation written for your customers; one page per language, properly indexed.',
        },
        ...(widget.length > 1
          ? [
              {
                value: 'all',
                label: fr ? `Toutes les langues proposées (${widget.length + 1})` : `Every language offered (${widget.length + 1})`,
                description: names([main, ...widget]),
              },
            ]
          : []),
        {
          value: 'main',
          label: fr ? `Seulement en ${languageLabel(main, true)}` : `Only in ${languageLabel(main, false)}`,
          description: fr ? 'Le site reste prêt : une langue s’ajoute plus tard avec /translate.' : 'The site stays ready: add a language later with /translate.',
        },
      ],
    });
  }
  if (questions.length) {
    return {
      ask: {
        text: said.join(' '),
        choices: {
          purpose: 'redesign-colors',
          questions,
          context: {
            projectId: imported.projectId,
            url: options.url,
            path: options.choice,
            focus: options.focus,
            ...(widget.length ? { mainLanguage: main, widgetLanguages: widget.join(','), pairLanguage: widget.includes(main === 'en' ? 'fr' : 'en') ? (main === 'en' ? 'fr' : 'en') : widget[0] } : {}),
          },
        },
      },
    };
  }

  return finish(options, { projectId: imported.projectId, content: imported.content, logo: imported.logo, fonts: imported.fonts });
}

/** La suite commune (import neuf ou reprise) : facturation, projet, charte, contenu prêt pour le moteur. */
async function finish(
  options: Parameters<typeof prepareRedesign>[0],
  imported: { projectId: string; content: SiteContent; logo: boolean; fonts: { display: string; body: string } | null }
): Promise<Prepared | { stop: string }> {
  const { stream, fr, signal } = options;
  const host = (() => {
    try {
      return new URL(options.url).hostname.replace(/^www\./, '');
    } catch {
      return options.url;
    }
  })();

  // La génération est facturée au projet, maintenant qu'il existe et que le site a pu être lu (une fois : la reprise
  // d'une génération interrompue ne repaie pas).
  const billing = options.resume?.billed ? { allowed: true as const, refusal: undefined } : await consumeGeneration({ credentials: options.credentials, action: 'initial_generation', projectId: imported.projectId });
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
    imported.fonts?.display ? (fr ? `vos polices (${[imported.fonts.display, imported.fonts.body].filter((f, i, all) => f && all.indexOf(f) === i).join(', ')})` : `your fonts (${[imported.fonts.display, imported.fonts.body].filter((f, i, all) => f && all.indexOf(f) === i).join(', ')})`) : '',
    imported.content.images.length ? (fr ? `${imported.content.images.length} image${imported.content.images.length > 1 ? 's' : ''}` : `${imported.content.images.length} image${imported.content.images.length > 1 ? 's' : ''}`) : '',
    imported.content.inventory.pages.length
      ? fr
        ? `${imported.content.inventory.pages.length} page${imported.content.inventory.pages.length > 1 ? 's' : ''} et ${imported.content.inventory.pages.reduce((n, p) => n + p.sections.length, 0)} sections`
        : `${imported.content.inventory.pages.length} page${imported.content.inventory.pages.length > 1 ? 's' : ''} and ${imported.content.inventory.pages.reduce((n, p) => n + p.sections.length, 0)} sections`
      : '',
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
    resumed: !!options.resume,
    choice: options.choice,
    images: imported.content.images.length,
    pages: imported.content.inventory.pages.length,
    sections: imported.content.inventory.pages.reduce((n, p) => n + p.sections.length, 0),
  });

  return {
    projectData,
    redesign: { content: imported.content, choice: options.choice, focus: options.focus, charter, created: !options.projectId },
  };
}

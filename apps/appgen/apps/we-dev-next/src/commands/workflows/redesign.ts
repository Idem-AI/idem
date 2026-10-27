/**
 * /redesign — refaire un site existant. Lancé par la commande, ou par l'agent qui a reconnu une refonte.
 *
 *   questions   l'adresse (si elle manque) · par où commencer (refonte directe ⟶ recommandé, ou charte
 *               d'abord) · quoi améliorer en priorité (tout ⟶ recommandé, le design, les textes) · l'accord
 *               aux politiques quand un projet doit naître
 *   exécution   le moteur de sites en mode refonte (`siteEngine/redesign/flow.ts`) : lecture du site, projet
 *               IDEM, facturation seulement après lecture réussie, site refait
 */
import { createSiteEngineStream } from '../../siteEngine/orchestrator.js';
import type { RedesignFocus } from '../../siteEngine/redesign/brief.js';
import { findSiteUrl } from '../../siteEngine/redesign/intent.js';
import { ChatChoices, ChoicesAnswer, ChoiceQuestion, createTextStream } from '../choices.js';
import { CommandContext, hasCharter, Responder } from '../types.js';

function questions(ctx: CommandContext, url: string | null): ChoiceQuestion[] {
  const { fr } = ctx;
  const list: ChoiceQuestion[] = [];
  if (!url) {
    list.push({
      id: 'url',
      kind: 'text',
      question: fr ? 'Quelle est l’adresse de votre site ?' : 'What is your website’s address?',
      placeholder: fr ? 'monentreprise.com' : 'mycompany.com',
    });
  }
  // Un projet qui a déjà sa charte n'a rien à choisir ici : la refonte s'en sert.
  if (!hasCharter(ctx.projectData)) {
    list.push({
      id: 'path',
      question: fr ? 'Par où commence-t-on ?' : 'Where do we start?',
      options: [
        {
          value: 'direct',
          recommended: true,
          label: fr ? 'Refaire mon site maintenant' : 'Redesign my site now',
          description: fr
            ? 'Je garde votre logo, vos couleurs, vos polices et vos photos, et je refais la mise en page, les textes et le message.'
            : 'I keep your logo, colours, fonts and photos, and redo the layout, the copy and the message.',
        },
        {
          value: 'identity',
          label: fr ? 'D’abord une identité visuelle pro' : 'A professional brand identity first',
          description: fr
            ? 'Votre charte graphique complète (logo décliné, palette, typographies, motifs), puis le site refait avec. Payée depuis votre portefeuille IDEM.'
            : 'Your complete brand guidelines (logo variations, palette, typefaces, patterns), then the site redesigned with them. Paid from your IDEM wallet.',
        },
      ],
    });
  }
  list.push({
    id: 'focus',
    question: fr ? 'Qu’est-ce qu’on améliore en priorité ?' : 'What do we improve first?',
    options: [
      {
        value: 'all',
        recommended: true,
        label: fr ? 'Tout : structure, textes et design' : 'Everything: structure, copy and design',
        description: fr ? 'Le site est repensé pour vos clients, du message à la mise en page.' : 'The site is rethought for your customers, from message to layout.',
      },
      {
        value: 'design',
        label: fr ? 'Surtout le design' : 'Mostly the design',
        description: fr ? 'Vos textes restent, la présentation devient moderne.' : 'Your copy stays, the presentation becomes modern.',
      },
      {
        value: 'copy',
        label: fr ? 'Surtout les textes et le message' : 'Mostly the copy and message',
        description: fr ? 'Une promesse claire et des appels à l’action, pour votre cible.' : 'A clear promise and calls to action, for your audience.',
      },
    ],
  });
  return list;
}

export function startRedesign(ctx: CommandContext, options: { url?: string | null; original?: string }): Responder {
  const site = options.url ? findSiteUrl(options.url) : null;
  const { fr } = ctx;
  const intro = site
    ? fr
      ? `Je vais refaire **${site.host}** : je lis votre site (couleurs, polices, logo, photos, textes), je comprends à qui il parle et ce qui lui manque, puis je le reconstruis plus moderne et plus clair pour vos clients.`
      : `I'll redesign **${site.host}**: I read your site (colours, fonts, logo, photos, copy), work out who it speaks to and what it lacks, then rebuild it more modern and clearer for your customers.`
    : fr
      ? 'Je peux refaire votre site existant : je le lis (couleurs, polices, logo, photos, textes), puis je le reconstruis plus moderne et plus clair pour vos clients.'
      : 'I can redesign your existing site: I read it (colours, fonts, logo, photos, copy), then rebuild it more modern and clearer for your customers.';
  const choices: ChatChoices = {
    purpose: 'redesign',
    questions: questions(ctx, site?.url ?? null),
    consent: !ctx.projectData?.id,
    prepare: 'site-reset',
    context: { url: site?.url, original: options.original },
    submitLabel: fr ? 'Refaire mon site' : 'Redesign my site',
  };
  return createTextStream(intro, choices);
}

/**
 * La réponse à « Quelles couleurs pour le nouveau site ? » (posée après le relevé, quand le logo et le site ne
 * s'accordent pas) : la refonte reprend là où elle s'était arrêtée, sans relire le site.
 */
export function runRedesignColors(ctx: CommandContext, answer: ChoicesAnswer): Responder {
  const context = answer.context ?? {};
  const projectId = typeof context.projectId === 'string' ? context.projectId : '';
  const site = findSiteUrl(String(context.url ?? ''));
  if (!projectId || !site) return startRedesign(ctx, { original: typeof context.original === 'string' ? context.original : undefined });
  const focus: RedesignFocus = context.focus === 'design' || context.focus === 'copy' ? context.focus : 'all';
  return createSiteEngineStream({
    projectData: ctx.projectData,
    language: ctx.fr ? 'fr' : 'en',
    request: typeof context.original === 'string' ? context.original : '',
    model: ctx.model,
    userId: ctx.userId,
    scaffoldMounted: false,
    credentials: ctx.credentials,
    redesign: {
      url: site.url,
      choice: context.path === 'identity' ? 'identity' : 'direct',
      focus,
      consent: true,
      creativity: ctx.creativity,
      resume: { projectId, colors: answer.values.colors === 'logo' ? 'logo' : 'site' },
    },
  });
}

export function runRedesign(ctx: CommandContext, answer: ChoicesAnswer): Responder {
  const site = findSiteUrl(String(answer.values.url || answer.context?.url || ''));
  if (!site) {
    // Une adresse illisible : la question revient, rien n'est lancé ni facturé.
    return startRedesign(ctx, { original: typeof answer.context?.original === 'string' ? answer.context.original : undefined });
  }
  // Sans projet ni accord, aucun projet ne peut naître : la question revient (l'atelier l'exige déjà).
  if (!ctx.projectData?.id && answer.consent !== true) {
    return startRedesign(ctx, { url: site.url, original: typeof answer.context?.original === 'string' ? answer.context.original : undefined });
  }
  const focus: RedesignFocus = answer.values.focus === 'design' || answer.values.focus === 'copy' ? answer.values.focus : 'all';
  return createSiteEngineStream({
    projectData: ctx.projectData,
    language: ctx.fr ? 'fr' : 'en',
    // La demande d'origine (« … en plus moderne, en vert ») porte des précisions que les questions n'ont pas.
    request: typeof answer.context?.original === 'string' ? answer.context.original : '',
    model: ctx.model,
    userId: ctx.userId,
    scaffoldMounted: false,
    credentials: ctx.credentials,
    redesign: { url: site.url, choice: answer.values.path === 'identity' ? 'identity' : 'direct', focus, consent: answer.consent === true, creativity: ctx.creativity },
  });
}

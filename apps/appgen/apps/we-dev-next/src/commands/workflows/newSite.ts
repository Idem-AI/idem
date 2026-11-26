/**
 * UN SITE DEMANDÉ SANS PROJET — la première demande écrite sur l'accueil d'iCode (« un site de vente de poulet, Rocky »).
 *
 * Avant ce déroulé, le site se faisait sur un projet tiré de la demande, jamais enregistré : couleur et polices au
 * hasard du nom, rien à rouvrir après une actualisation. Désormais une seule question, gratuite :
 *
 *   start   créer un nouveau site (recommandé) · refaire un site existant (la refonte, qui garde sa marque)
 *   accord  la politique de confidentialité, les conditions d'utilisation et celles du programme bêta, car un projet
 *           IDEM va naître : il garde le site, sa conversation et son identité visuelle
 *
 * Puis la génération est facturée et le moteur crée le projet, son identité, et le site (`newProject`).
 */
import { createSiteEngineStream } from '../../siteEngine/orchestrator.js';
import { findSiteUrl } from '../../siteEngine/redesign/intent.js';
import { consumeGeneration } from '../../services/billingService.js';
import { ChatChoices, ChoicesAnswer, createTextStream } from '../choices.js';
import { CommandContext, refusal, Responder } from '../types.js';
import { startRedesign } from './redesign.js';

/** La première demande d'un site, sans projet ouvert ni site déjà construit dans la conversation ? */
export function isNewSiteRequest(ctx: CommandContext & { product: 'site' | 'app' | null; hasSite: boolean }): boolean {
  if (ctx.product !== 'site' || ctx.projectData?.id || ctx.hasSite) return false;
  return !ctx.messages.some((message) => message.role === 'assistant');
}

export function startNewSite(ctx: CommandContext): Responder {
  const { fr } = ctx;
  // Une adresse dans la demande : c'est sans doute une refonte, proposée en tête.
  const url = findSiteUrl(ctx.text)?.url;
  const choices: ChatChoices = {
    purpose: 'new-site',
    consent: true,
    context: { original: ctx.text.slice(0, 4000), url },
    submitLabel: fr ? 'Créer mon site' : 'Create my site',
    questions: [
      {
        id: 'start',
        question: fr ? 'On part de quoi ?' : 'What are we starting from?',
        options: [
          {
            value: 'new',
            recommended: !url,
            label: fr ? 'Un nouveau site' : 'A new website',
            description: fr
              ? 'Je crée votre identité (couleurs, polices, style) d’après votre activité, puis le site avec.'
              : 'I create your identity (colours, fonts, style) from your business, then the site with it.',
          },
          {
            value: 'redesign',
            recommended: !!url,
            label: fr ? 'Refaire mon site existant' : 'Redesign my existing site',
            description: fr
              ? 'Donnez son adresse : je le lis (logo, couleurs, textes, photos) et je le refais en gardant votre marque.'
              : 'Give its address: I read it (logo, colours, copy, photos) and rebuild it while keeping your brand.',
          },
        ],
      },
    ],
  };
  return createTextStream(
    fr
      ? 'Avant de commencer, je crée votre **projet IDEM** : il garde votre site, cette conversation et votre identité visuelle, pour les retrouver à tout moment et faire ensuite votre charte, vos visuels ou votre mise en ligne.\n\nVous avez déjà un site ? Choisissez « Refaire mon site existant », ou tapez `/redesign` suivi de son adresse.'
      : 'Before we start, I create your **IDEM project**: it keeps your site, this conversation and your visual identity, so you can come back to them any time and then make your brand guidelines, visuals or go live.\n\nAlready have a site? Choose “Redesign my existing site”, or type `/redesign` followed by its address.',
    choices
  );
}

export async function runNewSite(ctx: CommandContext, answer: ChoicesAnswer): Promise<Responder> {
  const original = typeof answer.context?.original === 'string' ? answer.context.original : '';
  if (answer.consent !== true) return startNewSite({ ...ctx, text: original });
  if (answer.values.start === 'redesign') {
    const url = typeof answer.context?.url === 'string' ? answer.context.url : null;
    return startRedesign(ctx, { url, original, consented: true });
  }
  const billing = await consumeGeneration({ credentials: ctx.credentials, action: 'initial_generation' });
  if (!billing.allowed) return refusal(billing.refusal);
  return createSiteEngineStream({
    language: ctx.fr ? 'fr' : 'en',
    request: original || ctx.text,
    model: ctx.model,
    userId: ctx.userId,
    scaffoldMounted: false,
    credentials: ctx.credentials,
    creativity: ctx.creativity,
    newProject: true,
  });
}

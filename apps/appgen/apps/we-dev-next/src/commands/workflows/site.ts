/**
 * /site — créer le site vitrine, en trois décisions qui changent vraiment le résultat :
 *
 *   pages    plusieurs pages (une par offre importante) ou une seule page à ancres — recommandé selon ce que le
 *            projet a à dire (offres, histoire) ;
 *   action   ce que doit faire un visiteur : écrire sur WhatsApp ou appeler (recommandé), demander un devis,
 *            réserver, commander, venir sur place — l'appel à l'action du site entier ;
 *   style    celui de la marque (recommandé s'il y en a une), sobre, ou audacieux.
 *
 * Sans projet, une première question demande l'activité en une phrase (sauf si la commande la donne).
 * Puis : le moteur de sites avec un projet, le constructeur habituel en mode site sans projet. La génération est
 * facturée comme une première génération.
 */
import { handleBuilderMode } from '../../handlers/builderHandler.js';
import { createSiteEngineStream } from '../../siteEngine/orchestrator.js';
import { readSiteFacts } from '../../siteEngine/siteFacts.js';
import { consumeGeneration } from '../../services/billingService.js';
import { ChatChoices, ChoicesAnswer, ChoiceQuestion, createTextStream } from '../choices.js';
import { CommandContext, hasBrand, refusal, Responder } from '../types.js';

/** Assez de matière pour plusieurs pages ? Des offres à détailler, ou une histoire à raconter. */
function recommendsPages(ctx: CommandContext): boolean {
  if (!ctx.projectData) return false;
  const facts = readSiteFacts(ctx.projectData, ctx.fr ? 'fr' : 'en');
  return facts.offers.length >= 3 || facts.team.length >= 2 || facts.story.length > 700;
}

export function startSite(ctx: CommandContext, args: string): Responder {
  const { fr } = ctx;
  const multi = recommendsPages(ctx);
  const brand = hasBrand(ctx.projectData);
  const list: ChoiceQuestion[] = [];
  if (!ctx.projectData && !args) {
    list.push({
      id: 'about',
      kind: 'text',
      question: fr ? 'Que fait votre entreprise, et pour qui ?' : 'What does your business do, and for whom?',
      placeholder: fr ? 'Une boulangerie artisanale à Douala, pour les familles du quartier' : 'An artisan bakery in Douala, for local families',
    });
  }
  list.push(
    {
      id: 'pages',
      question: fr ? 'Combien de pages ?' : 'How many pages?',
      options: [
        {
          value: 'multi',
          recommended: multi,
          label: fr ? 'Plusieurs pages' : 'Several pages',
          description: fr ? 'Une page par offre importante, une page à propos, une page contact.' : 'One page per key offer, an about page, a contact page.',
        },
        {
          value: 'one',
          recommended: !multi,
          label: fr ? 'Une seule page' : 'A single page',
          description: fr ? 'Tout sur une page qui défile, avec un menu qui y mène.' : 'Everything on one scrolling page, with a menu that jumps to each part.',
        },
      ],
    },
    {
      id: 'action',
      question: fr ? 'Qu’est-ce qu’un visiteur doit faire ?' : 'What should a visitor do?',
      allowOther: true,
      options: [
        { value: 'whatsapp', recommended: true, label: fr ? 'M’écrire sur WhatsApp ou m’appeler' : 'Message me on WhatsApp or call me', description: fr ? 'Le contact le plus direct, en un geste.' : 'The most direct contact, in one tap.' },
        { value: 'quote', label: fr ? 'Demander un devis' : 'Ask for a quote', description: fr ? 'Un formulaire court qui vous arrive par e-mail ou WhatsApp.' : 'A short form that reaches you by email or WhatsApp.' },
        { value: 'booking', label: fr ? 'Réserver' : 'Book', description: fr ? 'Une table, un rendez-vous, une chambre.' : 'A table, an appointment, a room.' },
        { value: 'order', label: fr ? 'Commander' : 'Order', description: fr ? 'Choisir un produit et passer commande.' : 'Pick a product and place an order.' },
        { value: 'visit', label: fr ? 'Venir sur place' : 'Visit in person', description: fr ? 'Adresse, horaires et itinéraire bien en vue.' : 'Address, hours and directions in plain sight.' },
      ],
    },
    {
      id: 'style',
      question: fr ? 'Quel style ?' : 'Which style?',
      options: [
        ...(brand
          ? [{ value: 'brand', recommended: true, label: fr ? 'Celui de ma marque' : 'My brand’s', description: fr ? 'Votre logo, vos couleurs et vos polices, appliqués avec soin.' : 'Your logo, colours and fonts, applied with care.' }]
          : []),
        { value: 'minimal', recommended: !brand, label: fr ? 'Sobre et épuré' : 'Clean and minimal', description: fr ? 'Beaucoup d’espace, peu de couleurs, une lecture facile.' : 'Lots of space, few colours, easy to read.' },
        { value: 'bold', label: fr ? 'Audacieux et coloré' : 'Bold and colourful', description: fr ? 'De grands titres, des couleurs franches, du mouvement.' : 'Big headings, strong colours, motion.' },
      ],
    }
  );
  const choices: ChatChoices = {
    purpose: 'site',
    questions: list,
    prepare: 'site-reset',
    context: { about: args || undefined },
    submitLabel: fr ? 'Créer mon site' : 'Create my site',
  };
  return createTextStream(
    fr ? 'Trois choix et je m’y mets. Je vous recommande une option à chaque fois.' : 'Three choices and I get to work. I recommend one option each time.',
    choices
  );
}

const ACTION: Record<string, [string, string]> = {
  whatsapp: ['écrire sur WhatsApp ou appeler (lien WhatsApp et numéro cliquable)', 'message on WhatsApp or call (WhatsApp link and tappable number)'],
  quote: ['demander un devis (formulaire court qui part par e-mail ou WhatsApp)', 'ask for a quote (short form sent by email or WhatsApp)'],
  booking: ['réserver (formulaire de réservation qui part par e-mail ou WhatsApp)', 'book (booking form sent by email or WhatsApp)'],
  order: ['commander (offres présentées pour passer commande, commande envoyée par WhatsApp)', 'order (offers laid out to order, order sent by WhatsApp)'],
  visit: ['venir sur place (adresse, horaires et itinéraire bien en vue)', 'visit in person (address, hours and directions in plain sight)'],
};

const STYLE: Record<string, [string, string]> = {
  brand: ['celui de la marque : logo, couleurs et polices du projet, appliqués avec soin', 'the brand’s: the project’s logo, colours and fonts, applied with care'],
  minimal: ['sobre et épuré : beaucoup d’espace, peu de couleurs, lecture facile', 'clean and minimal: lots of space, few colours, easy reading'],
  bold: ['audacieux et coloré : grands titres, couleurs franches, mouvement', 'bold and colourful: big headings, strong colours, motion'],
};

/** La demande que le déroulé compose à partir des réponses. */
export function siteRequest(answer: ChoicesAnswer, fr: boolean): string {
  const v = answer.values;
  const about = String(v.about || answer.context?.about || '').trim();
  const action = ACTION[v.action]?.[fr ? 0 : 1] ?? String(v.action || '').slice(0, 200);
  const style = STYLE[v.style]?.[fr ? 0 : 1];
  const pages =
    v.pages === 'multi'
      ? fr
        ? 'plusieurs pages : une par offre importante, une page à propos, une page contact'
        : 'several pages: one per key offer, an about page, a contact page'
      : fr
        ? 'une seule page qui défile, avec un menu à ancres'
        : 'a single scrolling page, with an anchor menu';
  return fr
    ? [`Crée le site vitrine${about ? ` de : ${about}` : ''}.`, `Structure : ${pages}.`, action ? `Action principale du visiteur : ${action} — visible dans l’en-tête, dès l’ouverture et à la fin de chaque page.` : '', style ? `Style : ${style}.` : '']
        .filter(Boolean)
        .join('\n')
    : [`Create the showcase website${about ? ` for: ${about}` : ''}.`, `Structure: ${pages}.`, action ? `Main visitor action: ${action} — visible in the header, on the first screen and at the end of every page.` : '', style ? `Style: ${style}.` : '']
        .filter(Boolean)
        .join('\n');
}

export async function runSite(ctx: CommandContext, answer: ChoicesAnswer): Promise<Responder> {
  const request = siteRequest(answer, ctx.fr);
  if (!ctx.projectData && !String(answer.values.about || answer.context?.about || '').trim()) {
    return createTextStream(ctx.fr ? 'Dites-moi d’abord ce que fait votre entreprise : c’est la matière du site.' : 'Tell me first what your business does: it is what the site is made of.');
  }
  const billing = await consumeGeneration({ credentials: ctx.credentials, action: 'initial_generation', projectId: ctx.projectData?.id });
  if (!billing.allowed) return refusal(billing.refusal);

  if (ctx.projectData) {
    return createSiteEngineStream({
      projectData: ctx.projectData,
      language: ctx.fr ? 'fr' : 'en',
      request,
      model: ctx.model,
      userId: ctx.userId,
      scaffoldMounted: false,
      credentials: ctx.credentials,
    });
  }
  // Sans projet : le constructeur habituel, en mode site, avec la demande composée comme premier message.
  const messages = [{ ...ctx.messages[ctx.messages.length - 1], role: 'user' as const, content: request }];
  return handleBuilderMode(messages, ctx.model, ctx.userId, undefined, undefined, undefined, ctx.fr ? 'fr' : 'en', undefined, 'site', undefined, ctx.credentials);
}

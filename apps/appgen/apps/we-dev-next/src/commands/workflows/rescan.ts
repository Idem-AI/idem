/**
 * /rescan — RELIRE LE SITE D'ORIGINE d'un projet refait, puis le refaire à partir de cette lecture.
 *
 * Lancé par la commande ou par l'agent qui lit la demande (« rescanne mon site », « reprends les photos de mon
 * site », « mon site a changé »). Le projet ouvert garde sa place : la refonte relit le site DANS ce projet (l'API
 * relève toutes les pages, recopie les images avec leurs légendes, garde la marque du projet), puis le moteur refait
 * le site avec ce contenu frais. Rien d'autre ne change : même projet, même conversation.
 *
 *   question   quoi améliorer en priorité (comme une refonte) ; elle dit qu'une génération sera décomptée
 *   exécution  `createSiteEngineStream` en mode refonte, projet ouvert imposé (jamais un nouveau projet)
 *
 * Sans site d'origine connu : c'est une refonte ordinaire (l'adresse est demandée).
 */
import { createSiteEngineStream } from '../../siteEngine/orchestrator.js';
import type { RedesignFocus } from '../../siteEngine/redesign/brief.js';
import { findSiteUrl } from '../../siteEngine/redesign/intent.js';
import type { ProjectModel } from '../../types/project.js';
import { fetchProject } from '../../siteEngine/redesign/idemClient.js';
import { ChatChoices, ChoicesAnswer, createTextStream } from '../choices.js';
import { CommandContext, Responder } from '../types.js';
import { startRedesign } from './redesign.js';

export { rescanSource, siteSourceOf } from '../../siteEngine/redesign/source.js';
import { rescanSource } from '../../siteEngine/redesign/source.js';

type RescanContext = CommandContext & { siteFiles?: Record<string, string> };

export function startRescan(ctx: RescanContext, original?: string): Responder {
  const { fr } = ctx;
  const found = rescanSource(ctx.projectData, ctx.siteFiles);
  if (!found) {
    // Aucun site d'origine : une adresse dans la demande lance une refonte, sinon la question de l'adresse.
    return startRedesign(ctx, { url: original ? findSiteUrl(original)?.url ?? null : null, original });
  }
  const source = found.url;
  const host = findSiteUrl(source)!.host;
  const choices: ChatChoices = {
    purpose: 'rescan',
    questions: [
      {
        id: 'focus',
        question: fr ? 'Après la relecture, qu’est-ce qu’on améliore en priorité ?' : 'After re-reading, what do we improve first?',
        options: [
          {
            value: 'all',
            recommended: true,
            label: fr ? 'Tout : structure, textes et design' : 'Everything: structure, copy and design',
            description: fr ? 'Le site est refait à partir de ce que votre site dit aujourd’hui.' : 'The site is rebuilt from what your site says today.',
          },
          {
            value: 'design',
            label: fr ? 'Surtout le design' : 'Mostly the design',
            description: fr ? 'Vos textes relus restent, la présentation est refaite.' : 'Your re-read copy stays, the presentation is redone.',
          },
          {
            value: 'copy',
            label: fr ? 'Surtout les textes et le message' : 'Mostly the copy and message',
            description: fr ? 'Une promesse claire et des appels à l’action, pour votre cible.' : 'A clear promise and calls to action, for your audience.',
          },
        ],
      },
    ],
    prepare: 'site-reset',
    context: { url: source, projectId: found.projectId, original: original ?? '' },
    submitLabel: fr ? 'Relire et refaire mon site' : 'Re-read and rebuild my site',
  };
  return createTextStream(
    fr
      ? `Je relis **${host}** tel qu’il est aujourd’hui : toutes les pages, les textes, les photos (chacune avec le nom ou le titre qui l’accompagne) et l’équipe. Puis je refais votre site dans ce même projet, avec votre marque actuelle. Cela compte comme une nouvelle génération du site.`
      : `I'll read **${host}** again as it is today: every page, the copy, the photos (each with the name or title next to it) and the team. Then I rebuild your site in this same project, with your current brand. This counts as a new site generation.`,
    choices
  );
}

export function runRescan(ctx: RescanContext, answer: ChoicesAnswer): Responder {
  const found = rescanSource(ctx.projectData, ctx.siteFiles);
  const site = findSiteUrl(String(answer.context?.url ?? '')) ?? (found ? findSiteUrl(found.url) : null);
  const projectId = ctx.projectData?.id || (typeof answer.context?.projectId === 'string' ? answer.context.projectId : '') || found?.projectId;
  if (!site || !projectId) {
    return createTextStream(ctx.fr ? 'Je ne retrouve pas l’adresse du site d’origine de ce projet. Donnez-la-moi et je le relis.' : 'I can’t find this project’s original site address. Give it to me and I’ll read it again.');
  }
  const focus: RedesignFocus = answer.values.focus === 'design' || answer.values.focus === 'copy' ? answer.values.focus : 'all';
  const stream = async (projectData: ProjectModel) =>
    createSiteEngineStream({
      // Le projet ouvert, toujours : la relecture se fait dans CE projet (jamais un nouveau, contrairement à une refonte).
      projectData,
      language: ctx.fr ? 'fr' : 'en',
      request: typeof answer.context?.original === 'string' ? answer.context.original : '',
      model: ctx.model,
      userId: ctx.userId,
      scaffoldMounted: false,
      credentials: ctx.credentials,
      redesign: { url: site.url, choice: 'direct', focus, consent: true, creativity: ctx.creativity },
    });
  if (ctx.projectData?.id) return { pipeDataStreamToResponse: async (res) => (await stream(ctx.projectData!)).pipeDataStreamToResponse(res) };
  // Le projet n'a pas été joint à la requête : il est relu dans IDEM.
  return {
    async pipeDataStreamToResponse(res) {
      const controller = new AbortController();
      const projectData = await fetchProject(projectId, ctx.credentials, controller.signal).catch(() => null);
      if (!projectData?.id) {
        await createTextStream(ctx.fr ? 'Je n’arrive pas à rouvrir ce projet dans IDEM. Rechargez la page, puis redemandez-moi de relire votre site.' : 'I can’t reopen this project in IDEM. Reload the page, then ask me again to re-read your site.').pipeDataStreamToResponse(res);
        return;
      }
      await (await stream(projectData)).pipeDataStreamToResponse(res);
    },
  };
}

/**
 * « continue » / `/continue` — une génération interrompue (page actualisée par erreur, connexion coupée) reprend
 * là où elle s'était arrêtée.
 *
 * Le moteur de sites écrit son plan dans le projet avant la première étape et le coche au fur et à mesure
 * (`siteEngine/plan.ts`). Ici, on le relit : ce qui est fait est gardé, seul le reste est écrit, sans refacturer.
 * Un plan interrompu avant même le manifeste repart de la demande d'origine (la refonte, sans relire le site).
 */
import { createSiteEngineStream } from '../../siteEngine/orchestrator.js';
import { isIncomplete, readPlan, readSavedDesign } from '../../siteEngine/plan.js';
import { createTextStream } from '../choices.js';
import { CommandContext, Responder } from '../types.js';

export interface ResumeContext extends CommandContext {
  siteFiles?: Record<string, string>;
}

/** Y a-t-il une génération à reprendre dans les fichiers de l'atelier ? */
export const hasUnfinishedGeneration = (files: Record<string, string> | undefined) => isIncomplete(readPlan(files));

export function startResume(ctx: ResumeContext): Responder {
  const { fr } = ctx;
  const plan = readPlan(ctx.siteFiles);
  if (!isIncomplete(plan)) {
    return createTextStream(
      fr
        ? 'Il n’y a rien à reprendre : la dernière génération est allée au bout. Dites-moi ce que vous voulez changer sur votre site.'
        : 'There is nothing to resume: the last generation finished. Tell me what you would like to change on your site.'
    );
  }
  if (!ctx.projectData?.id) {
    return createTextStream(
      fr ? 'Pour reprendre la génération, ouvrez iCode depuis votre projet IDEM.' : 'To resume the generation, open iCode from your IDEM project.'
    );
  }
  const files = ctx.siteFiles ?? {};
  const saved = readSavedDesign(files);
  return createSiteEngineStream({
    projectData: ctx.projectData,
    language: plan.language,
    request: plan.request,
    model: ctx.model,
    userId: ctx.userId,
    scaffoldMounted: false,
    credentials: ctx.credentials,
    resume: { plan, files },
    // Interrompue avant le manifeste : la refonte repart du relevé déjà stocké dans le projet, sans le repayer.
    ...(!saved && plan.redesign
      ? {
          redesign: {
            url: plan.redesign.url,
            choice: plan.redesign.choice,
            focus: plan.redesign.focus,
            consent: true,
            creativity: ctx.creativity,
            resume: { projectId: plan.redesign.projectId, colors: 'site' as const, languages: plan.languages.slice(1), billed: true },
          },
        }
      : {}),
  });
}

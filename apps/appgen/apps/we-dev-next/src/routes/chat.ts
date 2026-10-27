import { Router, Request, Response } from 'express';
import { ChatRequest } from '../types/project.js';
import { modelForCreativity, normalizeCreativity } from '../config/modelConfig.js';
import { handleBuilderMode } from '../handlers/builderHandler.js';
import { resolveBuildTarget } from '../config/buildTarget.js';
import { handleChatMode } from '../handlers/chatHandler.js';
import { createSiteEngineStream } from '../siteEngine/orchestrator.js';
import { createRedesignAskStream } from '../siteEngine/redesign/ask.js';
import { ChatLogger } from '../utils/logger.js';
import { consumeGeneration, resolveBillableAction } from '../services/billingService.js';
import { forwardedCredentials } from '../middleware/auth.js';
import { detectRedesign } from '../siteEngine/redesign/intent.js';
import { INTERNAL_MARK } from '../siteEngine/redesign/ask.js';

const router = Router();

enum ChatMode {
  Chat = 'chat',
  Builder = 'builder',
}

router.post('/', async (req: Request, res: Response) => {
  const startTime = Date.now();

  console.log('\n\n');
  console.log('='.repeat(100));
  console.log(' POST /api/chat - REQUEST RECEIVED');
  console.log('='.repeat(100));
  console.log('\n');

  try {
    ChatLogger.setContext('Route');
    ChatLogger.stepStart('POST /api/chat - Request received');

    console.log(' Parsing request body...');
    ChatLogger.info('REQUEST', 'Parsing request body...');

    const {
      messages,
      model: requestedModel,
      creativity,
      mode = ChatMode.Builder,
      otherConfig,
      tools,
      projectData,
      language,
      qualityRepair,
      workspace,
      projectId,
      product,
      platform,
      scaffold,
      followUp,
      siteRepair,
      siteEdit,
      siteRedesign,
    } = req.body as ChatRequest;

    // Le niveau de créativité choisit le modèle (l'interface n'en montre plus aucun) ; un ancien client qui
    // envoie encore un modèle garde son choix.
    const level = normalizeCreativity(creativity);
    const model = level ? modelForCreativity(level) : requestedModel;

    // User UI language (from the client) so the AI generates content in the right
    // language. Falls back to the Accept-Language header, then English.
    const acceptFr = (req.headers['accept-language'] || '')
      .toString()
      .toLowerCase()
      .startsWith('fr');
    const resolvedLanguage =
      language === 'fr' || language === 'en' ? language : acceptFr ? 'fr' : 'en';

    // Identité vérifiée par `requireIdemUser`, jamais un en-tête libre.
    const userId = req.idemUser?.uid ?? null;

    console.log('\n REQUEST DATA:');
    console.log('  - Message count:', messages?.length || 0);
    console.log('  - Model:', model);
    console.log('  - Mode:', mode);
    console.log('  - Has projectData:', !!projectData);
    console.log('  - Project name:', projectData?.name || 'N/A');
    console.log('  - User ID:', userId || 'anonymous');
    console.log(
      '  - Last message preview:',
      messages?.[messages.length - 1]?.content?.substring(0, 100) || 'N/A'
    );

    ChatLogger.info('REQUEST_PARSED', 'Request data extracted', {
      messageCount: messages?.length || 0,
      model,
      mode,
      hasOtherConfig: !!otherConfig,
      hasTools: !!tools,
      toolsCount: tools?.length || 0,
      hasProjectData: !!projectData,
      projectName: projectData?.name || 'N/A',
      userId: userId || 'anonymous',
      lastMessagePreview: messages?.[messages.length - 1]?.content?.substring(0, 100) || 'N/A',
    });

    if (projectData) {
      console.log('\n PROJECT DATA DETECTED:');
      console.log('  - Name:', projectData.name);
      console.log('  - Description:', projectData.description);
      console.log('  - Has analysis:', !!projectData.analysisResultModel);
      console.log('  - Has branding:', !!projectData.analysisResultModel?.branding);
      console.log(
        '  - Landing config:',
        projectData.analysisResultModel?.development?.configs?.landingPageConfig
      );
      console.log(
        '  - Frontend:',
        projectData.analysisResultModel?.development?.configs?.frontend?.framework
      );
      console.log(
        '  - Backend:',
        projectData.analysisResultModel?.development?.configs?.backend?.framework
      );
      console.log(
        '  - Database:',
        projectData.analysisResultModel?.development?.configs?.database?.provider
      );

      ChatLogger.info('PROJECT_DATA', 'Project data details', {
        name: projectData.name,
        description: projectData.description,
        type: projectData.type,
        hasAnalysisResult: !!projectData.analysisResultModel,
        hasBranding: !!projectData.analysisResultModel?.branding,
        hasDevelopment: !!projectData.analysisResultModel?.development,
        hasDesign: !!projectData.analysisResultModel?.design,
        landingPageConfig: projectData.analysisResultModel?.development?.configs?.landingPageConfig,
        frontendFramework:
          projectData.analysisResultModel?.development?.configs?.frontend?.framework,
        backendFramework: projectData.analysisResultModel?.development?.configs?.backend?.framework,
        database: projectData.analysisResultModel?.development?.configs?.database?.provider,
      });
    }

    /**
     * Contrôle de facturation, AVANT toute génération.
     *
     * Placé ici parce que c'est le dernier point où rien n'est encore parti :
     * aucun en-tête envoyé, aucun appel au modèle, donc un refus peut répondre
     * un vrai 402 que le client sait interpréter. Après
     * `pipeDataStreamToResponse`, il serait trop tard pour refuser quoi que ce
     * soit — et le coût d'inférence serait déjà engagé.
     */
    // « Refais mon site https://… » : la question (gratuite, sans modèle), puis la refonte, facturée au projet
    // seulement une fois le site lu (`siteEngine/redesign/flow.ts`). Un projet qui a déjà sa charte n'a rien à
    // choisir : la refonte part directement.
    const lastUser = [...(messages ?? [])].reverse().find((message) => message.role === 'user');
    const redesignIntent =
      mode === ChatMode.Builder && !siteRedesign && !siteRepair && !qualityRepair?.trim() && !followUp?.trim() && lastUser && !String(lastUser.content).startsWith(INTERNAL_MARK)
        ? detectRedesign(String(lastUser.content))
        : null;
    const hasCharter = Array.isArray((projectData?.analysisResultModel?.branding as { sections?: { data?: string }[] } | undefined)?.sections)
      ? ((projectData!.analysisResultModel!.branding as { sections: { data?: string }[] }).sections.some((section) => !!section?.data))
      : false;
    const redesign =
      siteRedesign && typeof siteRedesign.url === 'string' && siteRedesign.url.trim()
        ? { url: siteRedesign.url.trim().slice(0, 2000), choice: siteRedesign.choice === 'identity' ? ('identity' as const) : ('direct' as const), consent: siteRedesign.consent === true, creativity: level ?? undefined }
        : redesignIntent && hasCharter
          ? { url: redesignIntent.url, choice: 'direct' as const, consent: false, creativity: level ?? undefined }
          : null;

    if (redesign || redesignIntent) {
      const fr = resolvedLanguage !== 'en';
      ChatLogger.info('SITE_REDESIGN', redesign ? 'Refonte lancée' : 'Question de refonte', { url: redesign?.url ?? redesignIntent?.url, choice: redesign?.choice });
      const result = redesign
        ? createSiteEngineStream({
            projectData,
            language: fr ? 'fr' : 'en',
            // La demande d'origine (« refais mon site … en plus moderne, en vert ») plutôt que le choix cliqué.
            request: String(
              [...(messages ?? [])].reverse().find((message) => message.role === 'user' && detectRedesign(String(message.content))?.url === redesign.url)?.content ??
                lastUser?.content ??
                ''
            ),
            model,
            userId,
            scaffoldMounted: false,
            credentials: forwardedCredentials(req),
            redesign,
          })
        : createRedesignAskStream(redesignIntent!, { fr, needsConsent: !projectData?.id });
      return await result.pipeDataStreamToResponse(res);
    }

    const billable = resolveBillableAction(messages?.length ?? 0, mode as 'chat' | 'builder');
    const billing = await consumeGeneration({
      credentials: forwardedCredentials(req),
      action: billable,
      projectId,
    });

    if (!billing.allowed) {
      console.log(' PAIEMENT REQUIS — génération refusée:', billable);
      ChatLogger.info('BILLING_REFUSED', 'Generation refused for billing reasons', billing.refusal);
      const reason = (billing.refusal as { error?: string } | undefined)?.error;
      const status =
        reason === 'authentication_required'
          ? 401
          : reason === 'billing_unavailable'
            ? 503
            : reason === 'quota_exceeded'
              ? 429
              : 402;
      return res.status(status).json(billing.refusal);
    }

    console.log('\n MODE SELECTION:', mode);
    ChatLogger.info('MODE_SELECTION', `Processing in ${mode} mode`);

    let result: any;

    if (mode === ChatMode.Chat) {
      console.log('  Delegating to handleChatMode');
      ChatLogger.info('HANDLER', 'Delegating to handleChatMode');
      result = await handleChatMode(messages, model, userId, tools, resolvedLanguage, workspace);
    } else {
      console.log('  Delegating to handleBuilderMode');
      ChatLogger.info('HANDLER', 'Delegating to handleBuilderMode');
      result = await handleBuilderMode(
        messages,
        model,
        userId,
        otherConfig,
        tools,
        projectData,
        resolvedLanguage,
        // Les deux voyagent par le même canal : une instruction précise qui
        // remplace la demande, sans passer par l'historique affiché.
        qualityRepair || followUp,
        resolveBuildTarget(product, platform, projectData),
        scaffold?.version,
        forwardedCredentials(req),
        siteRepair,
        siteEdit
      );
    }

    const duration = Date.now() - startTime;
    console.log('\n✅ REQUEST COMPLETED');
    console.log('⏱️  Duration:', duration, 'ms');
    console.log('='.repeat(100));
    console.log('\n\n');

    ChatLogger.stepEnd('POST /api/chat - Request completed', duration);

    // The resilient stream sets its own headers: on success it writes the data
    // stream (200), otherwise it answers with a real HTTP error status.
    return await result.pipeDataStreamToResponse(res);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log('\n REQUEST FAILED');
    console.error('Error:', error);
    console.log('  Duration:', duration, 'ms');
    console.log('='.repeat(100));
    console.log('\n\n');

    ChatLogger.error('REQUEST_FAILED', 'Error processing request', error);
    ChatLogger.stepEnd('POST /api/chat - Request failed', duration);

    const errorMessage = error instanceof Error ? error.message : String(error);

    // The stream may already be on the wire (headers sent): nothing left to do
    // but close it, the client got the error part from the data stream.
    if (res.headersSent) {
      ChatLogger.error('LATE_ERROR', 'Error after headers were sent', errorMessage);
      return res.end();
    }

    if (error instanceof Error && error.message?.includes('API key')) {
      ChatLogger.error('AUTH_ERROR', 'Invalid or missing API key');
      return res.status(401).send('Invalid or missing API key');
    }

    ChatLogger.error('UNKNOWN_ERROR', errorMessage);
    return res.status(500).send(errorMessage);
  }
});

export default router;

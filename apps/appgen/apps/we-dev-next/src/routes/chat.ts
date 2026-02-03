import { Router, Request, Response } from 'express';
import { ChatRequest } from '../types/project.js';
import { handleBuilderMode } from '../handlers/builderHandler.js';
import { handleChatMode } from '../handlers/chatHandler.js';
import { ChatLogger } from '../utils/logger.js';

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
      model,
      mode = ChatMode.Builder,
      otherConfig,
      tools,
      projectData,
    } = req.body as ChatRequest;

    const userId = req.headers['userid'] as string | null;

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

    console.log('\n MODE SELECTION:', mode);
    ChatLogger.info('MODE_SELECTION', `Processing in ${mode} mode`);

    let result: any;

    if (mode === ChatMode.Chat) {
      console.log('  Delegating to handleChatMode');
      ChatLogger.info('HANDLER', 'Delegating to handleChatMode');
      result = await handleChatMode(messages, model, userId, tools);
    } else {
      console.log('  Delegating to handleBuilderMode');
      ChatLogger.info('HANDLER', 'Delegating to handleBuilderMode');
      result = await handleBuilderMode(messages, model, userId, otherConfig, tools, projectData);
    }

    const duration = Date.now() - startTime;
    console.log('\n✅ REQUEST COMPLETED');
    console.log('⏱️  Duration:', duration, 'ms');
    console.log('='.repeat(100));
    console.log('\n\n');

    ChatLogger.stepEnd('POST /api/chat - Request completed', duration);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('X-Vercel-AI-Data-Stream', 'v1');

    return result.pipeDataStreamToResponse(res);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log('\n REQUEST FAILED');
    console.error('Error:', error);
    console.log('  Duration:', duration, 'ms');
    console.log('='.repeat(100));
    console.log('\n\n');

    ChatLogger.error('REQUEST_FAILED', 'Error processing request', error);
    ChatLogger.stepEnd('POST /api/chat - Request failed', duration);

    if (error instanceof Error && error.message?.includes('API key')) {
      ChatLogger.error('AUTH_ERROR', 'Invalid or missing API key');
      return res.status(401).send('Invalid or missing API key');
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    ChatLogger.error('UNKNOWN_ERROR', errorMessage);
    return res.status(500).send(errorMessage);
  }
});

export default router;

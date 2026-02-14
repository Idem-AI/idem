import { v4 as uuidv4 } from 'uuid';
import { Messages, ToolInfo, ProjectModel } from '../types/project.js';
import { estimateTokens } from '../utils/tokens.js';
import { buildMaxSystemPrompt, buildSystemPrompt, PromptExtra } from '../config/prompts.js';
import { determineFileType } from '../utils/fileTypeDetector.js';
import { getHistoryDiff } from '../utils/diffGenerator.js';
import { handleTokenLimit } from '../utils/tokenHandler.js';
import { processFiles } from '../utils/fileProcessor.js';
import { screenshotOne } from '../utils/screenshotone.js';
import { ProjectPromptService } from '../services/projectPromptService.js';
import { ChatLogger } from '../utils/logger.js';
import { streamResponse } from '../utils/streamResponse.js';

export async function handleBuilderMode(
  messages: Messages,
  model: string,
  userId: string | null,
  otherConfig?: PromptExtra,
  tools?: ToolInfo[],
  projectData?: ProjectModel
) {
  const startTime = Date.now();

  console.log('\n');
  console.log(' === BUILDER HANDLER START ===');
  console.log('  Messages:', messages.length);
  console.log('  Model:', model);
  console.log('  Has projectData:', !!projectData);
  if (projectData) {
    console.log('  Project name:', projectData.name);
  }
  console.log('');

  ChatLogger.setContext('BuilderHandler');
  ChatLogger.stepStart('handleBuilderMode');

  ChatLogger.info('INIT', 'Initializing builder mode', {
    messageCount: messages.length,
    model,
    userId,
    hasOtherConfig: !!otherConfig,
    hasTools: !!tools,
    hasProjectData: !!projectData,
  });

  const historyMessages = JSON.parse(JSON.stringify(messages));
  ChatLogger.debug('HISTORY', 'Messages history cloned');

  ChatLogger.info('FILE_PROCESSING', 'Processing files from messages...');
  const { files, allContent } = processFiles(messages);
  ChatLogger.debug('FILE_PROCESSING', 'Files processed', {
    fileCount: Object.keys(files).length,
    contentLength: allContent.length,
  });

  const lastMessage = messages[messages.length - 1];
  ChatLogger.info('URL_CHECK', 'Checking for URL in last message', {
    role: lastMessage.role,
    contentPreview: lastMessage.content.substring(0, 100),
    startsWithHash: lastMessage.content.startsWith('#'),
  });

  if (lastMessage.role === 'user' && lastMessage.content.startsWith('#')) {
    const urlMatch = lastMessage.content.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      ChatLogger.info('SCREENSHOT', 'URL detected, capturing screenshot', { url: urlMatch[0] });
      try {
        const imageUrl = await screenshotOne(urlMatch[0]);
        ChatLogger.success('SCREENSHOT', 'Screenshot captured successfully', { imageUrl });
        messages.splice(messages.length - 1, 0, {
          id: uuidv4(),
          role: 'user',
          content: `1:1 Restore this page`,
          experimental_attachments: [
            {
              name: uuidv4(),
              contentType: 'image/png',
              url: imageUrl,
            },
          ],
        });
      } catch (error) {
        ChatLogger.error('SCREENSHOT', 'Screenshot capture failed', error);
      }
    }
  }

  const filesPath = Object.keys(files);
  let nowFiles = files;
  const type = determineFileType(filesPath);
  ChatLogger.info('FILE_TYPE', 'File type determined', { type, filesCount: filesPath.length });

  if (projectData) {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 PROJECT DATA PROCESSING STARTED');
    console.log('='.repeat(80));
    console.log('  Project name:', projectData.name);
    console.log('  Project description:', projectData.description);
    console.log('  Project type:', projectData.type);
    console.log('  Has analysisResultModel:', !!projectData.analysisResultModel);

    if (projectData.analysisResultModel) {
      console.log('\n  📊 Analysis Result Model Details:');
      console.log('    Has branding:', !!projectData.analysisResultModel.branding);
      console.log('    Has development:', !!projectData.analysisResultModel.development);
      console.log('    Has design:', !!projectData.analysisResultModel.design);

      if (projectData.analysisResultModel.development?.configs) {
        const configs = projectData.analysisResultModel.development.configs;
        console.log('\n  ⚙️  Development Configs:');
        console.log('    Landing page config:', configs.landingPageConfig);
        console.log('    Frontend framework:', configs.frontend?.framework);
        console.log('    Backend framework:', configs.backend?.framework);
        console.log('    Database provider:', configs.database?.provider);
      }
    }
    console.log('='.repeat(80) + '\n');

    ChatLogger.stepStart('PROJECT DATA PROCESSING');
    ChatLogger.info('PROJECT_ENV', 'Environment check', {
      nodeEnv: process.env.NODE_ENV,
      projectDataReceived: !!projectData,
      projectName: projectData.name,
      hasAnalysisResultModel: !!projectData.analysisResultModel,
    });

    const originalMessage = messages[messages.length - 1].content;
    console.log('\n📝 ORIGINAL MESSAGE (before modification):');
    console.log('  Length:', originalMessage.length);
    console.log('  Content:', originalMessage);
    console.log('');

    ChatLogger.debug('ORIGINAL_MESSAGE', 'Original message content', {
      length: originalMessage.length,
      preview: originalMessage.substring(0, 200),
    });

    try {
      console.log('\n🔧 Creating ProjectPromptService...');
      ChatLogger.info('PROMPT_SERVICE', 'Creating ProjectPromptService instance');
      const projectPromptService = new ProjectPromptService();

      console.log('\n🎯 Generating project prompt from projectData...');
      console.log(
        '  This will extract all project information (branding, tech stack, features, etc.)'
      );
      ChatLogger.info('PROMPT_GENERATION', 'Generating project prompt from projectData...');

      const projectPrompt = projectPromptService.generatePrompt(projectData);

      console.log('\n✅ Project prompt generated!');
      console.log('  Length:', projectPrompt.length, 'characters');
      console.log('\n📄 PROJECT PROMPT PREVIEW (first 1000 chars):');
      console.log('  ---');
      console.log('  ' + projectPrompt.substring(0, 1000));
      console.log('  ...');
      console.log('  ---\n');

      ChatLogger.success('PROMPT_GENERATED', 'Project prompt generated successfully', {
        length: projectPrompt.length,
        preview: projectPrompt.substring(0, 500),
      });

      if (!projectPrompt || projectPrompt.trim().length === 0) {
        console.log('\n❌ CRITICAL ERROR: Generated project prompt is EMPTY!');
        ChatLogger.error('PROMPT_EMPTY', 'Generated project prompt is empty!');
        throw new Error('Generated project prompt is empty');
      }

      console.log('✅ Project prompt validation: PASSED (not empty)\n');
      ChatLogger.success('PROMPT_VALIDATION', 'Project prompt validated (not empty)');

      console.log('🔧 Building system prompt...');
      ChatLogger.info('SYSTEM_PROMPT', 'Building system prompt...');
      const systemPrompt = buildSystemPrompt();
      console.log('  System prompt length:', systemPrompt.length, 'characters');
      console.log(
        '  System prompt preview (first 300 chars):',
        systemPrompt.substring(0, 300) + '...\n'
      );

      ChatLogger.debug('SYSTEM_PROMPT', 'System prompt built', {
        length: systemPrompt.length,
        preview: systemPrompt.substring(0, 200),
      });

      console.log('🔨 Assembling final message content...');
      ChatLogger.info('FINAL_CONTENT', 'Building final message content...');

      // Réorganiser pour éviter "Lost in the Middle"
      // 1. System prompt (contraintes techniques)
      // 2. Détails du projet à la FIN (meilleure mémorisation)
      const systemInstructions = systemPrompt;

      // Créer un ID dynamique basé sur le projet
      const projectId = projectData.name.toLowerCase().replace(/\s+/g, '-') + '-app';

      // Renommer le projet dans le titre pour éviter la confusion avec Material UI (MUI)
      const projectDisplayName =
        projectData.name === 'MUI' ? 'MUI-African-Artisans-Marketplace' : projectData.name;
      const artifactTitle = `${projectDisplayName} - Full Implementation`;

      const userRequest = `PROJECT CONTEXT AND REQUIREMENTS:
${projectPrompt}

=== YOUR TASK ===
Build a complete landing page for: ${projectDisplayName}

Project Description: ${projectData.description}

REQUIREMENTS:
1. Use the EXACT branding specified above (colors, fonts, logo URLs)
2. Create a modern, professional landing page with:
   - Hero section with compelling headline and CTA
   - Features section highlighting key benefits
   - About/Story section
   - Contact section
3. This is NOT a generic React template - customize everything for this specific project
4. Use the provided color scheme, typography, and logo

⚠️ TARGET AUDIENCE - SUB-SAHARAN AFRICA (ABSOLUTELY CRITICAL):
- ALL images of people MUST feature Black African people. NEVER use generic Western/European/Asian stock photos.
- Use Unsplash with search terms: "african business", "african woman", "african man", "african team", "black professional", "african entrepreneur"
- Testimonials/user names MUST use African names (e.g., Amara Diallo, Kwame Asante, Fatou Ndiaye, Chidi Okonkwo, Aisha Mbeki)
- Locations MUST reference African cities (Lagos, Nairobi, Dakar, Accra, Douala, Abidjan, Kigali, Johannesburg)
- Currency references: use XAF/FCFA, NGN, KES, GHS, XOF or USD
- Phone numbers: use African country codes (+237, +234, +254, +233, +225)
- Social proof and success stories MUST feature African entrepreneurs and businesses
- Placeholder company names should be African-sounding or Africa-based

⚠️ CRITICAL FINAL INSTRUCTIONS:
- Project name "${projectData.name}" refers to THIS specific project, NOT any UI library
- Start your response IMMEDIATELY with the <boltArtifact> tag containing the complete implementation

<boltArtifact id="${projectId}" title="${artifactTitle}">
...your complete implementation here...
</boltArtifact>`;

      const finalContent = systemInstructions + '\n\n' + userRequest;

      messages[messages.length - 1].content = finalContent;

      console.log('\n' + '='.repeat(80));
      console.log('✅ FINAL CONTENT ASSEMBLED SUCCESSFULLY');
      console.log('='.repeat(80));
      console.log('  Total length:', messages[messages.length - 1].content.length, 'characters');
      console.log('  System prompt length:', systemPrompt.length, 'characters');
      console.log('  Project prompt length:', projectPrompt.length, 'characters');
      console.log(
        '  Additional text length:',
        finalContent.length - systemPrompt.length - projectPrompt.length,
        'characters'
      );
      console.log('\n📊 CONTENT BREAKDOWN:');
      console.log(
        '  1. System prompt:',
        Math.round((systemPrompt.length / finalContent.length) * 100) + '%'
      );
      console.log(
        '  2. Project prompt:',
        Math.round((projectPrompt.length / finalContent.length) * 100) + '%'
      );
      console.log(
        '  3. Additional instructions:',
        Math.round(
          ((finalContent.length - systemPrompt.length - projectPrompt.length) /
            finalContent.length) *
            100
        ) + '%'
      );
      console.log('\n📝 FINAL CONTENT PREVIEW (first 500 chars):');
      console.log('  ---');
      console.log('  ' + messages[messages.length - 1].content.substring(0, 500));
      console.log('  ...');
      console.log('  ---');
      console.log('='.repeat(80) + '\n');

      ChatLogger.success('FINAL_CONTENT', 'Final message content assembled', {
        totalLength: messages[messages.length - 1].content.length,
        systemPromptLength: systemPrompt.length,
        projectPromptLength: projectPrompt.length,
        preview: messages[messages.length - 1].content.substring(0, 200),
      });

      ChatLogger.stepEnd('PROJECT DATA PROCESSING');
    } catch (error) {
      console.log('\n' + '='.repeat(80));
      console.log('❌ ERROR GENERATING PROJECT PROMPT');
      console.log('='.repeat(80));
      console.error('Error details:', error);
      if (error instanceof Error) {
        console.log('  Error message:', error.message);
        console.log('  Error stack:', error.stack);
      }
      console.log('='.repeat(80) + '\n');

      ChatLogger.error('PROMPT_ERROR', 'Error generating project prompt', error);

      console.log('⚠️  USING FALLBACK CONTENT...');
      ChatLogger.warn('FALLBACK', 'Using fallback content due to error');

      const systemInstructions = buildSystemPrompt();
      const userRequest =
        `Error processing project data: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
        'Please generate a basic web application structure.\n\n' +
        'CRITICAL INSTRUCTION: Start your response IMMEDIATELY with <boltArtifact> tag. Do NOT add any explanation before the artifact.';

      const fallbackContent = systemInstructions + '\n\n' + userRequest;

      messages[messages.length - 1].content = fallbackContent;

      console.log('\n📝 FALLBACK CONTENT SET:');
      console.log('  Length:', fallbackContent.length, 'characters');
      console.log('  Preview (first 300 chars):', fallbackContent.substring(0, 300) + '...\n');

      ChatLogger.info('FALLBACK', 'Fallback content set', {
        length: fallbackContent.length,
        preview: fallbackContent.substring(0, 200),
      });
    }
  } else {
    ChatLogger.info('NO_PROJECT_DATA', 'No project data provided, using original logic');
    const tokenCount = estimateTokens(allContent);
    ChatLogger.debug('TOKEN_ESTIMATE', 'Estimated tokens', { tokenCount, threshold: 128000 });

    if (tokenCount > 128000) {
      ChatLogger.warn('TOKEN_LIMIT', 'Token limit exceeded, handling token limit...');
      const { files } = processFiles(messages, true);
      nowFiles = await handleTokenLimit(messages, files, filesPath);
      const historyDiffString = getHistoryDiff(historyMessages, filesPath, nowFiles);

      ChatLogger.info('MAX_PROMPT', 'Building max system prompt for large content');
      const maxPrompt = buildMaxSystemPrompt(filesPath, nowFiles, historyDiffString);
      const userRequest =
        'My question is: ' +
        messages[messages.length - 1].content +
        '\n\nCRITICAL INSTRUCTION: Start your response IMMEDIATELY with <boltArtifact> tag. Do NOT add any explanation before the artifact.';

      messages[messages.length - 1].content = maxPrompt + '\n\n' + userRequest;

      ChatLogger.debug('MAX_PROMPT', 'Max prompt applied', {
        promptLength: maxPrompt.length,
        finalLength: messages[messages.length - 1].content.length,
      });
    } else {
      ChatLogger.info('STANDARD_PROMPT', 'Building standard system prompt');
      const standardPrompt = buildSystemPrompt();
      const userRequest =
        'My question is: ' +
        messages[messages.length - 1].content +
        '\n\nCRITICAL INSTRUCTION: Start your response IMMEDIATELY with <boltArtifact> tag. Do NOT add any explanation before the artifact.';

      messages[messages.length - 1].content = standardPrompt + '\n\n' + userRequest;

      ChatLogger.debug('STANDARD_PROMPT', 'Standard prompt applied', {
        promptLength: standardPrompt.length,
        finalLength: messages[messages.length - 1].content.length,
      });
    }
  }

  try {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 CALLING STREAM RESPONSE');
    console.log('='.repeat(80));
    console.log('  Total messages:', messages.length);
    console.log(
      '  Final message length:',
      messages[messages.length - 1].content.length,
      'characters'
    );
    console.log('  Model:', model);
    console.log('  Has tools:', !!tools);
    console.log('  User ID:', userId || 'anonymous');

    console.log('\n📋 MESSAGES SUMMARY:');
    messages.forEach((msg, idx) => {
      console.log(`  ${idx + 1}. Role: ${msg.role}, Length: ${msg.content?.length || 0} chars`);
    });

    console.log('\n📝 FINAL MESSAGE PREVIEW (first 500 chars):');
    console.log('  ---');
    console.log('  ' + messages[messages.length - 1].content.substring(0, 500));
    console.log('  ...');
    console.log('  ---');
    console.log('='.repeat(80) + '\n');

    ChatLogger.info('STREAM_RESPONSE', 'Calling streamResponse to send to AI', {
      messageCount: messages.length,
      model,
      hasTools: !!tools,
      finalMessageLength: messages[messages.length - 1].content.length,
    });

    const response = await streamResponse(messages, model, userId, tools);

    const duration = Date.now() - startTime;
    console.log('\n BUILDER HANDLER COMPLETED');
    console.log('  Duration:', duration, 'ms');
    console.log(' === BUILDER HANDLER END ===');
    console.log('');

    ChatLogger.stepEnd('handleBuilderMode', duration);

    return response;
  } catch (err) {
    const duration = Date.now() - startTime;
    ChatLogger.error('BUILDER_ERROR', 'Error in handleBuilderMode', err);
    ChatLogger.stepEnd('handleBuilderMode - FAILED', duration);
    throw err;
  }
}

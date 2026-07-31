import { v4 as uuidv4 } from 'uuid';
import { Messages, ToolInfo, ProjectModel } from '../types/project.js';
import { estimateTokens } from '../utils/tokens.js';
import {
  assembleBuilderPrompt,
  buildExistingProjectContext,
  PromptExtra,
} from '../config/prompts.js';
import { determineFileType } from '../utils/fileTypeDetector.js';
import { getHistoryDiff } from '../utils/diffGenerator.js';
import { handleTokenLimit } from '../utils/tokenHandler.js';
import { processFiles } from '../utils/fileProcessor.js';
import { screenshotOne } from '../utils/screenshotone.js';
import { ProjectPromptService } from '../services/projectPromptService.js';
import { ChatLogger } from '../utils/logger.js';
import { streamResponse } from '../utils/streamResponse.js';

/** Past this, the existing project is summarised rather than sent whole. */
const CONTEXT_TOKEN_LIMIT = 128000;

/**
 * Installs the assembled prompt: the cacheable system message at the head, the
 * volatile brief on the last user message.
 *
 * The two are kept apart on purpose. Everything invariant (the routed skills)
 * sits in the `system` message so it forms a stable prefix eligible for
 * Gemini's implicit cache; everything project-specific (forged design system,
 * brief, task) stays in the trailing user message. This used to be one
 * concatenated blob inside the last user message, which meant the prefix
 * changed on every request and the cache never hit.
 */
function applyPrompt(messages: Messages, system: string, user: string): void {
  messages[messages.length - 1].content = user;

  if (messages[0]?.role === 'system') {
    messages[0].content = system;
    return;
  }

  messages.unshift({ id: uuidv4(), role: 'system', content: system });
}

/** Turns a leading `#https://…` message into a screenshot attachment. */
async function attachScreenshotIfRequested(messages: Messages): Promise<void> {
  const lastMessage = messages[messages.length - 1];

  if (lastMessage.role !== 'user' || !lastMessage.content.startsWith('#')) {
    return;
  }

  const urlMatch = lastMessage.content.match(/https?:\/\/[^\s]+/);

  if (!urlMatch) {
    return;
  }

  try {
    const imageUrl = await screenshotOne(urlMatch[0]);
    ChatLogger.success('SCREENSHOT', 'Screenshot captured', { url: urlMatch[0] });

    messages.splice(messages.length - 1, 0, {
      id: uuidv4(),
      role: 'user',
      content: '1:1 Restore this page',
      experimental_attachments: [{ name: uuidv4(), contentType: 'image/png', url: imageUrl }],
    });
  } catch (error) {
    ChatLogger.error('SCREENSHOT', 'Screenshot capture failed', error);
  }
}

export async function handleBuilderMode(
  messages: Messages,
  model: string,
  userId: string | null,
  otherConfig?: PromptExtra,
  tools?: ToolInfo[],
  projectData?: ProjectModel,
  language?: string
) {
  const startTime = Date.now();

  ChatLogger.setContext('BuilderHandler');
  ChatLogger.stepStart('handleBuilderMode');
  ChatLogger.info('INIT', 'Initializing builder mode', {
    messageCount: messages.length,
    model,
    userId,
    hasTools: !!tools,
    hasProjectData: !!projectData,
    projectName: projectData?.name,
  });

  const historyMessages: Messages = JSON.parse(JSON.stringify(messages));
  const { files, allContent } = processFiles(messages);
  const filesPath = Object.keys(files);

  await attachScreenshotIfRequested(messages);

  ChatLogger.debug('FILE_TYPE', 'Project type', {
    type: determineFileType(filesPath),
    fileCount: filesPath.length,
  });

  // The request as the user wrote it, before any assembly. The skill router
  // scores against this, so it has to stay clean of injected instructions.
  const rawRequest = messages[messages.length - 1].content;

  // Only the opening turn is "build the whole thing". Later turns carry a real
  // instruction from the user (a change request, or the linter's repair list),
  // and overwriting it with the initial framing throws that instruction away.
  const isFirstTurn = !messages.some((message) => message.role === 'assistant');

  let projectBrief: string | undefined;
  let extraContext: string | undefined;
  let request = rawRequest;

  if (projectData && isFirstTurn) {
    try {
      projectBrief = new ProjectPromptService().generatePrompt(projectData);
    } catch (error) {
      ChatLogger.error('PROMPT_ERROR', 'Could not build the project brief', error);
    }

    // The project name can collide with a library name (MUI being the case that
    // burned us), and the model then generates that library's documentation site.
    const displayName =
      projectData.name === 'MUI' ? 'MUI-African-Artisans-Marketplace' : projectData.name;

    request = [
      `Build ${projectBrief ? 'the product described above' : 'a complete web application'} for: ${displayName}`,
      projectData.description ? `\n${projectData.description}` : '',
      '',
      'Requirements:',
      '- Apply the design system above exactly: tokens, fonts, art direction, and its signature move.',
      '- Use the brand assets as typed in the Brand Assets section. A hosted URL goes in an `<img src>`; inline SVG markup is pasted into the JSX and never placed inside an `<img>`.',
      '- Nothing here may read as a generic React template. Every screen is specific to this product.',
      `- "${projectData.name}" is the name of THIS project, not of a UI library.`,
    ]
      .filter(Boolean)
      .join('\n');
  } else if (estimateTokens(allContent) > CONTEXT_TOKEN_LIMIT) {
    // Existing project too large to send whole: summarise it and send the diff.
    ChatLogger.warn('TOKEN_LIMIT', 'Context over limit, summarising the project');

    const { files: fullFiles } = processFiles(messages, true);
    const trimmedFiles = await handleTokenLimit(messages, fullFiles, filesPath);

    extraContext = buildExistingProjectContext(
      filesPath,
      trimmedFiles,
      getHistoryDiff(historyMessages, filesPath, trimmedFiles)
    );
  }

  const { system, user, diagnostics } = assembleBuilderPrompt({
    request,
    projectBrief,
    projectData,
    language,
    extraContext,
  });

  applyPrompt(messages, system, user);

  ChatLogger.success('PROMPT_ASSEMBLED', 'Prompt assembled', {
    artDirection: diagnostics.artDirection,
    seed: diagnostics.seed,
    systemChars: diagnostics.systemChars,
    userChars: diagnostics.userChars,
    coreSkills: diagnostics.skills.core.map((skill) => skill.name),
    contextualSkills: diagnostics.skills.contextual.map((skill) => skill.name),
    skillTokens: diagnostics.skills.totalTokens,
  });

  try {
    const response = await streamResponse(messages, model, userId, tools, language);
    ChatLogger.stepEnd('handleBuilderMode', Date.now() - startTime);
    return response;
  } catch (error) {
    ChatLogger.error('BUILDER_ERROR', 'Error in handleBuilderMode', error);
    ChatLogger.stepEnd('handleBuilderMode - FAILED', Date.now() - startTime);
    throw error;
  }
}

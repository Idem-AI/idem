import { v4 as uuidv4 } from 'uuid';
import { Messages } from '../action';
import { streamResponse } from '../utils/streamResponse';
import { estimateTokens } from '@/utils/tokens';
import { buildMaxSystemPrompt, buildSystemPrompt } from '../utils/promptBuilder';
import { determineFileType } from '../utils/fileTypeDetector';
import { getHistoryDiff } from '../utils/diffGenerator';
import { handleTokenLimit } from '../utils/tokenHandler';
import { processFiles } from '../utils/fileProcessor';
import { screenshotOne } from '../utils/screenshotone';
import { promptExtra, ToolInfo } from '../prompt';
import { ProjectModel } from '../types/project';
import { ProjectPromptService } from '../services/projectPromptService';

export async function handleBuilderMode(
  messages: Messages,
  model: string,
  userId: string | null,
  otherConfig: promptExtra,
  tools?: ToolInfo[],
  projectData?: ProjectModel
): Promise<Response> {
  const historyMessages = JSON.parse(JSON.stringify(messages));
  // Directory tree search
  // select files from the list of code file from the project that might be useful for the current request from the user
  const { files, allContent } = processFiles(messages);
  // Check if the last message contains a URL
  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role === 'user' && lastMessage.content.startsWith('#')) {
    const urlMatch = lastMessage.content.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      try {
        const imageUrl = await screenshotOne(urlMatch[0]);
        console.log(imageUrl, 'imageUrl');
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
        console.error('Screenshot capture failed:', error);
      }
    }
  }
  const filesPath = Object.keys(files);
  let nowFiles = files;
  const type = determineFileType(filesPath);

  // Si projectData est fourni, génère le prompt côté serveur
  if (projectData) {
    console.log('=== PROJECT DATA PROCESSING ===');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('ProjectData received:', !!projectData);
    console.log('Project name:', projectData.name);
    console.log('Has analysisResultModel:', !!projectData.analysisResultModel);
    console.log('Original message content:', messages[messages.length - 1].content);

    try {
      const projectPromptService = new ProjectPromptService();
      const projectPrompt = projectPromptService.generatePrompt(projectData);

      console.log('Generated project prompt length:', projectPrompt.length);
      console.log('Project prompt preview (first 500 chars):', projectPrompt.substring(0, 500));

      if (!projectPrompt || projectPrompt.trim().length === 0) {
        console.error('❌ Generated project prompt is empty!');
        throw new Error('Generated project prompt is empty');
      }

      const systemPrompt = buildSystemPrompt(type, otherConfig);
      console.log('System prompt length:', systemPrompt.length);

      // CORRECTION CRITIQUE : Remplacer complètement le contenu du message
      const finalContent =
        systemPrompt +
        '\nNote the requirements above, when writing code, do not give me markdown, output must be XML!! Emphasis!\n\n' +
        'PROJECT CONTEXT AND REQUIREMENTS:\n' +
        projectPrompt +
        '\n\nBased on the above project information, generate the complete application code with all necessary files.';

      messages[messages.length - 1].content = finalContent;

      console.log('✅ Final message content length:', messages[messages.length - 1].content.length);
      console.log(
        'Final message preview (first 200 chars):',
        messages[messages.length - 1].content.substring(0, 200)
      );
      console.log('=== END PROJECT DATA PROCESSING ===');
    } catch (error) {
      console.error('❌ Error generating project prompt:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

      // Fallback avec message d'erreur explicite
      const fallbackContent =
        buildSystemPrompt(type, otherConfig) +
        '\nNote the requirements above, when writing code, do not give me markdown, output must be XML!! Emphasis!\n\n' +
        `Error processing project data: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
        'Please generate a basic web application structure.\n\n' +
        messages[messages.length - 1].content;

      messages[messages.length - 1].content = fallbackContent;
      console.log('⚠️ Using fallback content due to error');
    }
  } else {
    // Original logic for non-project generation
    if (estimateTokens(allContent) > 128000) {
      const { files } = processFiles(messages, true);
      nowFiles = await handleTokenLimit(messages, files, filesPath);
      const historyDiffString = getHistoryDiff(historyMessages, filesPath, nowFiles);
      messages[messages.length - 1].content =
        buildMaxSystemPrompt(filesPath, type, nowFiles, historyDiffString, otherConfig) +
        'Note the requirements above, when writing code, do not give me markdown, output must be XML!! Emphasis!; My question is: ' +
        messages[messages.length - 1].content;
    } else {
      messages[messages.length - 1].content =
        buildSystemPrompt(type, otherConfig) +
        'Note the requirements above, when writing code, do not give me markdown, output must be XML!! Emphasis!; My question is: ' +
        messages[messages.length - 1].content;
    }
  }
  try {
    return await streamResponse(messages, model, userId, tools);
  } catch (err) {
    throw err;
  }
}

import {v4 as uuidv4} from "uuid";
import {Messages} from "../action";
import {streamResponse} from "../utils/streamResponse";
import {estimateTokens} from "@/utils/tokens";
import {buildMaxSystemPrompt, buildSystemPrompt} from "../utils/promptBuilder";
import {determineFileType} from "../utils/fileTypeDetector";
import {getHistoryDiff} from "../utils/diffGenerator";
import {handleTokenLimit} from "../utils/tokenHandler";
import {processFiles} from "../utils/fileProcessor";
import {screenshotOne} from "../utils/screenshotone";
import {promptExtra, ToolInfo} from "../prompt";
import { ProjectModel } from "../types/project";
import { ProjectPromptService } from "../services/projectPromptService";

export async function handleBuilderMode(
    messages: Messages,
    model: string,
    userId: string | null,
    otherConfig: promptExtra,
    tools?: ToolInfo[],
    projectData?: ProjectModel,
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
        console.log(imageUrl, 'imageUrl')
        messages.splice(messages.length - 1, 0, {
          id: uuidv4(),
          role: "user",
          content: `1:1 Restore this page`,
          experimental_attachments: [{
            name: uuidv4(),
            contentType: 'image/png',
            url: imageUrl,
          }],
        });
      } catch (error) {
        console.error('Screenshot capture failed:', error);
      }
    }
  }
  const filesPath = Object.keys(files);
  let nowFiles = files;
  const type = determineFileType(filesPath);
  
  // If projectData is provided, generate prompt on server side
  if (projectData) {
    try {
      const projectPromptService = new ProjectPromptService();
      const projectPrompt = projectPromptService.generatePrompt(projectData);
      
      // Replace the last message content with the generated prompt
      // Add XML output instructions (same as original logic)
      messages[messages.length - 1].content = buildSystemPrompt(type, otherConfig) + 
        'Note the requirements above, when writing code, do not give me markdown, output must be XML!! Emphasis!; My question is: ' + 
        projectPrompt;
    } catch (error) {
      console.error('Error generating project prompt:', error);
      throw new Error(`Failed to generate project prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else {
    // Original logic for non-project generation
    if (estimateTokens(allContent) > 128000) {
      const { files } = processFiles(messages, true);
      nowFiles = await handleTokenLimit(messages, files, filesPath);
      const historyDiffString = getHistoryDiff(historyMessages, filesPath, nowFiles);
      messages[messages.length - 1].content = buildMaxSystemPrompt(filesPath, type, nowFiles, historyDiffString, otherConfig) + 'Note the requirements above, when writing code, do not give me markdown, output must be XML!! Emphasis!; My question is: ' + messages[messages.length - 1].content
    } else {
      messages[messages.length - 1].content = buildSystemPrompt(type, otherConfig) + 'Note the requirements above, when writing code, do not give me markdown, output must be XML!! Emphasis!; My question is: ' + messages[messages.length - 1].content
    }
  }
  try {
    return await streamResponse(messages, model, userId, tools);
  } catch (err) {
    throw err
  }
} 

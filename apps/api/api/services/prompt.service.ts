import { GoogleGenAI, createPartFromUri, Content, File } from "@google/genai";
import dotenv from "dotenv";
import * as fs from "fs-extra";
import logger from "../config/logger";
import betaRestrictionsService from "./betaRestrictions.service";
import OpenAI from "openai";
import { userService } from "./user.service";
dotenv.config();

export enum LLMProvider {
  GEMINI = "GEMINI",
  CHATGPT = "CHATGPT",
  DEEPSEEK = "DEEPSEEK",
}

export interface LLMOptions {
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
}

export interface PromptConfig {
  provider: LLMProvider;
  modelName: string;
  llmOptions?: LLMOptions;
  contextFilePaths?: string[];
  file?: {
    localPath: string;
    mimeType?: string;
  };
  userId?: string;
  promptType?: string;
  skipQuotaCheck?: boolean;
}

export interface AIChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface PromptRequest {
  provider: LLMProvider;
  modelName: string;
  messages: AIChatMessage[];
  llmOptions?: LLMOptions;
  contextFilePaths?: string[];
  file?: {
    localPath: string;
    mimeType?: string;
  };
  userId?: string;
  promptType?: string;
  skipQuotaCheck?: boolean;
}

export interface AIResponse {
  content: string;
  summary: string;
}

export class PromptService {
  private genAIClient: GoogleGenAI;
  private openaiClient!: OpenAI; // Using definite assignment assertion as client may be conditionally initialized

  constructor() {
    logger.info("Initializing PromptService...");

    // Initialize Gemini client
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      logger.error("GEMINI_API_KEY is not set in environment variables.");
      throw new Error("GEMINI_API_KEY is not set in environment variables.");
    }
    this.genAIClient = new GoogleGenAI({ apiKey: geminiApiKey });
    logger.info("GoogleGenAI client initialized successfully.");

    // Initialize OpenAI client
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      logger.warn(
        "OPENAI_API_KEY is not set in environment variables. OpenAI features will not be available."
      );
    } else {
      this.openaiClient = new OpenAI({ apiKey: openaiApiKey });
      logger.info("OpenAI client initialized successfully.");
    }
  }

  private toGeminiMessages(messages: AIChatMessage[]): Content[] {
    return messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));
  }

  private async _runGeminiPrompt(
    modelName: string,
    messages: AIChatMessage[],
    llmOptions: LLMOptions,
    fileInput?: { localPath: string; mimeType?: string }
  ): Promise<string> {
    const geminiContent: Content[] = this.toGeminiMessages(messages);

    if (fileInput && fileInput.localPath) {
      if (geminiContent.length === 0) {
        geminiContent.push({ role: "user", parts: [] });
      }

      try {
        // Ensure file is not empty before uploading as a potential workaround/diagnostic
        const fileStats = await fs.stat(fileInput.localPath);
        if (fileStats.size === 0) {
          logger.warn(
            `File ${fileInput.localPath} is empty. Writing a placeholder to avoid potential upload issues.`
          );
          await fs.writeFile(
            fileInput.localPath,
            "[Initial empty context]",
            "utf-8"
          );
        }

        logger.info(
          `Uploading file: ${fileInput.localPath}, MimeType (intended, if SDK infers): ${fileInput.mimeType}`
        );
        // Simplifying files.upload call to match user's example: only 'file' path.
        // The SDK should infer mimeType, or it might be available on the response.
        const uploadedFile: File = await this.genAIClient.files.upload({
          file: fileInput.localPath,
        });

        // We need mimeType for createPartFromUri. Check if it's on the response.
        // If fileInput.mimeType was provided by the user, and SDK doesn't allow setting it during upload,
        // we might prefer the user-provided one if available and SDK's is generic.
        // For now, let's prioritize SDK's detected mimeType if present on uploadedFile.
        const effectiveMimeType = uploadedFile.mimeType || fileInput.mimeType;

        if (!uploadedFile || !uploadedFile.uri || !effectiveMimeType) {
          logger.error(
            "File upload response did not contain expected file details (uri or an effective mimeType)."
          );
          throw new Error(
            "File upload response did not contain expected file details (uri or an effective mimeType)."
          );
        }
        logger.info(
          `File uploaded successfully: URI ${uploadedFile.uri}, MimeType (from SDK): ${uploadedFile.mimeType}`
        );

        const filePart = createPartFromUri(uploadedFile.uri, effectiveMimeType);

        const lastMessageTurn = geminiContent[geminiContent.length - 1];
        if (!lastMessageTurn.parts) {
          lastMessageTurn.parts = [];
        }
        lastMessageTurn.parts.push(filePart);

        // run prompt
        const result = await this.genAIClient.models.generateContent({
          model: modelName,
          contents: geminiContent,
        });
        // Safely access the text content
        const firstCandidate = result.candidates?.[0];
        const firstPart = firstCandidate?.content?.parts?.[0];
        const textContent = firstPart?.text;

        if (typeof textContent === "string") {
          return textContent;
        } else {
          let detailedError = "Invalid response structure from Gemini API: ";
          if (!result.candidates || result.candidates.length === 0) {
            detailedError += "No candidates array or empty candidates array.";
          } else if (!firstCandidate) {
            detailedError +=
              "First candidate is undefined (candidates array might be sparse or malformed, or was empty).";
          } else if (!firstCandidate.content) {
            detailedError += "First candidate is missing 'content' property.";
          } else if (
            !firstCandidate.content.parts ||
            firstCandidate.content.parts.length === 0
          ) {
            detailedError +=
              "First candidate's content is missing 'parts' array or 'parts' array is empty.";
          } else if (!firstPart) {
            detailedError +=
              "First part of first candidate's content is undefined (parts array might be sparse or malformed, or was empty).";
          } else if (typeof firstPart.text !== "string") {
            detailedError +=
              "First part's 'text' property is missing or not a string.";
          } else {
            detailedError +=
              "textContent was not a string for an unknown reason after checks.";
          }
          logger.error(
            "Gemini API Error: " +
              detailedError +
              " Full response for debugging: " +
              JSON.stringify(result, null, 2)
          );
          logger.error(
            "Invalid or empty response structure from Gemini API. " +
              detailedError
          );
          throw new Error(
            "Invalid or empty response structure from Gemini API. " +
              detailedError
          );
        }
      } catch (uploadError) {
        logger.error("Error uploading file to Gemini:", uploadError);
        const errorMessage = `Failed to upload file: ${
          fileInput.localPath
        }. Error: ${(uploadError as Error).message || uploadError}`;
        logger.error(errorMessage);
        throw new Error(errorMessage);
      }
    }

    const generationParams = {
      ...(llmOptions.maxOutputTokens && {
        maxOutputTokens: llmOptions.maxOutputTokens,
      }),
      ...(llmOptions.temperature && { temperature: llmOptions.temperature }),
      ...(llmOptions.topP && { topP: llmOptions.topP }),
      ...(llmOptions.topK && { topK: llmOptions.topK }),
    };

    const result = await this.genAIClient.models.generateContent({
      model: modelName,
      contents: geminiContent,
      ...generationParams,
    });
    const response = result.text;
    if (!response) {
      logger.error("Failed to generate response from Gemini API.");
      const runPromptErrorMessage = `Failed to run prompt: ${JSON.stringify(
        result,
        null,
        2
      )}`;
      logger.error(runPromptErrorMessage);
      throw new Error(runPromptErrorMessage);
    }
    return response;
  }

  private async _runChatGPTPrompt(
    modelName: string,
    messages: AIChatMessage[],
    llmOptions: LLMOptions,
    fileInput?: { localPath: string; mimeType?: string }
  ): Promise<string> {
    if (!this.openaiClient) {
      const error = new Error(
        "OpenAI client is not initialized. Please set OPENAI_API_KEY environment variable."
      );
      logger.error(error.message);
      throw error;
    }

    try {
      // Convert our internal message format to OpenAI's format
      const openaiMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const generationParams = {
        ...(llmOptions.maxOutputTokens && {
          max_tokens: llmOptions.maxOutputTokens,
        }),
        ...(llmOptions.temperature !== undefined && {
          temperature: llmOptions.temperature,
        }),
        ...(llmOptions.topP !== undefined && { top_p: llmOptions.topP }),
        // OpenAI doesn't have a topK parameter
      };

      // Handle file uploads if needed
      if (fileInput && fileInput.localPath) {
        logger.info(
          `Processing file input for ChatGPT: ${fileInput.localPath}`
        );

        try {
          // Read the file content
          const fileContent = await fs.readFile(fileInput.localPath, "utf-8");

          // Instead of uploading the file directly, we'll add its contents to the prompt
          // Add context as system message at the beginning
          openaiMessages.unshift({
            role: "system",
            content: `File content for context: ${fileContent}`,
          });

          logger.info("File content added to ChatGPT prompt");
        } catch (fileError) {
          logger.error(
            `Error reading file for ChatGPT: ${fileInput.localPath}`,
            fileError
          );
          throw new Error(
            `Failed to read file for ChatGPT: ${
              (fileError as Error).message || fileError
            }`
          );
        }
      }

      // Create chat completion
      const response = await this.openaiClient.chat.completions.create({
        model: modelName,
        messages: openaiMessages,
        ...generationParams,
      });

      if (!response.choices || response.choices.length === 0) {
        logger.error("ChatGPT API returned no choices");
        throw new Error("ChatGPT API returned no choices");
      }

      const textContent = response.choices[0].message.content;

      if (!textContent) {
        logger.error("ChatGPT API returned empty text content");
        throw new Error("ChatGPT API returned empty text content");
      }

      return textContent;
    } catch (error) {
      const errorMessage = `Error with ChatGPT API: ${
        (error as Error).message || error
      }`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  private async _runDeepSeekPrompt(
    modelName: string,
    messages: AIChatMessage[],
    llmOptions: LLMOptions,
    fileInput?: { localPath: string; mimeType?: string }
  ): Promise<string> {
    // DeepSeek is accessed through the OpenAI API compatibility layer
    if (!this.openaiClient) {
      const error = new Error(
        "OpenAI client is not initialized. Please set OPENAI_API_KEY environment variable."
      );
      logger.error(error.message);
      throw error;
    }

    try {
      // Convert our internal message format to OpenAI's format
      const openaiMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const generationParams = {
        ...(llmOptions.maxOutputTokens && {
          max_tokens: llmOptions.maxOutputTokens,
        }),
        ...(llmOptions.temperature !== undefined && {
          temperature: llmOptions.temperature,
        }),
        ...(llmOptions.topP !== undefined && { top_p: llmOptions.topP }),
        // DeepSeek may support additional parameters, but we'll stick to the OpenAI compatibility
      };

      // Handle file uploads if needed
      if (fileInput && fileInput.localPath) {
        logger.info(
          `Processing file input for DeepSeek: ${fileInput.localPath}`
        );

        try {
          // Read the file content
          const fileContent = await fs.readFile(fileInput.localPath, "utf-8");

          // Add file content to the prompt
          openaiMessages.unshift({
            role: "system",
            content: `File content for context: ${fileContent}`,
          });

          logger.info("File content added to DeepSeek prompt");
        } catch (fileError) {
          logger.error(
            `Error reading file for DeepSeek: ${fileInput.localPath}`,
            fileError
          );
          throw new Error(
            `Failed to read file for DeepSeek: ${
              (fileError as Error).message || fileError
            }`
          );
        }
      }

      // Make API call with the DeepSeek base URL if provided, otherwise use the default OpenAI URL
      const deepSeekBaseUrl =
        process.env.DEEPSEEK_API_URL || "https://api.deepseek.com";
      const customClient = new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY || "",
        baseURL: deepSeekBaseUrl,
      });

      // Create chat completion
      const response = await customClient.chat.completions.create({
        model: modelName,
        messages: openaiMessages,
        ...generationParams,
      });

      if (!response.choices || response.choices.length === 0) {
        logger.error("DeepSeek API returned no choices");
        throw new Error("DeepSeek API returned no choices");
      }

      const textContent = response.choices[0].message.content;

      if (!textContent) {
        logger.error("DeepSeek API returned empty text content");
        throw new Error("DeepSeek API returned empty text content");
      }

      return textContent;
    } catch (error) {
      const errorMessage = `Error with DeepSeek API: ${
        (error as Error).message || error
      }`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  public async runPrompt(request: PromptConfig, messages: AIChatMessage[]): Promise<string> {
    logger.info(
      `Running prompt for provider: ${request.provider}, model: ${
        request.modelName
      }, file attached: ${!!request.file}, userId: ${request.userId}`
    );
    const {
      provider,
      modelName,
      llmOptions = {},
      file,
      userId,
      promptType,
      skipQuotaCheck = false,
    } = request;

    if (!messages || messages.length === 0) {
      logger.error("Messages array cannot be empty.");
      throw new Error("Messages array cannot be empty."); 
    }

    // Quota checking for authenticated users (skip for system/internal calls)
    if (userId && !skipQuotaCheck) {
      logger.info(`Checking quota for user: ${userId}`);
      const quotaCheck = await userService.checkQuota(userId);

      if (!quotaCheck.allowed) {
        logger.warn(`Quota exceeded for user ${userId}: ${quotaCheck.message}`);
        throw new Error(quotaCheck.message || "Quota exceeded");
      }

      logger.info(
        `Quota check passed for user ${userId}. Remaining: daily=${quotaCheck.remainingDaily}, weekly=${quotaCheck.remainingWeekly}`
      );
    }

    // Beta restrictions validation
    if (promptType) {
      const featureValidation =
        betaRestrictionsService.validateFeature(promptType);
      if (!featureValidation.allowed) {
        logger.warn(
          `Feature ${promptType} not allowed in beta: ${featureValidation.message}`
        );
        throw new Error(
          featureValidation.message || "Feature not available in beta"
        );
      }

      // Validate and adjust prompt parameters for beta
      const paramValidation = betaRestrictionsService.validatePromptParams(
        promptType,
        { llmOptions, ...request }
      );
      if (!paramValidation.allowed) {
        logger.warn(
          `Prompt parameters not allowed in beta: ${paramValidation.message}`
        );
        throw new Error(
          paramValidation.message || "Parameters not allowed in beta"
        );
      }

      // Apply adjusted parameters if any
      if (paramValidation.adjustedParams) {
        Object.assign(request, paramValidation.adjustedParams);
        logger.info(`Applied beta parameter adjustments for ${promptType}`);
      }
    }

    // Input validation for user content
    // if (userId && messages.length > 0) {
    //   const userMessage = messages.find((msg) => msg.role === "user");

    //   console.log("userMessage", userMessage);
    //   console.log("messages", messages);
    //   if (userMessage) {
    //     const inputValidation = betaRestrictionsService.validateInput(
    //       userMessage.content
    //     );
    //     console.log("inputValidation", inputValidation);
    //     if (!inputValidation.allowed) {
    //       logger.warn(
    //         `Invalid input from user ${userId}: ${inputValidation.message}`
    //       );
    //       throw new Error(inputValidation.message || "Invalid input");
    //     }
    //   }
    // }

    // Apply beta prompt modifications if needed
    let modifiedMessages = messages;
    if (betaRestrictionsService.isBetaMode() && messages.length > 0) {
      modifiedMessages = messages.map((msg) => {
        if (msg.role === "user" || msg.role === "system") {
          return {
            ...msg,
            content: betaRestrictionsService.applyBetaPromptModifications(
              msg.content
            ),
          };
        }
        return msg;
      });
      logger.info("Applied beta prompt modifications");
    }

    try {
      let result: string;
      switch (provider) {
        case LLMProvider.GEMINI:
          result = await this._runGeminiPrompt(
            modelName,
            modifiedMessages,
            llmOptions,
            file
          );
          break;
        case LLMProvider.CHATGPT:
          result = await this._runChatGPTPrompt(
            modelName,
            modifiedMessages,
            llmOptions,
            file
          );
          break;
        case LLMProvider.DEEPSEEK:
          result = await this._runDeepSeekPrompt(
            modelName,
            modifiedMessages,
            llmOptions,
            file
          );
          break;
        default:
          const unsupportedProviderError = new Error(
            `Unsupported LLM provider: ${provider}`
          );
          logger.error(
            `Unsupported LLM provider encountered in runPrompt: ${unsupportedProviderError.message}`,
            { provider, stack: unsupportedProviderError.stack }
          );
          throw unsupportedProviderError;
      }

      // Increment quota after successful API call
      if (userId && !skipQuotaCheck) {
        try {
          logger.info(`Incremented quota usage for user ${userId}`);
        } catch (quotaError) {
          logger.error(
            `Failed to increment quota for user ${userId}:`,
            quotaError
          );
          // Don't throw here as the API call was successful
        }
      }

      return result;
    } catch (error: any) {
      logger.error(
        `Error in runPrompt for provider ${provider}, model ${modelName}: ${error.message}`,
        { stack: error.stack, details: error }
      );
      throw error;
    }
  }

  public getCleanAIText(response: any): string {
    logger.debug("Attempting to clean AI text response.");
    if (typeof response === "string") {
      return response
        .replace(/^```(json)?\s*/i, "")
        .replace(/```$/g, "")
        .trim();
    }

    if (response && typeof response.text === "function") {
      try {
        const text = response.text();
        return text
          .replace(/^```(json)?\s*/i, "")
          .replace(/```$/g, "")
          .trim();
      } catch (e: any) {
        logger.warn(
          `Failed to extract text using response.text(). Trying older structure. Error: ${e.message}`,
          { stack: e.stack, responseDetails: typeof response }
        );
      }
    }

    const raw =
      response?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return raw
      .replace(/^```(json)?\s*/i, "")
      .replace(/```$/g, "")
      .trim();
  }
}

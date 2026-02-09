import { v4 as uuidv4 } from 'uuid';
import { Messages, ToolInfo } from '../types/project.js';
import { streamTextFn, StreamingOptions } from '../services/aiService.js';
import { CONTINUE_PROMPT } from '../config/prompts.js';
import { deductUserTokens, estimateTokens } from './tokens.js';
import SwitchableStream from './switchableStream.js';
import { tool } from 'ai';
import { jsonSchemaToZodSchema } from './json2zod.js';
import { ChatLogger } from './logger.js';
import { Response } from 'express';

const MAX_RESPONSE_SEGMENTS = 2;

export async function streamResponse(
  messages: Messages,
  model: string,
  userId: string | null,
  tools?: ToolInfo[]
) {
  const startTime = Date.now();
  ChatLogger.setContext('StreamResponse');
  ChatLogger.stepStart('streamResponse');

  ChatLogger.info('INIT', 'Initializing stream response', {
    messageCount: messages.length,
    model,
    userId,
    hasTools: !!tools,
    toolsCount: tools?.length || 0,
  });

  let toolList = {};
  if (tools && tools.length > 0) {
    ChatLogger.info('TOOLS', 'Processing tools...', { toolCount: tools.length });
    toolList = tools.reduce(
      (obj, { name, ...args }) => {
        ChatLogger.debug('TOOL_REGISTER', `Registering tool: ${name}`, { id: args.id });
        obj[name] = tool({
          id: args.id,
          description: args.description,
          parameters: jsonSchemaToZodSchema(args.parameters),
        });
        return obj;
      },
      {} as Record<string, any>
    );
    ChatLogger.success('TOOLS', 'All tools registered', {
      toolCount: Object.keys(toolList).length,
    });
  } else {
    ChatLogger.info('TOOLS', 'No tools provided');
  }

  ChatLogger.info('STREAM', 'Creating SwitchableStream instance');
  const stream = new SwitchableStream();

  ChatLogger.info('OPTIONS', 'Configuring streaming options', {
    hasTools: Object.keys(toolList).length > 0,
    toolCallStreaming: true,
  });

  const options: StreamingOptions = {
    tools: toolList,
    toolCallStreaming: true,
    onError: (err: any) => {
      ChatLogger.error('STREAM_ERROR', 'Error during streaming', err);
      const errorCause = err?.cause?.message || err?.cause || err?.error?.message;
      const msg = errorCause || err?.errors?.[0]?.responseBody || JSON.stringify(err);

      ChatLogger.error('ERROR_DETAILS', 'Detailed error information', {
        errorCause,
        message: msg,
        hasErrors: !!err?.errors,
        errorCount: err?.errors?.length || 0,
      });

      if (msg) {
        throw new Error(msg, { cause: err });
      }
      throw err;
    },
    onFinish: async (response) => {
      const { text: content, finishReason } = response;

      ChatLogger.info('FINISH', 'Stream finished', {
        finishReason,
        contentLength: content.length,
        contentPreview: content.substring(0, 200),
      });

      if (finishReason !== 'length') {
        const tokens = estimateTokens(content);
        ChatLogger.debug('TOKENS', 'Estimating and deducting tokens', {
          tokens,
          userId,
          willDeduct: !!userId,
        });

        if (userId) {
          await deductUserTokens(userId, tokens);
          ChatLogger.success('TOKENS', 'Tokens deducted successfully', { tokens, userId });
        }

        ChatLogger.info('STREAM_CLOSE', 'Closing stream (finish reason not length)');
        return stream.close();
      }

      ChatLogger.warn('CONTINUE', 'Finish reason is length, checking if can continue', {
        currentSwitches: stream.switches,
        maxSegments: MAX_RESPONSE_SEGMENTS,
      });

      if (stream.switches >= MAX_RESPONSE_SEGMENTS) {
        ChatLogger.error('MAX_SEGMENTS', 'Maximum segments reached, cannot continue');
        throw Error('Cannot continue message: Maximum segments reached');
      }

      ChatLogger.info('CONTINUE', 'Adding continuation messages');
      messages.push({ id: uuidv4(), role: 'assistant', content });
      messages.push({ id: uuidv4(), role: 'user', content: CONTINUE_PROMPT });
      ChatLogger.debug('CONTINUE', 'Continuation messages added', {
        newMessageCount: messages.length,
      });
    },
  };

  try {
    ChatLogger.info('AI_CALL', 'Calling AI with streamTextFn', {
      model,
      messageCount: messages.length,
      lastMessageLength: messages[messages.length - 1]?.content?.length || 0,
      lastMessagePreview: messages[messages.length - 1]?.content?.substring(0, 300) || 'N/A',
    });

    const result = streamTextFn(messages, options, model);

    ChatLogger.success('AI_RESPONSE', 'AI stream created successfully');

    const duration = Date.now() - startTime;
    ChatLogger.stepEnd('streamResponse', duration);

    return result;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    ChatLogger.error('STREAM_FAILED', 'Error in streamResponse', error);

    ChatLogger.info('CLEANUP', 'Closing stream due to error');
    stream.close();

    if (error.cause) {
      ChatLogger.error('ERROR_CAUSE', 'Error has cause property', { cause: error.cause });
      const newError = new Error(error.cause);
      (newError as any).cause = error.cause;
      ChatLogger.stepEnd('streamResponse - FAILED', duration);
      throw newError;
    }

    ChatLogger.stepEnd('streamResponse - FAILED', duration);
    throw error;
  }
}

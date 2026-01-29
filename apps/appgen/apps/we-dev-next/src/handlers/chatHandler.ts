import { v4 as uuidv4 } from 'uuid';
import { Messages, ToolInfo } from '../types/project.js';
import { streamTextFn, StreamingOptions } from '../services/aiService.js';
import { CONTINUE_PROMPT } from '../config/prompts.js';
import { deductUserTokens, estimateTokens } from '../utils/tokens.js';
import SwitchableStream from '../utils/switchableStream.js';
import { tool } from 'ai';
import { jsonSchemaToZodSchema } from '../utils/json2zod.js';
import { Response } from 'express';

const MAX_RESPONSE_SEGMENTS = 2;

export async function handleChatMode(
  messages: Messages,
  model: string,
  userId: string | null,
  tools?: ToolInfo[]
): Promise<Response> {
  const stream = new SwitchableStream();
  let toolList = {};

  if (tools && tools.length > 0) {
    toolList = tools.reduce(
      (obj, { name, ...args }) => {
        obj[name] = tool({
          id: args.id,
          description: args.description,
          parameters: jsonSchemaToZodSchema(args.parameters),
          execute: async (input: any) => {
            return input;
          },
        });
        return obj;
      },
      {} as Record<string, any>
    );
  }

  const options: StreamingOptions = {
    tools: toolList,
    toolCallStreaming: true,
    onError: (error: any) => {
      const uuid = uuidv4();
      const msg = error?.errors?.[0]?.responseBody;
      throw new Error(`${msg || JSON.stringify(error)} logid ${uuid}`);
    },
    onFinish: async (response) => {
      const { text: content, finishReason } = response;

      if (finishReason !== 'length') {
        const tokens = estimateTokens(content);
        if (userId) {
          await deductUserTokens(userId, tokens);
        }
        return stream.close();
      }

      if (stream.switches >= MAX_RESPONSE_SEGMENTS) {
        throw Error('Cannot continue message: Maximum segments reached');
      }

      messages.push({ id: uuidv4(), role: 'assistant', content });
      messages.push({ id: uuidv4(), role: 'user', content: CONTINUE_PROMPT });
    },
  };

  const result = await streamTextFn(messages, options, model);

  return result;
}

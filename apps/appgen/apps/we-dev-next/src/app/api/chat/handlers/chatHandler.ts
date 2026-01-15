import { Messages, StreamingOptions, streamTextFn } from '../action';
import { CONTINUE_PROMPT, ToolInfo } from '../prompt';
import SwitchableStream from '../switchable-stream';
// TODO: Re-enable tool imports when fixing tool handling for ai v6.0.26
// import { tool } from 'ai';
// import { jsonSchemaToZodSchema } from '@/app/api/chat/utils/json2zod';

const MAX_RESPONSE_SEGMENTS = 2;

export async function handleChatMode(
  messages: Messages,
  model: string,
  _userId: string | null,
  _tools?: ToolInfo[]
): Promise<Response> {
  const switchableStream = new SwitchableStream();
  // TODO: Fix tool handling for ai v6.0.26 - temporarily disabled
  const toolList = {};
  const options: StreamingOptions = {
    tools: toolList,
    onError: (error) => {
      const msg = error?.error;
      throw new Error(`${msg || JSON.stringify(error)}`);
    },
    onFinish: async (response) => {
      const { text: content, finishReason } = response;

      if (finishReason !== 'length') {
        return switchableStream.close();
      }

      if (switchableStream.switches >= MAX_RESPONSE_SEGMENTS) {
        throw Error('Cannot continue message: Maximum segments reached');
      }

      messages.push({ role: 'assistant', content });
      messages.push({ role: 'user', content: CONTINUE_PROMPT });
    },
  };

  const result = streamTextFn(messages, options, model);

  // Create a data stream format compatible with AI React client
  const encoder = new TextEncoder();
  const responseStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.textStream) {
          // Format as data stream part with separator for AI React client
          const dataChunk = `0:${JSON.stringify(chunk)}\n`;
          controller.enqueue(encoder.encode(dataChunk));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(responseStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

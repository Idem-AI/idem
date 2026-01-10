// Removed unused uuidv4 import
import { Messages, StreamingOptions, streamTextFn } from '../action';
import { CONTINUE_PROMPT, ToolInfo } from '../prompt';
import SwitchableStream from '../switchable-stream';
// TODO: Re-enable tool imports when fixing tool handling for ai v6.0.26
// import { tool } from 'ai';
// import { jsonSchemaToZodSchema } from '@/app/api/chat/utils/json2zod';

const MAX_RESPONSE_SEGMENTS = 2;

export async function streamResponse(
  messages: Messages,
  model: string,
  _userId: string | null,
  _tools?: ToolInfo[]
): Promise<Response> {
  // TODO: Fix tool handling for ai v6.0.26 - temporarily disabled
  const toolList = {};
  const stream = new SwitchableStream();
  const options: StreamingOptions = {
    tools: toolList,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      // Get error information, prioritize cause property
      const errorCause = err?.cause?.message || err?.cause || err?.error?.message;
      const msg = errorCause || err?.errors?.[0]?.responseBody || JSON.stringify(err);

      if (msg) {
        throw new Error(msg, { cause: err });
      }
      throw err;
    },
    onFinish: async (response) => {
      const { text: content, finishReason } = response;

      if (finishReason !== 'length') {
        return stream.close();
      }

      if (stream.switches >= MAX_RESPONSE_SEGMENTS) {
        throw Error('Cannot continue message: Maximum segments reached');
      }

      messages.push({ role: 'assistant', content });
      messages.push({ role: 'user', content: CONTINUE_PROMPT });
    },
  };

  try {
    const result = streamTextFn(messages, options, model);

    // Create a data stream format compatible with AI React client
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
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

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    stream.close();

    if (error.cause) {
      const newError = new Error(error.cause);
      newError.cause = error.cause;
      throw newError;
    }
    stream.close();
    throw error;
  }
}

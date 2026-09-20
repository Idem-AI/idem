import { v4 as uuidv4 } from 'uuid';
import { Messages, ToolInfo } from '../types/project.js';
import { StreamingOptions } from '../services/aiService.js';
import { CONTINUE_PROMPT, getLanguageDirective } from '../config/prompts.js';
import { reportUsage } from '../utils/tokens.js';
import SwitchableStream from '../utils/switchableStream.js';
import { tool } from 'ai';
import { jsonSchemaToZodSchema } from '../utils/json2zod.js';
import { createResilientStream } from '../utils/resilientStream.js';
import { buildWorkspaceTools, WorkspaceSnapshot } from '../tools/workspaceTools.js';

const MAX_RESPONSE_SEGMENTS = 2;

/** Tours d'outils avant que le modèle doive conclure. Au-delà, un diagnostic
 *  qui n'a pas abouti tourne en rond plutôt que d'admettre qu'il bloque. */
const MAX_TOOL_STEPS = Number(process.env.PLAN_MAX_TOOL_STEPS ?? 8);

const PLAN_DIRECTIVE = `Tu es en mode Plan.

Tu ne modifies JAMAIS le code. Tu n'as aucun outil d'écriture, et tu ne dois pas
produire de bloc de fichier ni d'artefact : si l'utilisateur demande une
modification, décris-la et invite-le à basculer en mode Build.

Tu disposes d'outils de lecture sur le projet en cours (list_files, read_file,
search_files, read_logs). Sers-t'en avant de répondre : une réponse fondée sur
le code réel vaut mieux qu'une hypothèse plausible. Pour un diagnostic, commence
par read_logs, puis remonte au fichier fautif.

Quand la demande est ambiguë, pose une question de suivi plutôt que de deviner.`;

export async function handleChatMode(
  messages: Messages,
  model: string,
  userId: string | null,
  tools?: ToolInfo[],
  language?: string,
  workspace?: WorkspaceSnapshot
) {
  const stream = new SwitchableStream();
  let toolList: Record<string, any> = {};

  // Le mode Plan n'est agentique que s'il a de quoi lire. Sans instantané, il
  // retombe sur son comportement d'origine : une conversation simple.
  const hasWorkspace = !!workspace?.files && Object.keys(workspace.files).length > 0;

  messages.unshift({
    id: uuidv4(),
    role: 'system',
    content: hasWorkspace
      ? `${PLAN_DIRECTIVE}\n\n${getLanguageDirective(language)}`
      : getLanguageDirective(language),
  });

  if (hasWorkspace) {
    toolList = { ...buildWorkspaceTools(workspace as WorkspaceSnapshot) };
  }

  if (tools && tools.length > 0) {
    // Les outils MCP de l'utilisateur s'ajoutent aux outils de lecture.
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
      toolList as Record<string, any>
    );
  }

  const options: StreamingOptions = {
    tools: toolList,
    toolCallStreaming: true,
    // Sans plusieurs tours, le SDK s'arrête au premier appel d'outil et rend
    // une réponse vide : le modèle aurait lu un fichier sans jamais conclure.
    ...(hasWorkspace ? { maxSteps: MAX_TOOL_STEPS } : {}),
    onError: (error: any) => {
      // Logged only: throwing from this callback runs inside a stream transform
      // and would end up as an unhandled rejection. The resilient stream below
      // takes care of retrying on another model and of the client message.
      const msg = error?.errors?.[0]?.responseBody || error?.message;
      console.error(`[chat] stream error (logid ${uuidv4()}):`, msg || error);
    },
    onFinish: async (response) => {
      const { text: content, finishReason, usage } = response;

      reportUsage({
        model,
        mode: 'plan',
        promptTokens: usage?.promptTokens,
        completionTokens: usage?.completionTokens,
        finishReason,
        userId,
      });

      if (finishReason !== 'length') {
        return stream.close();
      }

      if (stream.switches >= MAX_RESPONSE_SEGMENTS) {
        throw Error('Cannot continue message: Maximum segments reached');
      }

      messages.push({ id: uuidv4(), role: 'assistant', content });
      messages.push({ id: uuidv4(), role: 'user', content: CONTINUE_PROMPT });
    },
  };

  return createResilientStream(messages, options, model, language);
}

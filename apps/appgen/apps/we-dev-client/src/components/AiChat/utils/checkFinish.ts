import { ChatRequestOptions, CreateMessage, Message } from "ai";
import { execList } from "../useMessageParser";
import { TFunction } from "i18next";
import { ensureProjectIsRunnable } from "./ensureRunnable";


/**
 * Check if boltArtifact tags are properly closed
 * @param text - Input text content
 * @returns Returns true if boltArtifact tags are properly closed, false otherwise
 */
export const checkFinish = (text: string, append?: (message: Message | CreateMessage, chatRequestOptions?: ChatRequestOptions) => Promise<string | null | undefined>, t?: TFunction): boolean => {
  const openCount = (text.match(/<boltArtifact/g) || []).length;
  const closeCount = (text.match(/<\/boltArtifact>/g) || []).length;

  if (openCount !== closeCount) {
    append({
      content: t('chat.regenerate_incomplete'),
      role: 'user',
    })
  }
  // Both opening and closing tags must exist and be equal in number
  return openCount === closeCount;
};

const INSTALL_COMMAND = "npm install";
const START_COMMAND = "npm run dev";

const isInstall = (command: string) => /^(npm|pnpm|yarn)\s+(install|i|add)\b/.test(command);
const isStart = (command: string) => /\b(run\s+)?(dev|start)\b/.test(command);

/**
 * Collects the shell/start actions from the artifacts and runs them.
 *
 * Two guarantees are added around the model's output, because both failures are
 * invisible to the user until the preview simply never appears:
 *
 * 1. package.json is patched first, so `npm run dev` cannot die on a missing
 *    script (see ensureRunnable).
 * 2. If the artifact forgot the install/start actions entirely, they are
 *    appended. `execList` dedupes by index against what it already ran, and the
 *    list is rebuilt in the same order every time, so this never double-runs.
 */
export const checkExecList = (messages: Message[]) => {
  setTimeout(async () => {
    const shellCommandRegex =
      /<boltAction\s+type=["'](shell|start)["']\s*>([\s\S]*?)<\/boltAction>/g;

    const list: string[] = [];
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      if (message.role === "assistant") {
        const matches = Array.from(message.content.matchAll(shellCommandRegex));
        matches.forEach((match) => {
          const command = match[2].trim();
          if (command) {
            list.push(command);
          }
        });
      }
    }

    try {
      await ensureProjectIsRunnable();
    } catch (error) {
      console.warn("[checkExecList] could not verify the project manifest:", error);
    }

    if (!list.some(isInstall)) {
      list.push(INSTALL_COMMAND);
    }

    if (!list.some(isStart)) {
      list.push(START_COMMAND);
    }

    console.log("[checkExecList] commands", list);
    execList.run(list);
  }, 1000);
};
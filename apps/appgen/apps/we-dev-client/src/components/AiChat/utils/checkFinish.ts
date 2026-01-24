import { ChatRequestOptions, CreateMessage, Message } from "ai";
import { execList } from "../useMessageParser";
import { TFunction } from "i18next";


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

export const checkExecList = (messages: Message[]) => {
  // No restrictions in type
  setTimeout(() => {
    const shellCommandRegex =
      /<boltAction\s+type=["'](shell|start)["']\s*>([\s\S]*?)<\/boltAction>/g;

    const list = [];
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      if (message.role === "assistant") {
        console.log("message.content", message.content);
        const matches = Array.from(message.content.matchAll(shellCommandRegex));
        console.log("matches", matches);
        matches.forEach((match) => {
          const command = match[2].trim();
          console.log("command", command);
          list.push(command);
        });
      }
    }
    execList.run(list);
  }, 1000);

}
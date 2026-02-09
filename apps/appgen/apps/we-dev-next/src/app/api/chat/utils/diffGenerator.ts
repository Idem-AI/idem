import { Messages } from "../action";
import { parseMessage } from "../messagepParseJson";

export function getHistoryDiff(
  historyMessages: Messages,
  filesPath: string[],
  nowFiles: { [key: string]: string }
): string {
  let diffResult = "";
  const currentMessageIndex = historyMessages.length - 1;
  let foundFirst = false;
  let previousFiles = null;

  for (let i = currentMessageIndex - 1; i >= 0; i--) {
    const message = historyMessages[i];
    if (message.role === "assistant") {
      const { files, content } = parseMessage(message.content);
      const hasRelevantFiles = filesPath.some((path) => files && files[path]);

      if (hasRelevantFiles) {
        if (!foundFirst) {
          foundFirst = true;
        } else {
          previousFiles = files;
          break;
        }
      }
    }
  }

  if (!previousFiles) return "";

  for (const filePath of filesPath) {
    const currentContent = nowFiles[filePath];
    const previousContent = previousFiles[filePath];

    if (!previousContent || !currentContent) continue;

    if (currentContent !== previousContent) {
      diffResult += `diffFilePath: ${filePath};\n`;
      const previousLines = previousContent.split("\n");
      const currentLines = currentContent.split("\n");
      let diffContent = "";

      for (let i = 0; i < Math.max(previousLines.length, currentLines.length); i++) {
        const prevLine = previousLines[i] || "";
        const currLine = currentLines[i] || "";
        if (prevLine !== currLine) {
          if (prevLine) diffContent += `- ${prevLine}\n`;
          if (currLine) diffContent += `+ ${currLine}\n`;
        }
      }
      diffResult += diffContent + "\n";
    }
  }

  return diffResult;
} 
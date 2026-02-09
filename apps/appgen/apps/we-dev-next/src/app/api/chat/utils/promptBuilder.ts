import { typeEnum, getSystemPrompt,promptExtra } from "../prompt";

export function buildMaxSystemPrompt(
  filesPath: string[], 
  type: typeEnum, 
  files: Record<string, string>, 
  diffString: string,
  otherConfig:promptExtra
): string {
  return `Current file directory tree: ${filesPath.join("\n")}\n\n,You can only modify the contents within the directory tree, requirements: ${getSystemPrompt(type,otherConfig)}
Current requirement file contents:\n${JSON.stringify(files)}${diffString ? `,diff:\n${diffString}` : ""}`;
} 

export function buildSystemPrompt(
  type: typeEnum, 
  otherConfig:promptExtra
): string {
  return `${getSystemPrompt(type,otherConfig)}`;
} 
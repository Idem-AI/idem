import { stripIndents } from '../utils/stripIndent.js';

export const WORK_DIR_NAME = 'project';
export const WORK_DIR = `/home/${WORK_DIR_NAME}`;
export const MODIFICATIONS_TAG_NAME = 'bolt_file_modifications';

export interface PromptExtra {
  isBackEnd: boolean;
  backendLanguage: string;
  extra: Record<string, any>;
}

export function getSystemPrompt(): string {
  return `
You are an expert web developer. Generate complete, working code.

TECHNICAL CONSTRAINTS:
- WebContainer environment (browser Node.js)
- Use Vite + React 18 + TailwindCSS
- No native binaries

PROJECT SETUP:
- The project is ALREADY initialized with Vite + React
- DO NOT run "npx create-vite" or any project initialization commands
- The project structure already exists in /home/project
- Only modify existing files or add new files as needed
- Use "npm install <package>" to add dependencies
- Use "npm run dev" to start the development server

OUTPUT FORMAT:
<boltArtifact id="project-id" title="Project Title">
  <boltAction type="file" filePath="path">code</boltAction>
  <boltAction type="shell">npm install package-name</boltAction>
  <boltAction type="start">npm run dev</boltAction>
</boltArtifact>

IMPORTANT RULES:
1. NEVER run project initialization commands (create-vite, create-react-app, etc.)
2. Work with the existing project structure
3. Only add/modify files and install dependencies
4. Start with file modifications, then install dependencies, then start dev server

`;
}

export function buildSystemPrompt(): string {
  return getSystemPrompt();
}

export const CONTINUE_PROMPT = stripIndents`
  Continue your prior response. IMPORTANT: Immediately begin from where you left off without any interruptions.
  Do not repeat any content, including artifact and action tags.
`;

export function buildMaxSystemPrompt(
  filesPath: string[],
  files: Record<string, string>,
  diffString: string
): string {
  return `Current file directory tree: ${filesPath.join('\n')}\n\n,You can only modify the contents within the directory tree, requirements: ${getSystemPrompt()}
Current requirement file contents:\n${JSON.stringify(files)}${diffString ? `,diff:\n${diffString}` : ''}`;
}

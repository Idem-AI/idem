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
  <boltAction type="file" filePath="package.json">package.json content</boltAction>
  <boltAction type="file" filePath="path">other files</boltAction>
  <boltAction type="shell">npm install</boltAction>
  <boltAction type="start">npm run dev</boltAction>
</boltArtifact>

IMPORTANT RULES:
1. NEVER run project initialization commands (create-vite, create-react-app, etc.)
2. Work with the existing project structure
3. ALWAYS create/update package.json as the FIRST file action
4. Create package.json with all required dependencies before any other files
5. After package.json, create other files in logical order (config files, then source files)
6. Run "npm install" after all files are created
7. Finally, start the dev server with "npm run dev"

FILE CREATION ORDER (CRITICAL):
1. package.json (MUST BE FIRST)
2. Configuration files (vite.config.js, tailwind.config.js, etc.)
3. index.html
4. Source files (src/main.jsx, src/App.jsx, etc.)
5. npm install
6. npm run dev

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

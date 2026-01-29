import { allowedHTMLElements } from '../utils/markdown.js';
import { stripIndents } from '../utils/stripIndent.js';
import { TypeEnum } from '../utils/fileTypeDetector.js';
import { ProjectModel } from '../types/project.js';

export const WORK_DIR_NAME = 'project';
export const WORK_DIR = `/home/${WORK_DIR_NAME}`;
export const MODIFICATIONS_TAG_NAME = 'bolt_file_modifications';

const iconName = [
  'add-friends',
  'add',
  'add2',
  'album',
  'arrow',
  'at',
  'back',
  'back2',
  'bellring-off',
  'bellring-on',
  'camera',
  'cellphone',
  'clip',
  'close',
  'close2',
  'comment',
  'contacts',
  'copy',
  'delete-on',
  'delete',
  'discover',
  'display',
  'done',
  'done2',
  'download',
  'email',
  'error',
  'eyes-off',
  'eyes-on',
  'folder',
  'group-detail',
  'help',
  'home',
  'imac',
  'info',
  'keyboard',
  'like',
  'link',
  'location',
  'lock',
  'max-window',
  'me',
  'mike',
  'mike2',
  'mobile-contacts',
  'more',
  'more2',
  'mosaic',
  'music-off',
  'music',
  'note',
  'pad',
  'pause',
  'pencil',
  'photo-wall',
  'play',
  'play2',
  'previous',
  'previous2',
  'qr-code',
  'refresh',
  'report-problem',
  'search',
  'sending',
  'setting',
  'share',
  'shop',
  'star',
  'sticker',
  'tag',
  'text',
  'time',
  'transfer-text',
  'transfer2',
  'translate',
  'tv',
  'video-call',
  'voice',
  'volume-down',
  'volume-off',
  'volume-up',
];

export interface PromptExtra {
  isBackEnd: boolean;
  backendLanguage: string;
  extra: Record<string, any>;
}

const databasePrompts: Record<string, (extra: any) => string[]> = {
  mysql: () => [
    'IMPORTANT: Use MySQL as database',
    'IMPORTANT: Include database connection configuration',
  ],
  postgresql: () => [
    'IMPORTANT: Use PostgreSQL as database',
    'IMPORTANT: Include database connection configuration',
  ],
  mongodb: () => [
    'IMPORTANT: Use MongoDB as database',
    'IMPORTANT: Include database connection configuration',
  ],
};

const backendPrompts: Record<string, (extra: any) => string[]> = {
  java: () => ['IMPORTANT: Use Java with Spring Boot framework'],
  javascript: () => ['IMPORTANT: Use Node.js with Express framework'],
  typescript: () => ['IMPORTANT: Use Node.js with Express and TypeScript'],
  python: () => ['IMPORTANT: Use Python with Flask or FastAPI framework'],
  go: () => ['IMPORTANT: Use Go with Gin or Echo framework'],
};

const cachePrompts: Record<string, (extra: any) => string[]> = {
  redis: () => ['IMPORTANT: Use Redis for caching'],
};

function getExtraPrompt(
  type: TypeEnum,
  startNum: number = 15,
  extra?: PromptExtra | ProjectModel
): string {
  const promptArr: string[] = [];
  promptArr.push(
    `IMPORTANT: All code must be complete code, do not generate code snippets, and do not use Markdown`
  );

  if (type === TypeEnum.MiniProgram) {
    promptArr.push(
      `IMPORTANT: For any place that uses images, implement using weui's icon library, usage example: <we-icon type="field" icon="add" color="black" size="{{24}}"></we-icon>, size must be 24px, where icon can only be ${iconName.join(
        ','
      )}, please choose appropriate icon based on the scenario`
    );
    promptArr.push(
      `IMPORTANT: If images need to be used, you must write /components/weicon/index in the current directory's .json file`
    );
    promptArr.push(
      `IMPORTANT: If the mini program needs a tabbar, generate a custom bottom tabbar component custom-tab-bar to replace the native app.json tabbar`
    );
  }

  if (type === TypeEnum.Other) {
    promptArr.push(
      `IMPORTANT: If you are a react project, you must use import React from 'react' to introduce react`
    );
  }

  if (extra) {
    const ret =
      'analysisResultModel' in extra
        ? resolveProjectConfig(extra as ProjectModel)
        : resolveExtra(extra as PromptExtra);
    promptArr.unshift(...ret);
  }

  let prompt = '';
  for (let index = 0; index < promptArr.length; index++) {
    prompt += `${index + startNum}. ${promptArr[index]}\n`;
  }
  return prompt;
}

function resolveExtra(extra: PromptExtra): string[] {
  const promptArr: string[] = [];

  if (extra.isBackEnd) {
    promptArr.push('IMPORTANT: You must generate backend code, do not only generate frontend code');
    promptArr.push('IMPORTANT: Backend must handle CORS for all domains');

    let language = (extra.backendLanguage || 'java').toLowerCase();
    if (language === '') language = 'java';

    const backPromptArr = backendPrompts[language]?.(extra) || [];
    promptArr.push(...backPromptArr);

    if (extra.extra['isOpenDataBase'] ?? false) {
      let database = (extra.extra['database'] ?? 'mysql').toLowerCase();
      if (database === '') database = 'mysql';
      const databasePromptArr = databasePrompts[database]?.(extra) || [];
      promptArr.push(...databasePromptArr);
    } else {
      promptArr.push('IMPORTANT: Backend does not need database, use Map for storage');
    }

    if (extra.extra['isOpenCache'] ?? false) {
      let cache = extra.extra['cache'] ?? 'redis';
      if (cache === '') cache = 'redis';
      const cachePromptArr = cachePrompts[cache]?.(extra) || [];
      promptArr.push(...cachePromptArr);
    }

    promptArr.push(`IMPORTANT: Write the defined interfaces into a json file named api.json`);
    promptArr.push(
      'IMPORTANT: Use localhost for backend address, separate frontend and backend files, put frontend files under src, backend files in backend directory.'
    );
  }

  return promptArr;
}

function resolveProjectConfig(project: ProjectModel): string[] {
  const promptArr: string[] = [];
  const developmentConfig = project.analysisResultModel?.development?.configs;

  if (!developmentConfig) return promptArr;

  const backendConfig = developmentConfig.backend;
  const databaseConfig = developmentConfig.database;
  const projectConfig = developmentConfig.projectConfig;

  if (backendConfig && backendConfig.language) {
    promptArr.push('IMPORTANT: You must generate backend code, do not only generate frontend code');
    promptArr.push('IMPORTANT: Backend must handle CORS for all domains');
    promptArr.push(
      `IMPORTANT: Use ${backendConfig.language} as the backend language with ${backendConfig.framework} framework.`
    );
    promptArr.push(`IMPORTANT: Implement ${backendConfig.apiType} API endpoints.`);

    if (backendConfig.orm) {
      promptArr.push(`IMPORTANT: Use ${backendConfig.orm} as ORM for database operations.`);
    }

    const backendFeatures = backendConfig.features;
    if (backendFeatures) {
      if (Array.isArray(backendFeatures)) {
        backendFeatures.forEach((feature) => {
          promptArr.push(`IMPORTANT: Implement ${feature} functionality in the backend.`);
        });
      } else {
        Object.entries(backendFeatures).forEach(([feature, enabled]) => {
          if (enabled) {
            promptArr.push(`IMPORTANT: Implement ${feature} functionality in the backend.`);
          }
        });
      }
    }
  }

  if (databaseConfig && databaseConfig.provider && databaseConfig.provider !== 'none') {
    const databasePromptArr =
      databasePrompts[databaseConfig.provider.toLowerCase()]?.(project) || [];
    promptArr.push(...databasePromptArr);
  } else {
    promptArr.push('IMPORTANT: Backend does not need database, use Map for storage');
  }

  if (projectConfig) {
    if (projectConfig.authentication) {
      promptArr.push('IMPORTANT: Implement user authentication system.');
    }
    if (projectConfig.authorization) {
      promptArr.push('IMPORTANT: Implement role-based authorization system.');
    }
    if (projectConfig.paymentIntegration) {
      promptArr.push('IMPORTANT: Implement payment integration functionality.');
    }
  }

  promptArr.push(`IMPORTANT: Write the defined interfaces into a json file named api.json`);
  promptArr.push(
    'IMPORTANT: Use localhost for backend address, separate frontend and backend files.'
  );

  return promptArr;
}

export function getSystemPrompt(type: TypeEnum, otherConfig?: PromptExtra): string {
  return `
You are an expert web developer. Generate complete, working code.

PRE-GENERATION VALIDATION (MANDATORY):
Before generating ANY code, you MUST internally verify:
1) Project type = "marketing landing page" (NOT dashboard/admin/app)
2) Contains ONLY: Hero, Features, About, Contact, Footer
3) Contains NO: dashboards, auth, tables, admin UI, sidebars
If verification fails, STOP and regenerate with correct understanding.

ALLOWED UI COMPONENTS:
- hero-banner (headline, CTA, image)
- feature-grid (benefits, icons)
- about-section (story, mission)
- testimonials (social proof)
- call-to-action (conversion)
- contact-form (email, message)
- footer (links, copyright)

FORBIDDEN COMPONENTS:
- sidebar, navbar-dashboard
- charts, graphs, metrics
- data tables, admin panels
- auth forms (login/signup)
- user management UI

TECHNICAL CONSTRAINTS:
- WebContainer environment (browser Node.js)
- Use Vite + React 18 + TailwindCSS
- No native binaries

CRITICAL RULE:
NEVER fallback to generic templates like "habit-tracker-pro" or dashboard starters.
ALWAYS use the exact project data in the "SOURCE OF TRUTH" section.

OUTPUT FORMAT:
<boltArtifact id="project-id" title="Project Title">
  <boltAction type="shell">command</boltAction>
  <boltAction type="file" filePath="path">code</boltAction>
  <boltAction type="start">npm run dev</boltAction>
</boltArtifact>
${getExtraPrompt(type, 2, otherConfig)}
`;
}

export function buildSystemPrompt(type: TypeEnum, otherConfig?: PromptExtra): string {
  return getSystemPrompt(type, otherConfig);
}

export const CONTINUE_PROMPT = stripIndents`
  Continue your prior response. IMPORTANT: Immediately begin from where you left off without any interruptions.
  Do not repeat any content, including artifact and action tags.
`;

export function buildMaxSystemPrompt(
  filesPath: string[],
  type: TypeEnum,
  files: Record<string, string>,
  diffString: string,
  otherConfig?: PromptExtra
): string {
  return `Current file directory tree: ${filesPath.join('\n')}\n\n,You can only modify the contents within the directory tree, requirements: ${getSystemPrompt(type, otherConfig)}
Current requirement file contents:\n${JSON.stringify(files)}${diffString ? `,diff:\n${diffString}` : ''}`;
}

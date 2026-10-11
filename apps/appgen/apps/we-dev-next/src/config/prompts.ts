import { stripIndents } from '../utils/stripIndent.js';
import { ProjectModel } from '../types/project.js';
import { forgeDesignSystem, renderDesignBrief, resolveRegister } from '../design/tokenForge.js';
import { renderSkills, routeSkills, RouteResult } from '../skills/router.js';
import { buildScaffold, renderScaffoldNotice } from '../scaffold/index.js';
import { BuildTarget } from './buildTarget.js';

export const WORK_DIR_NAME = 'project';
export const WORK_DIR = `/home/${WORK_DIR_NAME}`;
export const MODIFICATIONS_TAG_NAME = 'bolt_file_modifications';

export interface PromptExtra {
  isBackEnd: boolean;
  backendLanguage: string;
  extra: Record<string, any>;
}

/**
 * Build a directive forcing the AI to produce user-facing content in the user's
 * UI language. Code, identifiers, tags and technical tokens stay unchanged.
 */
export function getLanguageDirective(language?: string): string {
  const isFr = (language || 'en').toLowerCase().startsWith('fr');
  const label = isFr ? 'French (Français)' : 'English';
  return `
RESPONSE LANGUAGE (CRITICAL): All user-facing content you generate — UI text, copy,
headings, labels, button text, placeholder/demo data, testimonials and any message
addressed to the user — MUST be written in ${label}. Keep code, identifiers, file
paths, HTML/JSX tags and technical tokens unchanged.
`;
}

export interface AssembledPrompt {
  /** Stable, cacheable prefix: routed skills. Sent as a real `system` message. */
  system: string;
  /** Volatile tail: forged design system, project brief, task. */
  user: string;
  diagnostics: {
    skills: RouteResult;
    systemChars: number;
    userChars: number;
    target: BuildTarget;
    artDirection: string;
    seed: number;
    /** Le starter était-il déjà en place pour cette requête ? */
    scaffolded: boolean;
  };
}

export interface AssembleOptions {
  /** The user's own request, before any prompt assembly. */
  request: string;
  /** Project brief produced by ProjectPromptService, when a project is attached. */
  projectBrief?: string;
  /** Logo instructions. Emitted on every turn, unlike the brief. */
  brandLockup?: string;
  projectData?: ProjectModel;
  language?: string;
  /** Extra constraints appended after the task (file trees, diffs, …). */
  extraContext?: string;
  /** Site, web application or mobile application: picks the build contract. */
  target: BuildTarget;
  /**
   * Vrai quand l'espace de travail a déjà monté le starter préconfiguré. Le
   * brief cesse alors de faire recopier la configuration et liste seulement les
   * fichiers verrouillés et les jetons disponibles.
   */
  scaffolded?: boolean;
}

/**
 * Assembles the two halves of a builder request.
 *
 * The split is what makes the whole thing cheap. Provider-side prefix caching
 * discounts input tokens when a request shares a prefix with a previous
 * one, so everything invariant goes into the `system` message, in a stable
 * order, and everything that changes per project stays in the trailing user
 * message. Concatenating the two (as this codebase used to) means the prefix is
 * never repeated and the cache never hits.
 *
 * Ordering inside the system message is deliberate:
 *   1. core skills       identical on every request, anywhere → global cache hit
 *   2. contextual skills stable within a project session      → session cache hit
 *   3. language          last, so it is the most recent instruction
 */
export function assembleBuilderPrompt(options: AssembleOptions): AssembledPrompt {
  const { request, projectBrief, brandLockup, projectData, language, extraContext, target } = options;

  const register = resolveRegister(projectData);
  const skills = routeSkills({ request, register, projectData, target });
  const designSystem = forgeDesignSystem(projectData);

  // Le starter est reconstruit ici plutôt que repris du client : il est
  // déterministe (même projet, même cible, mêmes octets), donc le serveur sait
  // exactement quels fichiers sont déjà posés sans faire confiance à la requête.
  const scaffold = options.scaffolded
    ? buildScaffold({ target, projectData, language, system: designSystem })
    : null;

  const system = [
    'You are a senior product designer who also writes production React. You ship interfaces that look designed, not generated.',
    '',
    'The instructions below are grouped into skills. All of them apply.',
    '',
    renderSkills(skills),
    '',
    getLanguageDirective(language),
  ].join('\n');

  const user = [
    renderDesignBrief(designSystem, { scaffolded: !!scaffold }),
    scaffold ? `\n${renderScaffoldNotice(scaffold)}` : '',
    brandLockup ? `\n${brandLockup}` : '',
    projectBrief ? `\n${projectBrief}` : '',
    extraContext ? `\n${extraContext}` : '',
    `\n## YOUR TASK\n${request}`,
    '\nStart your response immediately with the <boltArtifact> tag. No preamble, no explanation before it.',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    system,
    user,
    diagnostics: {
      skills,
      systemChars: system.length,
      userChars: user.length,
      target,
      artDirection: designSystem.direction.id,
      seed: designSystem.seed,
      scaffolded: !!scaffold,
    },
  };
}

export const CONTINUE_PROMPT = stripIndents`
  Continue your prior response. IMPORTANT: Immediately begin from where you left off without any interruptions.
  Do not repeat any content, including artifact and action tags.
`;

/**
 * Context block for edits on an existing project: the file tree the model is
 * allowed to touch, the current contents, and the diff since last turn.
 */
export function buildExistingProjectContext(
  filesPath: string[],
  files: Record<string, string>,
  diffString: string
): string {
  return [
    '## EXISTING PROJECT',
    'You may only modify files within this tree:',
    filesPath.join('\n'),
    '',
    'Current contents:',
    JSON.stringify(files),
    diffString ? `\nChanges since the last turn:\n${diffString}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * A repair proposal, checked before anything is applied.
 *
 * The platform's agent returns settings to change; iDeploy applies none of
 * them on trust. Each one is checked here, in code: a known setting, one line,
 * a folder that exists in the repository, a port that is a port, a build
 * variable that is not a secret. And nothing is kept unless the rebuilt
 * application then starts — the worker decides that, not the model.
 */

export const REPAIR_SETTINGS = [
  'install_command',
  'build_command',
  'start_command',
  'base_directory',
  'publish_directory',
  'ports_exposes',
  'dockerfile_location',
  'build_pack',
] as const;
export type RepairSetting = (typeof REPAIR_SETTINGS)[number];

export type RepairAction =
  | { type: 'set_setting'; key: RepairSetting; value: string }
  | { type: 'set_build_variable'; key: 'NODE_OPTIONS' | 'IDEPLOY_BUILDER' | 'IDEPLOY_TRIAL'; value: string }
  | { type: 'ask_user'; variable?: string; question: string };

export interface RepairProposal {
  diagnosis: string;
  fixable: boolean;
  actions: RepairAction[];
}

/** What a repair changes for the next build: settings, and build variables (`KEY=value`). */
export interface RepairOverrides {
  settings: Partial<Record<RepairSetting, string>>;
  buildVariables: string[];
}

export interface CheckedProposal {
  diagnosis: string;
  /** Null: nothing to apply (only questions, or every change refused). */
  overrides: RepairOverrides | null;
  /** For the developer: what they must provide or do. */
  questions: string[];
  /** Changes refused, with why — logged. */
  refused: string[];
}

const BUILD_VARIABLE_VALUES: Record<string, RegExp> = {
  NODE_OPTIONS: /^(--[\w-]+(=[\w.:/-]+)?)(\s+--[\w-]+(=[\w.:/-]+)?)*$/,
  IDEPLOY_BUILDER: /^nixpacks$/,
  IDEPLOY_TRIAL: /^false$/,
};

/** A folder of the repository (relative, inside it, present in the file list). */
function isFolder(value: string, paths: string[]): boolean {
  const dir = value.replace(/^\.?\/+|\/+$/g, '');
  if (dir === '') return true;
  if (dir.split('/').includes('..')) return false;
  return paths.some((p) => p.startsWith(`${dir}/`));
}

/**
 * Check every action against the repository and the current settings.
 * `paths`: the repository's files; `current`: the settings as they are.
 */
export function checkProposal(proposal: RepairProposal, paths: string[], current: Partial<Record<RepairSetting, string | null>>): CheckedProposal {
  const settings: RepairOverrides['settings'] = {};
  const buildVariables: string[] = [];
  const questions: string[] = [];
  const refused: string[] = [];

  for (const action of proposal.actions) {
    if (action.type === 'ask_user') {
      questions.push(action.variable ? `${action.variable}: ${action.question}` : action.question);
      continue;
    }
    const value = action.value.trim();
    const refuse = (why: string) => refused.push(`${action.key}=${value} (${why})`);
    if (/[\r\n\0]/.test(value)) {
      refuse('not one line');
      continue;
    }
    if (action.type === 'set_build_variable') {
      const pattern = BUILD_VARIABLE_VALUES[action.key];
      if (!pattern?.test(value)) refuse('not an allowed value');
      else buildVariables.push(`${action.key}=${value}`);
      continue;
    }
    if (!(REPAIR_SETTINGS as readonly string[]).includes(action.key)) {
      refuse('not a setting a repair may change');
      continue;
    }
    if ((current[action.key] ?? '') === value) {
      refuse('already the value');
      continue;
    }
    switch (action.key) {
      case 'base_directory':
      case 'publish_directory':
        if (action.key === 'base_directory' ? !isFolder(value, paths) : value.split('/').includes('..')) {
          refuse('no such folder in the repository');
          continue;
        }
        break;
      case 'dockerfile_location':
        if (value.split('/').includes('..') || !paths.some((p) => p === value.replace(/^\.?\//, '') || p.endsWith(`/${value.replace(/^\.?\//, '')}`))) {
          refuse('no such file in the repository');
          continue;
        }
        break;
      case 'ports_exposes': {
        const port = Number(value);
        if (!/^\d{1,5}$/.test(value) || port < 1 || port > 65535) {
          refuse('not a port');
          continue;
        }
        break;
      }
      case 'build_pack':
        if (!['nixpacks', 'static', 'dockerfile'].includes(value)) {
          refuse('not a build pack');
          continue;
        }
        break;
      default:
        // A command runs in the build or application container, never on the
        // server: it may not reach for the server's Docker.
        if (value.length > 500 || /docker\.sock|\/var\/run\/docker/.test(value)) {
          refuse('not an acceptable command');
          continue;
        }
    }
    settings[action.key] = value;
  }

  const hasChanges = Object.keys(settings).length > 0 || buildVariables.length > 0;
  return {
    diagnosis: proposal.diagnosis,
    overrides: proposal.fixable && hasChanges ? { settings, buildVariables } : null,
    questions,
    refused,
  };
}

/** The changes, said in the log: `build_command: "pnpm build" → "pnpm --filter web build"`. */
export function describeOverrides(overrides: RepairOverrides, current: Partial<Record<RepairSetting, string | null>>): string[] {
  return [
    ...Object.entries(overrides.settings).map(([k, v]) => `${k}: ${JSON.stringify(current[k as RepairSetting] ?? '')} → ${JSON.stringify(v)}`),
    ...overrides.buildVariables.map((pair) => `build variable ${pair}`),
  ];
}

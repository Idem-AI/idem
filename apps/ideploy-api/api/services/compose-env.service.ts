/**
 * The variables a Compose file expects, and the `.env` that provides them.
 *
 * A compose file pasted into iDeploy often declares `env_file: .env` and uses
 * `${DB_PASSWORD:-default}`. The file next to the compose was never created, so
 * `docker compose up` refused the whole stack ("env file … .env not found")
 * while one-click templates, which need none, worked. The variables are now
 * stored with the service, shown for the user to fill, and written to `.env`
 * (always — an empty one satisfies `env_file: .env`) before every start.
 */
import YAML from 'yaml';

export interface ComposeVariable {
  key: string;
  /** The `${KEY:-default}` default, null when the compose gives none. */
  default: string | null;
  /** `${KEY:?message}`: Compose refuses to start without a value. */
  required: boolean;
}

export interface ComposeAnalysis {
  variables: ComposeVariable[];
  /** Paths named by `env_file`. Only `.env` can be provided. */
  envFiles: string[];
  /** Service names, in the order written. */
  services: string[];
  warnings: { code: 'ENV_FILE_OTHER' | 'BUILD_CONTEXT' | 'INVALID_YAML' | 'CONTAINER_NAME' | 'HOST_PORTS'; message: string }[];
}

const VARIABLE = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?:(:?[-?+])([^}]*))?\}/g;

/**
 * Variables of a compose file, with their defaults.
 * iDeploy's own template placeholders (`SERVICE_PASSWORD_X`, `SERVICE_FQDN_X`…)
 * are generated at start and never asked for.
 */
export function analyseCompose(text: string): ComposeAnalysis {
  const variables = new Map<string, ComposeVariable>();
  // `$$` is Compose's literal dollar: not a reference.
  for (const match of text.replace(/\$\$/g, '').matchAll(VARIABLE)) {
    const [, key, operator, rest] = match;
    if (key.startsWith('SERVICE_')) continue;
    const known = variables.get(key);
    const entry: ComposeVariable = {
      key,
      default: operator?.endsWith('-') ? (rest ?? '') : null,
      required: Boolean(operator?.endsWith('?')),
    };
    // Written several times: keep a default and the strictest requirement.
    variables.set(key, {
      key,
      default: known?.default ?? entry.default,
      required: Boolean(known?.required || entry.required),
    });
  }

  const envFiles: string[] = [];
  const services: string[] = [];
  const warnings: ComposeAnalysis['warnings'] = [];
  type Parsed = { services?: Record<string, Record<string, unknown>> } | null;
  let parsed = null as Parsed;
  try {
    parsed = YAML.parse(text) as Parsed;
  } catch {
    warnings.push({ code: 'INVALID_YAML', message: 'The compose file is not valid YAML.' });
  }
  for (const [name, service] of Object.entries(parsed?.services ?? {})) {
    services.push(name);
    const files = (service?.env_file ?? []) as unknown;
    const list = Array.isArray(files) ? files : files ? [files] : [];
    for (const entry of list) {
      const path = typeof entry === 'string' ? entry : String((entry as { path?: string })?.path ?? '');
      if (path) envFiles.push(path);
    }
    if (service?.container_name) {
      warnings.push({
        code: 'CONTAINER_NAME',
        message: `${name}: "container_name: ${String(service.container_name)}" is a fixed name — a second copy of this stack, or a leftover container with that name, stops it from starting. Remove it unless another program needs that exact name.`,
      });
    }
    if (Array.isArray(service?.ports) && service.ports.length > 0) {
      warnings.push({
        code: 'HOST_PORTS',
        message: `${name}: "ports" opens the container directly on the server (${(service.ports as unknown[]).map(String).join(', ')}), around the firewall, and fails when another stack already uses that port.`,
      });
    }
    if (service?.build) {
      warnings.push({
        code: 'BUILD_CONTEXT',
        message: `${name}: "build" has no source here — use an image already pushed to a registry.`,
      });
    }
  }
  const unique = [...new Set(envFiles)];
  const other = unique.filter((p) => p.replace(/^\.\//, '') !== '.env');
  if (other.length > 0) {
    warnings.push({
      code: 'ENV_FILE_OTHER',
      message: `Only .env can be provided; ${other.join(', ')} will not exist next to the compose file.`,
    });
  }
  return { variables: [...variables.values()], envFiles: unique, services, warnings };
}

const VALID_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * A `.env` file, as Docker Compose reads it: single quotes keep a value literal
 * (no `$` interpolation); a value with a quote or a line break goes in double
 * quotes with the characters Compose expands escaped.
 */
export function renderDotEnv(vars: { key: string; value: string | null }[]): string {
  const lines = vars
    .filter((v) => VALID_KEY.test(v.key))
    .map(({ key, value }) => {
      const v = value ?? '';
      if (!/['\n\r]/.test(v)) return `${key}='${v}'`;
      const escaped = v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\r?\n/g, '\\n');
      return `${key}="${escaped}"`;
    });
  return lines.length ? `${lines.join('\n')}\n` : '';
}

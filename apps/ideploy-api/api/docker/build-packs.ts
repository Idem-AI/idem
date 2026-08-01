/**
 * Build strategies.
 *
 * The rewrite only knew two paths: a Dockerfile, or "run the source in a base
 * Node image". That second path is a development convenience, not a deployment —
 * it mounts the working tree and installs dependencies on every start, so the
 * running container is not a reproducible artefact.
 *
 * The four packs below are the ones the Laravel side supports, and the ones the
 * `build_pack` column already stores.
 *
 * Everything here is a *plan*: pure functions producing the commands to run.
 * That keeps the interesting decisions — which builder, which directory, what to
 * serve — testable without a server, and leaves the worker responsible only for
 * executing and streaming.
 */

export type BuildPack = 'nixpacks' | 'static' | 'dockerfile' | 'dockercompose';

export const BUILD_PACKS: readonly BuildPack[] = [
  'nixpacks',
  'static',
  'dockerfile',
  'dockercompose',
] as const;

/**
 * Nixpacks runs from its published image rather than being installed on the
 * host: the fleet stays uniform, and a customer's server needs nothing beyond
 * Docker.
 */
const NIXPACKS_IMAGE = process.env.NIXPACKS_IMAGE || 'ghcr.io/railwayapp/nixpacks:latest';

/** Image serving a built static site. */
const STATIC_IMAGE = 'nginx:alpine';

export interface BuildContext {
  /** Where the repository was cloned on the server. */
  srcDir: string;
  /** Deployment working directory (holds the generated compose file). */
  workdir: string;
  /** Tag for the image this build produces. */
  imageTag: string;
  /** Sub-directory of the repository to build, for monorepos. */
  baseDirectory?: string | null;
  installCommand?: string | null;
  buildCommand?: string | null;
  startCommand?: string | null;
  /** Directory the build writes its output to (static packs). */
  publishDirectory?: string | null;
  port: number;
}

export interface BuildStep {
  /** Shown in the deployment log. */
  label: string;
  command: string;
}

export type Runtime =
  /** Run the image this build produced. */
  | 'image'
  /** Run the compose file that ships with the repository. */
  | 'compose-file';

export interface BuildPlan {
  pack: BuildPack;
  steps: BuildStep[];
  runtime: Runtime;
  /** Set when `runtime` is `image`. */
  imageTag?: string;
  /** Set when `runtime` is `compose-file`: path on the server. */
  composePath?: string;
}

/** Resolve the directory to build in, honouring a monorepo sub-path. */
export function buildDirectory(context: BuildContext): string {
  const base = (context.baseDirectory ?? '').replace(/^\.?\/+|\/+$/g, '');
  return base ? `${context.srcDir}/${base}` : context.srcDir;
}

/** Wrap a value for safe use as a single shell argument. */
function quote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Guess the pack from the repository's top-level files.
 *
 * Used when the user has not chosen one. Order matters: an explicit Dockerfile
 * or compose file is a deliberate statement about how the project is built and
 * outranks inference from a package manifest.
 */
export function detectBuildPack(files: string[]): BuildPack {
  const present = new Set(files.map((f) => f.trim()).filter(Boolean));

  if (present.has('docker-compose.yml') || present.has('docker-compose.yaml')) {
    return 'dockercompose';
  }
  if (present.has('Dockerfile')) return 'dockerfile';

  // A static-site generator's manifest still needs a build, which nixpacks
  // handles; `static` is for output that is already just files.
  if (present.has('index.html') && !present.has('package.json')) return 'static';

  return 'nixpacks';
}

/** Steps that build an image from the repository's own Dockerfile. */
function dockerfilePlan(context: BuildContext): BuildPlan {
  const dir = buildDirectory(context);
  return {
    pack: 'dockerfile',
    runtime: 'image',
    imageTag: context.imageTag,
    steps: [
      {
        label: 'Building image from the Dockerfile',
        // Fail with a clear message rather than an opaque docker error when the
        // pack was chosen but no Dockerfile exists.
        command:
          `cd ${quote(dir)} && ` +
          `{ test -f Dockerfile || { echo "No Dockerfile found in ${dir}." >&2; exit 1; }; } && ` +
          `docker build -t ${quote(context.imageTag)} .`,
      },
    ],
  };
}

/**
 * Steps that let nixpacks work out how to build the project.
 *
 * Nixpacks emits a Dockerfile rather than building directly, so the image is
 * produced by the host's own Docker — no socket is handed to the builder
 * container, which would give it control of the whole daemon.
 */
function nixpacksPlan(context: BuildContext): BuildPlan {
  const dir = buildDirectory(context);
  const env = [
    context.installCommand ? `NIXPACKS_INSTALL_CMD=${quote(context.installCommand)}` : '',
    context.buildCommand ? `NIXPACKS_BUILD_CMD=${quote(context.buildCommand)}` : '',
    context.startCommand ? `NIXPACKS_START_CMD=${quote(context.startCommand)}` : '',
  ]
    .filter(Boolean)
    .map((pair) => `-e ${pair}`)
    .join(' ');

  return {
    pack: 'nixpacks',
    runtime: 'image',
    imageTag: context.imageTag,
    steps: [
      {
        label: 'Detecting the build plan (nixpacks)',
        command:
          `cd ${quote(dir)} && docker run --rm -v ${quote(dir)}:/app -w /app ${env} ` +
          `${NIXPACKS_IMAGE} nixpacks build . --out .`,
      },
      {
        label: 'Building image',
        command:
          `cd ${quote(dir)} && ` +
          `{ test -f .nixpacks/Dockerfile || { echo "nixpacks produced no Dockerfile — the project's language may not be detected." >&2; exit 1; }; } && ` +
          `docker build -f .nixpacks/Dockerfile -t ${quote(context.imageTag)} .`,
      },
    ],
  };
}

/**
 * Steps that build a site and serve the output with nginx.
 *
 * The generated Dockerfile is written on the server rather than committed to the
 * repository: it is an artefact of this deployment, not of the project.
 */
function staticPlan(context: BuildContext): BuildPlan {
  const dir = buildDirectory(context);
  const publish = (context.publishDirectory ?? 'dist').replace(/^\.?\/+|\/+$/g, '') || 'dist';

  const steps: BuildStep[] = [];

  if (context.installCommand || context.buildCommand) {
    const install = context.installCommand ?? 'npm ci || npm install';
    const build = context.buildCommand ?? 'npm run build';
    steps.push({
      label: 'Building the site',
      command:
        `cd ${quote(dir)} && docker run --rm -v ${quote(dir)}:/app -w /app node:20-alpine ` +
        `sh -lc ${quote(`${install} && ${build}`)}`,
    });
  }

  steps.push(
    {
      label: 'Preparing the runtime image',
      command:
        `cd ${quote(dir)} && ` +
        `{ test -d ${quote(publish)} || { echo "Build output not found in ${publish}. Set the publish directory to match your build." >&2; exit 1; }; } && ` +
        `printf 'FROM ${STATIC_IMAGE}\\nCOPY %s /usr/share/nginx/html\\n' ${quote(publish)} > Dockerfile.ideploy-static`,
    },
    {
      label: 'Building image',
      command: `cd ${quote(dir)} && docker build -f Dockerfile.ideploy-static -t ${quote(context.imageTag)} .`,
    }
  );

  return { pack: 'static', runtime: 'image', imageTag: context.imageTag, steps };
}

/** Steps that hand over to the repository's own compose file. */
function composePlan(context: BuildContext): BuildPlan {
  const dir = buildDirectory(context);
  const composePath = `${dir}/docker-compose.yml`;

  return {
    pack: 'dockercompose',
    runtime: 'compose-file',
    composePath,
    steps: [
      {
        label: 'Locating the compose file',
        command:
          `cd ${quote(dir)} && ` +
          `{ test -f docker-compose.yml || test -f docker-compose.yaml || ` +
          `{ echo "No docker-compose.yml found in ${dir}." >&2; exit 1; }; }`,
      },
      {
        label: 'Building the stack',
        command: `cd ${quote(dir)} && docker compose build`,
      },
    ],
  };
}

/** The commands that turn a checkout into something runnable. */
export function planBuild(pack: BuildPack, context: BuildContext): BuildPlan {
  switch (pack) {
    case 'dockerfile':
      return dockerfilePlan(context);
    case 'static':
      return staticPlan(context);
    case 'dockercompose':
      return composePlan(context);
    case 'nixpacks':
    default:
      return nixpacksPlan(context);
  }
}

/** Normalise a stored `build_pack` value, falling back to the default. */
export function toBuildPack(value: unknown): BuildPack {
  const pack = String(value ?? '').toLowerCase();
  return (BUILD_PACKS as readonly string[]).includes(pack) ? (pack as BuildPack) : 'nixpacks';
}

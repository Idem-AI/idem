/**
 * Python applications: the project's own dependency tool, the Python version
 * it asks for, and the production server its framework needs — gunicorn for
 * Django and Flask, uvicorn for FastAPI — added when the project does not list
 * it (`runserver` and `flask run` are development servers).
 */
import { BuildPlanResult, PlanIssue, PythonRecipe } from './types';
import { RepoFiles, joinPath } from './repo-files';
import { filesNamed, hasFile, nodeOwnsFolder, procfileWeb } from './common';

/** Python of a recipe when the project does not say: recent, with wheels for nearly every package. */
const DEFAULT_PYTHON_MINOR = 12;

/** Files an application's entry point is usually in. */
const ENTRY_FILES = ['main.py', 'app.py', 'server.py', 'application.py', 'asgi.py', 'wsgi.py', 'run.py', 'streamlit_app.py'];

/** `3.12` from `.python-version`, `runtime.txt`, Pipfile or `requires-python`. */
export function pythonVersionFromSpec(spec: string): string | null {
  const s = spec.trim();
  const exact = /^(?:python-)?3\.(\d+)(?:\.\d+)?$/.exec(s) ?? /==\s*3\.(\d+)/.exec(s);
  if (exact) return `3.${exact[1]}`;
  const lower = /(?:>=|\^|~=|~|>)\s*3\.(\d+)/.exec(s);
  const upper = /<\s*3\.(\d+)/.exec(s);
  if (!lower && !upper) return null;
  // The default when the range allows it, else the closest version it allows.
  let minor = Math.max(lower ? Number(lower[1]) : 0, DEFAULT_PYTHON_MINOR);
  if (upper && minor >= Number(upper[1])) minor = Number(upper[1]) - 1;
  return `3.${minor}`;
}

async function pythonVersion(files: RepoFiles, dir: string, pyproject: string, pipfile: string): Promise<{ version: string; source: string } | null> {
  const pv = await files.read(joinPath(dir, '.python-version'));
  const fromPv = pv ? pythonVersionFromSpec(pv.split('\n')[0]) : null;
  if (fromPv) return { version: fromPv, source: '.python-version' };
  const rt = await files.read(joinPath(dir, 'runtime.txt'));
  const fromRt = rt ? pythonVersionFromSpec(rt.split('\n')[0]) : null;
  if (fromRt) return { version: fromRt, source: 'runtime.txt' };
  const pipVersion = /python_version\s*=\s*["']([\d.]+)["']/.exec(pipfile)?.[1];
  if (pipVersion) return { version: pythonVersionFromSpec(pipVersion) ?? `3.${DEFAULT_PYTHON_MINOR}`, source: 'Pipfile' };
  const requires =
    /requires-python\s*=\s*["']([^"']+)["']/.exec(pyproject)?.[1] ?? /^python\s*=\s*["']([^"']+)["']/m.exec(pyproject)?.[1];
  const fromPyproject = requires ? pythonVersionFromSpec(requires) : null;
  if (fromPyproject) return { version: fromPyproject, source: 'pyproject.toml' };
  return null;
}

/** Python module path of a file: `app/main.py` → `app.main`; `src/` is an import root, not a package. */
function moduleOf(rel: string): { module: string; appDir: string | null } {
  const inSrc = rel.startsWith('src/');
  const path = (inSrc ? rel.slice(4) : rel).replace(/\.py$/, '');
  return { module: path.replace(/\//g, '.'), appDir: inSrc ? 'src' : null };
}

export async function planPython(files: RepoFiles, appDir: string, overrides: { start?: string | null } = {}): Promise<BuildPlanResult | null> {
  const has = (name: string) => hasFile(files, appDir, name);
  const markers = ['requirements.txt', 'pyproject.toml', 'Pipfile', 'setup.py', 'manage.py'];
  if (!markers.some(has)) return null;
  // A Node application with a Python helper file stays a Node application.
  if (!has('manage.py') && (await nodeOwnsFolder(files, appDir))) return null;

  const [requirements, pyproject, pipfile] = await Promise.all(
    ['requirements.txt', 'pyproject.toml', 'Pipfile'].map(async (n) => (await files.read(joinPath(appDir, n))) ?? '')
  );
  const deps = `${requirements}\n${pyproject}\n${pipfile}`.toLowerCase();
  const hasDep = (name: string) => new RegExp(`(^|[\\s"'\\[,])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\s=<>~!;\\[,"']|$)`, 'm').test(deps);

  const issues: PlanIssue[] = [];
  const manager: PythonRecipe['manager'] | null = has('uv.lock')
    ? 'uv'
    : has('poetry.lock') || /\[tool\.poetry\]/.test(pyproject)
      ? 'poetry'
      : has('Pipfile')
        ? 'pipenv'
        : has('requirements.txt')
          ? 'pip'
          : /\[project\]/.test(pyproject) || has('setup.py')
            ? 'pip-project'
            : null;
  if (!manager) {
    issues.push({
      code: 'NO_PYTHON_DEPENDENCIES',
      severity: 'blocking',
      message: 'This Python project declares no dependencies: add a requirements.txt (pip freeze > requirements.txt) or a pyproject.toml.',
    });
  }
  const install =
    manager === 'uv'
      ? 'pip install -q uv && uv sync --frozen --no-dev'
      : manager === 'poetry'
        ? 'python -m venv /opt/poetry && /opt/poetry/bin/pip install -q poetry && /opt/poetry/bin/poetry install --no-root --only main --no-interaction'
        : manager === 'pipenv'
          ? `python -m venv /opt/pipenv && /opt/pipenv/bin/pip install -q pipenv && ${has('Pipfile.lock') ? '' : '/opt/pipenv/bin/pipenv lock && '}` +
            '/opt/pipenv/bin/pipenv requirements > /tmp/requirements.txt && pip install -r /tmp/requirements.txt'
          : manager === 'pip-project'
            ? 'pip install .'
            : 'pip install -r requirements.txt';

  const version = await pythonVersion(files, appDir, pyproject, pipfile);
  const entries = filesNamed(files, appDir, ENTRY_FILES);
  const read = (rel: string) => files.read(joinPath(appDir, rel));
  /** The first entry file whose content matches, with the match. */
  const findEntry = async (re: RegExp): Promise<{ rel: string; match: RegExpExecArray } | null> => {
    for (const rel of entries) {
      const match = re.exec((await read(rel)) ?? '');
      if (match) return { rel, match };
    }
    return null;
  };

  const extras: string[] = [];
  let framework = 'Python';
  let start: string | null = null;
  let build: string | null = null;
  const port = '${PORT:-8000}';

  if (has('manage.py') || hasDep('django')) {
    framework = 'Django';
    const wsgi = filesNamed(files, appDir, ['wsgi.py']).find((rel) => rel.includes('/'));
    if (wsgi) {
      const { module, appDir: root } = moduleOf(wsgi);
      start = `gunicorn ${module}:application --bind 0.0.0.0:${port}${root ? ` --chdir ${root}` : ''}`;
    }
    if (!hasDep('gunicorn')) extras.push('gunicorn');
    // Without STATIC_ROOT (or with settings needing runtime variables) there is nothing to collect.
    build = 'python manage.py collectstatic --noinput || echo "collectstatic skipped: STATIC_ROOT is not set, or the settings need runtime variables."';
    issues.push({
      code: 'DJANGO_MIGRATIONS',
      severity: 'info',
      message: 'Database migrations are not run automatically: start with "python manage.py migrate && gunicorn …", or run them from the terminal.',
    });
  } else if (hasDep('fastapi') || hasDep('starlette') || hasDep('litestar')) {
    framework = hasDep('fastapi') ? 'FastAPI' : hasDep('litestar') ? 'Litestar' : 'Starlette';
    const found = await findEntry(/^(\w+)\s*(?::\s*[\w.]+\s*)?=\s*(?:FastAPI|Starlette|Litestar)\(/m);
    if (found) {
      const { module, appDir: root } = moduleOf(found.rel);
      start = `uvicorn ${module}:${found.match[1]} --host 0.0.0.0 --port ${port}${root ? ` --app-dir ${root}` : ''}`;
    }
    if (!hasDep('uvicorn')) extras.push('uvicorn[standard]');
  } else if (hasDep('flask')) {
    framework = 'Flask';
    const instance = await findEntry(/^(\w+)\s*=\s*Flask\(/m);
    const factory = instance ? null : await findEntry(/^def\s+(create_app|make_app)\s*\(/m);
    const found = instance ?? factory;
    if (found) {
      const { module, appDir: root } = moduleOf(found.rel);
      const target = instance ? `${module}:${found.match[1]}` : `'${module}:${found.match[1]}()'`;
      start = `gunicorn ${target} --bind 0.0.0.0:${port}${root ? ` --chdir ${root}` : ''}`;
    }
    if (!hasDep('gunicorn')) extras.push('gunicorn');
  } else if (hasDep('streamlit')) {
    framework = 'Streamlit';
    const found = await findEntry(/^\s*(import streamlit|from streamlit)/m);
    if (found) start = `streamlit run ${found.rel} --server.port \${PORT:-8501} --server.address 0.0.0.0 --server.headless true`;
  } else if (hasDep('gradio')) {
    framework = 'Gradio';
    const found = await findEntry(/^\s*(import gradio|from gradio)/m);
    if (found) start = `GRADIO_SERVER_NAME=0.0.0.0 GRADIO_SERVER_PORT=\${PORT:-7860} python ${found.rel}`;
  } else {
    const main = entries.find((rel) => !rel.includes('/'));
    if (main) start = `python ${main}`;
  }

  // The project's own Procfile says best how it starts.
  const procfile = await procfileWeb(files, appDir);
  if (procfile) start = procfile;
  if (!start && !overrides.start && manager) {
    issues.push({
      code: 'NO_START_COMMAND',
      severity: 'blocking',
      message:
        `No way to start this ${framework} application was found (no entry file with the application object, no Procfile). ` +
        'Add a Procfile ("web: gunicorn myproject.wsgi --bind 0.0.0.0:$PORT") or set a start command in Settings › Build options.',
    });
  }

  const plan: BuildPlanResult = {
    language: 'python',
    framework,
    appDir,
    buildRoot: appDir,
    output: 'server',
    tool: manager ?? 'pip',
    runtimeVersion: version ? { name: 'Python', version: version.version, source: version.source } : undefined,
    nixpacksEnv: version ? { NIXPACKS_PYTHON_VERSION: version.version } : {},
    issues,
    // Django's migrations; Alembic's (SQLAlchemy: FastAPI, Flask) when the project has its alembic.ini.
    release: framework === 'Django' ? 'python manage.py migrate --noinput' : has('alembic.ini') ? 'alembic upgrade head' : undefined,
  };
  if (manager && (start || overrides.start)) {
    plan.recipe = {
      kind: 'python',
      version: version?.version ?? `3.${DEFAULT_PYTHON_MINOR}`,
      manager,
      install,
      extras,
      build,
      start: start ?? '',
    };
  }
  return plan;
}

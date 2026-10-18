/**
 * Ruby applications: Rails, a Rack application, or Sinatra, with the Ruby
 * version the project names, Bundler, and Rails' assets.
 */
import { BuildPlanResult, PlanIssue } from './types';
import { RepoFiles, joinPath } from './repo-files';
import { hasFile, procfileWeb } from './common';
import { FRESH_COREPACK, readPackage } from './node';

const DEFAULT_RUBY = '3.3';

/** `3.2` from `.ruby-version` (`3.2.2`, `ruby-3.2.2`) or the Gemfile's `ruby "~> 3.2"`. */
export function rubyVersion(text: string): string | null {
  const m = /(?:^|ruby[-\s'"~>=]*)(\d)\.(\d+)/.exec(text.trim());
  return m ? `${m[1]}.${m[2]}` : null;
}

export async function planRuby(files: RepoFiles, appDir: string, overrides: { start?: string | null } = {}): Promise<BuildPlanResult | null> {
  const gemfile = await files.read(joinPath(appDir, 'Gemfile'));
  if (gemfile === null) return null;
  const has = (name: string) => hasFile(files, appDir, name);
  const issues: PlanIssue[] = [];
  const gem = (name: string) => new RegExp(`^\\s*gem\\s+['"]${name}['"]`, 'm').test(gemfile);

  const rails = gem('rails') || gem('railties') || has('config/application.rb');
  const sinatra = gem('sinatra');
  const framework = rails ? 'Ruby on Rails' : sinatra ? 'Sinatra' : 'Ruby';

  const rv = await files.read(joinPath(appDir, '.ruby-version'));
  const declared = (rv ? rubyVersion(rv) : null) ?? rubyVersion(/^\s*ruby\s+['"][^'"]+['"]/m.exec(gemfile)?.[0] ?? '');
  const version = declared ?? DEFAULT_RUBY;

  const port = '${PORT:-3000}';
  let start: string | null = null;
  if (rails) start = `bundle exec rails server -b 0.0.0.0 -p ${port}`;
  else if (has('config.ru')) start = gem('puma') ? `bundle exec puma -b tcp://0.0.0.0:${port}` : `bundle exec rackup -o 0.0.0.0 -p ${port}`;
  else if (sinatra && has('app.rb')) start = `bundle exec ruby app.rb -o 0.0.0.0 -p ${port}`;
  const procfile = await procfileWeb(files, appDir);
  if (procfile) start = procfile;
  if (!start && !overrides.start) {
    issues.push({
      code: 'NO_START_COMMAND',
      severity: 'blocking',
      message: 'No way to start this Ruby application was found (not Rails, no config.ru, no Procfile). Add a Procfile ("web: bundle exec puma -p $PORT") or set a start command.',
    });
  }

  // jsbundling/cssbundling: the asset build runs Node.
  const pkg = await readPackage(files, appDir);
  const nodeInstall = rails && pkg
    ? has('yarn.lock')
      ? `${FRESH_COREPACK} && yarn install`
      : has('pnpm-lock.yaml')
        ? `${FRESH_COREPACK} && pnpm install --frozen-lockfile`
        : has('package-lock.json')
          ? 'npm ci'
          : 'npm install'
    : null;

  if (rails) {
    issues.push({
      code: 'RAILS_MASTER_KEY',
      severity: 'info',
      message: 'Rails needs RAILS_MASTER_KEY (config/master.key) or SECRET_KEY_BASE under Variables. Its migrations run before each release (rails db:migrate).',
    });
  }

  const plan: BuildPlanResult = {
    language: 'ruby',
    framework,
    appDir,
    buildRoot: appDir,
    output: 'server',
    tool: 'bundler',
    runtimeVersion: { name: 'Ruby', version, source: declared ? (rv ? '.ruby-version' : 'Gemfile') : 'default' },
    nixpacksEnv: {},
    issues,
    release: rails ? 'bundle exec rails db:migrate' : undefined,
  };
  if (start || overrides.start) {
    plan.recipe = {
      kind: 'ruby',
      version,
      rails,
      nodeInstall,
      // Assets, with a throwaway key: precompiling does not need the real
      // one. An API-only application (no app/assets, no app/javascript) has none.
      build: rails
        ? 'if [ -d app/assets ] || [ -d app/javascript ]; then SECRET_KEY_BASE_DUMMY=1 SECRET_KEY_BASE=precompile bundle exec rails assets:precompile; fi'
        : null,
      start: start ?? '',
    };
  }
  return plan;
}

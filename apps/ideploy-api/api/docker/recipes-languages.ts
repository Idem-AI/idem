/**
 * iDeploy's recipes for Python, PHP, Go, Ruby, .NET and Rust.
 *
 * Same principles as the Node and Java ones (recipes.ts): the official
 * images, a build stage with the compilers (native extensions build: psycopg2,
 * mysql2, pg, sqlite), a slim run stage of the same Debian release with the
 * libraries those extensions link against, dependency caches kept between
 * builds by BuildKit, build variables as ARGs of the build stage only.
 */
import { DotnetRecipe, GoRecipe, PhpRecipe, PythonRecipe, RubyRecipe, RustRecipe } from '../build-plan/types';
import { argLines, json, runtimeLibraries, sq } from './dockerfile-helpers';

const cmd = (start: string) => `CMD ["sh", "-c", ${json(start)}]`;

export function pythonDockerfile(recipe: PythonRecipe, buildArgKeys: string[] = [], registry = ''): string {
  // The virtualenv lives at the same path in both stages: its scripts point there.
  const env =
    'ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_DEFAULT_TIMEOUT=100 ' +
    'VIRTUAL_ENV=/opt/venv PATH=/opt/venv/bin:$PATH UV_PROJECT_ENVIRONMENT=/opt/venv UV_LINK_MODE=copy POETRY_VIRTUALENVS_CREATE=false';
  const caches =
    '--mount=type=cache,id=ideploy-pip,target=/root/.cache/pip --mount=type=cache,id=ideploy-uv,target=/root/.cache/uv ' +
    '--mount=type=cache,id=ideploy-poetry,target=/root/.cache/pypoetry';
  const lines = [
    `FROM ${registry}python:${recipe.version}-bookworm AS build`,
    'WORKDIR /app',
    env,
    'RUN python -m venv /opt/venv',
    ...argLines(buildArgKeys),
    'COPY . .',
    `RUN ${caches} ${recipe.install}`,
  ];
  // The production server the start command runs, when the project does not list it.
  if (recipe.extras.length) lines.push(`RUN ${caches} pip install ${recipe.extras.map(sq).join(' ')}`);
  if (recipe.build) lines.push(`RUN ${recipe.build}`);
  lines.push(
    '',
    `FROM ${registry}python:${recipe.version}-slim-bookworm`,
    'WORKDIR /app',
    runtimeLibraries(['libpq5', 'libmariadb3', 'ca-certificates']),
    env,
    'COPY --from=build /opt/venv /opt/venv',
    'COPY --from=build /app /app',
    cmd(recipe.start),
    ''
  );
  return lines.join('\n');
}

export function phpDockerfile(recipe: PhpRecipe, buildArgKeys: string[] = [], registry = ''): string {
  const docroot = recipe.documentRoot ? `/app/${recipe.documentRoot}` : '/app';
  const lines: string[] = [];
  if (recipe.assets) {
    lines.push(
      `FROM ${registry}node:22-bookworm AS assets`,
      'WORKDIR /app',
      'ENV CI=1 HUSKY=0 CYPRESS_INSTALL_BINARY=0',
      ...argLines(buildArgKeys),
      'COPY . .',
      `RUN --mount=type=cache,id=ideploy-npm,target=/root/.npm ${recipe.assets.install} && ${recipe.assets.build}`,
      ''
    );
  }
  lines.push(
    `FROM ${registry}php:${recipe.version}-apache`,
    'WORKDIR /app',
    `ENV APACHE_DOCUMENT_ROOT=${docroot} COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 COMPOSER_CACHE_DIR=/root/.composer/cache PORT=80`,
    // Apache serves the public folder, reads its .htaccess (Laravel's and
    // Symfony's routing), and listens on $PORT — resolved by Apache at start.
    "RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf && " +
      "sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf && " +
      "sed -ri -e 's/^Listen 80$/Listen ${PORT}/' /etc/apache2/ports.conf && " +
      "sed -ri -e 's/<VirtualHost \\*:80>/<VirtualHost *:${PORT}>/' /etc/apache2/sites-available/000-default.conf && " +
      "printf '<Directory ${APACHE_DOCUMENT_ROOT}>\\n    AllowOverride All\\n    Require all granted\\n</Directory>\\n' > /etc/apache2/conf-available/ideploy.conf && " +
      'a2enconf ideploy && a2enmod rewrite headers',
    // Composer needs git (VCS dependencies) and unzip.
    runtimeLibraries(['git', 'unzip']),
    'COPY --from=mlocati/php-extension-installer:2 /usr/bin/install-php-extensions /usr/local/bin/',
    // All at once (fast); if that fails, one at a time, so one extension that
    // cannot build does not take the others down — Composer then says if the
    // application really needs it.
    `RUN install-php-extensions ${recipe.extensions.join(' ')} || { echo 'Installing the PHP extensions together failed: one at a time.'; ` +
      `for e in ${recipe.extensions.join(' ')}; do install-php-extensions "$e" || echo "⚠ The PHP extension $e could not be installed."; done; }`,
    `COPY --from=${registry}composer:2 /usr/bin/composer /usr/bin/composer`,
    ...argLines(buildArgKeys),
    'COPY . .'
  );
  if (recipe.assets && recipe.documentRoot) lines.push(`COPY --from=assets /app/${recipe.documentRoot} ${docroot}`);
  lines.push('RUN --mount=type=cache,id=ideploy-composer,target=/root/.composer/cache if [ -f composer.json ]; then composer install --no-dev --optimize-autoloader --no-progress; fi');
  if (recipe.build) lines.push(`RUN ${recipe.build}`);
  lines.push(
    // Laravel writes to storage/ and bootstrap/cache, Symfony to var/.
    'RUN for d in storage bootstrap/cache var; do [ -d "$d" ] && chown -R www-data:www-data "$d"; done; true',
    cmd(recipe.start),
    ''
  );
  return lines.join('\n');
}

export function goDockerfile(recipe: GoRecipe, buildArgKeys: string[] = [], registry = ''): string {
  return [
    `FROM ${registry}golang:${recipe.version}-bookworm AS build`,
    'WORKDIR /app',
    // GOTOOLCHAIN=auto: a go.mod asking for a newer Go fetches it.
    `ENV GOTOOLCHAIN=auto CGO_ENABLED=${recipe.cgo ? 1 : 0}`,
    ...argLines(buildArgKeys),
    'COPY . .',
    `RUN --mount=type=cache,id=ideploy-gomod,target=/go/pkg/mod --mount=type=cache,id=ideploy-gobuild,target=/root/.cache/go-build mkdir -p /out && ${recipe.build}`,
    `RUN test -x /out/app || { echo ${sq('iDeploy: the build did not produce /out/app. A build command of your own must write the program there: go build -o /out/app ./path/to/main')} >&2; exit 1; }`,
    '',
    `FROM ${registry}debian:bookworm-slim`,
    runtimeLibraries(['ca-certificates', 'tzdata']),
    'WORKDIR /app',
    // The source stays next to the program: templates and static files it opens by relative path.
    'COPY --from=build /app /app',
    'COPY --from=build /out/app /usr/local/bin/app',
    cmd(recipe.start),
    '',
  ].join('\n');
}

export function rubyDockerfile(recipe: RubyRecipe, buildArgKeys: string[] = [], registry = ''): string {
  const env = 'ENV RAILS_ENV=production RACK_ENV=production BUNDLE_WITHOUT=development:test BUNDLE_JOBS=4 BUNDLE_RETRY=3';
  const lines = [`FROM ${registry}ruby:${recipe.version}-bookworm AS build`, 'WORKDIR /app', env];
  if (recipe.nodeInstall) {
    // jsbundling/cssbundling: Node for the asset build, without replacing Ruby's /usr/local.
    lines.push(
      `COPY --from=${registry}node:22-bookworm /usr/local/bin/node /usr/local/bin/node`,
      `COPY --from=${registry}node:22-bookworm /usr/local/lib/node_modules /usr/local/lib/node_modules`,
      'RUN ln -sf ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && ln -sf ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx'
    );
  }
  lines.push(
    ...argLines(buildArgKeys),
    'COPY . .',
    // A Gemfile.lock made on a Mac lists only its platform: Linux added.
    'RUN bundle lock --add-platform x86_64-linux aarch64-linux >/dev/null 2>&1 || true',
    'RUN bundle install'
  );
  if (recipe.nodeInstall) lines.push(`RUN --mount=type=cache,id=ideploy-npm,target=/root/.npm ${recipe.nodeInstall}`);
  if (recipe.build) lines.push(`RUN ${recipe.build}`);
  lines.push(
    '',
    `FROM ${registry}ruby:${recipe.version}-slim-bookworm`,
    runtimeLibraries(['libpq5', 'libmariadb3', 'libsqlite3-0', 'libyaml-0-2', 'ca-certificates']),
    'WORKDIR /app',
    `${env} RAILS_LOG_TO_STDOUT=1 RAILS_SERVE_STATIC_FILES=1`,
    'COPY --from=build /usr/local/bundle /usr/local/bundle',
    'COPY --from=build /app /app',
    cmd(recipe.start),
    ''
  );
  return lines.join('\n');
}

export function dotnetDockerfile(recipe: DotnetRecipe, buildArgKeys: string[] = []): string {
  // Microsoft's registry: Docker Hub's limit and mirror do not apply.
  return [
    `FROM mcr.microsoft.com/dotnet/sdk:${recipe.version} AS build`,
    'WORKDIR /src',
    'ENV DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1',
    ...argLines(buildArgKeys),
    'COPY . .',
    `RUN --mount=type=cache,id=ideploy-nuget,target=/root/.nuget/packages ${recipe.build}`,
    '',
    `FROM mcr.microsoft.com/dotnet/${recipe.web ? 'aspnet' : 'runtime'}:${recipe.version}`,
    'WORKDIR /app',
    'COPY --from=build /out .',
    'ENV DOTNET_RUNNING_IN_CONTAINER=true',
    cmd(recipe.start),
    '',
  ].join('\n');
}

export function rustDockerfile(recipe: RustRecipe, buildArgKeys: string[] = [], registry = ''): string {
  // target/ is a cache (one per program: two projects never share it); the
  // binary is copied out in the same step.
  const target = `ideploy-cargo-target-${recipe.bin.replace(/[^A-Za-z0-9_-]/g, '-')}`;
  return [
    `FROM ${registry}rust:${recipe.version}-bookworm AS build`,
    'WORKDIR /app',
    ...argLines(buildArgKeys),
    'COPY . .',
    `RUN --mount=type=cache,id=ideploy-cargo-registry,target=/usr/local/cargo/registry --mount=type=cache,id=ideploy-cargo-git,target=/usr/local/cargo/git ` +
      `--mount=type=cache,id=${target},target=/app/target ${recipe.build} && mkdir -p /out && cp ${sq(`target/release/${recipe.bin}`)} /out/app`,
    '',
    `FROM ${registry}debian:bookworm-slim`,
    runtimeLibraries(['ca-certificates', 'libssl3']),
    'WORKDIR /app',
    'COPY --from=build /app /app',
    'COPY --from=build /out/app /usr/local/bin/app',
    cmd(recipe.start),
    '',
  ].join('\n');
}

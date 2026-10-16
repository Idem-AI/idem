/**
 * Python, PHP, Go, Ruby, .NET and Rust: read from the code, built by iDeploy.
 */
import { describe, it, expect } from 'vitest';
import { analyzeRepository, RepoFiles } from '../../../api/build-plan';
import { DotnetRecipe, GoRecipe, PhpRecipe, PythonRecipe, RubyRecipe, RustRecipe } from '../../../api/build-plan/types';
import { phpVersionFromConstraint } from '../../../api/build-plan/php';
import { goVersion } from '../../../api/build-plan/go';
import { pythonVersionFromSpec } from '../../../api/build-plan/python';
import { FRESH_COREPACK } from '../../../api/build-plan/node';
import { explainFailure, explainRuntimeFailure } from '../../../api/build-plan/failures';
import { recipeDockerfile, recipeLabel } from '../../../api/docker/recipes';

function repo(files: Record<string, string | object>): RepoFiles {
  const contents = new Map(Object.entries(files).map(([p, c]) => [p, typeof c === 'string' ? c : JSON.stringify(c)]));
  return { paths: [...contents.keys()], read: async (p) => contents.get(p) ?? null };
}

describe('Python', () => {
  it('runs Django with gunicorn on its wsgi module', async () => {
    const plan = await analyzeRepository(
      repo({
        'requirements.txt': 'Django==5.0\npsycopg2-binary==2.9\n',
        'manage.py': '',
        'mysite/wsgi.py': 'application = get_wsgi_application()',
        '.python-version': '3.11.6',
      }),
      ''
    );
    expect(plan).toMatchObject({ language: 'python', framework: 'Django' });
    const recipe = plan.recipe as PythonRecipe;
    expect(recipe).toMatchObject({
      kind: 'python',
      version: '3.11',
      manager: 'pip',
      install: 'pip install -r requirements.txt',
      extras: ['gunicorn'],
      start: 'gunicorn mysite.wsgi:application --bind 0.0.0.0:${PORT:-8000}',
    });
    expect(recipe.build).toContain('collectstatic --noinput');
    const file = recipeDockerfile(recipe);
    expect(file).toContain('FROM python:3.11-bookworm AS build');
    expect(file).toContain("pip install 'gunicorn'");
    expect(file).toContain('FROM python:3.11-slim-bookworm');
    expect(file).toContain('COPY --from=build /opt/venv /opt/venv');
    expect(file).toContain('libpq5');
  });

  it('runs FastAPI with uvicorn, from a src layout, installed by Poetry', async () => {
    const plan = await analyzeRepository(
      repo({
        'pyproject.toml': '[tool.poetry]\nname = "x"\n[tool.poetry.dependencies]\npython = "^3.11"\nfastapi = "^0.110"\n',
        'poetry.lock': '',
        'src/app/main.py': 'from fastapi import FastAPI\napp = FastAPI()\n',
      }),
      ''
    );
    expect(plan.recipe).toMatchObject({
      kind: 'python',
      version: '3.12',
      manager: 'poetry',
      extras: ['uvicorn[standard]'],
      start: 'uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --app-dir src',
    });
    expect((plan.recipe as PythonRecipe).install).toContain('/opt/poetry/bin/poetry install --no-root --only main');
  });

  it('runs a Flask factory, and the Procfile wins', async () => {
    const files = {
      'requirements.txt': 'flask\ngunicorn\n',
      'app.py': 'from flask import Flask\ndef create_app():\n    return Flask(__name__)\n',
    };
    const plan = await analyzeRepository(repo(files), '');
    expect(plan.recipe).toMatchObject({ extras: [], start: "gunicorn 'app:create_app()' --bind 0.0.0.0:${PORT:-8000}" });
    const withProcfile = await analyzeRepository(repo({ ...files, Procfile: 'web: gunicorn app:app -w 4 -b 0.0.0.0:$PORT\n' }), '');
    expect((withProcfile.recipe as PythonRecipe).start).toBe('gunicorn app:app -w 4 -b 0.0.0.0:$PORT');
  });

  it('leaves a Node application with a requirements.txt to Node', async () => {
    const plan = await analyzeRepository(
      repo({ 'package.json': { scripts: { build: 'next build', start: 'next start' }, dependencies: { next: '15' } }, 'requirements.txt': 'black' }),
      ''
    );
    expect(plan.language).toBe('node');
  });

  it('reads Python versions', () => {
    expect(pythonVersionFromSpec('python-3.10.4')).toBe('3.10');
    expect(pythonVersionFromSpec('>=3.9,<3.12')).toBe('3.11');
    expect(pythonVersionFromSpec('==3.11.*')).toBe('3.11');
    expect(pythonVersionFromSpec('>=3.13')).toBe('3.13');
  });
});

describe('PHP', () => {
  it('serves Laravel with Apache from public/, its extensions and its Vite assets', async () => {
    const plan = await analyzeRepository(
      repo({
        'composer.json': { require: { php: '^8.2', 'laravel/framework': '^11.0', 'ext-gd': '*' } },
        'composer.lock': '{"packages":[{"name":"x","require":{"ext-sodium":"*"}}]}',
        'package.json': { scripts: { build: 'vite build' }, devDependencies: { vite: '5' } },
        'package-lock.json': '{}',
        'public/index.php': '',
        artisan: '',
      }),
      ''
    );
    const recipe = plan.recipe as PhpRecipe;
    expect(plan).toMatchObject({ language: 'php', framework: 'Laravel' });
    expect(recipe).toMatchObject({
      version: '8.2',
      documentRoot: 'public',
      assets: { manager: 'npm', install: 'npm ci', build: 'npm run build' },
      start: 'apache2-foreground',
    });
    expect(recipe.extensions).toEqual(['bcmath', 'exif', 'gd', 'intl', 'opcache', 'pcntl', 'pdo_mysql', 'pdo_pgsql', 'sodium', 'zip']);
    const file = recipeDockerfile(recipe);
    expect(file).toContain('FROM node:22-bookworm AS assets');
    expect(file).toContain('FROM php:8.2-apache');
    expect(file).toContain('ENV APACHE_DOCUMENT_ROOT=/app/public');
    expect(file).toContain("sed -ri -e 's/^Listen 80$/Listen ${PORT}/' /etc/apache2/ports.conf");
    expect(file).toContain('AllowOverride All');
    expect(file).toContain('RUN install-php-extensions bcmath exif gd intl opcache pcntl pdo_mysql pdo_pgsql sodium zip');
    expect(file).toContain('COPY --from=assets /app/public /app/public');
    expect(file).toContain('composer install --no-dev --optimize-autoloader');
  });

  it('serves a plain PHP folder without Composer', async () => {
    const plan = await analyzeRepository(repo({ 'index.php': '<?php echo 1;' }), '');
    expect(plan.recipe).toMatchObject({ kind: 'php', framework: 'PHP', documentRoot: '', assets: null });
  });

  it('reads PHP version constraints, preferring PHP 8', () => {
    expect(phpVersionFromConstraint('^7.4|^8.0')).toBe('8.0');
    expect(phpVersionFromConstraint('>=8.1')).toBe('8.3');
    expect(phpVersionFromConstraint('>=8.1 <8.3')).toBe('8.2');
    expect(phpVersionFromConstraint('~7.4')).toBe('7.4');
  });
});

describe('Go', () => {
  it('builds the server of cmd/, with cgo for sqlite', async () => {
    const plan = await analyzeRepository(
      repo({
        'go.mod': 'module github.com/acme/shop\n\ngo 1.22.3\n\nrequire github.com/mattn/go-sqlite3 v1.14.22\n',
        'cmd/server/main.go': '',
        'cmd/migrate/main.go': '',
      }),
      ''
    );
    const recipe = plan.recipe as GoRecipe;
    expect(recipe).toMatchObject({ kind: 'go', version: '1.22', cgo: true, build: 'go build -trimpath -ldflags="-s -w" -o /out/app ./cmd/server' });
    expect(plan.issues.find((i) => i.code === 'GO_MAIN')?.severity).toBe('info');
    const file = recipeDockerfile(recipe);
    expect(file).toContain('FROM golang:1.22-bookworm AS build');
    expect(file).toContain('CGO_ENABLED=1');
    expect(file).toContain('mkdir -p /out && go build');
    expect(file).toContain('FROM debian:bookworm-slim');
  });

  it('asks which program when none stands out', async () => {
    const plan = await analyzeRepository(repo({ 'go.mod': 'module x\n\ngo 1.22\n', 'cmd/alpha/main.go': '', 'cmd/beta/main.go': '' }), '');
    expect(plan.issues.find((i) => i.severity === 'blocking')?.code).toBe('GO_PICK_MAIN');
    expect(plan.recipe).toBeUndefined();
    expect(goVersion('go 1.21\ntoolchain go1.23.4\n')).toBe('1.23');
  });
});

describe('Ruby', () => {
  it('runs Rails with its Ruby, Bundler for Linux, Node for its assets', async () => {
    const plan = await analyzeRepository(
      repo({
        Gemfile: "source 'https://rubygems.org'\nruby '3.2.2'\ngem 'rails', '~> 7.1'\ngem 'pg'\n",
        '.ruby-version': 'ruby-3.2.2',
        'config/application.rb': '',
        'package.json': {},
        'yarn.lock': '',
      }),
      ''
    );
    const recipe = plan.recipe as RubyRecipe;
    expect(plan.framework).toBe('Ruby on Rails');
    expect(recipe).toMatchObject({
      kind: 'ruby',
      version: '3.2',
      rails: true,
      nodeInstall: `${FRESH_COREPACK} && yarn install`,
      start: 'bundle exec rails server -b 0.0.0.0 -p ${PORT:-3000}',
    });
    const file = recipeDockerfile(recipe);
    expect(file).toContain('FROM ruby:3.2-bookworm AS build');
    expect(file).toContain('bundle lock --add-platform x86_64-linux aarch64-linux');
    expect(file).toContain('COPY --from=node:22-bookworm /usr/local/bin/node /usr/local/bin/node');
    expect(file).toContain('FROM ruby:3.2-slim-bookworm');
  });
});

describe('.NET', () => {
  it('publishes the web project, never a test project', async () => {
    const plan = await analyzeRepository(
      repo({
        'src/Api/Api.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>',
        'src/Core/Core.csproj': '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>',
        'tests/Api.Tests/Api.Tests.csproj': '<Project Sdk="Microsoft.NET.Sdk"><ItemGroup><PackageReference Include="Microsoft.NET.Test.Sdk" /></ItemGroup></Project>',
      }),
      ''
    );
    const recipe = plan.recipe as DotnetRecipe;
    expect(plan.framework).toBe('ASP.NET Core');
    expect(recipe).toMatchObject({
      version: '8.0',
      project: 'src/Api/Api.csproj',
      assembly: 'Api',
      build: 'dotnet publish "src/Api/Api.csproj" -c Release -o /out',
      start: 'export ASPNETCORE_URLS=http://0.0.0.0:${PORT:-8080} && exec dotnet "Api.dll"',
    });
    const file = recipeDockerfile(recipe);
    expect(file).toContain('FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build');
    expect(file).toContain('FROM mcr.microsoft.com/dotnet/aspnet:8.0');
  });
});

describe('Rust', () => {
  it('builds the package binary with its lockfile', async () => {
    const plan = await analyzeRepository(repo({ 'Cargo.toml': '[package]\nname = "api"\nversion = "0.1.0"\n', 'src/main.rs': '', 'Cargo.lock': '' }), '');
    expect(plan.recipe).toMatchObject({ kind: 'rust', version: '1', bin: 'api', build: 'cargo build --release --locked --bin api' });
  });

  it('builds the one program of a workspace from its root, also when pointed at its folder', async () => {
    const files = {
      'Cargo.toml': '[workspace]\nmembers = ["crates/*"]\n',
      'crates/server/Cargo.toml': '[package]\nname = "acme-server"\n\n[[bin]]\nname = "server"\npath = "src/main.rs"\n',
      'crates/server/src/main.rs': '',
      'crates/core/Cargo.toml': '[package]\nname = "acme-core"\n',
      'crates/core/src/lib.rs': '',
    };
    const root = await analyzeRepository(repo(files), '');
    expect(root.recipe).toMatchObject({ bin: 'server', build: 'cargo build --release -p acme-server --bin server' });
    const member = await analyzeRepository(repo(files), 'crates/server');
    expect(member).toMatchObject({ buildRoot: '', recipe: { build: 'cargo build --release -p acme-server --bin server' } });
    const file = recipeDockerfile(root.recipe as RustRecipe);
    expect(file).toContain("cp 'target/release/server' /out/app");
    expect(file).toContain('id=ideploy-cargo-target-server');
  });
});

describe('labels and failures', () => {
  it('names each recipe in the log', () => {
    expect(recipeLabel({ kind: 'go', version: '1.22', cgo: true, build: null, start: '' })).toBe('Go 1.22 (cgo)');
    expect(recipeLabel({ kind: 'rust', version: '1', bin: 'x', build: null, start: '' })).toBe('Rust stable');
  });

  it('explains the build and start failures of these languages', () => {
    expect(explainFailure('missing go.sum entry for module providing package github.com/x/y')?.code).toBe('LOCKFILE_OUT_OF_DATE');
    expect(explainFailure('#12 1.234 main.go:3:2: undefined: foo')?.code).toBe('COMPILE_ERROR');
    expect(explainFailure('ERROR: Could not find a version that satisfies the requirement torch==9.9')?.code).toBe('PYTHON_VERSION');
    expect(explainRuntimeFailure("ModuleNotFoundError: No module named 'django'")?.code).toBe('MODULE_NOT_FOUND');
    expect(explainRuntimeFailure('No application encryption key has been specified.')?.code).toBe('APP_SECRET');
    expect(explainRuntimeFailure("Failed to find attribute 'app' in 'main'.")?.code).toBe('ENTRY_NOT_FOUND');
  });
});

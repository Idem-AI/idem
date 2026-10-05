/**
 * Build strategies.
 *
 * A build plan is a set of commands that will run as root on a customer's
 * server, so the assertions here are about two things: producing a reproducible
 * artefact, and failing with an explanation instead of an opaque Docker error
 * when the repository is not what the chosen pack expects.
 */
import { describe, expect, it } from 'vitest';
import {
  BuildContext,
  buildDirectory,
  detectBuildPack,
  planBuild,
  toBuildPack,
} from '../../../api/docker/build-packs';

function context(overrides: Partial<BuildContext> = {}): BuildContext {
  return {
    srcDir: '/data/app/src',
    workdir: '/data/app',
    imageTag: 'my-app-abc123',
    port: 3000,
    ...overrides,
  };
}

/** All commands of a plan, joined — for coarse "does it mention X" checks. */
function script(plan: { steps: { command: string }[] }): string {
  return plan.steps.map((s) => s.command).join('\n');
}

describe('buildDirectory', () => {
  it('builds at the repository root by default', () => {
    expect(buildDirectory(context())).toBe('/data/app/src');
  });

  it.each([
    ['packages/web', '/data/app/src/packages/web'],
    ['./packages/web', '/data/app/src/packages/web'],
    ['/packages/web/', '/data/app/src/packages/web'],
  ])('resolves a monorepo sub-path %s', (baseDirectory, expected) => {
    expect(buildDirectory(context({ baseDirectory }))).toBe(expected);
  });

  it('treats a lone slash as the root', () => {
    expect(buildDirectory(context({ baseDirectory: '/' }))).toBe('/data/app/src');
  });
});

describe('detectBuildPack', () => {
  it('prefers a compose file, the most explicit statement of intent', () => {
    expect(detectBuildPack(['docker-compose.yml', 'Dockerfile', 'package.json'])).toBe(
      'dockercompose'
    );
  });

  it('prefers a Dockerfile over inferring from a manifest', () => {
    expect(detectBuildPack(['Dockerfile', 'package.json'])).toBe('dockerfile');
  });

  it('treats plain files as a static site', () => {
    expect(detectBuildPack(['index.html', 'style.css'])).toBe('static');
  });

  it('sends a site that needs building through nixpacks, not static', () => {
    // An index.html beside a package.json is a source tree, not build output.
    expect(detectBuildPack(['index.html', 'package.json'])).toBe('nixpacks');
  });

  it('falls back to nixpacks for an unrecognised project', () => {
    expect(detectBuildPack(['main.go', 'go.mod'])).toBe('nixpacks');
    expect(detectBuildPack([])).toBe('nixpacks');
  });
});

describe('planBuild — dockerfile', () => {
  it('builds and tags the image', () => {
    const plan = planBuild('dockerfile', context());

    expect(plan.runtime).toBe('image');
    expect(plan.imageTag).toBe('my-app-abc123');
    expect(script(plan)).toContain("docker build -f 'Dockerfile' -t 'my-app-abc123'");
  });

  it('explains a missing Dockerfile instead of failing opaquely', () => {
    expect(script(planBuild('dockerfile', context()))).toContain('No Dockerfile found');
  });

  it('builds inside the monorepo sub-path', () => {
    const plan = planBuild('dockerfile', context({ baseDirectory: 'apps/api' }));
    expect(script(plan)).toContain("cd '/data/app/src/apps/api'");
  });
});

describe('planBuild — nixpacks', () => {
  it('produces an image, not a mounted working tree', () => {
    // The point of a build pack: a reproducible artefact rather than a container
    // that reinstalls dependencies on every start.
    const plan = planBuild('nixpacks', context());

    expect(plan.runtime).toBe('image');
    expect(script(plan)).toContain('docker build -f .nixpacks/Dockerfile');
  });

  it('never hands the Docker socket to the builder container', () => {
    // Mounting the socket would give the builder control of the whole daemon;
    // nixpacks only needs to emit a Dockerfile.
    expect(script(planBuild('nixpacks', context()))).not.toContain('docker.sock');
  });

  it('passes the user’s commands through to nixpacks', () => {
    const plan = planBuild(
      'nixpacks',
      context({ installCommand: 'pnpm i', buildCommand: 'pnpm build', startCommand: 'pnpm start' })
    );
    const commands = script(plan);

    expect(commands).toContain("NIXPACKS_INSTALL_CMD='pnpm i'");
    expect(commands).toContain("NIXPACKS_BUILD_CMD='pnpm build'");
    expect(commands).toContain("NIXPACKS_START_CMD='pnpm start'");
  });

  it('omits the overrides when the user set none', () => {
    expect(script(planBuild('nixpacks', context()))).not.toContain('NIXPACKS_INSTALL_CMD');
  });

  it('explains an undetected language', () => {
    expect(script(planBuild('nixpacks', context()))).toContain('may not be detected');
  });
});

describe('planBuild — static', () => {
  it('serves the build output from nginx', () => {
    const plan = planBuild('static', context({ publishDirectory: 'dist' }));

    expect(plan.runtime).toBe('image');
    expect(script(plan)).toContain('FROM nginx:alpine');
    expect(script(plan)).toContain('/usr/share/nginx/html');
  });

  it('runs the build when one is configured', () => {
    const plan = planBuild(
      'static',
      context({ installCommand: 'npm ci', buildCommand: 'npm run build' })
    );

    expect(script(plan)).toContain('npm ci && npm run build');
  });

  it('skips the build step for output that is already just files', () => {
    const plan = planBuild('static', context());

    expect(plan.steps.some((s) => s.label === 'Building the site')).toBe(false);
  });

  it('passes build-time Variables to the build (VITE_API_URL baked into the site)', () => {
    const plan = planBuild(
      'static',
      context({ buildCommand: 'npm run build', buildEnv: ['VITE_API_URL=https://api.example.com'] })
    );

    expect(script(plan)).toContain("-e 'VITE_API_URL=https://api.example.com'");
  });

  it('falls back to index.html, so reloading a page of a single-page app is not a 404', () => {
    const plan = planBuild('static', context());
    const conf = Buffer.from(
      script(plan).match(/echo (\S+) \| base64 -d > nginx\.ideploy\.conf/)![1],
      'base64'
    ).toString('utf8');

    expect(conf).toContain('try_files $uri $uri/ /index.html;');
    expect(script(plan)).toContain('COPY nginx.ideploy.conf /etc/nginx/conf.d/default.conf');
  });

  it('defaults the publish directory, and says so when it is wrong', () => {
    const plan = planBuild('static', context());

    expect(script(plan)).toContain('dist');
    expect(script(plan)).toContain('Set the publish directory to match your build');
  });
});

describe('planBuild — dockercompose', () => {
  it('hands over to the repository’s compose file', () => {
    const plan = planBuild('dockercompose', context());

    expect(plan.runtime).toBe('compose-file');
    expect(plan.composePath).toBe('/data/app/src/docker-compose.yml');
    expect(script(plan)).toContain('docker compose build');
  });

  it('accepts either spelling of the file name', () => {
    const commands = script(planBuild('dockercompose', context()));

    expect(commands).toContain('docker-compose.yml');
    expect(commands).toContain('docker-compose.yaml');
  });
});

describe('shell safety', () => {
  it('quotes paths so a crafted directory name cannot inject a command', () => {
    // Base directory is user input; unquoted, it runs as root on their server.
    const plan = planBuild('dockerfile', context({ baseDirectory: "web'; rm -rf /; echo '" }));

    // The payload stays inside quotes: every embedded quote is escaped.
    expect(script(plan)).not.toMatch(/cd [^']*; rm -rf \//);
    expect(script(plan)).toContain(`'\\''`);
  });
});

describe('toBuildPack', () => {
  it.each(['nixpacks', 'static', 'dockerfile', 'dockercompose'])('accepts %s', (pack) => {
    expect(toBuildPack(pack)).toBe(pack);
  });

  it('defaults anything unknown to nixpacks', () => {
    expect(toBuildPack(null)).toBe('nixpacks');
    expect(toBuildPack('herokuish')).toBe('nixpacks');
  });
});

describe('dockerfile plan — monorepo layout', () => {
  it('builds with the base directory as context and the Dockerfile where it lives', () => {
    const plan = planBuild('dockerfile', {
      srcDir: '/w/src',
      workdir: '/w',
      imageTag: 'ideploy-x:1',
      port: 3000,
      dockerfileLocation: '/Dockerfile/prod/Dockerfile.api',
      dockerfileTarget: 'runtime',
    });
    const command = plan.steps[0].command;
    expect(command).toContain("cd '/w/src'");
    expect(command).toContain("docker build -f 'Dockerfile/prod/Dockerfile.api' --target 'runtime' -t 'ideploy-x:1' .");
  });

  it('defaults to ./Dockerfile', () => {
    const plan = planBuild('dockerfile', { srcDir: '/w/src', workdir: '/w', imageTag: 't', port: 3000 });
    expect(plan.steps[0].command).toContain("docker build -f 'Dockerfile' -t 't' .");
  });
});

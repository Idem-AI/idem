import { execSync } from 'child_process';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { missingArgsCheck, planBuild } from '../../../api/docker/build-packs';

const MONOREPO_DOCKERFILE = 'FROM node:22 AS pruner\nARG APP\nARG NODE_VERSION=22\nARG TARGETARCH\nRUN turbo prune $APP --docker\n';

function runCheck(provided: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'df-'));
  writeFileSync(join(dir, 'Dockerfile'), MONOREPO_DOCKERFILE);
  return execSync(`cd ${dir} && { ${missingArgsCheck('Dockerfile', provided)}; } 2>&1; echo "exit=$?"`, { shell: '/bin/sh' }).toString();
}

describe('Dockerfile build arguments', () => {
  it('passes the build variables as --build-arg', () => {
    const plan = planBuild('dockerfile', {
      srcDir: '/r/src', workdir: '/r', imageTag: 'img:1', baseDirectory: '', port: 3000, buildEnv: ['APP=web', 'API_URL=https://x'],
    } as never);
    expect(plan.steps[0].command).toContain("--build-arg 'APP=web' --build-arg 'API_URL=https://x' -t 'img:1'");
  });

  it('names an ARG without default that nobody provides, without failing the build', () => {
    const out = runCheck([]);
    expect(out).toMatch(/expects build argument\(s\) APP with no default value/);
    expect(out).not.toMatch(/NODE_VERSION|TARGETARCH/);
    expect(out).toMatch(/exit=0/);
  });

  it('says nothing once the argument is given', () => {
    expect(runCheck(['APP'])).not.toMatch(/expects build argument/);
  });
});

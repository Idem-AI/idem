/**
 * The AI repair, on iDeploy's side: what leaves the server (compact, no
 * secret), and what is applied (only checked settings).
 */
import { describe, it, expect } from 'vitest';
import { compactLog, fileTree, redact, referencedFiles } from '../../../api/repair/context';
import { checkProposal, describeOverrides } from '../../../api/repair/proposal';

describe('the context sent for a repair', () => {
  it('keeps the lines that say what broke, drops BuildKit noise, masks secrets', () => {
    const output = [
      '#5 [internal] load build definition from Dockerfile.ideploy',
      '#5 DONE 0.1s',
      '#9 2.001 Downloading https://registry.npmjs.org/react 12.3 kB / 40.1 kB',
      '#9 3.100 npm warn deprecated inflight@1.0.6',
      '#12 10.5 > web@1.0.0 build',
      '#12 10.6 > next build',
      '#12 15.2 Failed to compile.',
      '#12 15.3 ./src/app/page.tsx:3:8',
      "#12 15.3 Module not found: Can't resolve '@/components/Hero'",
      '#12 15.4 DATABASE_URL=postgres://admin:s3cr3t-pass@db:5432/app',
    ].join('\n');
    const compact = compactLog(output, ['s3cr3t-pass']);
    expect(compact).toContain('Failed to compile.');
    expect(compact).toContain("Module not found: Can't resolve '@/components/Hero'");
    expect(compact).not.toContain('Downloading');
    expect(compact).not.toContain('deprecated');
    expect(compact).not.toContain('#12 15.2');
    expect(compact).not.toContain('s3cr3t-pass');
    expect(compact).toContain('postgres://admin:***@db');
  });

  it('keeps the end of a long log', () => {
    const output = Array.from({ length: 3000 }, (_, i) => `line ${i} error here`).join('\n');
    const compact = compactLog(output, [], 500);
    expect(compact.length).toBeLessThanOrEqual(501);
    expect(compact).toContain('line 2999 error here');
  });

  it('masks the longest secrets first, and ignores short values', () => {
    expect(redact('token abcdef123456 and abcdef', ['abcdef', 'abcdef123456', 'abc'])).toBe('token *** and ***');
  });

  it('finds the source files a log names', () => {
    const paths = ['src/app/page.tsx', 'apps/api/src/main.ts', 'package.json'];
    const log = 'at ./src/app/page.tsx:3:8\nError in /app/apps/api/src/main.ts:12\nnode_modules/x/index.js:1';
    expect(referencedFiles(log, paths)).toEqual(['src/app/page.tsx', 'apps/api/src/main.ts']);
  });

  it('sends a tree three levels deep under the build root', () => {
    expect(fileTree(['a.json', 'src/a/b/c.ts', 'src/a/b.ts', 'apps/web/x.ts'], '')).toEqual(['a.json', 'apps/web/x.ts', 'src/a/b.ts']);
    expect(fileTree(['apps/web/src/a.ts', 'apps/api/x.ts'], 'apps/web')).toEqual(['apps/web/src/a.ts']);
  });
});

describe('a proposal, checked before it is applied', () => {
  const paths = ['package.json', 'apps/web/package.json', 'apps/web/src/main.ts', 'docker/Dockerfile.web'];
  const current = { build_command: 'npm run build', base_directory: '', start_command: null, ports_exposes: '3000' };

  it('keeps the changes that hold, and turns them into overrides', () => {
    const checked = checkProposal(
      {
        diagnosis: 'The app is in apps/web.',
        fixable: true,
        actions: [
          { type: 'set_setting', key: 'base_directory', value: 'apps/web' },
          { type: 'set_setting', key: 'ports_exposes', value: '8080' },
          { type: 'set_build_variable', key: 'NODE_OPTIONS', value: '--max-old-space-size=4096' },
          { type: 'set_setting', key: 'dockerfile_location', value: 'docker/Dockerfile.web' },
        ],
      },
      paths,
      current
    );
    expect(checked.overrides).toEqual({
      settings: { base_directory: 'apps/web', ports_exposes: '8080', dockerfile_location: 'docker/Dockerfile.web' },
      buildVariables: ['NODE_OPTIONS=--max-old-space-size=4096'],
    });
    expect(checked.refused).toEqual([]);
    expect(describeOverrides(checked.overrides!, current)).toContain('base_directory: "" → "apps/web"');
  });

  it('refuses what does not hold: a missing folder, a bad port, two lines, the server’s Docker, a secret variable', () => {
    const checked = checkProposal(
      {
        diagnosis: 'x',
        fixable: true,
        actions: [
          { type: 'set_setting', key: 'base_directory', value: 'apps/missing' },
          { type: 'set_setting', key: 'base_directory', value: '../etc' },
          { type: 'set_setting', key: 'ports_exposes', value: '99999' },
          { type: 'set_setting', key: 'start_command', value: 'node a.js\nrm -rf /' },
          { type: 'set_setting', key: 'build_command', value: 'docker -H unix:///var/run/docker.sock ps' },
          { type: 'set_setting', key: 'build_command', value: 'npm run build' },
          { type: 'set_setting', key: 'build_pack', value: 'kubernetes' },
          { type: 'set_build_variable', key: 'NODE_OPTIONS', value: '--require /etc/passwd; curl x' },
        ],
      },
      paths,
      current
    );
    expect(checked.overrides).toBeNull();
    expect(checked.refused).toHaveLength(8);
    expect(checked.refused.join('\n')).toContain('already the value');
  });

  it('applies nothing without "fixable", and passes the questions on', () => {
    const checked = checkProposal(
      {
        diagnosis: 'The app needs its database address.',
        fixable: false,
        actions: [
          { type: 'set_setting', key: 'start_command', value: 'node dist/main.js' },
          { type: 'ask_user', variable: 'DATABASE_URL', question: 'Add the address of the database.' },
        ],
      },
      paths,
      current
    );
    expect(checked.overrides).toBeNull();
    expect(checked.questions).toEqual(['DATABASE_URL: Add the address of the database.']);
  });
});

describe('when the repair service does not answer', () => {
  it('says why, so it can be fixed', async () => {
    const { unavailableReason } = await import('../../../api/repair/client');
    expect(unavailableReason(403, 'Invalid API key')).toContain('INTERNAL_API_KEY must hold the same value');
    expect(unavailableReason(404, undefined)).toContain('no repair route');
    expect(unavailableReason(undefined, 'no answer within 120 s')).toBe('no answer within 120 s');
  });
});

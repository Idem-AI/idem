import { describe, expect, it } from 'vitest';
import { globToRegExp, matchesWatchPaths, parseWatchPaths } from '../../../api/utils/path-glob';

describe('globToRegExp', () => {
  const m = (pattern: string, file: string) => globToRegExp(pattern).test(file);

  it('crosses folders with **, stays within one with *', () => {
    expect(m('apps/api/**', 'apps/api/api/services/x.ts')).toBe(true);
    expect(m('apps/*/package.json', 'apps/api/package.json')).toBe(true);
    expect(m('apps/*/package.json', 'apps/api/sub/package.json')).toBe(false);
    expect(m('**/*.md', 'README.md')).toBe(true);
    expect(m('apps/**/Dockerfile', 'apps/Dockerfile')).toBe(true);
  });

  it('reads a trailing slash as a folder, and a leading slash or ./ as the root', () => {
    expect(m('packages/', 'packages/a/b.ts')).toBe(true);
    expect(m('/Dockerfile/prod/Dockerfile.api', 'Dockerfile/prod/Dockerfile.api')).toBe(true);
    expect(m('./apps/api/**', 'apps/api/x')).toBe(true);
  });

  it('treats dots and other characters literally', () => {
    expect(m('a.ts', 'abts')).toBe(false);
  });
});

describe('parseWatchPaths / matchesWatchPaths', () => {
  it('takes one pattern per line or comma, without blanks or comments', () => {
    expect(parseWatchPaths('apps/api/**\n# shared\npackages/**, !**/*.md\n')).toEqual(['apps/api/**', 'packages/**', '!**/*.md']);
  });

  it('includes, then excludes', () => {
    const patterns = ['apps/api/**', '!apps/api/**/*.test.ts'];
    expect(matchesWatchPaths(['apps/api/x.ts'], patterns)).toBe(true);
    expect(matchesWatchPaths(['apps/api/x.test.ts'], patterns)).toBe(false);
  });
});

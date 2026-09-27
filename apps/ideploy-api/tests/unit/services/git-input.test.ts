/**
 * Références Git fournies par l'utilisateur, qui finissent dans `git clone`
 * sur le serveur.
 */
import { describe, expect, it } from 'vitest';
import {
  isSafeGitBranch,
  isSafeGitUrl,
  isSafeRelativeDir,
} from '../../../api/validation/git-input';

describe('isSafeGitBranch', () => {
  it.each(['main', 'feature/login', 'release-1.2', 'v2.0.1'])('accepts %s', (branch) => {
    expect(isSafeGitBranch(branch)).toBe(true);
  });

  it.each(['--upload-pack=touch', 'main;id', 'main$(id)', 'a b', 'x..y', '', 'x.lock'])(
    'refuses %s',
    (branch) => {
      expect(isSafeGitBranch(branch)).toBe(false);
    }
  );
});

describe('isSafeGitUrl', () => {
  it.each(['https://github.com/acme/app.git', 'git@github.com:acme/app.git'])('accepts %s', (url) => {
    expect(isSafeGitUrl(url)).toBe(true);
  });

  it.each(['ext::sh -c id', 'file:///etc', '--config=x', 'https://a b', 'git@host:$(id)'])(
    'refuses %s',
    (url) => {
      expect(isSafeGitUrl(url)).toBe(false);
    }
  );
});

describe('isSafeRelativeDir', () => {
  it('accepts empty and nested relative paths', () => {
    expect(isSafeRelativeDir('')).toBe(true);
    expect(isSafeRelativeDir('apps/web/dist')).toBe(true);
  });

  it('refuses traversal and shell metacharacters', () => {
    expect(isSafeRelativeDir('../..')).toBe(false);
    expect(isSafeRelativeDir('dist$(id)')).toBe(false);
    expect(isSafeRelativeDir('dist"; id; "')).toBe(false);
  });
});

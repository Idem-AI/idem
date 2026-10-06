import { describe, expect, it } from 'vitest';
import { isSafeImageName, isSafeImageTag, registryOf } from '../../../api/validation/git-input';

describe('isSafeImageName', () => {
  it('accepts registry paths, with or without a registry or a port', () => {
    for (const name of ['nginx', 'org/app', 'ghcr.io/idem-ai/idem-api', 'registry.example.com:5000/team/app', 'a/b/c']) {
      expect(isSafeImageName(name)).toBe(true);
    }
  });

  it('refuses what is not an image reference, or could reach a shell', () => {
    for (const name of ['', 'Org/App', 'app:latest', 'app; rm -rf /', 'app$(id)', '../x', 'a b', '-app']) {
      expect(isSafeImageName(name)).toBe(false);
    }
  });
});

describe('isSafeImageTag', () => {
  it('accepts versions and commit-based tags, refuses the rest', () => {
    expect(isSafeImageTag('v1.2.3')).toBe(true);
    expect(isSafeImageTag('sha-9f3c2d1')).toBe(true);
    expect(isSafeImageTag('latest')).toBe(true);
    expect(isSafeImageTag('.hidden')).toBe(false);
    expect(isSafeImageTag('a b')).toBe(false);
    expect(isSafeImageTag('v1;id')).toBe(false);
    expect(isSafeImageTag('x'.repeat(129))).toBe(false);
  });
});

describe('registryOf', () => {
  it('reads the registry host, defaulting to Docker Hub', () => {
    expect(registryOf('ghcr.io/idem-ai/app')).toBe('ghcr.io');
    expect(registryOf('registry.example.com:5000/app')).toBe('registry.example.com:5000');
    expect(registryOf('nginx')).toBe('docker.io');
    expect(registryOf('org/app')).toBe('docker.io');
  });
});

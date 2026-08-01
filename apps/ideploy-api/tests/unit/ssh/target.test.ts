import { describe, expect, it } from 'vitest';
import { isLocalServer } from '../../../api/ssh/target';
import { serverRow } from '../../helpers/rows';

describe('isLocalServer', () => {
  it('treats loopback, localhost and the Docker host gateway as local', () => {
    for (const ip of ['127.0.0.1', 'localhost', 'host.docker.internal']) {
      expect(isLocalServer(serverRow({ ip }))).toBe(true);
    }
  });

  it('is case-insensitive on the host', () => {
    expect(isLocalServer(serverRow({ ip: 'LOCALHOST' }))).toBe(true);
  });

  it("treats Coolify's reserved uuid '0' as the local server whatever the ip", () => {
    expect(isLocalServer(serverRow({ uuid: '0', ip: '203.0.113.10' }))).toBe(true);
  });

  it('treats a routable address as remote', () => {
    expect(isLocalServer(serverRow({ ip: '203.0.113.10' }))).toBe(false);
  });

  it('does not mistake an address merely containing a local host name for local', () => {
    // Regression guard: a substring match here would route a real deployment to
    // the wrong machine — commands would run on the iDeploy host, not the target.
    expect(isLocalServer(serverRow({ ip: 'localhost.example.com' }))).toBe(false);
    expect(isLocalServer(serverRow({ ip: '127.0.0.10' }))).toBe(false);
  });

  it('handles a missing ip without throwing', () => {
    expect(isLocalServer(serverRow({ ip: '' }))).toBe(false);
  });
});

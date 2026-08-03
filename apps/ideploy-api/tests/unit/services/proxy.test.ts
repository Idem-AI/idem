/**
 * The Traefik container's own bootstrap.
 *
 * A dynamic label referencing `plugin.bouncer` or `plugin.geoblock` means
 * nothing to a Traefik instance that was never told the plugin exists — that
 * declaration belongs in the proxy's own static command, not in a per-application
 * label. Task 4.2 wired the bouncer's dynamic labels but never checked whether
 * anything told the proxy the plugin existed; this suite exists because that gap
 * would have made both the bouncer and geo-blocking silently inert regardless of
 * how correct every other label is.
 */
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { buildTraefikCompose } from '../../../api/services/proxy.service';

function command(): string[] {
  const doc = parse(buildTraefikCompose()) as {
    services: { traefik: { command: string[] } };
  };
  return doc.services.traefik.command;
}

describe('buildTraefikCompose', () => {
  it('produces valid YAML', () => {
    expect(() => parse(buildTraefikCompose())).not.toThrow();
  });

  it('declares the CrowdSec bouncer plugin, so plugin.bouncer labels are not inert', () => {
    const cmd = command();

    expect(cmd.some((f) => f.startsWith('--experimental.plugins.bouncer.modulename='))).toBe(true);
    expect(cmd.some((f) => f.includes('crowdsec-bouncer-traefik-plugin'))).toBe(true);
  });

  it('declares the geoblock plugin, so plugin.geoblock labels are not inert', () => {
    const cmd = command();

    expect(cmd.some((f) => f.startsWith('--experimental.plugins.geoblock.modulename='))).toBe(true);
    expect(cmd.some((f) => f.includes('PascalMinder/geoblock'))).toBe(true);
  });

  it('pins a version for each plugin', () => {
    // An unpinned plugin can change its option names on the maintainer's
    // schedule, not ours, and that failure is silent — a middleware that loads
    // with defaults, not an error.
    const cmd = command();

    expect(cmd.some((f) => f.startsWith('--experimental.plugins.bouncer.version='))).toBe(true);
    expect(cmd.some((f) => f.startsWith('--experimental.plugins.geoblock.version='))).toBe(true);
  });

  it('keeps the pre-existing entrypoints and providers', () => {
    const cmd = command();

    expect(cmd).toContain('--entrypoints.https.address=:443');
    expect(cmd).toContain('--providers.docker=true');
  });
});

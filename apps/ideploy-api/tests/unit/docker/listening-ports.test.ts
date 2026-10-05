/**
 * Reading what a container listens on, and choosing the port to route to.
 */
import { describe, expect, it } from 'vitest';
import { choosePort, parseExposedPorts, parseListeningPorts } from '../../../api/docker/listening-ports';

const table = (...rows: string[]) =>
  ['  sl  local_address rem_address   st tx_queue rx_queue', ...rows.map((r, i) => `   ${i}: ${r} 00000000:0000 0A 0 0 0`)].join('\n');

describe('parseListeningPorts', () => {
  it('reads listening sockets from /proc/net/tcp and tcp6', () => {
    const v4 = table('00000000:0050', '00000000:1F90'); // 0.0.0.0:80, 0.0.0.0:8080
    const v6 = table('00000000000000000000000000000000:1271'); // [::]:4721
    expect(parseListeningPorts(`${v4}\n${v6}`)).toEqual([80, 4721, 8080]);
  });

  it('ignores ports bound to loopback only, and connections that are not listening', () => {
    const rows = [
      table('0100007F:0CEA'), // 127.0.0.1:3306
      table('00000000000000000000000001000000:1538'), // [::1]:5432
      '   9: 00000000:0BB8 0A01A8C0:D431 01 0 0 0', // established, not listening
    ].join('\n');
    expect(parseListeningPorts(rows)).toEqual([]);
  });
});

describe('choosePort', () => {
  it('keeps the requested port when the application listens on it (it honoured PORT)', () => {
    expect(choosePort(3000, [3000, 9090], [])).toEqual({ port: 3000, source: 'requested' });
  });

  it('routes to the one port the container listens on, whatever was requested', () => {
    expect(choosePort(3000, [80], [80])).toEqual({ port: 80, source: 'measured' });
    expect(choosePort(3000, [4721], [])).toEqual({ port: 4721, source: 'measured' });
  });

  it('prefers what the image declares, then a common HTTP port, among several', () => {
    expect(choosePort(3000, [8080, 9000], [9000])).toEqual({ port: 9000, source: 'image' });
    expect(choosePort(3000, [8080, 9000], [])).toEqual({ port: 8080, source: 'common' });
    expect(choosePort(3000, [9000, 9100], [])).toEqual({ port: 9000, source: 'measured' });
  });

  it('keeps the requested port and says so when nothing listens', () => {
    expect(choosePort(3000, [], [80])).toEqual({ port: 3000, source: 'none' });
  });
});

describe('parseExposedPorts', () => {
  it('reads EXPOSE as docker reports it', () => {
    expect(parseExposedPorts('{"80/tcp":{},"53/udp":{}}')).toEqual([80]);
    expect(parseExposedPorts('null')).toEqual([]);
  });
});

/**
 * Which port an application really listens on.
 *
 * Nothing can be assumed about a customer's application: nginx serves on 80,
 * Spring on 8080, a home-grown server on 4721. The port configured for it — or
 * the default when nobody filled the field — is only a request (it is passed
 * as PORT, which most frameworks honour). What the proxy must route to is the
 * port the running container actually listens on, read from the kernel's own
 * socket table for its network namespace: no tool needed in the image.
 */

/** Where a routed port comes from, said in the deployment log. */
export type PortSource = 'requested' | 'measured' | 'image' | 'common' | 'none';

export interface PortChoice {
  port: number;
  source: PortSource;
}

/** Ports tried first when an application listens on several and nothing else decides. */
const COMMON_HTTP_PORTS = [80, 8080, 3000, 8000, 5000, 4200, 8081, 8888, 443];

/** TCP state "LISTEN" in /proc/net/tcp. */
const LISTEN = '0A';

/**
 * Listening ports from `/proc/<pid>/net/tcp` and `tcp6` content, excluding
 * those bound to loopback only (unreachable from the proxy anyway).
 */
export function parseListeningPorts(procNetTcp: string): number[] {
  const ports = new Set<number>();
  for (const line of procNetTcp.split('\n')) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 4 || cols[3] !== LISTEN) continue;
    const [ipHex, portHex] = cols[1].split(':');
    if (!ipHex || !portHex) continue;
    if (isLoopback(ipHex)) continue;
    const port = parseInt(portHex, 16);
    if (port > 0) ports.add(port);
  }
  return [...ports].sort((a, b) => a - b);
}

/**
 * 127.0.0.0/8 (stored little-endian: first octet last), ::1, and IPv4-mapped
 * ::ffff:127.x.
 */
function isLoopback(ipHex: string): boolean {
  const ip = ipHex.toUpperCase();
  if (ip.length === 8) return ip.endsWith('7F');
  if (ip === '00000000000000000000000001000000') return true;
  return ip.length === 32 && ip.startsWith('0000000000000000FFFF0000') && ip.endsWith('7F');
}

/** `{"80/tcp":{}}` (docker image inspect) → [80]. */
export function parseExposedPorts(json: string): number[] {
  try {
    const parsed = JSON.parse(json.trim() || 'null') as Record<string, unknown> | null;
    return Object.keys(parsed ?? {})
      .filter((p) => !p.endsWith('/udp'))
      .map((p) => parseInt(p, 10))
      .filter((p) => p > 0);
  } catch {
    return [];
  }
}

/**
 * The port to route to.
 *
 * What the container listens on wins. The requested port is kept when it is
 * among them (the application honoured PORT). Several ports: the one the image
 * declares, then a common HTTP port, then the lowest. Nothing listening: the
 * requested port stays, and the caller says the application serves no HTTP.
 */
export function choosePort(requested: number, listening: number[], exposed: number[]): PortChoice {
  if (listening.length === 0) return { port: requested, source: 'none' };
  if (listening.includes(requested)) return { port: requested, source: 'requested' };
  if (listening.length === 1) return { port: listening[0], source: 'measured' };
  const declared = listening.filter((p) => exposed.includes(p));
  if (declared.length === 1) return { port: declared[0], source: 'image' };
  const common = COMMON_HTTP_PORTS.find((p) => listening.includes(p));
  if (common) return { port: common, source: 'common' };
  return { port: listening[0], source: 'measured' };
}

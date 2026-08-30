/**
 * WebSocket entry point for interactive terminals.
 *
 * Mounted on the same HTTP server as the REST API so it shares its origin, and
 * therefore its cookie: the browser sends the `session` cookie on the upgrade
 * request exactly as it does on a fetch, and no second credential has to be
 * invented for the socket.
 *
 * The upgrade is authenticated before the socket is accepted. Rejecting at
 * upgrade time means an unauthenticated client never reaches the message loop.
 */
import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import logger from '../config/logger';
import { isDomainError } from '../utils/errors';
import {
  TerminalRequest,
  TerminalTargetKind,
  authenticateSocket,
  openSession,
} from '../services/terminal.service';

export const TERMINAL_PATH = '/ws/terminal';

/** Cross-origin upgrades are refused: the browser does not enforce CORS here. */
function originAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  const allowed = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return allowed.includes(origin);
}

function parseRequest(raw: unknown): TerminalRequest | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { kind, uuid, cols, rows } = raw as Record<string, unknown>;
  if (kind !== 'server' && kind !== 'application') return null;
  if (typeof uuid !== 'string' || !uuid) return null;
  return {
    kind: kind as TerminalTargetKind,
    uuid,
    cols: typeof cols === 'number' ? cols : undefined,
    rows: typeof rows === 'number' ? rows : undefined,
  };
}

export function registerTerminalGateway(server: HttpServer): void {
  // `noServer` so this shares the port with Express instead of taking its own.
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { url, headers } = req;
    if (!url || !url.startsWith(TERMINAL_PATH)) return;

    if (!originAllowed(headers.origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    authenticateSocket(req)
      .then((auth) => {
        if (!auth) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => attach(ws, auth));
      })
      .catch((err) => {
        logger.error('Terminal upgrade failed', { message: (err as Error).message });
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
      });
  });

  logger.info(`Terminal gateway registered on ${TERMINAL_PATH}`);
}

/**
 * The first frame names the target; everything after it is session traffic.
 *
 * Waiting for it before opening the SSH connection means a socket that is
 * opened and abandoned costs nothing on the remote host.
 */
function attach(ws: WebSocket, auth: { userId: number; teamId: number }): void {
  const openTimeout = setTimeout(() => {
    ws.send(JSON.stringify({ type: 'error', message: 'No target was requested.' }));
    ws.close();
  }, 10_000);

  ws.once('message', (raw) => {
    clearTimeout(openTimeout);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Malformed request.' }));
      ws.close();
      return;
    }

    const request = parseRequest(parsed);
    if (!request) {
      ws.send(JSON.stringify({ type: 'error', message: 'A target kind and uuid are required.' }));
      ws.close();
      return;
    }

    logger.info('Terminal session requested', {
      userId: auth.userId,
      teamId: auth.teamId,
      kind: request.kind,
      uuid: request.uuid,
    });

    openSession(ws, auth, request).catch((err) => {
      // Domain errors are the caller's to see; anything else stays in the log.
      const message = isDomainError(err)
        ? err.message
        : 'The session could not be opened. Check that the server is reachable.';
      if (!isDomainError(err)) {
        logger.error('Terminal session failed', {
          message: (err as Error).message,
          userId: auth.userId,
        });
      }
      ws.send(JSON.stringify({ type: 'error', message }));
      ws.close();
    });
  });
}

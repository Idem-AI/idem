/**
 * Interactive terminal sessions over WebSocket.
 *
 * Security model — the important part:
 *
 * The client names a *resource* (a server, or an application's container) and
 * never a command. The command is built here, from rows the caller's team owns.
 * The legacy terminal took an ssh invocation from the browser and tried to make
 * it safe by checking the target host against an allowlist; that defends one
 * field of a string the client fully controls. Not accepting the string at all
 * removes the question.
 *
 * A session is therefore: authenticate the cookie, resolve the target inside
 * the caller's team, open one SSH channel with a PTY, and pipe bytes. Anything
 * the user types goes to the remote shell's stdin — it is never interpreted
 * here, and never interpolated into a command line.
 */
import { IncomingMessage } from 'http';
import { WebSocket } from 'ws';
import { Client as SshClient, ClientChannel } from 'ssh2';
import * as cookie from 'cookie';
import pool from '../config/db.config';
import logger from '../config/logger';
import { ServerRow, PrivateKeyRow } from '../models/ideploy.types';
import { decryptString } from '../utils/laravel-crypto';
import { isLocalServer } from '../ssh/ssh';
import { verifySession, syncUser } from './idem-auth.service';
import { resolveCurrentTeam } from './user.service';
import * as serverService from './server.service';
import { notFound, unprocessable } from '../utils/errors';

/** What the client may ask to attach to. */
export type TerminalTargetKind = 'server' | 'application';

export interface TerminalRequest {
  kind: TerminalTargetKind;
  uuid: string;
  cols?: number;
  rows?: number;
}

/** Bounded so a hostile or buggy client cannot ask for a 10-million-column PTY. */
const MIN_DIMENSION = 1;
const MAX_COLS = 500;
const MAX_ROWS = 300;
const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 30;

/** Idle sessions are closed: an abandoned shell on a production host is a risk. */
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

function clampDimension(value: unknown, fallback: number, max: number): number {
  const n = typeof value === 'number' ? Math.floor(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, MIN_DIMENSION), max);
}

/**
 * Identify the caller from the same session cookie the HTTP API uses.
 *
 * WebSocket upgrades carry cookies but not the Express middleware chain, so the
 * check is repeated here rather than assumed. Returns null when unauthenticated
 * — the caller closes the socket.
 */
export async function authenticateSocket(
  req: IncomingMessage
): Promise<{ userId: number; teamId: number } | null> {
  const cookies = cookie.parse(req.headers.cookie || '');
  const session = cookies.session;
  if (!session) return null;

  const profile = await verifySession(session);
  if (!profile) return null;

  const user = await syncUser(profile);
  const teamId = await resolveCurrentTeam(user.id);
  if (!teamId) return null;

  return { userId: user.id, teamId };
}

interface ResolvedTarget {
  server: ServerRow;
  key: PrivateKeyRow;
  /**
   * The container to attach to, when the target is an application. Null means
   * a shell on the host itself.
   */
  containerName: string | null;
}

/**
 * Resolve what the client asked for into a server plus, optionally, a container.
 *
 * Every lookup is constrained to the caller's team: a uuid from the client is
 * only ever a filter, never a grant.
 */
async function resolveTarget(
  teamId: number,
  request: TerminalRequest
): Promise<ResolvedTarget> {
  if (request.kind === 'server') {
    const server = await serverService.getServer(teamId, request.uuid);
    if (!server) throw notFound('Server');
    const key = await serverService.getPrivateKey(teamId, server.private_key_id);
    if (!key) throw notFound('The private key configured for this server');
    return { server, key, containerName: null };
  }

  // An application runs on the server behind its destination.
  const { rows } = await pool.query(
    `SELECT a.uuid, sd.server_id
     FROM applications a
     JOIN environments e ON e.id = a.environment_id
     JOIN projects p ON p.id = e.project_id
     JOIN standalone_dockers sd ON sd.id = a.destination_id
     WHERE p.team_id = $1 AND a.uuid = $2
     LIMIT 1`,
    [teamId, request.uuid]
  );
  if (!rows[0]) throw notFound('Application');

  const server = await serverService.getServerById(teamId, Number(rows[0].server_id));
  if (!server) throw notFound('The server this application runs on');
  const key = await serverService.getPrivateKey(teamId, server.private_key_id);
  if (!key) throw notFound('The private key configured for this server');

  // Container naming follows the deployment convention: `<app-uuid>`.
  return { server, key, containerName: String(rows[0].uuid) };
}

/**
 * The remote command for a session.
 *
 * The only variable part is a uuid that came out of our own database and
 * matches `^[a-z0-9-]+$`; it is re-checked here so a malformed row can never
 * reach a shell. Returning null means "plain login shell".
 */
function buildRemoteCommand(target: ResolvedTarget): string | null {
  if (!target.containerName) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(target.containerName)) {
    throw unprocessable('TERMINAL_BAD_TARGET', 'This resource cannot be attached to.');
  }
  // `sh` as the fallback: not every image ships bash.
  return `docker exec -it ${target.containerName} sh -c 'command -v bash >/dev/null && exec bash || exec sh'`;
}

/** Frames the browser receives. Everything else on the wire is raw output. */
type ServerFrame =
  | { type: 'ready' }
  | { type: 'data'; data: string }
  | { type: 'exit'; code: number | null }
  | { type: 'error'; message: string };

function send(ws: WebSocket, frame: ServerFrame): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame));
}

/**
 * Open an interactive session and pipe it to the socket until either end closes.
 *
 * Local servers are refused rather than silently downgraded: a shell on the API
 * container is not what "terminal into my server" means, and handing one out
 * because the host happened to be `localhost` would be a surprise with root
 * attached to it.
 */
export async function openSession(
  ws: WebSocket,
  auth: { userId: number; teamId: number },
  request: TerminalRequest
): Promise<void> {
  const target = await resolveTarget(auth.teamId, request);

  if (isLocalServer(target.server)) {
    throw unprocessable(
      'TERMINAL_LOCAL_UNSUPPORTED',
      'Interactive sessions are not available on the local server.'
    );
  }

  const command = buildRemoteCommand(target);
  const cols = clampDimension(request.cols, DEFAULT_COLS, MAX_COLS);
  const rows = clampDimension(request.rows, DEFAULT_ROWS, MAX_ROWS);

  const conn = new SshClient();
  let channel: ClientChannel | null = null;
  let idleTimer: NodeJS.Timeout;

  const closeAll = (): void => {
    clearTimeout(idleTimer);
    try {
      channel?.end();
    } catch {
      /* already gone */
    }
    conn.end();
    if (ws.readyState === WebSocket.OPEN) ws.close();
  };

  const touch = (): void => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      send(ws, { type: 'error', message: 'Session closed after 15 minutes of inactivity.' });
      closeAll();
    }, IDLE_TIMEOUT_MS);
  };

  await new Promise<void>((resolve, reject) => {
    conn
      .on('ready', () => {
        const opts = { term: 'xterm-256color', cols, rows };
        const handler = (err: Error | undefined, stream: ClientChannel): void => {
          if (err) {
            reject(err);
            return;
          }
          channel = stream;
          send(ws, { type: 'ready' });
          touch();

          stream.on('data', (chunk: Buffer) => send(ws, { type: 'data', data: chunk.toString('utf8') }));
          stream.stderr?.on('data', (chunk: Buffer) =>
            send(ws, { type: 'data', data: chunk.toString('utf8') })
          );
          stream.on('close', (code: number | null) => {
            send(ws, { type: 'exit', code: code ?? null });
            closeAll();
            resolve();
          });
        };

        // A command still gets a PTY: `docker exec -it` needs one to be interactive.
        if (command) {
          conn.exec(command, { pty: opts }, handler);
        } else {
          conn.shell(opts, handler);
        }
      })
      .on('error', (err) => reject(err))
      .connect({
        host: target.server.ip,
        port: target.server.port,
        username: target.server.user,
        privateKey: decryptString(target.key.private_key),
        readyTimeout: 15_000,
        keepaliveInterval: 20_000,
      });

    // Client → remote. Input is written to the shell's stdin verbatim; it is
    // never parsed or interpolated into a command on this side.
    ws.on('message', (raw) => {
      touch();
      let message: { type?: string; data?: unknown; cols?: unknown; rows?: unknown };
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!channel) return;

      if (message.type === 'data' && typeof message.data === 'string') {
        channel.write(message.data);
      } else if (message.type === 'resize') {
        channel.setWindow(
          clampDimension(message.rows, DEFAULT_ROWS, MAX_ROWS),
          clampDimension(message.cols, DEFAULT_COLS, MAX_COLS),
          0,
          0
        );
      }
    });

    ws.on('close', () => {
      closeAll();
      resolve();
    });
    ws.on('error', () => {
      closeAll();
      resolve();
    });
  });

  logger.info('Terminal session ended', {
    userId: auth.userId,
    teamId: auth.teamId,
    kind: request.kind,
    serverUuid: target.server.uuid,
  });
}

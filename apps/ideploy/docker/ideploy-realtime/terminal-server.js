/**
 * Lightweight WebSocket terminal server — port 6002.
 *
 * Runs inside the ideploy-realtime container alongside Soketi.
 * Accepts connections, spawns a shell (or runs docker exec for a named
 * container), and pipes bytes in both directions.
 *
 * Frame protocol (JSON on the wire, same as ideploy-api/ws/terminal.gateway):
 *   Client → server: { type: "data", data: "<stdin string>" }
 *                    { type: "resize", cols: N, rows: N }
 *   Server → client: { type: "ready" }
 *                    { type: "data", data: "<stdout/stderr string>" }
 *                    { type: "exit",  code: N | null }
 *                    { type: "error", message: "..." }
 *
 * Query-string parameters (ws://host:6002?container=<name>&cols=80&rows=30):
 *   container  — when present, runs `docker exec -it <container> sh`
 *                when absent,  opens a plain /bin/sh on the host
 */

'use strict';

const http = require('http');
const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');

const PORT = parseInt(process.env.TERMINAL_PORT || '6002', 10);
const IDLE_MS = 15 * 60 * 1000;

const server = http.createServer((_req, res) => {
  res.writeHead(200);
  res.end('terminal-server ok\n');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const container = url.searchParams.get('container') || '';
  const cols = Math.min(500, Math.max(1, parseInt(url.searchParams.get('cols') || '80', 10)));
  const rows = Math.min(300, Math.max(1, parseInt(url.searchParams.get('rows') || '30', 10)));

  let cmd, args;
  if (container && /^[A-Za-z0-9_-]+$/.test(container)) {
    cmd = 'docker';
    args = ['exec', '-e', `COLUMNS=${cols}`, '-e', `LINES=${rows}`, '-i', container,
            'sh', '-c', 'command -v bash >/dev/null && exec bash || exec sh'];
  } else {
    cmd = '/bin/sh';
    args = [];
  }

  const proc = spawn(cmd, args, {
    env: { ...process.env, TERM: 'xterm-256color', COLUMNS: String(cols), LINES: String(rows) },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const send = (frame) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(frame));
  };

  let idleTimer;
  const touch = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      send({ type: 'error', message: 'Session closed after 15 minutes of inactivity.' });
      ws.close();
    }, IDLE_MS);
  };

  send({ type: 'ready' });
  touch();

  proc.stdout.on('data', (chunk) => send({ type: 'data', data: chunk.toString('utf8') }));
  proc.stderr.on('data', (chunk) => send({ type: 'data', data: chunk.toString('utf8') }));
  proc.on('close', (code) => {
    clearTimeout(idleTimer);
    send({ type: 'exit', code: code ?? null });
    if (ws.readyState === ws.OPEN) ws.close();
  });
  proc.on('error', (err) => {
    clearTimeout(idleTimer);
    send({ type: 'error', message: err.message });
    ws.close();
  });

  ws.on('message', (raw) => {
    touch();
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!proc.stdin.writable) return;

    if (msg.type === 'data' && typeof msg.data === 'string') {
      proc.stdin.write(msg.data);
    } else if (msg.type === 'resize') {
      // node child_process doesn't expose setWindow; signal the process instead
      const c = Math.min(500, Math.max(1, parseInt(msg.cols, 10) || cols));
      const r = Math.min(300, Math.max(1, parseInt(msg.rows, 10) || rows));
      try {
        process.kill(proc.pid, 'SIGWINCH');
        proc.stdin.write(`\x1b[8;${r};${c}t`);
      } catch { /* process already gone */ }
    }
  });

  ws.on('close', () => { clearTimeout(idleTimer); proc.kill(); });
  ws.on('error', () => { clearTimeout(idleTimer); proc.kill(); });
});

server.listen(PORT, () => {
  console.log(`terminal-server listening on :${PORT}`);
});

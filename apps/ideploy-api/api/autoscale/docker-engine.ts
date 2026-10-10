/**
 * The few Docker Engine calls the autoscaler needs, over the local socket
 * (/var/run/docker.sock, already mounted in the iDeploy containers). No CLI in
 * the image: plain HTTP on the unix socket.
 */
import http from 'http';

const SOCKET = process.env.DOCKER_SOCKET || '/var/run/docker.sock';

export interface WorkerContainer {
  id: string;
  name: string;
  running: boolean;
  /** `fixed` (always on) or `elastic` (started and stopped by the autoscaler). */
  kind: string;
}

function request<T>(method: string, path: string, timeoutMs = 15_000): Promise<{ status: number; body: T | null }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ socketPath: SOCKET, method, path, timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let body: T | null = null;
        try {
          body = data ? (JSON.parse(data) as T) : null;
        } catch {
          body = null;
        }
        resolve({ status: res.statusCode ?? 0, body });
      });
    });
    req.on('timeout', () => req.destroy(new Error(`docker ${method} ${path} timed out`)));
    req.on('error', reject);
    req.end();
  });
}

/** Containers labelled `ideploy.worker` (fixed or elastic), running or not. */
export async function listWorkers(): Promise<WorkerContainer[]> {
  const filters = encodeURIComponent(JSON.stringify({ label: ['ideploy.worker'] }));
  const { status, body } = await request<{ Id: string; Names: string[]; State: string; Labels: Record<string, string> }[]>(
    'GET',
    `/containers/json?all=true&filters=${filters}`
  );
  if (status !== 200 || !body) throw new Error(`docker: listing containers answered ${status}`);
  return body.map((c) => ({
    id: c.Id,
    name: (c.Names[0] ?? '').replace(/^\//, ''),
    running: c.State === 'running',
    kind: c.Labels['ideploy.worker'] ?? '',
  }));
}

export async function startContainer(id: string): Promise<void> {
  const { status } = await request('POST', `/containers/${id}/start`);
  if (status !== 204 && status !== 304) throw new Error(`docker: start answered ${status}`);
}

/**
 * Stop with a grace period: the worker finishes its running jobs (graceful
 * shutdown) before Docker kills it. Not awaited by the caller.
 */
export async function stopContainer(id: string, graceSeconds: number): Promise<void> {
  const { status } = await request('POST', `/containers/${id}/stop?t=${graceSeconds}`, (graceSeconds + 30) * 1000);
  if (status !== 204 && status !== 304) throw new Error(`docker: stop answered ${status}`);
}

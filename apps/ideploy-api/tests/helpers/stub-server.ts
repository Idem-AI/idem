/**
 * A real HTTP server, in process, for testing HTTP clients.
 *
 * Preferred over mocking the HTTP library: the bugs that matter in a client are
 * in the shape of what it sends — the header the key goes in, whether a filter
 * lands in the query string or the body, how a path is escaped. A mock asserts
 * the call we *think* we make; a server observes the request actually sent.
 */
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { AddressInfo } from 'net';

export interface RecordedRequest {
  method: string;
  /** Path without the query string. */
  path: string;
  query: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
  /** Parsed JSON body, or undefined when there was none. */
  body?: unknown;
  /** Body exactly as received. */
  rawBody: string;
}

export interface StubResponse {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

type Handler = (request: RecordedRequest) => StubResponse | undefined;

export class StubServer {
  private server: Server | null = null;
  private handlers: Array<{ match: (r: RecordedRequest) => boolean; respond: Handler }> = [];

  readonly requests: RecordedRequest[] = [];
  /** Response used when no handler matches. */
  private fallback: StubResponse = { status: 200, body: [] };

  /** Base URL to point a client at. Valid once `start()` has resolved. */
  url = '';

  async start(): Promise<void> {
    this.server = createServer((req, res) => void this.handle(req, res));
    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
    const { port } = this.server!.address() as AddressInfo;
    this.url = `http://127.0.0.1:${port}`;
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve) => this.server!.close(() => resolve()));
    this.server = null;
  }

  /** Respond to requests matching `method` and `path`. First match wins. */
  on(method: string, path: string, response: StubResponse | Handler): this {
    const respond: Handler = typeof response === 'function' ? response : () => response;
    this.handlers.push({
      match: (r) => r.method === method.toUpperCase() && r.path === path,
      respond,
    });
    return this;
  }

  /** Response for anything unmatched. */
  otherwise(response: StubResponse): this {
    this.fallback = response;
    return this;
  }

  reset(): void {
    this.requests.length = 0;
    this.handlers.length = 0;
    this.fallback = { status: 200, body: [] };
  }

  /** The single request received, failing the intent if there was not exactly one. */
  lastRequest(): RecordedRequest {
    const last = this.requests.at(-1);
    if (!last) throw new Error('The stub server received no request.');
    return last;
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const rawBody = Buffer.concat(chunks).toString('utf8');

    const url = new URL(req.url ?? '/', 'http://localhost');
    const recorded: RecordedRequest = {
      method: (req.method ?? 'GET').toUpperCase(),
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      headers: req.headers,
      rawBody,
      body: rawBody ? safeParse(rawBody) : undefined,
    };
    this.requests.push(recorded);

    const handler = this.handlers.find((h) => h.match(recorded));
    const response = handler?.respond(recorded) ?? this.fallback;

    for (const [name, value] of Object.entries(response.headers ?? {})) {
      res.setHeader(name, value);
    }
    res.statusCode = response.status ?? 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(response.body === undefined ? '' : JSON.stringify(response.body));
  }
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/**
 * Le CLIENT MCP du moteur : il démarre un serveur déclaré dans `.mcp.json` (racine du dépôt) et appelle
 * ses outils au travers d'une interface TYPÉE.
 *
 * Usage borné, par décision : les serveurs MCP servent les outils de développement et de contrôle (audit
 * d'accessibilité des rendus, documentation à jour d'une bibliothèque, recherche d'icônes) — jamais la
 * génération en production, qui ne lance aucun processus tiers. Le SDK MCP est chargé à la demande : son
 * absence ne casse rien, la capacité est simplement indisponible.
 */
import fs from 'fs';
import path from 'path';

export const REPO_ROOT = path.resolve(__dirname, '../../../../..');

export interface ServerConfig {
  type?: 'stdio' | 'http';
  /** Serveur local (stdio). */
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  /** Serveur distant (HTTP « streamable »). */
  url?: string;
  headers?: Record<string, string>;
}

/** Les serveurs déclarés dans `.mcp.json` (les `${VAR}` y sont développés depuis l'environnement). */
export function listServers(file = path.join(REPO_ROOT, '.mcp.json')): Record<string, ServerConfig> {
  if (!fs.existsSync(file)) return {};
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as { mcpServers?: Record<string, ServerConfig> };
  const expand = (v: string) => v.replace(/\$\{([A-Z0-9_]+)(?::-([^}]*))?\}/g, (_m, name: string, fallback?: string) => process.env[name] ?? fallback ?? '');
  const mapValues = (o?: Record<string, string>) => Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [k, expand(v)]));
  const out: Record<string, ServerConfig> = {};
  for (const [name, cfg] of Object.entries(raw.mcpServers ?? {})) {
    out[name] = cfg.url
      ? { type: 'http', url: expand(cfg.url), headers: mapValues(cfg.headers) }
      : { type: 'stdio', command: cfg.command, args: (cfg.args ?? []).map(expand), env: mapValues(cfg.env) };
  }
  return out;
}

export interface McpTool {
  name: string;
  description?: string;
  required?: string[];
}

export interface McpSession {
  listTools(): Promise<McpTool[]>;
  call(tool: string, args: Record<string, unknown>): Promise<string>;
  close(): Promise<void>;
}

export function mcpAvailable(): boolean {
  try {
    require.resolve('@modelcontextprotocol/sdk/client/index.js');
    return true;
  } catch {
    return false;
  }
}

/** Démarre le serveur `name` et ouvre une session. */
export async function connect(name: string, options: { timeoutMs?: number } = {}): Promise<McpSession> {
  const config = listServers()[name];
  if (!config) throw new Error(`serveur MCP « ${name} » absent de .mcp.json`);
  if (!mcpAvailable()) throw new Error('SDK MCP (@modelcontextprotocol/sdk) introuvable');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
  let transport: unknown;
  if (config.type === 'http' && config.url) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
    transport = new StreamableHTTPClientTransport(new URL(config.url), { requestInit: { headers: config.headers ?? {} } });
  } else {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
    transport = new StdioClientTransport({ command: config.command, args: config.args ?? [], env: { ...(process.env as Record<string, string>), ...(config.env ?? {}) }, cwd: REPO_ROOT, stderr: 'ignore' });
  }
  const client = new Client({ name: 'idem-graphic-engine', version: '1.0.0' });
  const timeout = options.timeoutMs ?? 60_000;
  await Promise.race([client.connect(transport), new Promise((_, reject) => setTimeout(() => reject(new Error(`délai dépassé au démarrage de « ${name} »`)), timeout))]);
  return {
    async listTools() {
      const out = await client.listTools();
      return (out.tools ?? []).map((t: { name: string; description?: string; inputSchema?: { required?: string[] } }) => ({ name: t.name, description: t.description, required: t.inputSchema?.required }));
    },
    async call(tool, args) {
      const res = await client.callTool({ name: tool, arguments: args });
      const parts = (res.content ?? []) as Array<{ type: string; text?: string }>;
      return parts
        .filter((p) => p.type === 'text')
        .map((p) => p.text ?? '')
        .join('\n');
    },
    async close() {
      await client.close().catch(() => undefined);
    },
  };
}

/** Appel unique : démarrer, appeler, fermer. */
export async function callTool(server: string, tool: string, args: Record<string, unknown>, options: { timeoutMs?: number } = {}): Promise<string> {
  const session = await connect(server, options);
  try {
    return await session.call(tool, args);
  } finally {
    await session.close();
  }
}

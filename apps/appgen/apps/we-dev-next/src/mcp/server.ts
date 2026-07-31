/**
 * MCP endpoint exposing the skill catalog, the design token forge and the slop
 * linter to any MCP client (Claude Code, Cursor, the Idem API).
 *
 * Transport: Streamable HTTP, stateless. A stateless server needs only the POST
 * half of the transport — one JSON-RPC request in, one JSON response out — so
 * this is a couple of hundred lines rather than an SDK dependency. GET and
 * DELETE answer 405, which the spec allows for servers that offer no
 * server-initiated stream and no sessions.
 *
 * appgen itself does *not* go through this endpoint: the builder imports the
 * registry directly, so the critical path pays no network round trip. The
 * endpoint exists so the same catalog is reusable outside appgen without
 * becoming a second copy.
 *
 * Spec: https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
 */

import { Router, Request, Response } from 'express';
import { getSkill, getSkillReference, listSkillMeta } from '../skills/registry.js';
import { forgeDesignSystem, renderDesignBrief } from '../design/tokenForge.js';
import { buildRepairPrompt, lintGeneratedFiles } from '../design/slopLint.js';
import { ProjectModel } from '../types/project.js';

const SERVER_INFO = { name: 'appgen-skills', version: '1.0.0' };

const LATEST_PROTOCOL_VERSION = '2025-06-18';
const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
/** The spec's fallback when the client sends no MCP-Protocol-Version header. */
const ASSUMED_PROTOCOL_VERSION = '2025-03-26';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, any>;
}

const ERROR_CODES = {
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internalError: -32603,
} as const;

const text = (value: string) => ({ content: [{ type: 'text', text: value }] });
const json = (value: unknown) => text(JSON.stringify(value, null, 2));

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  handler: (args: Record<string, any>) => { content: Array<{ type: string; text: string }>; isError?: boolean };
}

const TOOLS: ToolDefinition[] = [
  {
    name: 'list_skills',
    description:
      'List every design skill with its name, description, tier and token cost. Progressive disclosure tier 1: read this first, then fetch only the skills you need.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => json(listSkillMeta()),
  },
  {
    name: 'get_skill',
    description:
      'Fetch the full body of one skill by name. Progressive disclosure tier 2. Use list_skills to discover valid names.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Skill name, e.g. "anti-slop".' } },
      required: ['name'],
      additionalProperties: false,
    },
    handler: ({ name }) => {
      const skill = getSkill(String(name));
      return skill
        ? text(skill.body)
        : { ...text(`No skill named "${name}". Call list_skills for valid names.`), isError: true };
    },
  },
  {
    name: 'get_skill_reference',
    description:
      'Fetch a deep-dive reference bundled with a skill. Progressive disclosure tier 3: only load this when the skill body points at it.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Skill name.' },
        reference: { type: 'string', description: 'Reference name as cited in the skill body.' },
      },
      required: ['name', 'reference'],
      additionalProperties: false,
    },
    handler: ({ name, reference }) => {
      const body = getSkillReference(String(name), String(reference));
      return body
        ? text(body)
        : { ...text(`No reference "${reference}" for skill "${name}".`), isError: true };
    },
  },
  {
    name: 'forge_design_tokens',
    description:
      'Compute a complete, contrast-verified design system (art direction, font pairing, OKLCH palette, Tailwind theme, type scale) from a project name and optional brand colours. Deterministic: the same project always yields the same system, and different projects yield visibly different ones.',
    inputSchema: {
      type: 'object',
      properties: {
        projectName: { type: 'string', description: 'Project name; seeds the art direction.' },
        projectId: {
          type: 'string',
          description: 'Stable id. Preferred over the name as the seed when available.',
        },
        description: { type: 'string' },
        primaryColor: { type: 'string', description: 'Brand colour as hex, e.g. "#C2410C".' },
        accentColor: { type: 'string', description: 'Accent colour as hex.' },
        primaryFont: { type: 'string', description: 'Overrides the seeded display family.' },
        secondaryFont: { type: 'string', description: 'Overrides the seeded body family.' },
        register: {
          type: 'string',
          enum: ['marketing', 'product'],
          description: 'marketing = design is the product; product = design serves the product.',
        },
      },
      required: ['projectName'],
      additionalProperties: false,
    },
    handler: (args) => {
      const project: ProjectModel = {
        id: args.projectId ? String(args.projectId) : undefined,
        name: String(args.projectName),
        description: args.description ? String(args.description) : '',
        type: 'web',
        analysisResultModel: {
          branding: {
            ...(args.primaryColor || args.accentColor
              ? {
                  colors: {
                    name: 'provided',
                    url: '',
                    colors: {
                      primary: String(args.primaryColor ?? ''),
                      secondary: '',
                      accent: String(args.accentColor ?? ''),
                      background: '',
                      text: '',
                    },
                  },
                }
              : {}),
            ...(args.primaryFont
              ? {
                  typography: {
                    name: 'provided',
                    url: '',
                    primaryFont: String(args.primaryFont),
                    secondaryFont: String(args.secondaryFont ?? args.primaryFont),
                  },
                }
              : {}),
          },
          development: {
            configs: {
              landingPageConfig: args.register === 'product' ? 'NONE' : 'ONLY_LANDING',
            },
          },
        },
      };

      return text(renderDesignBrief(forgeDesignSystem(project)));
    },
  },
  {
    name: 'lint_ui',
    description:
      'Scan generated UI files for the markers that make an interface read as machine-made (purple gradients, gradient text, Inter, repeated uppercase eyebrows, identical card grids, marketing buzzwords, low-contrast greys, missing alt text, a missing bootstrap script). Returns violations plus a ready-to-send repair prompt.',
    inputSchema: {
      type: 'object',
      properties: {
        files: {
          type: 'object',
          description: 'Map of file path to file contents.',
          additionalProperties: { type: 'string' },
        },
      },
      required: ['files'],
      additionalProperties: false,
    },
    handler: ({ files }) => {
      if (!files || typeof files !== 'object' || Array.isArray(files)) {
        return { ...text('`files` must be an object mapping paths to contents.'), isError: true };
      }

      const report = lintGeneratedFiles(files as Record<string, string>);

      return json({
        ...report,
        repairPrompt: buildRepairPrompt(report, files as Record<string, string>),
      });
    },
  },
];

function handleRpc(request: JsonRpcRequest): Record<string, any> | undefined {
  const { method, params = {}, id } = request;
  const reply = (result: unknown) => ({ jsonrpc: '2.0' as const, id, result });
  const fail = (code: number, message: string) => ({
    jsonrpc: '2.0' as const,
    id,
    error: { code, message },
  });

  switch (method) {
    case 'initialize': {
      const requested = String(params.protocolVersion ?? LATEST_PROTOCOL_VERSION);

      return reply({
        protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
          ? requested
          : LATEST_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          'Design skills for generating interfaces that do not read as machine-made. Start with list_skills, then forge_design_tokens for the project, and lint_ui on the result.',
      });
    }

    case 'ping':
      return reply({});

    case 'tools/list':
      return reply({
        tools: TOOLS.map(({ name, description, inputSchema }) => ({
          name,
          description,
          inputSchema,
        })),
      });

    case 'tools/call': {
      const tool = TOOLS.find((candidate) => candidate.name === params.name);

      if (!tool) {
        return fail(ERROR_CODES.invalidParams, `Unknown tool: ${params.name}`);
      }

      try {
        return reply(tool.handler(params.arguments ?? {}));
      } catch (error) {
        // A thrown handler is a tool failure, not a protocol failure: report it
        // in-band so the model can react instead of the client seeing a crash.
        return reply({
          ...text(error instanceof Error ? error.message : String(error)),
          isError: true,
        });
      }
    }

    default:
      // Notifications carry no id and expect no reply.
      return id === undefined || id === null
        ? undefined
        : fail(ERROR_CODES.methodNotFound, `Unknown method: ${method}`);
  }
}

/**
 * Blocks DNS-rebinding: a browser page on another origin must not be able to
 * drive this endpoint. Non-browser clients send no Origin and are allowed.
 */
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }

  const allowList = (process.env.MCP_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (allowList.includes(origin)) {
    return true;
  }

  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

const router = Router();

router.post('/', (req: Request, res: Response) => {
  if (!isOriginAllowed(req.headers.origin as string | undefined)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  const protocolVersion = (req.headers['mcp-protocol-version'] as string) ?? ASSUMED_PROTOCOL_VERSION;

  if (!SUPPORTED_PROTOCOL_VERSIONS.includes(protocolVersion)) {
    return res.status(400).json({
      error: `Unsupported MCP-Protocol-Version: ${protocolVersion}`,
      supported: SUPPORTED_PROTOCOL_VERSIONS,
    });
  }

  const body = req.body as JsonRpcRequest | JsonRpcRequest[];
  const batch = Array.isArray(body) ? body : [body];

  if (!batch.length || batch.some((message) => message?.jsonrpc !== '2.0')) {
    return res.status(400).json({
      jsonrpc: '2.0',
      id: null,
      error: { code: ERROR_CODES.invalidRequest, message: 'Expected JSON-RPC 2.0 message(s)' },
    });
  }

  const responses = batch
    .map((message) => handleRpc(message))
    .filter((response): response is Record<string, any> => response !== undefined);

  // Notifications and responses only: the spec asks for 202 with no body.
  if (!responses.length) {
    return res.status(202).end();
  }

  return res.json(Array.isArray(body) ? responses : responses[0]);
});

// No server-initiated stream and no sessions, so both are explicitly declined.
router.get('/', (_req: Request, res: Response) => res.status(405).send('Method Not Allowed'));
router.delete('/', (_req: Request, res: Response) => res.status(405).send('Method Not Allowed'));

export default router;

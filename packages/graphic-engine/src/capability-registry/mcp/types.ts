/** Le manifeste des outils MCP du projet (écrit par `npm run mcp:sync`, relu par le registre). */
export interface McpToolEntry {
  name: string;
  /** Une ligne : ce que l'outil fait. */
  summary: string;
  /** Les arguments obligatoires. */
  required?: string[];
}

export interface McpManifest {
  generatedFrom: string;
  servers: Record<string, { tools: McpToolEntry[] }>;
}

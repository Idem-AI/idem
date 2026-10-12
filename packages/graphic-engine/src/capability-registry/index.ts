/**
 * LE REGISTRE DE CAPACITÉS GRAPHIQUES.
 *
 * Ce que le moteur sait faire et avec quoi : composants, motifs de composition, formes du kit, graphiques,
 * icônes, polices, outils MCP, documentation. Chaque capacité déclare ce qu'elle fournit, sa licence, ses
 * dépendances, son coût observé (jetons, durée, réseau) et sa disponibilité.
 *
 * Deux usages, deux tailles :
 *  · l'INDEX compact (une ligne par capacité) — ce qu'un agent reçoit pour découvrir les capacités sans
 *    la documentation de toutes les bibliothèques ;
 *  · la DOCUMENTATION détaillée d'UNE capacité — chargée seulement à la demande.
 *
 * RÈGLE DE PRIORITÉ : composant LOCAL fiable, puis OUTIL disponible (MCP), puis génération spécifique.
 */
import type { DocumentType } from '../contracts/common';
import { allComponents } from '../design-system/components/registry';
import { allPatterns } from '../design-system/patterns/registry';
import { SHAPES } from '../design-system/kit/shapes';
import { iconCount, iconSetAvailable } from './local/icons';
import { listServers, mcpAvailable } from './mcp/client';
import type { McpManifest } from './mcp/types';
import manifestJson from './mcp/manifest.json';

export type Tier = 'local' | 'tool' | 'generated';
export type CapabilityKind = 'component' | 'pattern' | 'shapes' | 'icons' | 'fonts' | 'mcp-tool' | 'documentation';

export interface Capability {
  id: string;
  kind: CapabilityKind;
  tier: Tier;
  summary: string;
  provides: string[];
  deliverables?: DocumentType[];
  license?: string;
  dependencies?: string[];
  cost?: { tokens?: number; ms?: number; network?: boolean };
  available: () => boolean;
  /** Documentation détaillée, chargée à la demande. */
  docs?: () => string;
}

const TIER_RANK: Record<Tier, number> = { local: 0, tool: 1, generated: 2 };

const FAMILY_DELIVERABLES: Record<string, DocumentType[]> = {
  slide: ['pitch-deck', 'brand-charter'],
  document: ['business-plan', 'report'],
  card: ['business-card'],
  visual: ['flyer'],
  cover: ['flyer', 'brand-charter'],
};

export class CapabilityRegistry {
  private readonly items = new Map<string, Capability>();

  register(capability: Capability): void {
    this.items.set(capability.id, capability);
  }

  get(id: string): Capability | undefined {
    return this.items.get(id);
  }

  list(filter: { kind?: CapabilityKind; tier?: Tier; deliverable?: DocumentType; provides?: string; availableOnly?: boolean } = {}): Capability[] {
    return [...this.items.values()].filter(
      (c) =>
        (!filter.kind || c.kind === filter.kind) &&
        (!filter.tier || c.tier === filter.tier) &&
        (!filter.deliverable || !c.deliverables || c.deliverables.includes(filter.deliverable)) &&
        (!filter.provides || c.provides.includes(filter.provides)) &&
        (!filter.availableOnly || c.available())
    );
  }

  /** L'index compact d'un agent : une ligne par capacité DISPONIBLE, borné en signes. */
  index(filter: Parameters<CapabilityRegistry['list']>[0] = {}, maxChars = 2400): string {
    const lines: string[] = [];
    let size = 0;
    for (const c of this.list({ ...filter, availableOnly: true }).sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || a.id.localeCompare(b.id))) {
      const line = `${c.id} [${c.tier}] — ${c.summary}`;
      if (size + line.length + 1 > maxChars) break;
      lines.push(line);
      size += line.length + 1;
    }
    return lines.join('\n');
  }

  /** La documentation détaillée d'une capacité (à la demande seulement). */
  docs(id: string): string {
    const c = this.items.get(id);
    if (!c) return '';
    return [`${c.id} (${c.kind}, ${c.tier})`, c.summary, c.license ? `Licence : ${c.license}` : '', c.dependencies?.length ? `Dépendances : ${c.dependencies.join(', ')}` : '', c.docs?.() ?? ''].filter(Boolean).join('\n');
  }

  /** La meilleure capacité disponible pour un besoin : local d'abord, puis outil, puis génération. */
  resolve(need: string, deliverable?: DocumentType): Capability | undefined {
    return this.list({ provides: need, deliverable, availableOnly: true }).sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier])[0];
  }
}

/** Importé (et non lu sur le disque) : le manifeste suit le code compilé, dans le paquet comme dans une application. */
function loadManifest(): McpManifest | null {
  return (manifestJson as unknown as McpManifest) ?? null;
}

const MCP_NOTES: Record<string, { license: string; network: boolean; provides: string[] }> = {
  context7: { license: 'MIT (serveur distant Upstash)', network: true, provides: ['library-docs'] },
  'chrome-devtools': { license: 'Apache-2.0 (Google)', network: false, provides: ['render-screenshot', 'browser-eval'] },
  a11y: { license: 'MPL-2.0 (axe-core)', network: false, provides: ['accessibility-audit'] },
  iconify: { license: 'MIT (API publique Iconify)', network: true, provides: ['icon-search', 'icons'] },
};

export function createDefaultRegistry(): CapabilityRegistry {
  const r = new CapabilityRegistry();
  for (const c of allComponents()) {
    r.register({
      id: c.id,
      kind: 'component',
      tier: 'local',
      summary: c.summary,
      provides: [...c.kinds, ...(c.elastic ? ['elastic'] : [])],
      deliverables: c.deliverables,
      license: 'propriétaire IDEM',
      cost: { tokens: 0 },
      available: () => true,
      docs: () => `Variantes : ${Object.entries(c.variants).map(([k, v]) => `${k} ∈ {${v.join(' | ')}}`).join(' ; ') || 'aucune'}\nDéfaut : ${JSON.stringify(c.defaults)}`,
    });
  }
  for (const p of allPatterns()) {
    r.register({
      id: p.id,
      kind: 'pattern',
      tier: 'local',
      summary: p.summary,
      provides: [p.family, ...(p.roles ?? []), ...p.tags],
      deliverables: FAMILY_DELIVERABLES[p.family],
      cost: { tokens: 0 },
      available: () => true,
      docs: () => `Paramètres : ${Object.entries(p.params).map(([k, v]) => `${k} ∈ {${v.join(' | ')}}`).join(' ; ') || 'aucun'}\nÉtiquettes : ${p.tags.join(', ')}`,
    });
  }
  r.register({
    id: 'kit.shapes',
    kind: 'shapes',
    tier: 'local',
    summary: `${SHAPES.length} formes nommées dessinées par le code (une ligne de plan au lieu d'un SVG écrit à la main).`,
    provides: ['shapes', 'decor'],
    license: 'propriétaire IDEM',
    cost: { tokens: 0 },
    available: () => true,
    docs: () => `Formes : ${SHAPES.join(', ')}. Tons : brand, accent, soft, ink, on-brand. Tailles : fill, sm, md, lg.`,
  });
  r.register({
    id: 'icons.tabler',
    kind: 'icons',
    tier: 'local',
    summary: `Icônes au trait Tabler (${iconCount('tabler')}), hors ligne.`,
    provides: ['icons'],
    license: 'MIT',
    dependencies: ['@tabler/icons'],
    cost: { tokens: 0, network: false },
    available: () => iconSetAvailable('tabler'),
  });
  r.register({
    id: 'icons.lucide',
    kind: 'icons',
    tier: 'local',
    summary: `Icônes Lucide (${iconCount('lucide')}), hors ligne.`,
    provides: ['icons'],
    license: 'ISC',
    dependencies: ['lucide-static'],
    cost: { tokens: 0, network: false },
    available: () => iconSetAvailable('lucide'),
  });
  r.register({
    id: 'fonts.google',
    kind: 'fonts',
    tier: 'local',
    summary: 'Polices Google (liens calculés depuis les familles de la charte) ; Fontshare, Fontsource et polices importées par leur feuille.',
    provides: ['fonts'],
    license: 'SIL OFL (polices)',
    cost: { tokens: 0, network: true },
    available: () => true,
  });
  const manifest = loadManifest();
  const configured = listServers();
  for (const [server, entry] of Object.entries(manifest?.servers ?? {})) {
    const note = MCP_NOTES[server] ?? { license: 'inconnue', network: true, provides: [] };
    for (const tool of entry.tools) {
      r.register({
        id: `mcp.${server}.${tool.name}`,
        kind: 'mcp-tool',
        tier: 'tool',
        summary: tool.summary || tool.name,
        provides: note.provides,
        license: note.license,
        dependencies: [`serveur MCP « ${server} » (.mcp.json)`],
        cost: { network: note.network },
        available: () => mcpAvailable() && Boolean(configured[server]),
        docs: () => `Arguments requis : ${(tool.required ?? []).join(', ') || 'aucun'}. Appel : callTool('${server}', '${tool.name}', {…}).`,
      });
    }
  }
  return r;
}

let shared: CapabilityRegistry | null = null;

/** Le registre partagé du processus. */
export function capabilities(): CapabilityRegistry {
  if (!shared) shared = createDefaultRegistry();
  return shared;
}

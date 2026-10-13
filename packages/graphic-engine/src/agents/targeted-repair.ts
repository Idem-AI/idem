/**
 * La RÉPARATION CIBLÉE (crans High et au-delà) : quand le code n'a pas su corriger une page (elle déborde
 * encore à l'échelle minimale, deux blocs se chevauchent), un modèle choisit UNE correction dans un menu
 * fermé — jamais une régénération complète, jamais une modification du contenu.
 *
 * Les corrections sont toutes appliquées par le code : passer à une autre composition du classement,
 * densifier la page, compacter un bloc, retirer les décors.
 */
import type { Issue } from '../contracts/common';
import type { Candidate } from '../composition-engine/compose';
import { menuLines } from './creative-planner';
import { parseJsonObject } from '../orchestrator/run-task';

export type RepairChoice = { kind: 'switch'; index: number } | { kind: 'dense' } | { kind: 'compact'; blockId: string } | { kind: 'drop-decor' };

export function repairPrompt(issues: Issue[], alternatives: Candidate[], blockIds: string[]): { system: string; user: string } | null {
  if (!issues.length) return null;
  return {
    system: 'You fix ONE layout defect on a page without touching its content. Pick exactly one action from the list. Answer with JSON only: {"action": "<action>"}.',
    user: `DEFECTS: ${issues.map((i) => i.message).join(' ')}\nACTIONS:\n- dense (tighter spacing)\n- drop-decor\n${blockIds.map((id) => `- compact:${id} (most compact drawing of block ${id})`).join('\n')}\n${menuLines(alternatives)
      .map((l) => `- switch:${l}`)
      .join('\n')}`,
  };
}

export function parseRepair(raw: string, alternatives: number, blockIds: string[]): RepairChoice | undefined {
  const action = String(parseJsonObject(raw)?.action ?? '').trim();
  if (action === 'dense') return { kind: 'dense' };
  if (action === 'drop-decor') return { kind: 'drop-decor' };
  const compact = action.match(/^compact:(.+)$/);
  if (compact && blockIds.includes(compact[1])) return { kind: 'compact', blockId: compact[1] };
  const sw = action.match(/^switch:(\d+)/);
  if (sw && Number(sw[1]) >= 1 && Number(sw[1]) <= alternatives) return { kind: 'switch', index: Number(sw[1]) - 1 };
  return undefined;
}

/** La variante la plus compacte d'un bloc, par type (correction appliquée par le code). */
export const COMPACT_VARIANTS: Record<string, Record<string, string | number | boolean>> = {
  metrics: { style: 'stacked' },
  table: { style: 'minimal', density: 'compact' },
  cards: { style: 'plain', cols: 0 },
  timeline: { style: 'vertical' },
  steps: { style: 'ladder' },
  quote: { style: 'bar' },
  prose: { lead: false, dropcap: false, columns: 1 },
  chart: { frame: 'none' },
  comparison: { style: 'grid' },
  persona: { style: 'card' },
};

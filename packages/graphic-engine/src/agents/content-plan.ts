/**
 * L'étape ① des rédacteurs : LE PLAN d'une section, avant son écriture.
 *
 * Un petit modèle tient trois ou quatre exigences simultanées, puis décroche — en silence, en produisant
 * du plausible et du générique. Même quand le moteur lui a retiré la composition, une section lui demande
 * encore DEUX choses : décider quoi dire, et l'écrire. On les sépare :
 *
 *   ① PLAN     → un angle, les points à couvrir, les blocs à produire
 *   ② CONTENU  → remplir CE plan (contrat `content-contract.ts`)
 *   ③ PAGE     → le moteur
 *
 * L'étape ② cesse d'être une tâche ouverte pour devenir un REMPLISSAGE : le modèle n'a plus de place pour
 * inventer la charpente — c'est là que le comblement disparaît. Le plan est vérifiable SANS modèle (nombre
 * de points, types de blocs existants) : son échec se voit avant que la section ne soit écrite.
 */
import type { BlockKind } from '../contracts/content-model';
import { BLOCKS_BY_DELIVERABLE } from './content-contract';

export interface SectionPlan {
  /** Ce que la section DÉMONTRE, en une phrase. */
  angle: string;
  /** Les points à couvrir, dans l'ordre : la charpente. */
  points: string[];
  /** Les blocs à produire, dans l'ordre. */
  blocks: BlockKind[];
}

const MIN_POINTS = 3;
const MAX_POINTS = 8;

const kindsFor = (deliverable?: string): BlockKind[] => BLOCKS_BY_DELIVERABLE[deliverable ?? 'business-plan'] ?? BLOCKS_BY_DELIVERABLE['business-plan'];

/** Le prompt de l'étape ① : minuscule à dessein (c'est une tâche de structuration). */
export function sectionPlanContract(deliverable?: string): string {
  return `<planning_task>
Do NOT write the section. Plan it.

Read the brief and the project context, then return ONE JSON object:
{
  "angle": "what this section DEMONSTRATES, in one sentence. Not its topic — its conclusion.",
  "points": ["the points to cover, in reading order, 3 to 8 of them, one short line each"],
  "blocks": ["the block types to produce, in order"]
}

Allowed block types: ${kindsFor(deliverable).join(', ')}.

Rules:
- Each point must be supported by a fact from the project context. A point you cannot support will be
  padded — drop it now rather than filling it later.
- Vary the blocks. A section made only of "prose" is a wall; one made only of "cards" is a catalogue.
- "blocks" and "points" need not have the same length: one block may carry two points.
- Valid JSON only. No markdown fence, no commentary.
</planning_task>`;
}

/** Valide un plan ; `null` quand rien d'exploitable n'en sort (la section s'écrit alors sans plan). */
export function normalizeSectionPlan(raw: unknown, deliverable?: string): SectionPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Record<string, unknown>;
  const angle = typeof input.angle === 'string' ? input.angle.trim() : '';
  const points = (Array.isArray(input.points) ? input.points : [])
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
    .slice(0, MAX_POINTS);
  if (points.length < MIN_POINTS) return null;
  const allowed = new Set<string>(kindsFor(deliverable));
  const byLower = new Map([...allowed].map((k) => [k.toLowerCase(), k as BlockKind]));
  const blocks = (Array.isArray(input.blocks) ? input.blocks : [])
    .map((b) => (typeof b === 'string' ? byLower.get(b.trim().toLowerCase()) : undefined))
    .filter((b): b is BlockKind => Boolean(b));
  // Un plan sans bloc valide est une charpente sans matériaux : refusé plutôt que laisser ② improviser.
  if (!blocks.length) return null;
  return { angle, points, blocks };
}

/** Le plan rendu IMPÉRATIF pour l'étape ② : la structure n'est plus une suggestion. */
export function describeSectionPlan(plan: SectionPlan): string {
  return `<plan_to_execute>
This section's structure is DECIDED. Execute it — do not re-plan, do not add a point that is not listed,
do not drop one that is.

Angle (what the section demonstrates): ${plan.angle}

Points to cover, in this order:
${plan.points.map((point, i) => `${i + 1}. ${point}`).join('\n')}

Blocks to produce, in this order: ${plan.blocks.join(', ')}

If a point turns out to have no factual support, write it SHORT rather than padding it.
</plan_to_execute>`;
}

/** Le format d'affichage d'un programme dans les prompts (exemples, programme actuel d'une scène). */
import type { MotionProgram } from '../dsl/types';

/** Un programme lisible et compact : une ligne par nœud et par pas (les modèles le lisent mieux, il coûte peu). */
export function formatProgram(p: MotionProgram): string {
  const head = [p.bg !== undefined ? `  "bg": ${JSON.stringify(p.bg)}` : '', p.enter ? `  "enter": ${JSON.stringify(p.enter)}` : ''].filter(Boolean);
  return [
    '{',
    ...head.map((h) => `${h},`),
    '  "nodes": [',
    p.nodes.map((n) => `    ${JSON.stringify(n)}`).join(',\n'),
    '  ],',
    '  "timeline": [',
    p.timeline.map((s) => `    ${JSON.stringify(s)}`).join(',\n'),
    '  ]',
    '}',
  ].join('\n');
}

/**
 * Étape ① — LE PLAN.
 *
 * La décomposition du travail en tâches simples, dont le gabarit n'était que la
 * seconde moitié.
 *
 * Le constat : un petit modèle a une falaise de compétence. Il tient trois ou
 * quatre exigences simultanées, puis il décroche — et il décroche EN SILENCE,
 * en produisant quelque chose de plausible et de générique. Or même après que le
 * rendu lui a retiré la composition, une section lui demande encore DEUX choses
 * d'un coup : décider quoi dire, et l'écrire.
 *
 * On les sépare :
 *
 *   ① PLAN     (étage XS) → un angle, les points à couvrir, les blocs à produire
 *   ② CONTENU  (étage XS/M) → remplir CE plan
 *   ③ RENDU    (code)      → la page
 *
 * Ce que cela change, et qui est l'objet de l'opération : l'étape ② cesse d'être
 * une tâche ouverte pour devenir un REMPLISSAGE. Un modèle à qui l'on demande
 * « écris la section Opportunité » invente une structure et, s'il manque de
 * matière, la comble — c'est la définition de l'hallucination sur ce genre de
 * livrable. Le même modèle à qui l'on dit « couvre ces cinq points, dans cet
 * ordre, avec ces blocs » n'a plus de place pour inventer la charpente : il lui
 * reste à écrire, ce qu'il sait faire.
 *
 * Le plan est en outre VÉRIFIABLE sans modèle — nombre de points, types de blocs
 * existants — donc son échec est détecté avant que la section ne soit écrite,
 * là où le rattraper coûte quelques centaines de tokens plutôt qu'une page.
 *
 * Le surcoût est négligeable : un appel de ~2 000 tokens d'entrée pour ~400 de
 * sortie à l'étage mécanique, soit environ 0,0003 $. Il est très largement
 * repayé par les sections qu'on ne régénère pas.
 */

/** Types de blocs qu'un plan peut prescrire — le vocabulaire du rendu. */
export const PLANNABLE_BLOCKS = [
  'prose',
  'cards',
  'table',
  'metrics',
  'chart',
  'quote',
  'timeline',
  'assumption',
] as const;

export type PlannableBlock = (typeof PLANNABLE_BLOCKS)[number];

export interface SectionPlan {
  /** L'angle : ce que la section démontre, en une phrase. */
  angle: string;
  /** Les points à couvrir, dans l'ordre. C'est la charpente. */
  points: string[];
  /** Les blocs à produire, dans l'ordre. */
  blocks: PlannableBlock[];
}

const PLAN_MIN_POINTS = 3;
const PLAN_MAX_POINTS = 8;

/**
 * Prompt de l'étape ①.
 *
 * Volontairement minuscule : c'est une tâche de structuration, et un prompt long
 * y réintroduirait exactement le problème qu'on vient de résoudre.
 */
export const SECTION_PLAN_CONTRACT = `<planning_task>
Do NOT write the section. Plan it.

Read the brief and the project context, then return ONE JSON object:

{
  "angle": "what this section DEMONSTRATES, in one sentence. Not its topic — its conclusion.",
  "points": ["the points to cover, in reading order, 3 to 8 of them, one short line each"],
  "blocks": ["the block types to produce, in order"]
}

Allowed block types: ${PLANNABLE_BLOCKS.join(', ')}.

Rules:
- Each point must be something you can actually support with a fact from the
  project context. A point you cannot support is a point that will be padded —
  drop it now rather than filling it later.
- Vary the blocks. A section made only of "prose" is a wall; one made only of
  "cards" is a catalogue.
- "blocks" and "points" do not have to be the same length: one block may carry
  two points, and a chart may carry none.
- Valid JSON only. No markdown fence, no commentary.
</planning_task>`;

/**
 * Valide et normalise un plan. Ne lève jamais : renvoie `null` quand rien
 * d'exploitable n'en sort, auquel cas l'appelant écrit la section sans plan —
 * dégradé, jamais bloquant.
 */
export function normalizeSectionPlan(raw: unknown): SectionPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Record<string, unknown>;

  const angle = typeof input.angle === 'string' ? input.angle.trim() : '';

  const points = (Array.isArray(input.points) ? input.points : [])
    .map((point) => (typeof point === 'string' ? point.trim() : ''))
    .filter(Boolean)
    .slice(0, PLAN_MAX_POINTS);

  if (points.length < PLAN_MIN_POINTS) return null;

  const allowed = new Set<string>(PLANNABLE_BLOCKS);
  const blocks = (Array.isArray(input.blocks) ? input.blocks : [])
    .map((block) => (typeof block === 'string' ? block.trim().toLowerCase() : ''))
    .filter((block): block is PlannableBlock => allowed.has(block));

  // Un plan sans bloc valide est une charpente sans matériaux : le modèle a
  // inventé des types. On le refuse plutôt que de laisser l'étape ② improviser.
  if (blocks.length === 0) return null;

  return { angle, points, blocks };
}

/**
 * Rend le plan LISIBLE pour l'étape ②, sous forme de contrainte.
 *
 * Le ton est délibérément impératif : à ce stade, la structure n'est plus une
 * suggestion, et c'est tout l'intérêt du découpage. Le modèle qui écrit ne
 * décide plus quoi dire, il dit ce qui a été décidé.
 */
export function describeSectionPlan(plan: SectionPlan): string {
  return `<plan_to_execute>
This section's structure is DECIDED. Execute it — do not re-plan, do not add a
point that is not listed, do not drop one that is.

Angle (what the section demonstrates): ${plan.angle}

Points to cover, in this order:
${plan.points.map((point, index) => `${index + 1}. ${point}`).join('\n')}

Blocks to produce, in this order: ${plan.blocks.join(', ')}

If a point turns out to have no factual support, write it SHORT rather than
padding it. A thin point that is true is worth more than a full one that is not.
</plan_to_execute>`;
}

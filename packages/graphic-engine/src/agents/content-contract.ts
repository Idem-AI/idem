/**
 * Le CONTRAT DE CONTENU donné aux rédacteurs IA des applications (business plan, pitch deck, charte…).
 *
 * C'est le renversement central, gardé du moteur précédent : le modèle écrit le CONTENU, le moteur produit
 * la page. Il ne rend pas de HTML : il rend des BLOCS. Ce qui lui reste est exactement ce qu'un petit modèle
 * sait faire — trouver l'angle, choisir les faits, écrire des phrases justes. Le contrat est court à dessein :
 * un modèle honore de façon fiable une dizaine de contraintes, et toutes celles qui restent portent sur le
 * contenu.
 */
import type { BlockKind } from '../contracts/content-model';

const BLOCK_DOCS: Partial<Record<BlockKind, string>> = {
  prose: '{"kind":"prose","paragraphs":["…","…"]}\n    Running text. Each paragraph opens on a fact.',
  metrics: '{"kind":"metrics","items":[{"value":"2,3 Md FCFA","label":"what it measures","note":"year or source"}]}\n    2 to 4 key figures. Always carry a unit and a period.',
  table: '{"kind":"table","headers":["…"],"rows":[["…"]],"caption":"optional"}\n    Comparisons, breakdowns, price lists. Every row matches the header count.',
  cards: '{"kind":"cards","items":[{"title":"…","body":"…","emphasis":true}]}\n    2 to 5 items that genuinely differ. Set "emphasis" on the one that matters most.',
  chart: `{"kind":"chart","chartType":"line","title":"…","labels":["2025","2026"],"series":[{"name":"Revenue","data":[120,180]}],"unit":"M FCFA","readingKey":"what the reader should CONCLUDE"}
    Numbers only, no formatting. CHOOSE chartType FROM THE QUESTION THE DATA ANSWERS:
      line — how one thing moves over TIME (3+ periods) · area — same, when the volume matters
      bar — one measure across a few named items · groupedBar — 2-3 measures across the same items
      stacked — how a total BREAKS DOWN · horizontalBar — a ranking, or long labels
      pie / doughnut — parts of ONE whole, 3 to 6 slices · radar — 1-2 profiles across 4-6 criteria`,
  timeline: '{"kind":"timeline","steps":[{"date":"T1 2026","title":"…","body":"…"}]}',
  quote: '{"kind":"quote","text":"…","attribution":"…"}',
  assumption: '{"kind":"assumption","statement":"what the plan assumes","basis":"what it rests on"}',
  comparison: '{"kind":"comparison","columns":["Us","Competitor A"],"rows":[{"label":"criterion","values":["…","…"]}]}',
  steps: '{"kind":"steps","items":[{"title":"…","body":"…"}]}\n    A process in 2 to 7 steps.',
  swot: '{"kind":"swot","strengths":["…"],"weaknesses":["…"],"opportunities":["…"],"threats":["…"]}',
  funnel: '{"kind":"funnel","stages":[{"label":"Visitors","value":"12 000","note":"…"}]}\n    3 to 6 ordered stages.',
  persona: '{"kind":"persona","name":"…","role":"…","traits":["…"],"needs":["…"],"quote":"…"}',
  riskMatrix: '{"kind":"riskMatrix","risks":[{"label":"…","likelihood":"low|medium|high","impact":"low|medium|high","mitigation":"…"}]}',
  businessModel: '{"kind":"businessModel","cells":[{"key":"partners|activities|resources|value|relations|channels|segments|costs|revenues","items":["…"]}]}',
  points: '{"kind":"points","items":[{"label":"3 to 6 words","detail":"one short line (optional)","value":"92 % (optional)","visual":"one or two concrete English nouns it shows: truck, coffee beans"}]}\n    2 to 6 points SHOWN with a picture each, not paragraphs. Prefer it to "cards" on a slide.',
};

/** Les blocs proposés aux rédacteurs, par livrable (les autres restent possibles côté code). */
export const BLOCKS_BY_DELIVERABLE: Record<string, BlockKind[]> = {
  'business-plan': ['prose', 'metrics', 'table', 'cards', 'chart', 'timeline', 'quote', 'assumption', 'comparison', 'steps', 'swot', 'funnel', 'persona', 'riskMatrix', 'businessModel'],
  'pitch-deck': ['points', 'metrics', 'chart', 'table', 'cards', 'prose', 'timeline', 'quote', 'comparison', 'steps', 'funnel', 'persona', 'businessModel'],
  'brand-charter': ['prose', 'cards', 'quote', 'steps', 'table'],
  report: ['prose', 'metrics', 'table', 'cards', 'chart', 'timeline', 'quote', 'assumption'],
};

export interface ContentContractOptions {
  /** Le livrable : il fixe les types de blocs proposés. */
  deliverable?: keyof typeof BLOCKS_BY_DELIVERABLE;
  /** Types de blocs imposés (sinon ceux du livrable). */
  kinds?: BlockKind[];
  /**
   * La page a une INTENTION visuelle (diapositives) : la sortie porte une clé `visual` — le message à
   * retenir, l'image que la page appelle, et la stratégie parmi `strategies` quand la jauge laisse choisir.
   */
  visual?: { strategies: readonly string[] };
}

/** Le contrat de sortie, en anglais (c'est un prompt ; la langue du contenu est fixée ailleurs). */
export function contentContract(options: ContentContractOptions = {}): string {
  const kinds = options.kinds ?? BLOCKS_BY_DELIVERABLE[options.deliverable ?? 'business-plan'];
  return `<output_contract>
You do NOT write HTML, CSS or Tailwind. The page is composed by the graphic engine: colours, typefaces,
grid, spacing, logo placement and contrast are already decided and guaranteed. Markup would be discarded.

Return ONE JSON object, and nothing else:
{"kicker":"2 to 4 words naming the section's angle (optional)","title":"the section title","lede":"ONE sentence stating the finding (optional)","blocks":[ … ]${options.visual ? `,"visual":{"keyMessage":"what the audience must remember, one sentence",${options.visual.strategies.length > 1 ? `"strategy":"${options.visual.strategies.join('|')}",` : ''}"image":{"subject":"the photo or illustration this slide calls for: who or what, doing what (no text in it) — omit if none"}}` : ''}}

Block types — pick what the SUBSTANCE calls for, never a fixed recipe:
${kinds
  .map((k) => BLOCK_DOCS[k])
  .filter(Boolean)
  .join('\n')}

RULES:
- The number of blocks is given in <volume>: a ceiling as much as a target.
- Vary the types: a page of prose only is a wall, a page of cards only is a catalogue.
- Every figure carries a unit and a period; never invent a figure absent from the facts you were given.
- No sentence that would survive a change of company name. Never announce ("in this section we will…"), state.
- Write in the requested language. Keep proper nouns as they are.
- Valid JSON only: no markdown fence, no comment, no trailing text.
</output_contract>`;
}

/**
 * Les règles d'ÉCRITURE communes à tous les rédacteurs (business plan, deck, charte). Elles portent sur le
 * TEXTE seulement : la composition est celle du moteur, et le reste du prompt n'en dit rien.
 */
export const WRITING_RULES = `<writing_rules>
BANNED VOCABULARY (French and English alike):
"révolutionnaire", "innovant" used on its own, "solution clé en main", "propulsez", "boostez", "libérez le potentiel", "à l'ère du numérique", "dans un monde en constante évolution", "elevate", "unlock", "seamless", "empower", "supercharge", "cutting-edge", "game-changing", "next-generation", "world-class".
Write what the brand actually DOES instead, with a concrete noun and a verb.

BANNED CONTENT:
- Filler: "Lorem ipsum", "Feature 1", "Your company", an invented statistic with no source.
- Any sentence that would survive a change of company name. It says nothing: cut it, or replace it with a fact.
- Announcing instead of stating ("in this section we will…").
- FABRICATED APPARATUS: reference codes ("RÉF. DOC-ID-2026/09"), version numbers, "STATUT : VALIDÉ", classification labels, edition dates you were not given. Each is a small forgery.
- NUMBERS NOBODY COMPUTED: colour breakdowns (CMYK, RGB), contrast ratios, scales, percentages of anything. Use a figure ONLY if it was handed to you — the exact colour and type values are set on the page by the engine.
- INFLATED NAMING: "le logo", not "l'identifiant maître"; "bleu", not "BLEU MOBILITÉ SOUVERAIN".

THE TEST for every sentence you write: could it appear, unchanged, in a competitor's document? If yes, it is padding.
</writing_rules>`;

/**
 * La consigne de volume, exprimée en BLOCS (un modèle ne sait pas ce qu'une page contient). C'est la SEULE
 * consigne de volume du prompt : deux nombres contradictoires se départagent par un entre-deux.
 */
export function volumeDirective(blocks: string): string {
  return `<volume>
Produce ${blocks} blocks for this section. Reach the count with SUBSTANCE — figures, local examples, stated
hypotheses, risks, timelines, named sources. If the substance runs out first, STOP: a short section carrying
real content beats a full one padded with sentences that say nothing. Keep each block short.
</volume>`;
}

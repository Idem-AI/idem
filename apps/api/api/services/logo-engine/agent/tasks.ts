/**
 * LES TÂCHES DE L'AGENT — étroites, courtes, validées, avec le repli du code.
 *
 *   selector    (Medium)  choisit les propositions parmi un menu de candidats DÉJÀ construits et mesurés
 *   directions  (High+)   trois directions réellement différentes : catégorie + générateur + idée
 *   author      (Max+)    écrit le Logo IR d'une direction (JSON compact), le code le valide et le répare
 *   jury        (Max+)    départage plusieurs brouillons d'une même direction, mesures à l'appui
 *   critic      (Ultra)   REGARDE le rendu et répond par un patch ciblé, jamais par un nouveau dessin
 *
 * Le modèle ne reçoit jamais le catalogue complet : un menu filtré par le brief, la signature d'UN
 * générateur, un mémento du format. Tout ce qu'il écrit est validé par le schéma ; ce qui est refusé
 * est remplacé par la décision du planificateur.
 */
import type { AgentTask } from '../../creativity/orchestrator';
import { agentLines, LETTERS, pickOption } from '../../creativity/agent-io';
import { parseLlmJson } from '../../../utils/llm-json.util';
import { CONCEPT_TYPES } from '../ir/logo.schema';
import type { ConceptType, LogoDocument, LogoPalette } from '../ir/logo.schema';
import { applyPatch } from '../ir/patch';
import type { PatchOp } from '../ir/patch';
import { describeGenerator, getGenerator, listGenerators } from '../render/generators';
import type { GeneratorFamily, GeneratorSpec } from '../render/generators';
import { affinity } from '../planner/brief';
import type { PlanBrief, Traits } from '../planner/brief';
import type { PlannedLogo } from '../planner/planner';

// ─── Menus ──────────────────────────────────────────────────────────────────

export interface Direction {
  type: ConceptType;
  /** Générateur (types à symbole) ou variante typographique (conteneur, effet). */
  generator?: string;
  variant?: string;
  idea: string;
}

const SYMBOL_TYPES: ConceptType[] = ['combination', 'pictorial', 'abstract', 'mascot', 'emblem', 'negative-space', 'minimal', 'dynamic'];

/** Familles de générateurs admises pour un type : la même règle que les recettes. */
export function familiesFor(type: ConceptType): GeneratorFamily[] {
  if (type === 'pictorial' || type === 'negative-space') return ['pictorial'];
  if (type === 'abstract' || type === 'dynamic') return ['abstract'];
  if (type === 'mascot') return ['mascot'];
  if (type === 'combination' || type === 'emblem') return ['pictorial', 'abstract'];
  return [];
}

/** Les générateurs les plus proches du brief, par famille, pour le menu du directeur. */
export function generatorShortlist(weights: Map<string, number>, families: GeneratorFamily[], size = 8): GeneratorSpec[] {
  return listGenerators()
    .filter((g) => families.includes(g.family))
    .map((g) => ({ g, s: affinity(g.tags, weights) }))
    .sort((a, b) => b.s - a.s || a.g.id.localeCompare(b.g.id))
    .slice(0, size)
    .map((x) => x.g);
}

const TYPE_HINT: Record<ConceptType, string> = {
  wordmark: 'the name alone, typography is the logo',
  lettermark: 'initials in a container',
  letterform: 'one letter worked as the symbol',
  pictorial: 'a recognisable object',
  abstract: 'a geometric construction',
  mascot: 'a character',
  combination: 'symbol + name',
  emblem: 'a seal: frame + symbol + curved name',
  dynamic: 'a symbol with linked variants',
  minimal: 'one idea, 2 colours, fewest shapes',
  'negative-space': 'the symbol is the empty space',
};

// ─── Directions ─────────────────────────────────────────────────────────────

export interface DirectionMenu {
  types: ConceptType[];
  /** Générateurs proposés, par type. */
  generators: Partial<Record<ConceptType, string[]>>;
  /** Variantes typographiques proposées (wordmark : effets ; lettermark : conteneurs). */
  variants: Partial<Record<ConceptType, string[]>>;
}

export function directionMenu(kind: 'icon' | 'name' | 'initial', weights: Map<string, number>): DirectionMenu {
  const types: ConceptType[] = kind === 'name' ? ['wordmark'] : kind === 'initial' ? ['lettermark', 'letterform', 'negative-space', 'emblem'] : SYMBOL_TYPES;
  const generators: DirectionMenu['generators'] = {};
  for (const t of types) {
    const f = familiesFor(t);
    if (f.length) generators[t] = generatorShortlist(weights, f, t === 'mascot' ? 6 : 8).map((g) => g.id);
  }
  return {
    types,
    generators,
    variants: {
      wordmark: ['plain', 'dot', 'underline', 'bar', 'slice', 'ligature', 'dotReplace', 'swapRound', 'accentChar', 'cutCorner', 'italic'],
      lettermark: ['tile', 'circle', 'squircle', 'ring', 'hexagon', 'diamond', 'underline', 'shield'],
      letterform: ['plain', 'cut', 'swap', 'slice', 'notch', 'accentDot'],
    },
  };
}

function parseDirection(line: string, menu: DirectionMenu): Direction | null {
  const parts = line.split('|').map((p) => p.trim());
  if (parts.length < 2) return null;
  const type = pickOption(parts[0].toLowerCase().replace(/\s+/g, '-'), CONCEPT_TYPES as readonly string[]) as ConceptType | undefined;
  if (!type || !menu.types.includes(type)) return null;
  const second = parts[1].toLowerCase().replace(/[^a-z-]/g, '');
  const direction: Direction = { type, idea: (parts[2] ?? parts[1]).replace(/\*+/g, '').slice(0, 200) };
  const gens = menu.generators[type];
  if (gens) {
    // Un générateur hors menu (inventé) est écarté : la direction garde sa catégorie, le planificateur choisit.
    const g = gens.find((id) => id === second);
    if (g) direction.generator = g;
  }
  const variants = menu.variants[type];
  if (variants) {
    const v = variants.find((id) => id.toLowerCase() === second);
    if (v) direction.variant = v;
  }
  return direction;
}

/** High+ : N directions distinctes, une ligne chacune. */
export function directionsTask(sheet: string, menu: DirectionMenu, count: number, wish: string | undefined, fallback: () => Direction[] | null): AgentTask<Direction[] | null> {
  const lines = menu.types.map((t) => {
    const gens = menu.generators[t];
    const vars = menu.variants[t];
    return `- ${t} (${TYPE_HINT[t]})${gens ? ` generators: ${gens.join(', ')}` : ''}${vars ? ` variants: ${vars.join(', ')}` : ''}`;
  });
  return {
    role: 'logoDirector',
    minLevel: 'high',
    prompt: () => ({
      system: [
        `You are the creative director of a brand identity. Propose ${count} clearly DIFFERENT logo directions, true to the brand charter. The directions must differ in category AND in the form they take (not three variations of one idea).`,
        'Pick ONLY from this menu (a generator is a ready-made geometric construction; a variant is a typographic treatment):',
        ...lines,
        `Output ONLY ${count} lines, in this exact form: N: category | generator-or-variant | the idea in one short sentence (a metaphor or form tied to the brand, no pun that needs explaining)`,
      ].join('\n'),
      user: [sheet, wish ? `CLIENT WISH: ${wish.slice(0, 300)}` : ''].filter(Boolean).join('\n'),
    }),
    parse: (raw) => {
      const found = [...(raw || '').matchAll(/^\s*[*-]?\s*(?:direction\s*)?\d\s*[.):\-–]\s*(.+)$/gim)].map((m) => parseDirection(m[1], menu)).filter((d): d is Direction => !!d);
      if (found.length < count) return undefined;
      // Deux directions de même catégorie ET même générateur ne sont pas deux directions.
      const seen = new Set<string>();
      const distinct = found.filter((d) => {
        const key = `${d.type}:${d.generator ?? d.variant ?? ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return distinct.length >= count ? distinct.slice(0, count) : undefined;
    },
    fallback,
  };
}

// ─── Sélecteur (Medium) ─────────────────────────────────────────────────────

export function selectorTask(sheet: string, candidates: PlannedLogo[], count: number, fallback: () => number[]): AgentTask<number[]> {
  return {
    role: 'logoSelector',
    minLevel: 'medium',
    prompt: () =>
      candidates.length <= count
        ? null
        : {
            system: [
              `You are an art director. From these ${candidates.length} candidate logos (already built and checked), pick the ${count} that best fit the brand AND differ most from each other (different categories, different forms).`,
              `Output ONLY: picks: ${Array.from({ length: count }, (_, i) => LETTERS[i]).join(', ')} (letters of your picks)`,
            ].join('\n'),
            user: [sheet, 'CANDIDATES:', ...candidates.map((c, i) => `${LETTERS[i]}) ${c.type} — ${c.recipe} — ${(c.doc.concept.rationale || '').slice(0, 120)} (quality ${c.report.score})`)].join('\n'),
          },
    parse: (raw) => {
      const ids = candidates.map((_, i) => LETTERS[i]);
      const letters = (agentLines(raw).picks || raw).toLowerCase().match(/\b[a-p]\b/g) || [];
      const picks = [...new Set(letters)].filter((l) => ids.includes(l)).map((l) => ids.indexOf(l));
      return picks.length >= count ? picks.slice(0, count) : undefined;
    },
    fallback,
  };
}

// ─── Auteur du Logo IR (Max+) ───────────────────────────────────────────────

/** Le mémento du format : tout ce qu'il faut pour écrire un Logo IR valide, en ~400 tokens. */
export const IR_CHEATSHEET = [
  'Write a Logo IR as ONE JSON object {"rationale":string,"layers":[…],"composition":{…}}. Nothing else.',
  'Drawing box 0–100 (origin top-left). The engine centres, scales and spaces everything: give NO page coordinates for the name.',
  'Colours are ROLES only: "ink" (main), "ink2", "accent", "paper" (= a cut-out, transparent). Never hex. 2–3 roles at most.',
  'Layers (max 8, unique ids): ',
  ' {"kind":"generator","id","generator","params":{…},"fill"?,"transform"?:{x,y,rotate,scale,flipX}}',
  ' {"kind":"shape","id","geometry":{"type":"rect|circle|ellipse|polygon|star|ring|arc|superellipse|line|poly", …},"fill"?}',
  '   rect{x,y,w,h,r} circle{cx,cy,r} ellipse{cx,cy,rx,ry} polygon{cx,cy,r,sides,rotation,cornerRadius} ring{cx,cy,r,thickness} line{x1,y1,x2,y2,width,round} arc{cx,cy,r,thickness,from,to}',
  ' {"kind":"boolean","id","op":"union|subtract|intersect|exclude","operands":[layer,layer,…]}  (first operand is the base)',
  ' {"kind":"repeat","id","mode":"radial|mirror-x|mirror-y|mirror-xy|linear|grid","count","radius","merge","child":layer}',
  ' {"kind":"group","id","children":[layer…]}  (a "paper" child cuts the shapes before it)',
  ' {"kind":"text","id","role":"wordmark|symbol|tagline","content","case":"upper|lower|title|none","tracking":-0.05..0.4,"font":{"role":"display|body","weight":100-900},"effects":[{"type":"dot|underline|bar|slice|ligature|dotReplace|swapRound|cutCorner|accentChar|italic",…}],"fill"?, "size"?, "at"?:{x,y}, "curve"?:{radius,start,side}}',
  '   a text layer with role "wordmark" is placed by the composition; role "symbol" + "at" + "size" lives inside the 0–100 box (monogram letter, curved emblem text).',
  'composition: {"layout":"auto|horizontal|stacked|symbol-only|wordmark-only","gap":0.05–1.2,"symbolScale":1–6,"padding":0.02–0.4}',
  'Rules: one idea; text may only be the brand name, its initials or the tagline; keep it simple enough for 24 px; no gradients, no images.',
].join('\n');

function generatorSignature(id?: string): string {
  const spec = id ? getGenerator(id) : undefined;
  return spec ? `GENERATOR ${describeGenerator(spec)} — tones ${spec.tones} (a=fill, b=ink2, c=accent)` : '';
}

export interface AuthorContext {
  sheet: string;
  brief: PlanBrief;
  direction: Direction;
  withName: boolean;
  allowFreePaths: boolean;
}

/** Les chaînes de texte qu'un logo a le droit de porter. */
export function allowedTexts(brief: PlanBrief): Set<string> {
  const words = brief.brandName.split(/\s+/);
  const initials = words.map((w) => w[0]?.toUpperCase() ?? '').join('');
  const out = new Set<string>([brief.brandName, brief.brandName.toUpperCase(), brief.brandName.toLowerCase(), initials, initials.slice(0, 2), ...words, ...words.map((w) => w[0] ?? '')]);
  if (brief.tagline) out.add(brief.tagline);
  return out;
}

export interface AuthoredLogo {
  doc: Record<string, unknown>;
  rationale: string;
}

/** Assemble le document complet à partir de ce que le modèle a écrit (palette, brief, graine : toujours ceux du code). */
export function assembleAuthored(raw: unknown, ctx: AuthorContext, palette: LogoPalette, seed: number): AuthoredLogo | null {
  const obj = raw as Record<string, unknown> | null;
  if (!obj || !Array.isArray(obj.layers) || !obj.layers.length) return null;
  const allowed = allowedTexts(ctx.brief);
  const layers = JSON.parse(JSON.stringify(obj.layers)) as Record<string, unknown>[];
  let refused = false;
  const sweep = (list: Record<string, unknown>[]) => {
    for (const layer of list) {
      if (layer.kind === 'text') {
        const content = String(layer.content ?? '');
        if (!allowed.has(content) && ![...allowed].some((a) => a.length > 3 && a.toLowerCase().includes(content.toLowerCase()) && content.length > 1)) layer.content = ctx.brief.brandName;
        // Un texte « wordmark » sans nom du tout est inutile : on le laisse, la validation visuelle tranchera.
      }
      if (layer.kind === 'shape' && (layer.geometry as Record<string, unknown> | undefined)?.type === 'path' && !ctx.allowFreePaths) refused = true;
      if (Array.isArray(layer.operands)) sweep(layer.operands as Record<string, unknown>[]);
      if (Array.isArray(layer.children)) sweep(layer.children as Record<string, unknown>[]);
      if (layer.child) sweep([layer.child as Record<string, unknown>]);
    }
  };
  sweep(layers);
  if (refused) return null;
  const rationale = typeof obj.rationale === 'string' ? obj.rationale.slice(0, 400) : ctx.direction.idea;
  return {
    rationale,
    doc: {
      brief: { brandName: ctx.brief.brandName, ...(ctx.brief.tagline ? { tagline: ctx.brief.tagline } : {}), industry: ctx.brief.industry ?? '', audience: ctx.brief.audience ?? '', personality: (ctx.brief.personality ?? []).slice(0, 6) },
      concept: { type: ctx.direction.type, rationale, motifs: [], recipe: `author:${ctx.direction.generator ?? ctx.direction.variant ?? ctx.direction.type}` },
      palette,
      layers,
      composition: typeof obj.composition === 'object' && obj.composition ? obj.composition : {},
      ...(Array.isArray(obj.variants) ? { variants: obj.variants } : {}),
      meta: { seed, engine: 'logo-engine/1' },
    },
  };
}

/**
 * Ultra : l'IA écrit le Logo IR de la direction. `validate` (le schéma + les garde-fous) est donné
 * à l'orchestrateur : une réponse illisible fait monter le modèle d'un étage avant de céder au repli.
 */
export function authorTask(ctx: AuthorContext, palette: LogoPalette, seed: number, key: string, check: (assembled: AuthoredLogo) => boolean, fallback: () => AuthoredLogo | null): AgentTask<AuthoredLogo | null> {
  return {
    role: 'logoAuthor',
    key,
    minLevel: 'ultra',
    // Un JSON de plusieurs centaines de tokens : le profil « agents » plafonne la sortie à 400 et le tronquerait.
    profile: 'coder',
    prompt: () => ({
      system: [
        `You design a ${ctx.direction.type} logo (${TYPE_HINT[ctx.direction.type]}) as a Logo IR. The engine builds exact vector geometry from it.`,
        IR_CHEATSHEET,
        generatorSignature(ctx.direction.generator),
        ctx.allowFreePaths ? 'You MAY add one custom {"kind":"shape","geometry":{"type":"path","d":"M… Z"}} (absolute commands, box 0–100) when no generator fits.' : 'Do NOT use geometry type "path": only generators and basic shapes.',
        ctx.withName ? 'The brand name is added next to the symbol: include a text layer role "wordmark" with the brand name.' : 'Symbol only: no wordmark layer.',
      ]
        .filter(Boolean)
        .join('\n'),
      user: [ctx.sheet, `DIRECTION: ${ctx.direction.type}${ctx.direction.generator ? ` / ${ctx.direction.generator}` : ''}${ctx.direction.variant ? ` / ${ctx.direction.variant}` : ''} — ${ctx.direction.idea}`, `BRAND NAME: ${ctx.brief.brandName}${ctx.brief.tagline ? ` · TAGLINE: ${ctx.brief.tagline}` : ''}`].join('\n'),
    }),
    parse: (raw) => {
      const json = parseLlmJson<Record<string, unknown>>(raw);
      const assembled = json ? assembleAuthored(json, ctx, palette, seed) : null;
      return assembled && check(assembled) ? assembled : undefined;
    },
    fallback,
  };
}

// ─── Jury (Ultra) ────────────────────────────────────────────────────────────

export function juryTask(sheet: string, drafts: PlannedLogo[], index: number): AgentTask<number> {
  return {
    role: 'logoJury',
    key: `logoJury:${index + 1}`,
    minLevel: 'ultra',
    profile: 'critic',
    prompt: () =>
      drafts.length < 2
        ? null
        : {
            system: ['You are a jury of senior brand designers. Pick the STRONGEST draft: distinctive, simple, balanced, true to the brand. The measurements are facts: never pick a draft with a lower quality score unless it is clearly more original.', 'Output ONLY: best: the letter of one draft'].join('\n'),
            user: [sheet, 'DRAFTS:', ...drafts.map((d, i) => `${LETTERS[i]}) ${d.recipe} — quality ${d.report.score}, small-size solidity ${Math.round((d.report.metrics.solid24 ?? 0) * 100)}%, novelty ${d.novelty} — ${d.doc.concept.rationale.slice(0, 140)}`)].join('\n'),
          },
    parse: (raw) => {
      const ids = drafts.map((_, i) => LETTERS[i]);
      const letter = pickOption(agentLines(raw).best || raw.trim(), ids);
      return letter ? ids.indexOf(letter) : undefined;
    },
    // Repli : la meilleure qualité mesurée.
    fallback: () => drafts.reduce((best, d, i) => (d.report.score > drafts[best].report.score ? i : best), 0),
  };
}

// ─── Critique visuelle (Ultra) ──────────────────────────────────────────────

export interface Critique {
  verdict: 'pass' | 'fix';
  /** Note par critère (1–5). */
  scores: Record<string, number>;
  patch: PatchOp[];
  note: string;
}

export const CRITIC_CRITERIA = ['distinctiveness', 'simplicity', 'balance', 'concept', 'craft', 'legibility'] as const;

export const CRITIC_INSTRUCTION = [
  'You are a senior brand designer reviewing a logo image (shown on white, then at small size).',
  'Score 1–5 each criterion: distinctiveness (not generic), simplicity (one idea), balance (weight, spacing, alignment), concept (fits the brand), craft (clean joins, no awkward gaps/overlaps), legibility (reads at 24 px).',
  'The WEAKEST criterion counts double. If anything scores ≤ 2, give a TARGETED patch (not a redesign): a JSON array of at most 4 operations among',
  '{"op":"layer","id","fill"?,"hidden"?,"params"?:{…},"transform"?:{…}} · {"op":"text","id","weight"?,"tracking"?,"case"?} · {"op":"composition","gap"?,"symbolScale"?,"padding"?,"layout"?} · {"op":"palette","ink"?,"accent"?} · {"op":"generator","id","generator","params"?}',
  'Output ONLY lines: scores: distinctiveness=N, simplicity=N, balance=N, concept=N, craft=N, legibility=N / verdict: pass|fix / patch: [ … ] (empty array when pass) / note: one sentence',
].join('\n');

export function parseCritique(raw: string, doc: LogoDocument): Critique | null {
  const text = (raw || '').replace(/```[a-z]*\n?/gi, '');
  const scoresLine = text.match(/scores?\s*[:=]\s*(.+)/i)?.[1] ?? '';
  const scores: Record<string, number> = {};
  for (const c of CRITIC_CRITERIA) {
    const m = scoresLine.match(new RegExp(`${c}\\s*[=:]\\s*(\\d(?:\\.\\d)?)`, 'i'));
    if (m) scores[c] = Math.min(5, Math.max(1, Number(m[1])));
  }
  if (Object.keys(scores).length < 4) return null;
  const verdict = /verdict\s*[:=]\s*pass/i.test(text) ? 'pass' : 'fix';
  const patchText = text.match(/patch\s*[:=]\s*(\[[\s\S]*?\])\s*(?:\n|$|note)/i)?.[1];
  let patch: PatchOp[] = [];
  if (patchText) {
    const parsed = parseLlmJson<unknown[]>(patchText);
    if (Array.isArray(parsed)) {
      // Seules les opérations qui s'appliquent au document sont gardées (couches existantes, générateurs connus).
      const probe = applyPatch(doc, parsed);
      patch = probe.ok ? (parsed.filter((op) => applyPatch(doc, [op]).ok) as PatchOp[]) : [];
    }
  }
  return { verdict, scores, patch, note: (text.match(/note\s*[:=]\s*(.+)/i)?.[1] ?? '').slice(0, 200) };
}

/** Note globale d'une critique : le critère le plus faible compte double (la vision note trop large sinon). */
export function critiqueScore(scores: Record<string, number>): number {
  const values = Object.values(scores);
  if (!values.length) return 0;
  const min = Math.min(...values);
  return (values.reduce((a, b) => a + b, 0) + min) / (values.length + 1);
}

export type { Traits };

// ─── Retouche demandée par l'utilisateur ────────────────────────────────────

/** Les opérations de patch, pour la consigne d'une retouche (la même grammaire que la critique). */
export const PATCH_GRAMMAR = [
  'Answer with ONLY a JSON array of at most 5 operations, applied to the existing layers (never redraw the logo):',
  '{"op":"layer","id","fill"?:"ink|ink2|accent|paper|none","hidden"?:bool,"opacity"?,"params"?:{generator params},"transform"?:{"x","y","rotate","scale","flipX","flipY"}}',
  '{"op":"text","id","content"?,"case"?:"upper|lower|title|none","tracking"?,"weight"?,"effects"?:[…]}',
  '{"op":"generator","id","generator":"<id>","params"?:{…}}  (swap the symbol)',
  '{"op":"composition","layout"?:"horizontal|stacked|symbol-only|wordmark-only","gap"?,"symbolScale"?,"padding"?}',
  '{"op":"palette","ink"?:"#rrggbb","ink2"?,"accent"?}',
  '{"op":"remove","id"} · {"op":"add","layer":{…}}',
  'Colour roles only on layers; hex only in "palette". Return [] when the request cannot be done with these operations.',
].join('\n');

/** Résumé compact des couches : ce que le modèle doit connaître pour viser la bonne. */
export function layerDigest(doc: LogoDocument): string {
  const lines = JSON.stringify(
    doc.layers.map((l) => ({
      id: l.id,
      kind: l.kind,
      ...(l.kind === 'generator' ? { generator: l.generator, params: l.params } : {}),
      ...(l.kind === 'text' ? { content: l.content, role: l.role } : {}),
      ...(l.kind === 'shape' ? { geometry: l.geometry.type } : {}),
      ...(l.fill !== 'ink' ? { fill: l.fill } : {}),
    }))
  );
  return `LAYERS: ${lines.slice(0, 1400)}\nPALETTE: ink ${doc.palette.ink}${doc.palette.ink2 ? `, ink2 ${doc.palette.ink2}` : ''}${doc.palette.accent ? `, accent ${doc.palette.accent}` : ''}\nCOMPOSITION: ${JSON.stringify(doc.composition)}`;
}

/** La demande de l'utilisateur (« plus rond », « mets le nom en capitales ») devient un patch, pas un nouveau dessin. */
export function editTask(doc: LogoDocument, request: string): AgentTask<PatchOp[] | null> {
  return {
    role: 'logoEditor',
    minLevel: 'low',
    prompt: () => ({
      system: [`You edit an existing logo described as layers. Turn the user's request into a targeted patch.`, PATCH_GRAMMAR].join('\n'),
      user: [layerDigest(doc), `REQUEST: ${request.slice(0, 400)}`].join('\n'),
    }),
    parse: (raw) => {
      const ops = parseLlmJson<unknown[]>((raw || '').replace(/^[^[]*/, ''));
      if (!Array.isArray(ops) || !ops.length) return undefined;
      const result = applyPatch(doc, ops);
      if (!result.ok) return undefined;
      return ops.filter((op) => applyPatch(doc, [op]).ok) as PatchOp[];
    },
    fallback: () => null,
  };
}

/**
 * « AMÉLIORER MON LOGO » — trois rôles, un contrôle par le code.
 *
 *   1. OBSERVATEUR (vision)   décrit le logo envoyé : éléments, géométrie, couleurs, ce qu'il faut garder,
 *                             ce qu'il faut corriger (`reading.ts`). Palette et texte sont mesurés par le code.
 *   2. DESSINATEUR (texte)    ne voit PAS l'image : il écrit le Logo IR d'une amélioration à partir de la
 *                             description (éléments + boîtes 0–100) et de la CARTE D'ENCRE mesurée par le
 *                             code (silhouette 20 × 20). Trois degrés : fidèle · affiné · évolué. Il reçoit
 *                             aussi les bonnes pratiques du type de logo (`validate/practices.ts`).
 *   3. CONTRÔLE (code)        chaque brouillon passe le pipeline qualité, puis est comparé à l'original :
 *                             ressemblance de silhouette (empreinte d'encre) et écart de teinte. Ni
 *                             méconnaissable, ni identique.
 *   4. COMPARATEUR (vision, High+)  voit original | brouillon côte à côte et répond par un patch ciblé ;
 *                             le patch n'est gardé que s'il améliore la note composite.
 *
 * Avec un modèle vectoriel (OmniSVG, servi par idem-ml) et un logo SANS texte, l'image de l'original est
 * aussi vectorisée par ce modèle : un candidat « fidèle » de plus, converti en Logo IR et soumis au même
 * contrôle (OmniSVG n'écrit pas : un logo à texte reste au seul dessinateur).
 *
 * Si le modèle est absent ou muet, `improveLogo` rend une liste vide : l'appelant reprend le moteur standard.
 */
import sharp from 'sharp';
import { parseLlmJson } from '../../../utils/llm-json.util';
import { atLeast } from '../../../models/creativity.model';
import type { CreativityLevel } from '../../../models/creativity.model';
import { CreativeOrchestrator } from '../../creativity/orchestrator';
import type { AgentCall, AgentTask } from '../../creativity/orchestrator';
import { convertSvgToPng } from '../../logo-import.service';
import { assembleAuthored, IR_CHEATSHEET, PATCH_GRAMMAR, layerDigest } from '../agent/tasks';
import type { AuthoredLogo } from '../agent/tasks';
import { parseLogoDocument } from '../ir/logo.schema';
import type { LogoDocument } from '../ir/logo.schema';
import { applyPatch } from '../ir/patch';
import { produceLogo } from '../pipeline';
import { inkPalette } from '../planner/brief';
import type { PlanBrief } from '../planner/brief';
import { hashSeed } from '../planner/planner';
import type { PlannedLogo } from '../planner/planner';
import { defaultRasterizer, renderPng } from '../raster/rasterizer';
import type { RasterImage } from '../raster/rasterizer';
import { gridSimilarity, inkBox, inkGrid } from '../raster/measure';
import type { BuildOptions } from '../render/build';
import { hueGap, inkMap, measurePalette, mergePalette, OBSERVER_INSTRUCTION, parseReading, readingKey, readingSheet, svgTexts } from './reading';
import { practiceBrief } from '../validate/practices';
import type { LogoReading } from './reading';
import { defaultKernel } from '../kernel/paper.kernel';
import type { VectorModel } from '../vector/client';
import { importVectorSymbol } from '../vector/import';

export type Vision = (png: Buffer, instruction: string) => Promise<string>;
export type Cache = { get(key: string): Promise<unknown | null>; set(key: string, value: unknown): Promise<void> };

export type Degree = 'faithful' | 'refined' | 'evolved';
const DEGREES: Degree[] = ['faithful', 'refined', 'evolved'];

const DEGREE_BRIEF: Record<Degree, string> = {
  faithful: 'FAITHFUL: the same silhouette, the same proportions, the same colors and the same layout. Only clean it: exact geometry, equal strokes, perfect alignment, tidy spacing, details removed if they die at 24 px. Someone who knows the logo must think it is the same logo, just professionally drawn.',
  refined: 'REFINED: the same core idea, shape family and hue family, but re-proportioned and simplified: stronger silhouette, harmonised palette (same hues, better balanced), better weight distribution and spacing. Recognisable at a glance.',
  evolved: 'EVOLVED: keep the symbol idea, the initials/name and the hue family, but reinterpret it in a modern geometric language (bolder construction, negative space or a smarter join). Still clearly a descendant of the original.',
};

// ─── Rasters ────────────────────────────────────────────────────────────────

async function rasterOfSvg(svg: string, width = 128): Promise<RasterImage | null> {
  try {
    return await defaultRasterizer().render(svg, width, null);
  } catch {
    try {
      const png = await convertSvgToPng(svg, width, width);
      const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      return { width: info.width, height: info.height, rgba: new Uint8Array(data) };
    } catch {
      return null;
    }
  }
}

/** Un logo dont l'encre est écrite sur fond opaque (JPEG, PNG intégré) : la transparence ne dit rien, on lit la luminosité. */
function inkAlpha(image: RasterImage): RasterImage {
  let opaque = 0;
  for (let i = 3; i < image.rgba.length; i += 4) if (image.rgba[i] >= 250) opaque++;
  if (opaque / (image.rgba.length / 4) < 0.98) return image;
  const out = new Uint8Array(image.rgba);
  for (let i = 0; i < out.length; i += 4) {
    const lum = 0.2126 * out[i] + 0.7152 * out[i + 1] + 0.0722 * out[i + 2];
    out[i + 3] = lum > 235 ? 0 : 255;
  }
  return { ...image, rgba: out };
}

/** L'encre recadrée sur sa boîte puis posée au centre d'un carré : deux logos de marges différentes se comparent. */
export function normalizedGrid(image: RasterImage, n = 16): Float32Array | null {
  const box = inkBox(image);
  if (!box) return null;
  const x0 = Math.floor(box.x0 * image.width);
  const y0 = Math.floor(box.y0 * image.height);
  const w = Math.max(1, Math.ceil(box.x1 * image.width) - x0);
  const h = Math.max(1, Math.ceil(box.y1 * image.height) - y0);
  const side = Math.max(w, h);
  const out = new Uint8Array(side * side * 4);
  const ox = Math.floor((side - w) / 2);
  const oy = Math.floor((side - h) / 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[((y + oy) * side + x + ox) * 4 + 3] = image.rgba[((y + y0) * image.width + x + x0) * 4 + 3];
  return inkGrid({ width: side, height: side, rgba: out }, n);
}

async function sideBySide(left: Buffer, right: Buffer): Promise<Buffer> {
  const a = await sharp(left).resize({ height: 420, fit: 'inside', background: '#ffffff' }).flatten({ background: '#ffffff' }).png().toBuffer();
  const b = await sharp(right).resize({ height: 420, fit: 'inside', background: '#ffffff' }).flatten({ background: '#ffffff' }).png().toBuffer();
  const am = await sharp(a).metadata();
  const bm = await sharp(b).metadata();
  return sharp({ create: { width: (am.width ?? 420) + (bm.width ?? 420) + 48, height: 440, channels: 3, background: '#ffffff' } })
    .composite([
      { input: a, left: 8, top: 10 },
      { input: b, left: (am.width ?? 420) + 40, top: 10 },
    ])
    .png()
    .toBuffer();
}

// ─── 1. L'observateur ───────────────────────────────────────────────────────

export interface ObserveResult {
  reading: LogoReading;
  /** Tokens estimés de la vision (entrée + sortie). */
  tokens: { input: number; output: number };
  cached: boolean;
}

/** La lecture du logo : vision + mesures du code. Lève si l'image ne peut pas être lue ou décrite. */
export async function observeLogo(svg: string, vision: Vision, cache?: Cache): Promise<ObserveResult> {
  const key = readingKey(svg);
  const hit = (await cache?.get(key).catch(() => null)) as LogoReading | null | undefined;
  if (hit && Array.isArray(hit.elements) && hit.elements.length) return { reading: hit, tokens: { input: 0, output: 0 }, cached: true };

  const big = await convertSvgToPng(svg, 512, 512);
  const tiny = await convertSvgToPng(svg, 48, 48).catch(() => null);
  const image = tiny ? await sideBySide(big, await sharp(tiny).resize({ height: 96, kernel: 'nearest' }).png().toBuffer()) : big;
  const measured = await rasterOfSvg(svg, 160);
  const palette = measured ? measurePalette(inkAlpha(measured)) : [];

  const tokens = { input: 0, output: 0 };
  let problem = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const instruction = problem ? `${OBSERVER_INSTRUCTION}\n\nYOUR PREVIOUS ANSWER WAS REJECTED because ${problem}. Answer again, complete.` : OBSERVER_INSTRUCTION;
    const raw = await vision(image, instruction).catch(() => '');
    tokens.input += Math.ceil(instruction.length / 4) + 900;
    tokens.output += Math.ceil(raw.length / 4);
    const parsed = parseReading(raw);
    if (!parsed.reading) {
      problem = parsed.problem ?? 'the answer was empty';
      continue;
    }
    const { paletteUsage, ...rest } = parsed.reading;
    const texts = svgTexts(svg);
    const reading: LogoReading = {
      ...rest,
      // Le texte écrit dans le SVG fait foi sur la lecture du modèle.
      brandText: texts.length ? texts.join(' ').slice(0, 80) : rest.brandText,
      palette: palette.length ? mergePalette(palette, paletteUsage) : paletteUsage.map((p) => ({ hex: p.hex, share: 0, usage: p.usage })),
    };
    await cache?.set(key, reading).catch(() => undefined);
    return { reading, tokens, cached: false };
  }
  throw new Error(`logo_reading_failed: ${problem}`);
}

// ─── 2. Le dessinateur ──────────────────────────────────────────────────────

interface RedrawContext {
  reading: LogoReading;
  brief: PlanBrief;
  degree: Degree;
  wish?: string;
  withName: boolean;
  /** La silhouette de l'original mesurée par le code (`inkMap`), dans le carré 0–100. */
  inkMap?: string;
}

/** Côté de la carte d'encre donnée au dessinateur (1 case = 5 unités de la boîte 0–100). */
export const INK_MAP_SIZE = 20;

export function redrawTask(ctx: RedrawContext, palette: ReturnType<typeof inkPalette>, seed: number, key: string): AgentTask<AuthoredLogo | null> {
  const direction = { type: ctx.reading.conceptType, idea: `${ctx.degree} improvement of the imported logo` };
  const authorCtx = { sheet: '', brief: ctx.brief, direction, withName: ctx.withName, allowFreePaths: true };
  return {
    role: 'logoAuthor',
    key,
    minLevel: 'low',
    profile: 'coder',
    // Partie fixe d'abord (rôle, mémento, règles) : préfixe identique pour les 3 degrés, relu par le cache du fournisseur.
    prompt: () => ({
      system: [
        'You are the REDRAWER. You never see the original image: the OBSERVER described it and the code measured its INK MAP. Redraw it as an IMPROVED logo, written as a Logo IR. The engine builds exact vector geometry from it.',
        'Non-negotiable: reproduce every KEEP feature; fix every FIX item; keep the element layout (what sits where, use the element boxes as coordinates in the 0–100 box) and the proportions between elements; follow the INK MAP silhouette; keep the hue family of the palette.',
        IR_CHEATSHEET,
        'You MAY add custom {"kind":"shape","geometry":{"type":"path","d":"M… Z"}} (absolute commands, box 0–100) to reproduce a silhouette that no generator or basic shape can draw.',
      ].join('\n'),
      user: [
        `DEGREE — ${DEGREE_BRIEF[ctx.degree]}`,
        practiceBrief(ctx.reading.conceptType),
        ctx.withName ? `The text "${ctx.brief.brandName}" is part of the logo: include a text layer role "wordmark" with exactly that text, matching the described typography.` : 'Symbol only: no wordmark layer.',
        readingSheet(ctx.reading),
        ctx.inkMap ? `INK MAP of the original symbol (measured, ${INK_MAP_SIZE}×${INK_MAP_SIZE}, one cell = 5 units of the 0–100 box; # ink, + partial, . empty):\n${ctx.inkMap}` : '',
        ctx.wish ? `CLIENT WISH: ${ctx.wish.slice(0, 300)}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    }),
    parse: (raw) => {
      const json = parseLlmJson<Record<string, unknown>>(raw);
      const assembled = json ? assembleAuthored(json, authorCtx, palette, seed) : null;
      return assembled && parseLogoDocument(assembled.doc).ok ? assembled : undefined;
    },
    fallback: () => null,
  };
}

// ─── 3. Le contrôle ─────────────────────────────────────────────────────────

export const FIDELITY = { recognisable: 0.3, identical: 0.97 } as const;

export interface Judged {
  logo: PlannedLogo;
  degree: Degree;
  /** Ressemblance de silhouette avec l'original (0–1). */
  similarity: number;
  hueGap: number;
  /** Note composite 0–1 : qualité mesurée, ressemblance, teinte. */
  score: number;
  recognisable: boolean;
}

export async function judgeDraft(logo: PlannedLogo, degree: Degree, original: { grid: Float32Array; primary?: string }): Promise<Judged | null> {
  const image = await rasterOfSvg(logo.rendered.svg, 128);
  const grid = image ? normalizedGrid(image) : null;
  if (!image || !grid) return null;
  const similarity = gridSimilarity(original.grid, grid);
  const palette = measurePalette(image);
  const gap = original.primary && palette[0] ? hueGap(original.primary, palette[0].hex) : 0;
  const fidelity = similarity < FIDELITY.recognisable ? similarity * 0.5 : similarity > FIDELITY.identical ? 0.55 : Math.min(1, 0.45 + similarity);
  const hue = gap <= 25 ? 1 : gap <= 45 ? 0.5 : 0;
  const score = Math.round((0.4 * (logo.report.score / 100) + 0.4 * fidelity + 0.2 * hue) * 1000) / 1000;
  return { logo, degree, similarity: Math.round(similarity * 100) / 100, hueGap: Math.round(gap), score, recognisable: similarity >= FIDELITY.recognisable && gap <= 45 };
}

export const COMPARATOR_INSTRUCTION = [
  'The image shows an ORIGINAL logo (left) and a REDRAWN improved version (right). You are a strict brand-identity reviewer.',
  'Score 1–5: recognizable (would a person who knows the original accept the redraw as the same brand? silhouette, symbol idea, name, hue family), improved (cleaner geometry, balance, small-size legibility than the original).',
  'If recognizable ≤ 3 or improved ≤ 3, give a TARGETED patch bringing the redraw closer to the original or cleaner (never a redesign).',
  PATCH_GRAMMAR,
  'Output ONLY three lines: scores: recognizable=N, improved=N / patch: [ … ] (empty array when both ≥ 4) / note: one sentence',
].join('\n');

export function parseComparison(raw: string, doc: LogoDocument): { recognizable: number; improved: number; patch: unknown[]; note: string } | null {
  const text = (raw || '').replace(/```[a-z]*\n?/gi, '');
  const rec = text.match(/recognizable\s*[=:]\s*(\d(?:\.\d)?)/i)?.[1];
  const imp = text.match(/improved\s*[=:]\s*(\d(?:\.\d)?)/i)?.[1];
  if (!rec || !imp) return null;
  const patchText = text.match(/patch\s*[:=]\s*(\[[\s\S]*?\])\s*(?:\n|$|note)/i)?.[1];
  const parsed = patchText ? parseLlmJson<unknown[]>(patchText) : [];
  const patch = Array.isArray(parsed) ? parsed.filter((op) => applyPatch(doc, [op]).ok).slice(0, 5) : [];
  return { recognizable: Number(rec), improved: Number(imp), patch, note: text.match(/note\s*[:=]\s*(.+)/i)?.[1]?.trim().slice(0, 200) ?? '' };
}

// ─── L'orchestration ────────────────────────────────────────────────────────

export interface ImproveRequest {
  svg: string;
  /** Le brief du projet (le nom de la marque vient du logo quand il y est lu). */
  brief: PlanBrief;
  build: BuildOptions;
  level: CreativityLevel;
  count: number;
  call?: AgentCall;
  vision?: Vision;
  cache?: Cache;
  wish?: string;
  seed: string;
  /** Le modèle vectoriel (OmniSVG via idem-ml) : vectorisation fidèle des logos sans texte. */
  vector?: VectorModel;
  onStage?: (stage: 'observing' | 'redrawing' | 'checking' | 'comparing', detail?: string) => void;
}

export interface ImproveResult {
  reading?: LogoReading;
  logos: (PlannedLogo & { degree: Degree; similarity: number })[];
  decisions: { stage: string; source: 'llm' | 'code'; detail?: string }[];
  tokens: { input: number; output: number };
}

export async function improveLogo(req: ImproveRequest): Promise<ImproveResult> {
  const decisions: ImproveResult['decisions'] = [];
  const empty: ImproveResult = { logos: [], decisions, tokens: { input: 0, output: 0 } };
  if (!req.call || !req.vision) return empty;

  // ── 1. Observer ──
  req.onStage?.('observing');
  let observed: ObserveResult;
  try {
    observed = await observeLogo(req.svg, req.vision, req.cache);
  } catch (error) {
    decisions.push({ stage: 'observer', source: 'code', detail: (error as Error).message.slice(0, 160) });
    return empty;
  }
  const { reading } = observed;
  decisions.push({ stage: 'observer', source: 'llm', detail: `${reading.elements.length} élément(s), ${reading.palette.length} couleur(s) mesurée(s)${observed.cached ? ' (lecture en cache)' : ''}` });

  const originalImage = await rasterOfSvg(req.svg, 128);
  const grid = originalImage ? normalizedGrid(inkAlpha(originalImage)) : null;
  if (!grid) return { ...empty, reading, decisions };
  const original = { grid, primary: reading.palette[0]?.hex };
  const silhouette = originalImage ? normalizedGrid(inkAlpha(originalImage), INK_MAP_SIZE) : null;
  const map = silhouette ? inkMap(silhouette, INK_MAP_SIZE) : undefined;

  // ── 2. Dessiner : un degré par proposition, plusieurs brouillons à Ultra ──
  req.onStage?.('redrawing');
  const orchestrator = new CreativeOrchestrator({ level: req.level, call: req.call });
  const brief: PlanBrief = { ...req.brief, brandName: reading.brandText || req.brief.brandName };
  const palette = inkPalette({ primary: reading.palette[0]?.hex, secondary: reading.palette[1]?.hex, accent: reading.palette[2]?.hex, text: reading.palette[0]?.hex });
  const withName = !!reading.brandText && reading.layout !== 'symbol-only';
  const perDegree = req.level === 'ultra' ? 2 : 1;
  const wanted = Math.max(1, req.count);
  const tasks: { degree: Degree; task: AgentTask<AuthoredLogo | null> }[] = [];
  for (let i = 0; i < wanted; i++) {
    const degree = DEGREES[i % DEGREES.length];
    for (let d = 0; d < perDegree; d++) tasks.push({ degree, task: redrawTask({ reading, brief, degree, wish: req.wish, withName, inkMap: map }, palette, hashSeed(`${req.seed}#improve#${i}#${d}`), `logoRedraw:${i + 1}.${d + 1}`) });
  }
  // La vectorisation par le modèle vectoriel part en même temps que le dessinateur.
  const vectorize =
    req.vector && !withName && reading.layout !== 'wordmark-only'
      ? convertSvgToPng(req.svg, 448, 448)
          .then((png) => req.vector!.imageToSvg(png, { candidates: 3, seed: hashSeed(`${req.seed}#vector`) }))
          .catch(() => [])
      : null;
  const written = await orchestrator.all(tasks.map((t) => t.task));

  // ── 3. Contrôler : pipeline qualité + fidélité à l'original ──
  req.onStage?.('checking');
  const judged: Judged[] = [];
  for (let i = 0; i < written.length; i++) {
    const doc = written[i].value;
    if (!doc) continue;
    const made = await produceLogo(doc.doc, { ...req.build, allowFreePaths: true }, { skipVariants: true });
    if (!made.ok || !made.logo) continue;
    const planned: PlannedLogo = { ...made.logo, type: reading.conceptType, recipe: `improve:${tasks[i].degree}`, novelty: 1 };
    const verdict = await judgeDraft(planned, tasks[i].degree, original);
    if (verdict) judged.push(verdict);
  }
  const written_ok = judged.length;
  decisions.push({ stage: 'redrawer', source: written_ok ? 'llm' : 'code', detail: `${written_ok}/${written.length} brouillon(s) valides ; ressemblance ${judged.map((j) => `${j.degree} ${j.similarity}`).join(' · ')}` });
  if (vectorize) {
    const candidates = await vectorize;
    let kept = 0;
    for (const [k, candidate] of candidates.entries()) {
      const imported = importVectorSymbol(candidate.svg, palette, defaultKernel(), { idPrefix: 'v' });
      if (!imported.ok) continue;
      const doc = {
        brief: { brandName: brief.brandName, industry: brief.industry ?? '', audience: brief.audience ?? '', personality: (brief.personality ?? []).slice(0, 6) },
        concept: { type: reading.conceptType, rationale: 'Vectorisation fidèle de l\'original (OmniSVG)', motifs: ['omnisvg'], recipe: 'improve:omnisvg' },
        palette,
        composition: { layout: 'symbol-only' },
        layers: imported.layers,
        meta: { seed: hashSeed(`${req.seed}#vector#${k}`), engine: 'logo-engine/1+omnisvg' },
      };
      const made = await produceLogo(doc, { ...req.build, allowFreePaths: true }, { skipVariants: true });
      if (!made.ok || !made.logo) continue;
      const verdict = await judgeDraft({ ...made.logo, type: reading.conceptType, recipe: 'improve:omnisvg', novelty: 1 }, 'faithful', original);
      if (verdict) {
        judged.push(verdict);
        kept++;
      }
    }
    decisions.push({ stage: 'vector', source: candidates.length ? 'llm' : 'code', detail: candidates.length ? `OmniSVG : ${kept}/${candidates.length} vectorisation(s) fidèle(s) retenue(s)` : 'OmniSVG n\'a rien rendu (absent, occupé ou hors délai)' });
  }
  if (!judged.length) return { ...empty, reading, decisions, tokens: sum(orchestrator.tokens, observed.tokens) };

  // ── 4. Comparer (High+) : original | brouillon, patch ciblé gardé seulement s'il améliore ──
  if (atLeast(req.level, 'high')) {
    req.onStage?.('comparing');
    const originalPng = await convertSvgToPng(req.svg, 420, 420).catch(() => null);
    // Chaque brouillon est comparé à l'original EN PARALLÈLE (au plus 2 tours chacun).
    const compareOne = async (entry: Judged) => {
      if (!originalPng || (entry.recognisable && entry.similarity >= 0.6)) return;
      for (let round = 0; round < 2; round++) {
        const draftPng = await renderPng(entry.logo.rendered.svg, 420, '#ffffff').catch(() => null);
        if (!draftPng) break;
        const text = `${COMPARATOR_INSTRUCTION}\n${layerDigest(entry.logo.doc as LogoDocument)}\nKEEP: ${reading.keep.join(' | ').slice(0, 400)}`;
        const raw = await req.vision!(await sideBySide(originalPng, draftPng), text).catch(() => '');
        const cmp = parseComparison(raw, entry.logo.doc as LogoDocument);
        if (!cmp || !cmp.patch.length || (cmp.recognizable >= 4 && cmp.improved >= 4)) break;
        const patched = applyPatch(entry.logo.doc as LogoDocument, cmp.patch);
        if (!patched.ok || !patched.doc) break;
        const made = await produceLogo(patched.doc, { ...req.build, allowFreePaths: true }, { skipVariants: true });
        if (!made.ok || !made.logo) break;
        const next = await judgeDraft({ ...made.logo, type: entry.logo.type, recipe: entry.logo.recipe, novelty: 1 }, entry.degree, original);
        if (!next || next.score <= entry.score) break;
        Object.assign(entry, next);
        decisions.push({ stage: 'comparator', source: 'llm', detail: `${entry.degree} : reconnaissable ${cmp.recognizable}/5, amélioré ${cmp.improved}/5 → patch gardé (${entry.score})` });
      }
    };
    await Promise.all(judged.map(compareOne));
  }

  // Un seul brouillon par degré (le mieux noté) ; les reconnaissables d'abord.
  const best = new Map<Degree, Judged>();
  for (const entry of judged) {
    const cur = best.get(entry.degree);
    if (!cur || entry.score > cur.score) best.set(entry.degree, entry);
  }
  const ranked = [...best.values()].sort((a, b) => Number(b.recognisable) - Number(a.recognisable) || b.score - a.score);
  const keep = ranked.filter((j) => j.recognisable);
  const logos = (keep.length ? keep : ranked.filter((j) => j.similarity >= FIDELITY.recognisable * 0.7)).slice(0, wanted).map((j) => ({ ...j.logo, degree: j.degree, similarity: j.similarity }));
  decisions.push({ stage: 'check', source: 'code', detail: `${logos.length} proposition(s) retenue(s) sur ${ranked.length} degré(s) ; teinte d'origine ${original.primary ?? 'n/a'}` });
  return { reading, logos, decisions, tokens: sum(orchestrator.tokens, observed.tokens) };
}

const sum = (a: { input: number; output: number }, b: { input: number; output: number }) => ({ input: a.input + b.input, output: a.output + b.output });

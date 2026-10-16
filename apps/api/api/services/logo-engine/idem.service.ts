/**
 * L'ADAPTATEUR IDEM du moteur de logos — le seul fichier du moteur qui connaît l'application.
 *
 * Il branche ce que le moteur demande à son hôte :
 *   · les polices   le chargeur de polices de la charte (Google, Fontshare, polices importées)
 *   · le modèle     le runtime d'agents (étages, escalade, suivi d'usage) et le modèle de vision
 *   · le projet     charte (palette, polices, direction artistique), brief, mémoire des logos montrés
 *
 * et traduit le résultat en `LogoModel` (le format stocké et affiché par IDEM), avec le Logo IR
 * en plus : c'est lui qui rend possibles les déclinaisons sans IA, la recoloration, le
 * changement de police et les retouches ciblées.
 */
import crypto from 'crypto';
import logger from '../../config/logger';
import type { LogoModel, LogoPreferences } from '../../models/logo.model';
import type { ProjectModel } from '../../models/project.model';
import { cacheService } from '../cache.service';
import { brandSheet } from '../creativity/agent-io';
import { CreativeOrchestrator, runtimeCall } from '../creativity/orchestrator';
import type { CreativityLevel } from '../../models/creativity.model';
import { idemAnalyzeImage } from '../ivision/host';
import { designLogos } from './agent/agent';
import type { AgentResult } from './agent/agent';
import { editTask } from './agent/tasks';
import { LOGO_IR_VERSION, parseLogoDocument } from './ir/logo.schema';
import type { ConceptType, LogoDocument } from './ir/logo.schema';
import { applyPatch } from './ir/patch';
import { idemFontProvider } from './kernel/fontProviders';
import { produceLogo } from './pipeline';
import type { PlannedLogo } from './planner/planner';
import type { CharterPalette, LogoKind, PlanBrief } from './planner/brief';
import { inkPalette } from './planner/brief';
import { getGenerator } from './render/generators';
import { LogoSession } from './render/build';
import type { BuildOptions } from './render/build';
import type { BrandFonts } from './render/scene';
import { idemVariations } from './render/variants';
import type { LogoFingerprint } from './validate/fingerprint';

/** `LOGO_ENGINE=legacy` (ou `off`) rend la main à l'ancien pipeline (SVG dessiné par le modèle). */
export function logoEngineEnabled(): boolean {
  const value = (process.env.LOGO_ENGINE || 'on').toLowerCase();
  return value !== 'legacy' && value !== 'off';
}

const TYPE_LABELS: Record<ConceptType, string> = {
  wordmark: 'Logotype',
  lettermark: 'Monogramme',
  letterform: 'Lettre signature',
  pictorial: 'Pictogramme',
  abstract: 'Symbole abstrait',
  mascot: 'Mascotte',
  combination: 'Symbole + nom',
  emblem: 'Emblème',
  dynamic: 'Logo dynamique',
  minimal: 'Minimaliste',
  'negative-space': 'Espace négatif',
};

// ─── Ce que le moteur lit du projet ─────────────────────────────────────────

export interface EngineProjectInput {
  project: ProjectModel;
  brandName: string;
  /** Contexte extrait de la description (secteur, valeurs, public). */
  context: { industry: string; values: string[]; targetAudience: string; uniqueSellingPoint: string };
  description: string;
}

type Branding = NonNullable<ProjectModel['analysisResultModel']>['branding'];

export function charterOf(branding: Branding | undefined): { palette: CharterPalette; fonts: BrandFonts } {
  const colors = (branding?.colors?.colors as Record<string, string | undefined> | undefined) ?? {};
  const typography = branding?.typography;
  const display = (typography?.primary?.family || typography?.primaryFont || 'Archivo').trim();
  const body = (typography?.secondary?.family || typography?.secondaryFont || 'Inter').trim();
  return {
    palette: { primary: colors.primary, secondary: colors.secondary, accent: colors.accent, text: colors.text, background: colors.background },
    fonts: { display: { family: display, cssUrl: typography?.primary?.cssUrl }, body: { family: body, cssUrl: typography?.secondary?.cssUrl } },
  };
}

export function briefOf({ project, brandName, context, description }: EngineProjectInput): PlanBrief {
  const art = project.analysisResultModel?.branding?.artDirection;
  return {
    brandName,
    tagline: art?.tagline || undefined,
    industry: [context.industry, project.type].filter(Boolean).join(' '),
    description: [description, context.uniqueSellingPoint].filter(Boolean).join(' ').slice(0, 800),
    audience: context.targetAudience,
    personality: [...context.values, ...(art?.keywords ?? [])].slice(0, 8),
  };
}

const KIND_OF: Record<string, LogoKind> = { icon: 'icon', name: 'name', initial: 'initial' };

// ─── Génération ─────────────────────────────────────────────────────────────

export interface EngineConceptsRequest extends EngineProjectInput {
  userId: string;
  projectId: string;
  preferences?: LogoPreferences;
  level: CreativityLevel;
  /** Propositions déjà présentées (reprise) : le moteur n'en propose pas de semblables. */
  existing: LogoModel[];
  count: number;
  /** Une relance propose d'autres formes ; une reprise garde celles du projet. */
  fresh: boolean;
  onStage?: (stage: string, detail?: string) => void;
}

export interface EngineConcepts {
  logos: LogoModel[];
  result: AgentResult;
}

/** Les empreintes des logos déjà montrés ou retenus pour ce projet. */
export function memoryOf(branding: Branding | undefined, existing: LogoModel[]): LogoFingerprint[] {
  const fingerprints: LogoFingerprint[] = [];
  for (const logo of [...existing, ...(branding?.generatedLogos ?? []), ...(branding?.logo ? [branding.logo] : [])]) {
    const fp = logo?.engine?.fingerprint;
    if (fp && Array.isArray(fp.grid) && fp.grid.length === 256) fingerprints.push(fp as LogoFingerprint);
  }
  return fingerprints.slice(-24);
}

export function buildOptionsFor(fonts: BrandFonts, level?: CreativityLevel): BuildOptions {
  return { fontProvider: idemFontProvider, fonts, allowFreePaths: level === 'ultra' };
}

/** Un logo planifié, au format stocké par IDEM. */
export function toLogoModel(planned: PlannedLogo, index: number, req: { preferences?: LogoPreferences; level?: string; decisions?: AgentResult['decisions'] }, fonts: BrandFonts): LogoModel {
  const doc = planned.doc;
  const symbol = planned.session.render({ layout: 'symbol-only' });
  const spec = doc.layers.map((l) => (l.kind === 'generator' ? getGenerator(l.generator) : undefined)).find(Boolean);
  const hasSymbol = !!symbol && symbol.layout === 'symbol-only';
  const colors = planned.rendered.stats.colors.map((c) => (c.length === 4 ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : c).toUpperCase());
  const fp = planned.fingerprint;
  return {
    id: `concept${String(index + 1).padStart(2, '0')}`,
    name: spec ? `${TYPE_LABELS[planned.type]} — ${spec.label}` : TYPE_LABELS[planned.type],
    concept: doc.concept.rationale || TYPE_LABELS[planned.type],
    colors,
    fonts: [...new Set([fonts.display.family])],
    svg: planned.rendered.svg,
    ...(hasSymbol ? { iconSvg: symbol!.svg } : {}),
    type: req.preferences?.type,
    customDescription: req.preferences?.customDescription,
    ir: JSON.parse(JSON.stringify(doc)),
    engine: {
      version: LOGO_IR_VERSION,
      category: planned.type,
      recipe: planned.recipe,
      score: planned.report.score,
      novelty: planned.novelty,
      level: req.level,
      fonts: { display: { family: fonts.display.family, cssUrl: fonts.display.cssUrl }, ...(fonts.body ? { body: { family: fonts.body.family, cssUrl: fonts.body.cssUrl } } : {}) },
      ...(fp ? { fingerprint: { type: fp.type, layout: fp.layout, motifs: fp.motifs, grid: fp.grid } } : {}),
      ...(req.decisions ? { decisions: req.decisions.slice(0, 12) } : {}),
    },
  };
}

/** Le logo, retrouvé depuis son SVG (une retouche renvoie le SVG, pas l'IR). */
const irKey = (svg: string) => crypto.createHash('sha1').update(svg).digest('hex').slice(0, 24);

export async function rememberIr(svg: string, doc: unknown): Promise<void> {
  await cacheService.set(irKey(svg), doc, { prefix: 'logoir', ttl: 24 * 3600 }).catch(() => undefined);
}

export async function recallIr(svg: string): Promise<unknown | null> {
  return cacheService.get(irKey(svg), { prefix: 'logoir' }).catch(() => null);
}

/**
 * Les propositions de logo : le moteur (planificateur + agents selon le cran) sur la charte du
 * projet. Lève si le moteur ne produit rien d'exploitable : l'appelant reprend alors l'ancien
 * pipeline.
 */
export async function engineLogoConcepts(req: EngineConceptsRequest): Promise<EngineConcepts> {
  const branding = req.project.analysisResultModel?.branding;
  const { palette, fonts } = charterOf(branding);
  const brief = briefOf(req);
  const kind = KIND_OF[req.preferences?.type ?? 'name'] ?? 'name';
  const sheet = brandSheet({
    brandName: req.brandName,
    businessType: req.project.type,
    palette: palette as Record<string, string | undefined>,
    fonts: { display: fonts.display.family, body: fonts.body?.family ?? fonts.display.family },
    art: branding?.artDirection,
  });
  const call = runtimeCall({ userId: req.userId, projectId: req.projectId, element: 'logo' });
  const seen = new Set(req.existing.map((l) => l.name));

  const result = await designLogos(
    {
      brief,
      palette,
      fonts,
      kind,
      withName: kind !== 'initial',
      seed: req.fresh ? `${req.projectId}:${Date.now()}` : req.projectId,
      count: req.count + (seen.size ? 1 : 0),
      level: req.level,
      sheet,
      wish: req.preferences?.customDescription,
      avoid: memoryOf(branding, req.existing),
    },
    buildOptionsFor(fonts, req.level),
    {
      call,
      vision: async (png, instruction) => idemAnalyzeImage(png.toString('base64'), 'image/png', instruction, { purpose: 'shot-critic', maxOutputTokens: 500 }),
      onStage: req.onStage,
    }
  );

  const offset = req.existing.length;
  const built = result.logos.map((planned, i) => toLogoModel(planned, offset + i, { preferences: req.preferences, level: req.level, decisions: result.decisions }, fonts));
  // Les noms nouveaux d'abord, complétés au besoin par les autres. Écarter les noms déjà vus SANS compléter vidait
  // la liste quand toutes les propositions portaient un nom existant — et `logo_engine_empty` renvoyait alors vers
  // l'ancien pipeline (SVG écrit par le modèle, critique et révision avec raisonnement) : ~20 fois plus de tokens.
  const logos = [...built.filter((logo) => !seen.has(logo.name)), ...built.filter((logo) => seen.has(logo.name))]
    .slice(0, req.count)
    .map((logo, i) => ({ ...logo, id: `concept${String(offset + i + 1).padStart(2, '0')}` }));
  if (!logos.length) throw new Error('logo_engine_empty');
  logger.info(`[LogoEngine] ${logos.length} proposition(s) (${req.level}) en ${result.stats.ms} ms — ${result.tokens.input + result.tokens.output} tokens estimés — ${logos.map((l) => `${l.engine?.category}:${l.engine?.score}`).join(' ')}`);
  await Promise.all(logos.map((l) => rememberIr(l.svg, l.ir)));
  return { logos, result };
}

// ─── Reprise d'un logo du moteur ────────────────────────────────────────────

/** La session de rendu d'un logo du moteur, sur la charte courante. */
export async function sessionOfLogo(logo: Pick<LogoModel, 'ir'>, fonts: BrandFonts, level?: CreativityLevel): Promise<LogoSession | null> {
  const parsed = parseLogoDocument(logo.ir);
  if (!parsed.ok || !parsed.doc) return null;
  return LogoSession.create(parsed.doc, buildOptionsFor(fonts, level ?? 'ultra'));
}

/**
 * Les déclinaisons d'un logo du moteur — fond clair, fond sombre, monochrome, avec le nom et
 * icône seule — produites par le code depuis la même géométrie. Aucun appel au modèle.
 */
export async function engineVariations(logo: LogoModel, branding: Branding | undefined) {
  // Les polices du rendu d'origine d'abord (elles suivent le logo), celles de la charte à défaut.
  const stored = logo.engine?.fonts;
  const fonts: BrandFonts = stored ? { display: stored.display, ...(stored.body ? { body: stored.body } : {}) } : charterOf(branding).fonts;
  const session = await sessionOfLogo(logo, fonts);
  if (!session) return null;
  return idemVariations(session);
}

// ─── Retouche demandée par l'utilisateur ────────────────────────────────────

export interface EngineEditResult {
  logo: LogoModel;
  summary: string;
}

/**
 * « Plus rond », « le nom en capitales » : la demande devient un patch sur le Logo IR (quelques
 * dizaines de tokens), appliqué par le code ; les couches satisfaisantes ne bougent pas.
 * `null` quand le moteur ne peut pas la traiter (pas d'IR connu, patch refusé) : l'ancien chemin reprend.
 */
export async function engineEditLogo(args: { userId: string; projectId: string; svg: string; ir?: unknown; request: string; project: ProjectModel; preferences?: LogoPreferences }): Promise<EngineEditResult | null> {
  const known = args.ir ?? (await recallIr(args.svg));
  const parsed = parseLogoDocument(known);
  if (!parsed.ok || !parsed.doc) return null;
  const doc: LogoDocument = parsed.doc;
  const branding = args.project.analysisResultModel?.branding;
  const { fonts } = charterOf(branding);

  const orchestrator = new CreativeOrchestrator({ level: 'ultra', call: runtimeCall({ userId: args.userId, projectId: args.projectId, element: 'logo' }) });
  const verdict = await orchestrator.run(editTask(doc, args.request));
  const ops = verdict.value;
  if (!ops || !ops.length) return null;
  const patched = applyPatch(doc, ops);
  if (!patched.ok || !patched.doc) return null;

  const made = await produceLogo(patched.doc, buildOptionsFor(fonts, 'ultra'));
  if (!made.ok || !made.logo) return null;
  const planned: PlannedLogo = { ...made.logo, recipe: 'edit', type: patched.doc.concept.type, novelty: 1 };
  const logo = toLogoModel(planned, 0, { preferences: args.preferences, level: 'ultra' }, fonts);
  const edited: LogoModel = { ...logo, id: `edited-${Date.now()}`, name: 'Edited Logo' };
  await rememberIr(edited.svg, edited.ir);
  return { logo: edited, summary: `${patched.applied} correction(s) ciblée(s) : ${ops.map((o) => ('id' in o && o.id ? `${o.op} ${o.id}` : o.op)).join(', ')}` };
}

// ─── Propagation de l'identité (palette, police) ────────────────────────────

export interface EngineAdaptation {
  svg: string;
  iconSvg?: string;
  colors: string[];
  recolored: boolean;
  retypeset: boolean;
  ir: LogoDocument;
  fonts: BrandFonts;
}

/**
 * Un changement de palette ou de police se propage à un logo du moteur en le RECONSTRUISANT
 * depuis son Logo IR : couleurs exactes, lettres retracées dans la nouvelle police, déclinaisons
 * identiques en géométrie — sans IA et sans approximation de couleur.
 */
export async function adaptEngineLogo(
  logo: LogoModel,
  options: {
    palette?: { before: Partial<Record<string, string>>; after: Partial<Record<string, string>> };
    fonts?: { before: { display: string; displayCss?: string; body: string; bodyCss?: string }; after: { display: string; displayCss?: string; body: string; bodyCss?: string } };
  }
): Promise<EngineAdaptation | null> {
  const parsed = parseLogoDocument(logo.ir);
  if (!parsed.ok || !parsed.doc) return null;
  let doc = parsed.doc;
  let recolored = false;
  let retypeset = false;

  if (options.palette) {
    const merged = { ...options.palette.before, ...options.palette.after };
    const next = inkPalette(merged as CharterPalette);
    if (JSON.stringify(next) !== JSON.stringify(doc.palette)) {
      doc = { ...doc, palette: next };
      recolored = true;
    }
  }
  const after = options.fonts?.after;
  const kept = logo.engine?.fonts;
  const fonts: BrandFonts = after?.display
    ? { display: { family: after.display, cssUrl: after.displayCss }, body: { family: after.body || kept?.body?.family || 'Inter', cssUrl: after.bodyCss } }
    : { display: kept?.display ?? { family: options.fonts?.before.display || 'Archivo' }, ...(kept?.body ? { body: kept.body } : {}) };
  if (options.fonts && options.fonts.after.display && options.fonts.after.display !== options.fonts.before.display) retypeset = true;
  if (!recolored && !retypeset) return null;

  const session = await LogoSession.create(doc, buildOptionsFor(fonts, 'ultra'));
  const main = session.render();
  if (!main) return null;
  const symbol = session.render({ layout: 'symbol-only' });
  const hasSymbol = !!symbol && symbol.layout === 'symbol-only';
  return { svg: main.svg, ...(hasSymbol ? { iconSvg: symbol!.svg } : {}), colors: main.stats.colors.map((c) => c.toUpperCase()), recolored, retypeset, ir: doc, fonts };
}

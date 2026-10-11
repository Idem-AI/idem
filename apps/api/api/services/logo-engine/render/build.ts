/**
 * LE COMPILATEUR — du Logo IR au SVG, sans modèle, sans navigateur.
 *
 * Une `LogoSession` charge les polices du document, résout ses couches une fois, puis peut
 * en écrire autant de rendus qu'on veut (couleur, monochrome, inversé, symbole seul…) sans
 * rien recalculer des formes. Même document + même graine + mêmes polices ⇒ même SVG, octet
 * pour octet : c'est ce qui rend les corrections ciblées et les tests reproductibles.
 */
import type { LayerOverride, LogoDocument, LogoLayer, TextLayer } from '../ir/logo.schema';
import { LogoDocumentSchema, walkLayers } from '../ir/logo.schema';
import type { GeometryKernel, Shape } from '../kernel/geometry';
import { defaultKernel } from '../kernel/paper.kernel';
import type { EngineFont, FontProvider } from '../kernel/typography';
import { composeScene, Groups, Layout, resolveGroups } from './compose';
import type { ComposedScene } from './compose';
import './generators';
import { ColorMode, emitSvg, optimizeSvg, svgStats } from './svg';
import { BrandFonts, BuildContext, BuildWarning, fontKey } from './scene';
import { fontRequest } from './text';

export interface BuildOptions {
  kernel?: GeometryKernel;
  fontProvider?: FontProvider;
  fonts: BrandFonts;
  /** Autorise le dessin libre (`path`) : crans où l'IA dessine (Max, Ultra). */
  allowFreePaths?: boolean;
}

export interface RenderSpec {
  mode?: ColorMode;
  monoColor?: string;
  /** Force une mise en page (symbole seul, nom seul) ; absent : celle du document. */
  layout?: Layout;
  title?: string;
}

export interface RenderedLogo {
  svg: string;
  width: number;
  height: number;
  layout: Layout;
  scene: ComposedScene;
  stats: { paths: number; nodes: number; bytes: number; colors: string[] };
}

/** Copie du document avec les retouches de couche d'une variante (système dynamique). */
export function applyOverrides(doc: LogoDocument, overrides: Record<string, LayerOverride> | undefined): LogoDocument {
  if (!overrides || !Object.keys(overrides).length) return doc;
  const copy = JSON.parse(JSON.stringify(doc)) as LogoDocument;
  walkLayers(copy.layers, (layer) => {
    const o = overrides[layer.id];
    if (!o) return;
    if (o.fill !== undefined) layer.fill = o.fill;
    if (o.hidden !== undefined) layer.hidden = o.hidden;
    if (o.transform) layer.transform = { ...(layer.transform ?? {}), ...o.transform };
    if (o.params && layer.kind === 'generator') layer.params = { ...layer.params, ...o.params };
  });
  return copy;
}

export class LogoSession {
  readonly warnings: BuildWarning[] = [];
  private groups: Groups | null = null;

  private constructor(
    readonly doc: LogoDocument,
    private readonly ctx: BuildContext
  ) {}

  /** Charge les polices demandées par les couches de texte, puis prépare la session. */
  static async create(doc: LogoDocument, options: BuildOptions): Promise<LogoSession> {
    const loaded = new Map<string, EngineFont>();
    const warnings: BuildWarning[] = [];
    const ctx: BuildContext = {
      kernel: options.kernel ?? defaultKernel(),
      fontProvider: options.fontProvider,
      fonts: options.fonts,
      loaded,
      doc,
      warnings,
      allowFreePaths: options.allowFreePaths ?? false,
    };
    const requests = new Map<string, { family: string; weight: number; cssUrl?: string }>();
    walkLayers(doc.layers, (layer: LogoLayer) => {
      if (layer.kind !== 'text') return;
      const req = fontRequest(layer as TextLayer, ctx);
      requests.set(fontKey(req.family, req.weight), req);
    });
    if (options.fontProvider) {
      await Promise.all(
        [...requests.entries()].map(async ([key, req]) => {
          try {
            const font = await options.fontProvider!.load(req.family, req.weight, req.cssUrl);
            if (font) loaded.set(key, font);
          } catch {
            // introuvable : la couche de texte le signalera
          }
        })
      );
    }
    const session = new LogoSession(doc, ctx);
    (session as { warnings: BuildWarning[] }).warnings = warnings;
    return session;
  }

  /** Une session sur le même document retouché (variante dynamique) : les polices sont déjà chargées. */
  withDocument(doc: LogoDocument): LogoSession {
    const ctx: BuildContext = { ...this.ctx, doc, warnings: [] };
    const session = new LogoSession(doc, ctx);
    (session as { warnings: BuildWarning[] }).warnings = ctx.warnings;
    return session;
  }

  private resolved(): Groups {
    if (!this.groups) this.groups = resolveGroups(this.doc, this.ctx);
    return this.groups;
  }

  /** Le document a-t-il du texte ? (sinon, aucune police n'est nécessaire) */
  get needsFonts(): boolean {
    let text = false;
    walkLayers(this.doc.layers, (l) => {
      if (l.kind === 'text') text = true;
    });
    return text;
  }

  /** Aire d'une forme (le noyau décide) : sert aux mesures de couleur dominante. */
  area(shape: Shape): number {
    return this.ctx.kernel.area(shape);
  }

  get kernel(): GeometryKernel {
    return this.ctx.kernel;
  }

  scene(layout?: Layout): ComposedScene | null {
    return composeScene(this.doc, this.resolved(), this.ctx, layout);
  }

  render(spec: RenderSpec = {}): RenderedLogo | null {
    const scene = this.scene(spec.layout);
    if (!scene || !scene.parts.length) return null;
    const title = spec.title ?? `${this.doc.brief.brandName} — logo`;
    const raw = emitSvg(scene, { palette: this.doc.palette, mode: spec.mode, monoColor: spec.monoColor, title, description: this.doc.concept.rationale || undefined });
    const svg = optimizeSvg(raw);
    return { svg, width: scene.width, height: scene.height, layout: scene.layout, scene, stats: svgStats(svg) };
  }
}

export interface BuildResult {
  ok: boolean;
  errors: string[];
  warnings: BuildWarning[];
  doc?: LogoDocument;
  session?: LogoSession;
  rendered?: RenderedLogo;
}

/** Valide le document, charge les polices et écrit le SVG principal. Ne lève jamais. */
export async function buildLogo(input: unknown, options: BuildOptions): Promise<BuildResult> {
  const parsed = LogoDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.slice(0, 8).map((i) => `${i.path.join('.') || '(racine)'} : ${i.message}`), warnings: [] };
  }
  try {
    const session = await LogoSession.create(parsed.data, options);
    const rendered = session.render();
    const fatal = !rendered;
    return {
      ok: !fatal,
      errors: fatal ? ['Le logo ne produit aucune forme visible.'] : [],
      warnings: session.warnings,
      doc: parsed.data,
      session,
      rendered: rendered ?? undefined,
    };
  } catch (error) {
    return { ok: false, errors: [`Construction impossible : ${(error as Error).message}`], warnings: [], doc: parsed.data };
  }
}

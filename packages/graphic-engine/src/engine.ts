/**
 * LE FLUX D'UNE GÉNÉRATION — l'orchestrateur du moteur.
 *
 *   contenu → médias → matière à plat (clés) → bible du document (directeur, une fois) → page écrite en HTML
 *   Tailwind (auteur) → assainie, remplie, compilée → « s'affiche-t-elle ? » → RenderResult + trace
 *
 * Aucun gabarit, aucune note esthétique, aucune critique, aucune réécriture automatique : le rendu est celui que
 * l'auteur a écrit. La seule correction est TECHNIQUE et bornée — une page qui ne s'affiche pas (réponse
 * inutilisable, rien de visible, rendu impossible) : corriger › réécrire autrement (modèle du cran au-dessus) ›
 * version minimale ; une tentative à la fois, jamais deux fois la même approche, dans un budget par document.
 * Ce qui résiste lève `GraphicRenderError` : l'hôte le dit, rien n'est remplacé en silence.
 *
 * La jauge de créativité choisit le MODÈLE (`level` transmis à l'hôte, qui résout le rôle sur son échelle) :
 * mêmes étapes et même contexte à tous les crans.
 */
import type { CreativityLevel, DocumentType, FormatId, Issue } from './contracts/common';
import type { SectionContent, SectionRole } from './contracts/content-model';
import type { DesignSpec, SectionSpec } from './contracts/design-spec';
import { isAuthoredSpec } from './contracts/design-spec';
import type { RenderResult } from './contracts/render-result';
import { validateSectionContent } from './contracts/validate';
import { applyAssets, GENERATION_CAP, planAssets, resolveAssets } from './asset-planner';
import { BrandInput, buildTokens, DesignTokens, DirectionInput } from './design-system/tokens';
import { FORMATS } from './design-system/formats';
import { stableHash } from './foundation/hash';
import { AgentCall, engineHost, FingerprintScope, log } from './host';
import { GenerationTrace, TraceRecorder } from './observability/traces';
import { ENGINE_VERSION, COMPONENT_LIBRARY_VERSION } from './version';
import { authorSystem, authorUser, directorPrompt, DocumentContext, parseBible, ReferenceComposition, RepairStrategy, repairUser, reviseUser } from './author/prompts';
import { callModel, levelUp } from './author/model';
import { buildContentMap, ContentMap } from './runtime/content-map';
import { expandPage, extractHtml, sanitizeHtml, withSize } from './runtime/expand';
import { compileTailwind } from './runtime/tailwind';
import { checkRender } from './runtime/check';

export interface DocumentOptions {
  documentType: DocumentType;
  format: FormatId;
  locale?: string;
  brand: BrandInput;
  direction?: DirectionInput;
  allowDark?: boolean;
  creativity?: CreativityLevel;
  /** La clé du livrable (journaux, mémoire des bibles). */
  seed: string;
  documentLabel?: string;
  /** Les pages attendues, dans l'ordre : le directeur écrit la bible pour elles. */
  sections?: Array<{ id: string; role?: SectionRole }>;
  bindings?: 'values' | 'markers';
  imageColors?: string[];
  /** Contrôler l'affichage dans Chromium (défaut : oui). */
  validate?: boolean;
  /** Photographier la page (visuels, cartes). */
  png?: boolean;
  /** Portée de la mémoire des bibles entre documents (marque, projet). */
  memoryScope?: FingerprintScope;
  user?: { userId?: string; projectId?: string };
  size?: { width: number; height: number };
  /** Ancien réglage du pied de page : la page est désormais écrite par l'auteur (ignoré). */
  footer?: 'full' | 'logo' | 'none';
  /** Une composition MODÈLE (image de référence de l'utilisateur, analysée) : l'auteur la reproduit. */
  reference?: ReferenceComposition;
  /** Ce que l'hôte sait du projet (activité, public), donné au directeur et à l'auteur. */
  brief?: string;
}

export interface SectionOutput {
  spec: SectionSpec;
  result: RenderResult;
  png?: Buffer;
  trace: GenerationTrace;
}

export class ContentError extends Error {
  constructor(readonly issues: Issue[]) {
    super(`Contenu invalide : ${issues.map((i) => i.message).join(' ')}`);
  }
}

/** Une page qui n'a pas pu s'afficher, même après la correction bornée — une erreur TECHNIQUE, dite. */
export class GraphicRenderError extends Error {
  constructor(
    readonly sectionId: string,
    readonly reason: string,
    readonly attempts: string[] = []
  ) {
    super(`La page « ${sectionId} » ne s'affiche pas : ${reason}`);
  }
}

/** Les bornes de la correction technique, par document. */
export function repairLimits(): { attempts: number; tokenBudget: number; maxMs: number } {
  const n = (v: string | undefined, d: number) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : d);
  return { attempts: Math.min(3, n(process.env.GRAPHIC_REPAIR_ATTEMPTS, 3)), tokenBudget: n(process.env.GRAPHIC_REPAIR_TOKEN_BUDGET, 60000), maxMs: n(process.env.GRAPHIC_REPAIR_MAX_MS, 240000) };
}

const REPAIR_PLAN: RepairStrategy[] = ['fix', 'rewrite', 'minimal'];
const AUTHOR_TIMEOUT = 150_000;
const DIRECTOR_TIMEOUT = 60_000;

interface Rendered {
  template: string;
  html: string;
  head: string;
  png?: Buffer;
  width?: number;
  height?: number;
  issues: Issue[];
}

export class GraphicDocument {
  readonly tokens: DesignTokens;
  /** Le cran de la jauge : il choisit le modèle de chaque rôle (l'hôte résout l'échelle). */
  readonly policy: { level: CreativityLevel };
  private readonly specs = new Map<string, SectionSpec>();
  private readonly generationId: string;
  private generatedAssets = 0;
  private biblePromise: Promise<string | undefined> | null = null;
  private bibleText: string | undefined;
  /** Le budget de correction de tout le document (jetons, durée). */
  private repairSpent = { tokens: 0, started: 0 };

  private constructor(
    readonly options: DocumentOptions,
    private readonly previousBibles: string[]
  ) {
    this.tokens = buildTokens({ brand: options.brand, direction: options.direction, format: options.format, allowDark: options.allowDark, size: options.size });
    this.policy = { level: options.creativity === ('max' as CreativityLevel) ? 'high' : options.creativity ?? 'medium' };
    this.generationId = `${options.documentType}:${stableHash([options.seed, Date.now()], 10)}`;
  }

  static async create(options: DocumentOptions): Promise<GraphicDocument> {
    const host = engineHost();
    const recent = options.memoryScope && host.recentFingerprints ? await host.recentFingerprints(options.memoryScope).catch(() => []) : [];
    return new GraphicDocument(options, recent.filter((r) => r.startsWith('bible:')).map((r) => r.slice(6)));
  }

  /** Les polices de la marque (le `<style>` Tailwind de chaque page est dans son `result.head`). */
  get head(): string {
    return this.tokens.font.headHtml;
  }

  /** La bible du document, une fois écrite. */
  get bible(): string | undefined {
    return this.bibleText;
  }

  private get format() {
    return withSize(FORMATS[this.options.format], this.options.size);
  }

  private context(): DocumentContext {
    return {
      documentType: this.options.documentType,
      documentLabel: this.options.documentLabel,
      locale: this.options.locale ?? 'fr',
      tokens: this.tokens,
      format: this.format,
      direction: this.options.direction,
      allowDark: this.options.allowDark === true,
      brief: this.options.brief,
      bindings: this.options.bindings ?? 'values',
    };
  }

  private agent(): AgentCall | undefined {
    return engineHost().agentCall?.({ ...this.options.user, element: `graphic:${this.options.documentType}` });
  }

  /** La bible : écrite une fois par document de plusieurs pages, partagée par les pages composées en parallèle. */
  private ensureBible(recorder: TraceRecorder): Promise<string | undefined> {
    if ((this.options.sections?.length ?? 0) < 2) return Promise.resolve(undefined);
    if (!this.biblePromise) {
      const call = this.agent();
      this.biblePromise = (async () => {
        if (!call) return undefined;
        const { system, user } = directorPrompt(this.context(), this.options.sections ?? [], this.previousBibles);
        const run = await callModel({ call, recorder, task: 'direct', role: 'graphic.director', profile: 'agents', level: this.policy.level, system, user, timeoutMs: DIRECTOR_TIMEOUT, validate: (raw) => parseBible(raw) !== null });
        // Sans bible, chaque page reste écrite : la bible sert la cohérence, elle n'est pas une condition.
        this.bibleText = run.ok ? parseBible(run.raw) ?? undefined : undefined;
        return this.bibleText;
      })();
    }
    return this.biblePromise;
  }

  /**
   * Compose une page. `replay` : la page déjà écrite, rejouée avec un contenu retouché (aucun modèle) ;
   * `revise` : une retouche ÉCRITE (« le titre plus grand ») — l'auteur réécrit la page avec la consigne.
   */
  async composeSection(content: SectionContent, o: { index?: number; total?: number; replay?: SectionSpec; revise?: { spec?: SectionSpec; instruction: string } } = {}): Promise<SectionOutput> {
    const checked = validateSectionContent(content);
    if (!checked.ok || !checked.value) throw new ContentError(checked.issues);
    const level = this.policy.level;
    const recorder = new TraceRecorder({ generationId: this.generationId, documentType: this.options.documentType, format: this.options.format, level, sectionId: content.id });
    const { section, assets } = await this.prepareAssets(checked.value, recorder);
    const map = buildContentMap(section, this.options.bindings ?? 'values');
    const index = o.index ?? 1;
    const total = o.total ?? (this.options.sections?.length || 1);

    let rendered: Rendered | null = null;
    let bible: string | undefined;
    // 1. Une page rejouée : son code, le nouveau contenu, aucun modèle.
    if (o.replay && isAuthoredSpec(o.replay) && !o.revise) {
      const r = await this.render(o.replay.html, map, section.id, recorder);
      if (r.ok) rendered = r.page;
      else recorder.repair({ code: 'replay_failed', detail: `la page gardée ne s'affiche plus (${r.error.slice(0, 160)}) : réécrite`, by: 'code' });
      bible = o.replay.bible;
    }
    if (!rendered) {
      const call = this.agent();
      if (!call) throw new GraphicRenderError(section.id, 'aucun modèle n’est branché (port agentCall absent)');
      bible = bible ?? (await this.ensureBible(recorder));
      const ctx = this.context();
      const system = authorSystem(ctx);
      const base = authorUser(ctx, { section, listing: map.listing, index, total, bible, reference: this.options.reference });
      const revising = o.revise?.instruction && o.revise.spec && isAuthoredSpec(o.revise.spec) ? o.revise : undefined;
      const user = revising ? reviseUser(base, (revising.spec as SectionSpec).html, revising.instruction) : base;
      rendered = await this.author(section.id, map, recorder, { system, base, user, level, task: revising ? 'revise' : 'author' });
    }

    const spec: SectionSpec = { version: 2, ref: section.id, pattern: { id: 'authored' }, html: rendered.template, ...(bible ? { bible } : {}), level };
    this.specs.set(section.id, spec);
    const usage = recorder.usage();
    const trace = recorder.finish({ pattern: 'authored', ...(assets.length ? { assets } : {}) });
    engineHost().onTrace?.(trace);
    const result: RenderResult = {
      version: '1.0',
      documentType: this.options.documentType,
      format: this.options.format,
      sectionId: section.id,
      html: rendered.html,
      head: rendered.head,
      provenance: { engine: ENGINE_VERSION, components: COMPONENT_LIBRARY_VERSION, specHash: stableHash(spec.html, 12), tokensHash: this.tokens.hash, pattern: 'authored', fingerprint: `authored|${level}` },
      ...(rendered.width ? { measured: { width: rendered.width, height: rendered.height ?? 0 } } : {}),
      repairs: recorder.repairs,
      issues: rendered.issues,
      usage: { agentCalls: usage.agentCalls, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, ms: usage.ms },
    };
    return { spec, result, png: rendered.png, trace };
  }

  /**
   * L'auteur écrit la page ; si elle ne s'affiche pas, la correction bornée : une tentative à la fois, une
   * approche différente à chaque fois, le modèle du cran au-dessus dès la réécriture.
   */
  private async author(sectionId: string, map: ContentMap, recorder: TraceRecorder, p: { system: string; base: string; user: string; level: CreativityLevel; task: 'author' | 'revise' }): Promise<Rendered> {
    const call = this.agent() as AgentCall;
    const valid = (raw: string) => /<[a-z][\s\S]*>/i.test(extractHtml(raw));
    const first = await callModel({ call, recorder, task: p.task, role: 'graphic.author', profile: 'coder', level: p.level, system: p.system, user: p.user, timeoutMs: AUTHOR_TIMEOUT, validate: valid });
    let code = first.ok ? extractHtml(first.raw) : '';
    let error = first.ok ? '' : `the answer contained no HTML (${first.failure})`;
    if (code) {
      const r = await this.render(code, map, sectionId, recorder);
      if (r.ok) return r.page;
      error = r.error;
      code = r.template;
    }
    const limits = repairLimits();
    const history: string[] = [error];
    if (!this.repairSpent.started) this.repairSpent.started = Date.now();
    for (let i = 0; i < Math.min(limits.attempts, REPAIR_PLAN.length); i++) {
      const strategy = REPAIR_PLAN[i];
      if (this.repairSpent.tokens >= limits.tokenBudget) {
        history.push('budget de correction du document épuisé');
        break;
      }
      if (Date.now() - this.repairSpent.started > limits.maxMs) {
        history.push('temps de correction du document épuisé');
        break;
      }
      const level = strategy === 'fix' ? p.level : levelUp(p.level);
      const user = repairUser(p.base, strategy, { code: strategy === 'fix' ? code : undefined, error, history: history.slice(-3) });
      const run = await callModel({ call, recorder, task: 'repair', role: 'graphic.author', profile: 'coder', level, system: p.system, user, timeoutMs: AUTHOR_TIMEOUT, validate: valid });
      this.repairSpent.tokens += run.tokens;
      if (!run.ok) {
        error = `the answer contained no HTML (${run.failure})`;
        history.push(`${strategy}: ${error}`);
        continue;
      }
      const r = await this.render(extractHtml(run.raw), map, sectionId, recorder);
      if (r.ok) {
        recorder.repair({ code: `render_${strategy}`, detail: `page corrigée (${strategy}, cran ${level}) après : ${history[history.length - 1].slice(0, 160)}`, by: 'agent' });
        return r.page;
      }
      error = r.error;
      code = r.template;
      history.push(`${strategy}: ${error}`);
    }
    log().warn('graphic.page_failed', { event: 'graphic.page_failed', documentType: this.options.documentType, section: sectionId, attempts: history });
    throw new GraphicRenderError(sectionId, history[history.length - 1] ?? error, history);
  }

  /** Assainir, remplir, compiler, puis demander à Chromium si la page s'affiche. Rien n'est jugé d'autre. */
  private async render(raw: string, map: ContentMap, sectionId: string, recorder: TraceRecorder): Promise<{ ok: true; page: Rendered } | { ok: false; error: string; template: string }> {
    const t0 = Date.now();
    const clean = sanitizeHtml(raw);
    if (!clean.html.trim()) return { ok: false, error: 'the page is empty after removing what is not allowed (scripts, styles, external resources)', template: clean.html };
    const issues: Issue[] = [];
    if (clean.nativeCss) issues.push({ code: 'native_css_removed', severity: 'advisory', message: `${clean.nativeCss} style(s) CSS natif(s) retiré(s) : la page est en Tailwind.` });
    const page = expandPage(clean.html, map, this.tokens, this.format, { sectionId, locale: this.options.locale ?? 'fr', engine: ENGINE_VERSION });
    if (page.unknown.length) issues.push({ code: 'unknown_keys', severity: 'advisory', message: `Clés inconnues ignorées : ${page.unknown.slice(0, 8).join(', ')}` });
    if (page.orphans.length) issues.push({ code: 'unknown_blocks', severity: 'advisory', message: `Primitives sans bloc : ${page.orphans.slice(0, 6).join(', ')}` });
    const unused = [...map.entries.keys()].filter((k) => !page.used.has(k));
    const unusedBlocks = [...map.primitives.keys()].filter((id) => !page.used.has(`#${id}`));
    if (unused.length || unusedBlocks.length) issues.push({ code: 'content_not_shown', severity: 'advisory', message: `Contenu non placé par l'auteur : ${[...unusedBlocks.map((b) => `#${b}`), ...unused].slice(0, 12).join(', ')}` });
    let css: string;
    try {
      css = await compileTailwind(page.html, this.tokens);
    } catch (error) {
      return { ok: false, error: `Tailwind could not compile the classes: ${String((error as Error)?.message ?? error).slice(0, 200)}`, template: clean.html };
    }
    const head = `${this.head ? `${this.head}\n` : ''}<style data-ge-tailwind>${css}</style>`;
    if (this.options.validate === false) {
      recorder.task({ task: 'render', source: 'code', inputTokens: 0, outputTokens: 0, ms: Date.now() - t0, outcome: 'skipped' });
      return { ok: true, page: { template: clean.html, html: page.html, head, issues } };
    }
    const check = await checkRender(page.html, head, this.format, { lang: this.options.locale, shoot: Boolean(this.options.png) });
    recorder.task({ task: 'render', source: 'code', inputTokens: 0, outputTokens: 0, ms: Date.now() - t0, outcome: check.ok ? 'accepted' : 'refused' });
    if (check.infra) log().warn('graphic.render_unchecked', { event: 'graphic.render_unchecked', section: sectionId, reason: check.error });
    if (!check.ok) return { ok: false, error: check.error ?? 'the page did not display', template: clean.html };
    return { ok: true, page: { template: clean.html, html: page.html, head, png: check.png, width: check.width, height: check.height, issues } };
  }

  /**
   * Planifie, résout et pose les médias de la section (`asset-planner`). Une section sans intention, ou dont
   * les médias sont déjà là (contenu rejoué), passe telle quelle. Un média introuvable applique son repli.
   */
  private async prepareAssets(content: SectionContent, recorder: TraceRecorder): Promise<{ section: SectionContent; assets: string[] }> {
    const requirements = planAssets(content, this.tokens.format);
    if (!requirements.length) return { section: content, assets: [] };
    const t0 = Date.now();
    const host = engineHost();
    const resolution = await resolveAssets(
      requirements,
      host.assetProviders ?? {},
      { level: this.policy.level, documentType: this.options.documentType, locale: this.options.locale, userId: this.options.user?.userId, projectId: this.options.user?.projectId, brandName: this.options.brand.name, styleId: this.options.direction?.styleId, keywords: this.options.direction?.keywords },
      { generationLeft: Math.max(0, GENERATION_CAP[this.policy.level] - this.generatedAssets), registry: host.assetRegistry }
    );
    this.generatedAssets += resolution.generated;
    const applied = applyAssets(content, resolution, requirements);
    recorder.task({ task: 'asset.resolve', source: 'code', inputTokens: 0, outputTokens: 0, ms: Date.now() - t0, outcome: resolution.missing.length ? 'skipped' : 'accepted' });
    for (const note of applied.notes) recorder.repair({ code: 'asset_fallback', detail: note.slice(0, 240), by: 'code' });
    const rechecked = validateSectionContent(applied.section);
    if (!rechecked.ok || !rechecked.value) {
      // Un média mal formé ne coûte jamais la page : on la compose sans lui.
      log().warn('graphic.assets_refused', { event: 'graphic.assets_refused', section: content.id, issues: rechecked.issues.map((i) => i.code) });
      return { section: content, assets: resolution.log };
    }
    return { section: rechecked.value, assets: resolution.log };
  }

  /** Le DesignSpec du document : les pages écrites jusqu'ici, dans l'ordre annoncé. */
  designSpec(): DesignSpec {
    const order = (this.options.sections ?? []).map((s) => s.id);
    const ids = [...order.filter((id) => this.specs.has(id)), ...[...this.specs.keys()].filter((id) => !order.includes(id))];
    return {
      version: 2,
      documentType: this.options.documentType,
      format: this.options.format,
      creativity: this.policy.level,
      ...(this.bibleText ? { bible: this.bibleText } : {}),
      tokensHash: this.tokens.hash,
      seed: this.options.seed.slice(0, 120),
      engine: { version: ENGINE_VERSION, components: COMPONENT_LIBRARY_VERSION },
      sections: ids.map((id) => this.specs.get(id) as SectionSpec),
    };
  }

  /** La bible de ce document, confiée à la mémoire de l'hôte : le prochain document de la marque fera autrement. */
  async remember(): Promise<void> {
    const host = engineHost();
    if (this.options.memoryScope && host.rememberFingerprints && this.bibleText) await host.rememberFingerprints(this.options.memoryScope, [`bible:${this.bibleText.split('\n').slice(0, 3).join(' ').slice(0, 300)}`]).catch(() => undefined);
  }
}

export const createDocument = (options: DocumentOptions): Promise<GraphicDocument> => GraphicDocument.create(options);

/** Une toile d'une seule section (une face de carte, un visuel, une couverture de réseau). */
export async function renderSingle(options: DocumentOptions & { content: SectionContent; replay?: SectionSpec; revise?: { spec?: SectionSpec; instruction: string } }): Promise<SectionOutput> {
  const doc = await createDocument({ ...options, sections: [{ id: options.content.id, role: options.content.role }] });
  const out = await doc.composeSection(options.content, { index: 1, total: 1, ...(options.replay ? { replay: options.replay } : {}), ...(options.revise ? { revise: options.revise } : {}) });
  await doc.remember();
  return out;
}

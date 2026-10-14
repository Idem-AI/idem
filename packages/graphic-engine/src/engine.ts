/**
 * LE FLUX D'UNE GÉNÉRATION — l'orchestrateur du moteur.
 *
 *   contenu → médias → matière à plat (clés) → langage visuel de la MARQUE (une fois par marque, gardé) → plan du
 *   DOCUMENT (une ligne par page) → page écrite en HTML
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
import type { SectionContent } from './contracts/content-model';
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
import { authorSystem, authorUser, DocumentContext, DocumentPlan, languagePrompt, parseLanguage, parsePlan, planPrompt, PlannedPage, ReferenceComposition, RepairStrategy, repairUser, reviseUser, toolLines } from './author/prompts';
import { callModel, levelUp } from './author/model';
import { buildContentMap, ContentMap, fixBrandNameTypos } from './runtime/content-map';
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
  /** La clé du livrable (journaux). */
  seed: string;
  documentLabel?: string;
  /** Les pages attendues, dans l'ordre (`purpose` : ce que la page doit faire) : le directeur écrit le plan pour elles. */
  sections?: PlannedPage[];
  /** Le langage visuel de la marque, s'il est déjà connu de l'hôte (sinon lu ou écrit par `brandMemory`). */
  brandLanguage?: string;
  bindings?: 'values' | 'markers';
  imageColors?: string[];
  /** Contrôler l'affichage dans Chromium (défaut : oui). */
  validate?: boolean;
  /** Photographier la page (visuels, cartes). */
  png?: boolean;
  /** Portée de la mémoire entre documents (marque, projet) : langage visuel de la marque, idées déjà employées. */
  memoryScope?: FingerprintScope;
  user?: { userId?: string; projectId?: string };
  size?: { width: number; height: number };
  /** Ancien réglage du pied de page : la page est désormais écrite par l'auteur (ignoré). */
  footer?: 'full' | 'logo' | 'none';
  /** Une composition MODÈLE (image de référence de l'utilisateur, analysée) : l'auteur la reproduit. */
  reference?: ReferenceComposition;
  /** Ce que l'hôte sait du projet (activité, public), donné au directeur et à l'auteur. */
  brief?: string;
  /** Le souhait du client pour la mise en page (« plus aérée », « plus sobre ») : une nouvelle mise en page le suit. */
  layoutNote?: string;
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
  /** Le contenu final de chaque page (médias posés) : gardé par l'hôte, il permet de refaire la mise en page sans réécrire. */
  private readonly contents = new Map<string, SectionContent>();
  private readonly generationId: string;
  private generatedAssets = 0;
  private languagePromise: Promise<string | undefined> | null = null;
  private languageText: string | undefined;
  private planPromise: Promise<DocumentPlan | undefined> | null = null;
  private planValue: DocumentPlan | undefined;
  /** Le budget de correction de tout le document (jetons, durée). */
  private repairSpent = { tokens: 0, started: 0 };

  private constructor(
    readonly options: DocumentOptions,
    private readonly previousIdeas: string[]
  ) {
    this.tokens = buildTokens({ brand: options.brand, direction: options.direction, format: options.format, allowDark: options.allowDark, size: options.size });
    this.policy = { level: options.creativity === ('max' as CreativityLevel) ? 'high' : options.creativity ?? 'medium' };
    this.generationId = `${options.documentType}:${stableHash([options.seed, Date.now()], 10)}`;
  }

  static async create(options: DocumentOptions): Promise<GraphicDocument> {
    const host = engineHost();
    const recent = options.memoryScope && host.recentFingerprints ? await host.recentFingerprints(options.memoryScope).catch(() => []) : [];
    return new GraphicDocument(options, recent.filter((r) => r.startsWith('idea:') || r.startsWith('bible:')).map((r) => r.replace(/^(idea|bible):/, '')));
  }

  /** Les polices de la marque (le `<style>` Tailwind de chaque page est dans son `result.head`). */
  get head(): string {
    return this.tokens.font.headHtml;
  }

  /** L'idée du document (son plan), sinon le langage de la marque : ce qui a guidé ses pages. */
  get bible(): string | undefined {
    return this.planValue?.idea || this.languageText;
  }

  /** Le plan du document, une fois écrit. */
  get plan(): DocumentPlan | undefined {
    return this.planValue;
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
      layoutNote: this.options.layoutNote,
      bindings: this.options.bindings ?? 'values',
    };
  }

  private agent(): AgentCall | undefined {
    return engineHost().agentCall?.({ ...this.options.user, element: `graphic:${this.options.documentType}` });
  }

  /** La clé du langage de la marque : la portée (projet) et l'identité de la charte (une nouvelle charte, un nouveau langage). */
  private languageKey(): string | undefined {
    const scope = this.options.memoryScope?.key;
    if (!scope) return undefined;
    const b = this.options.brand;
    const d = this.options.direction;
    return `${scope}:${stableHash([b.name, b.palette, b.fonts?.display, b.fonts?.body, d?.styleId, d?.grammar], 12)}`;
  }

  /**
   * Le LANGAGE VISUEL de la marque : donné par l'hôte, sinon relu dans sa mémoire, sinon écrit UNE fois par le
   * directeur et gardé — tous les livrables de la marque le reprennent (cohérence, et un appel par marque au lieu
   * d'un par document). Sans mémoire, une page seule s'en passe (la direction brute de la charte suffit).
   */
  private ensureLanguage(recorder: TraceRecorder): Promise<string | undefined> {
    if (!this.languagePromise) {
      this.languagePromise = (async () => {
        if (this.options.brandLanguage?.trim()) return (this.languageText = this.options.brandLanguage.trim().slice(0, 1400));
        const host = engineHost();
        const key = this.languageKey();
        if (key && host.brandMemory) {
          const known = await host.brandMemory.read(key).catch(() => undefined);
          if (known?.trim()) return (this.languageText = known.trim().slice(0, 1400));
        }
        const multi = (this.options.sections?.length ?? 0) >= 2;
        const call = this.agent();
        if (!call || (!multi && !(key && host.brandMemory))) return undefined;
        const { system, user } = languagePrompt(this.context());
        const run = await callModel({ call, recorder, task: 'direct', role: 'graphic.director', profile: 'agents', level: this.policy.level, system, user, timeoutMs: DIRECTOR_TIMEOUT, validate: (raw) => parseLanguage(raw) !== null });
        // Sans langage, chaque page reste écrite : il sert la cohérence, il n'est pas une condition.
        this.languageText = run.ok ? parseLanguage(run.raw) ?? undefined : undefined;
        if (this.languageText && key && host.brandMemory) await host.brandMemory.write(key, this.languageText).catch(() => undefined);
        return this.languageText;
      })();
    }
    return this.languagePromise;
  }

  /** Le PLAN du document (une idée, une ligne par page) : une fois par document de plusieurs pages, partagé par ses pages. */
  private ensurePlan(recorder: TraceRecorder, language: string | undefined): Promise<DocumentPlan | undefined> {
    const pages = this.options.sections ?? [];
    if (pages.length < 2) return Promise.resolve(undefined);
    if (!this.planPromise) {
      const call = this.agent();
      this.planPromise = (async () => {
        if (!call) return undefined;
        const { system, user } = planPrompt(this.context(), pages, language, this.previousIdeas);
        const run = await callModel({ call, recorder, task: 'direct', role: 'graphic.director', profile: 'agents', level: this.policy.level, system, user, timeoutMs: DIRECTOR_TIMEOUT, validate: (raw) => parsePlan(raw, pages.length) !== null });
        this.planValue = run.ok ? parsePlan(run.raw, pages.length) ?? undefined : undefined;
        return this.planValue;
      })();
    }
    return this.planPromise;
  }

  /** Ce que le plan dit de CETTE page et de ses voisines. */
  private planFor(sectionId: string, index: number): { idea?: string; page?: string; previous?: string; next?: string } | undefined {
    const plan = this.planValue;
    if (!plan) return undefined;
    const ids = (this.options.sections ?? []).map((s) => s.id);
    const at = ids.indexOf(sectionId) >= 0 ? ids.indexOf(sectionId) : index - 1;
    return { idea: plan.idea || undefined, page: plan.pages[at] || undefined, previous: plan.pages[at - 1] || undefined, next: plan.pages[at + 1] || undefined };
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
    const prepared = await this.prepareAssets(checked.value, recorder);
    const assets = prepared.assets;
    // Le nom de la marque écrit juste (coquille d'inversion du rédacteur corrigée, et dite).
    const named = fixBrandNameTypos(prepared.section, this.options.brand.name);
    if (named.fixed) recorder.repair({ code: 'brand_name_typo', detail: `${named.fixed} coquille(s) du nom « ${this.options.brand.name} » corrigée(s)`, by: 'code' });
    const section = named.section;
    const map = buildContentMap(section, this.options.bindings ?? 'values');
    const index = o.index ?? 1;
    const total = o.total ?? (this.options.sections?.length || 1);

    let rendered: Rendered | null = null;
    /** Ce qui a guidé la page (gardé avec elle) : le langage de la marque et la ligne du plan. */
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
      const language = (await this.ensureLanguage(recorder)) ?? (bible || undefined);
      await this.ensurePlan(recorder, language);
      const plan = this.planFor(section.id, index);
      bible = [language, plan?.idea && `idea: ${plan.idea}`, plan?.page && `this page: ${plan.page}`].filter(Boolean).join('\n') || undefined;
      const ctx = this.context();
      const system = authorSystem(ctx);
      const blocks = [...map.primitives.values()];
      const tools = toolLines(ctx, { charts: blocks.filter((b) => b.kind === 'chart').map((b) => b.id), tables: blocks.filter((b) => b.kind === 'table').map((b) => b.id), icons: [...map.entries.values()].some((e) => e.kind === 'icon') });
      const base = authorUser(ctx, { section, listing: map.listing, tools, index, total, language, plan, reference: this.options.reference });
      const revising = o.revise?.instruction && o.revise.spec && isAuthoredSpec(o.revise.spec) ? o.revise : undefined;
      const user = revising ? reviseUser(base, (revising.spec as SectionSpec).html, revising.instruction) : base;
      rendered = await this.author(section.id, map, recorder, { system, base, user, level, task: revising ? 'revise' : 'author' });
    }

    const spec: SectionSpec = { version: 2, ref: section.id, pattern: { id: 'authored' }, html: rendered.template, ...(bible ? { bible } : {}), level };
    this.specs.set(section.id, spec);
    this.contents.set(section.id, section);
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
    /** La meilleure page presque affichée (un texte coupé) : livrée, et signalée, si rien ne fait mieux. */
    let partial: Rendered | undefined;
    if (code) {
      const r = await this.render(code, map, sectionId, recorder);
      if (r.ok) return r.page;
      error = r.error;
      code = r.template;
      partial = r.partial ?? partial;
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
      partial = r.partial ?? partial;
      history.push(`${strategy}: ${error}`);
    }
    if (partial) {
      log().warn('graphic.page_text_cut', { event: 'graphic.page_text_cut', documentType: this.options.documentType, section: sectionId, attempts: history });
      recorder.repair({ code: 'render_partial', detail: `livrée avec un texte coupé après ${history.length} essai(s)`.slice(0, 240), by: 'code' });
      return partial;
    }
    log().warn('graphic.page_failed', { event: 'graphic.page_failed', documentType: this.options.documentType, section: sectionId, attempts: history });
    throw new GraphicRenderError(sectionId, history[history.length - 1] ?? error, history);
  }

  /** Assainir, remplir, compiler, puis demander à Chromium si la page s'affiche. Rien n'est jugé d'autre. */
  private async render(raw: string, map: ContentMap, sectionId: string, recorder: TraceRecorder): Promise<{ ok: true; page: Rendered } | { ok: false; error: string; template: string; partial?: Rendered }> {
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
    if (!check.ok) {
      // Un texte coupé par le bord : la page s'affiche presque entière — gardée comme REPLI si la correction échoue.
      const partial = check.cut ? { template: clean.html, html: page.html, head, png: check.png, issues: [...issues, { code: 'text_cut', severity: 'blocking' as const, message: (check.error ?? '').slice(0, 380) }] } : undefined;
      return { ok: false, error: check.error ?? 'the page did not display', template: clean.html, ...(partial ? { partial } : {}) };
    }
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

  /**
   * Ce qu'il faut garder d'une page pour la refaire sans modèle de rédaction : son contenu (textes, chiffres, médias
   * déjà posés) et son code. Une nouvelle mise en page repart du contenu ; une retouche de mots rejoue le code.
   */
  page(sectionId: string): { content: SectionContent; spec: SectionSpec } | undefined {
    const content = this.contents.get(sectionId);
    const spec = this.specs.get(sectionId);
    return content && spec ? { content, spec } : undefined;
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
      ...(this.bible ? { bible: this.bible.slice(0, 2400) } : {}),
      tokensHash: this.tokens.hash,
      seed: this.options.seed.slice(0, 120),
      engine: { version: ENGINE_VERSION, components: COMPONENT_LIBRARY_VERSION },
      sections: ids.map((id) => this.specs.get(id) as SectionSpec),
    };
  }

  /** L'idée de ce document, confiée à la mémoire de l'hôte : le prochain document de la marque fera autrement. */
  async remember(): Promise<void> {
    const host = engineHost();
    if (this.options.memoryScope && host.rememberFingerprints && this.planValue?.idea) await host.rememberFingerprints(this.options.memoryScope, [`idea:${this.planValue.idea.slice(0, 300)}`]).catch(() => undefined);
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

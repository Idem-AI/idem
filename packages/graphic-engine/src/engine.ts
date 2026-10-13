/**
 * LE FLUX D'UNE GÉNÉRATION — l'orchestrateur du moteur.
 *
 *   contenu → validation → structure sémantique → candidats → choix (code ou agent selon le cran)
 *   → DesignSpec → compilation → mesure → réparation (code, puis agent ciblé) → critique (High+)
 *   → RenderResult versionné + trace de coûts
 *
 * Un `GraphicDocument` porte ce qui est commun aux sections d'un livrable : les jetons, le plan, la
 * mémoire de diversité, le budget. Ses sections peuvent être composées EN PARALLÈLE (le plan a déjà
 * réservé à chacune ses motifs) ; leur rendu est déterministe pour un même plan et un même contenu.
 */
import type { CreativityLevel, DocumentType, FormatId, Issue } from './contracts/common';
import type { SectionContent, SectionRole } from './contracts/content-model';
import type { DesignSpec, SectionSpec } from './contracts/design-spec';
import type { RenderResult } from './contracts/render-result';
import { validateSectionContent } from './contracts/validate';
import { analyzeSection, textLoad } from './composition-engine/analyze';
import { applyAssets, GENERATION_CAP, planAssets, resolveAssets } from './asset-planner';
import { buildCandidate, Candidate, choose, createComposeContext, generateCandidates, lookInputFor, menu, rank, specOf } from './composition-engine/compose';
import { DiversityMemory, fingerprintOf, serialize } from './composition-engine/diversity';
import { DocumentPlan, planDocument, slotFor } from './composition-engine/plan';
import { CreativityPolicy, policyFor } from './composition-engine/profiles';
import { resolveLook } from './design-system/look';
import { BrandInput, buildTokens, DesignTokens, DirectionInput } from './design-system/tokens';
import { stableHash } from './foundation/hash';
import { compileSection } from './html-css-compiler/compile';
import { createContext, SectionMeta } from './html-css-compiler/context';
import { authorPrompt, describeSection, parseAuthored, parsePick, parsePickTune, pickPrompt, pickTunePrompt } from './agents/creative-planner';
import { CRITIC_INSTRUCTION, parseCritique, visionCall } from './agents/critic';
import { planContent } from './agents/content-planner';
import { COMPACT_VARIANTS, parseRepair, repairPrompt } from './agents/targeted-repair';
import { AgentCall, engineHost, FingerprintScope, log } from './host';
import { budgetFor, TASK_POLICIES, TokenBudget, atLeast } from './orchestrator/policies';
import { runTask } from './orchestrator/run-task';
import { GenerationTrace, TraceRecorder } from './observability/traces';
import { fitAndMeasure, Measurement } from './quality-engine/measure';
import { decide, issuesOf, measuredScore } from './quality-engine/repair';
import { COMPONENT_LIBRARY_VERSION, ENGINE_VERSION } from './version';
import { walk } from './contracts/validate';

export interface DocumentOptions {
  documentType: DocumentType;
  format: FormatId;
  locale?: string;
  brand: BrandInput;
  direction?: DirectionInput;
  allowDark?: boolean;
  creativity?: CreativityLevel;
  /** La clé du livrable : elle sème tous les tirages (même projet, même suite ; autre projet, autre suite). */
  seed: string;
  documentLabel?: string;
  /** Les sections attendues, dans l'ordre : le plan leur réserve des compositions distinctes. */
  sections?: Array<{ id: string; role?: SectionRole }>;
  bindings?: 'values' | 'markers';
  imageColors?: string[];
  /** Mesurer et réparer dans Chromium (défaut : oui). */
  validate?: boolean;
  /** Photographier la page (visuels, cartes, critique). */
  png?: boolean;
  /** Portée de la mémoire de diversité entre documents (marque, projet). */
  memoryScope?: FingerprintScope;
  user?: { userId?: string; projectId?: string };
  size?: { width: number; height: number };
  footer?: 'full' | 'logo' | 'none';
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

interface Attempt {
  spec: SectionSpec;
  candidate?: Candidate;
  html: string;
  scale: number;
  measurement?: Measurement;
  png?: Buffer;
  score: number;
  issues: Issue[];
  critique?: number;
}

export class GraphicDocument {
  readonly tokens: DesignTokens;
  readonly plan: DocumentPlan;
  readonly policy: CreativityPolicy;
  readonly budget: TokenBudget;
  private readonly memory: DiversityMemory;
  private readonly specs = new Map<string, SectionSpec>();
  private readonly generationId: string;
  /** Images déjà générées pour ce document : la génération est plafonnée par document (`GENERATION_CAP`). */
  private generatedAssets = 0;

  private constructor(readonly options: DocumentOptions, recent: string[]) {
    this.tokens = buildTokens({ brand: options.brand, direction: options.direction, format: options.format, allowDark: options.allowDark, size: options.size });
    this.plan = planDocument({ documentType: options.documentType, format: options.format, seed: options.seed, creativity: options.creativity, styleId: options.direction?.styleId, density: options.direction?.density, sections: options.sections, hasImage: Boolean(options.imageColors?.length) });
    this.policy = policyFor(options.creativity);
    this.budget = new TokenBudget(budgetFor(options.documentType, this.policy.level, options.sections?.length ?? 1));
    this.memory = new DiversityMemory(recent);
    this.generationId = `${options.documentType}:${stableHash([options.seed, Date.now()], 10)}`;
  }

  static async create(options: DocumentOptions): Promise<GraphicDocument> {
    const host = engineHost();
    const recent = options.memoryScope && host.recentFingerprints ? await host.recentFingerprints(options.memoryScope).catch(() => []) : [];
    return new GraphicDocument(options, recent);
  }

  /** Le bloc `<head>` de l'assembleur (polices de la marque). */
  get head(): string {
    return this.tokens.font.headHtml;
  }

  private agent(): AgentCall | undefined {
    return engineHost().agentCall?.({ ...this.options.user, element: `graphic:${this.options.documentType}` });
  }

  private compile(spec: SectionSpec, section: SectionContent, meta: SectionMeta, scale: number, fingerprint: string): { html: string; issues: Issue[] } {
    const look = resolveLook(this.tokens, { strategy: spec.strategy, mood: spec.mood, tension: spec.tension, accent: spec.accent, density: spec.density, allowInverted: this.tokens.format.kind === 'fixed' && this.tokens.format.family !== 'card', imageColors: this.options.imageColors });
    const ctx = createContext({ tokens: this.tokens, look, section, documentType: this.options.documentType, locale: this.options.locale ?? 'fr', bindings: this.options.bindings ?? 'values', meta });
    const { html } = compileSection(spec, ctx, { fitScale: scale, fingerprint, specHash: stableHash(spec, 12) });
    return { html, issues: ctx.issues };
  }

  /**
   * Compiler, puis ajuster et mesurer dans Chromium (titres au pixel, texte dans son aplat, diapositive trop
   * vide agrandie), puis corriger par le code (échelle bornée) ; la meilleure tentative est gardée.
   */
  private async renderAttempt(spec: SectionSpec, section: SectionContent, meta: SectionMeta, fingerprint: string, recorder: TraceRecorder, light: boolean, shoot: boolean): Promise<Attempt> {
    const fixed = this.tokens.format.kind === 'fixed';
    const validate = this.options.validate !== false;
    const grow = fixed && this.tokens.format.family === 'slide';
    let scale = 1;
    let best: Attempt | null = null;
    for (let round = 0; round < 5; round++) {
      const compiled = this.compile(spec, section, meta, scale, fingerprint);
      if (!validate) return { spec, html: compiled.html, scale, score: 100, issues: compiled.issues };
      const t0 = Date.now();
      const run = await fitAndMeasure(compiled.html, this.head, this.tokens.format, { fixed, grow: grow && scale === 1, minPx: Math.max(7, this.tokens.format.minSize * 0.9), floor: 0.74, inks: { dark: this.tokens.color.ink, light: this.tokens.color.onDeep } }, { lang: this.options.locale, shoot });
      const measurement: Measurement = run.measurement;
      recorder.task({ task: 'measure', source: 'code', inputTokens: 0, outputTokens: 0, ms: Date.now() - t0, outcome: 'accepted' });
      if (measurement.fitted.shrunk) recorder.repair({ code: 'fit_text', detail: `textes ajustés (${measurement.fitted.shrunk} pas) — échelle finale ${Math.round(measurement.fitted.textScale * 100)} %`, by: 'code' });
      if (measurement.fitted.grown) recorder.repair({ code: 'fit_grow', detail: `page trop vide : textes agrandis de ${measurement.fitted.grown} %`, by: 'code' });
      if (measurement.fitted.recolored) recorder.repair({ code: 'fix_contrast', detail: `${measurement.fitted.recolored} texte(s) ramené(s) au contraste de lecture (encre de la charte)`, by: 'code' });
      const score = measuredScore(measurement, scale, fixed);
      const attempt: Attempt = { spec, html: run.html, scale, measurement, png: run.png, score, issues: [...compiled.issues, ...issuesOf(measurement, fixed, scale, this.policy.judgementBlocks, light)] };
      if (!best || attempt.score > best.score) best = attempt;
      // Un décor d'encre posé sur un texte s'efface — lui seul : le contenu passe avant l'ornement.
      if (measurement.decorOverText.length && spec.decor?.length) {
        const drop = new Set(measurement.decorOverText);
        recorder.repair({ code: 'drop_decor', detail: `${drop.size} décor(s) posé(s) sur un texte : retiré(s)`, by: 'code' });
        spec = { ...spec, decor: spec.decor.filter((_, i) => !drop.has(i)) };
        continue;
      }
      const action = decide(measurement, scale, fixed);
      if (action.kind !== 'zoom') return best;
      recorder.repair({ code: 'fit_scale', detail: `mise à l'échelle ${Math.round(scale * 100)} % → ${Math.round(action.scale * 100)} % (débordement ${measurement.overflowPx} px)`, by: 'code' });
      scale = action.scale;
    }
    return best as Attempt;
  }

  async composeSection(content: SectionContent, o: { index?: number; total?: number; replay?: SectionSpec } = {}): Promise<SectionOutput> {
    const checked = validateSectionContent(content);
    if (!checked.ok || !checked.value) throw new ContentError(checked.issues);
    const level = this.policy.level;
    const recorder = new TraceRecorder({ generationId: this.generationId, documentType: this.options.documentType, format: this.options.format, level, sectionId: content.id });
    // ── 0. Les médias : ce que la page doit montrer, trouvé AVANT de composer ───────────────
    const { section: withAssets, assets } = await this.prepareAssets(checked.value, recorder);
    const analysis0 = analyzeSection(withAssets);
    const section = planContent(withAssets, analysis0);
    const analysis = { ...analysis0, role: section.role };
    const slot = slotFor(this.plan, section.id, o.index);
    const meta: SectionMeta = { brandName: this.options.brand.name, documentLabel: this.options.documentLabel, index: slot.index, total: o.total ?? (this.plan.order.length || undefined), footer: this.options.footer ?? this.plan.footer };
    const ctx = createComposeContext({ section, analysis, plan: this.plan, slot, tokens: this.tokens, meta, memory: this.memory, policy: this.policy, imageColors: this.options.imageColors });
    const fixed = this.tokens.format.kind === 'fixed';
    const critic = atLeast(level, 'high') && fixed && Boolean(engineHost().analyzeImage) && this.budget.allows(TASK_POLICIES.critic.maxTokens);
    const shoot = Boolean(this.options.png) || critic;
    const call = this.agent();
    const brandName = this.options.brand.name;
    const summary = describeSection(section, analysis);
    const previous = this.memory.snapshot().map((f) => f.split('|')[0]);

    // ── 1. Le choix de la composition ─────────────────────────────────────────────────────
    let ranked: Candidate[] = [];
    let chosen: Candidate | null = null;
    let authored: SectionSpec | null = null;
    if (o.replay) {
      authored = o.replay;
      recorder.task({ task: 'compose', source: 'code', inputTokens: 0, outputTokens: 0, ms: 0, outcome: 'accepted', reason: 'nothing-to-decide' });
    } else {
      ranked = rank(generateCandidates(ctx), ctx);
      const fallback = choose(ranked, ctx);
      const options = menu(ranked, this.policy.menu);
      recorder.task({ task: 'compose', source: 'code', inputTokens: 0, outputTokens: 0, ms: 0, outcome: 'accepted' });
      chosen = fallback;
      if (this.policy.agents.tune) {
        const tuned = await runTask({ policy: TASK_POLICIES.pickTune, level, call, budget: this.budget, recorder, prompt: () => pickTunePrompt(this.plan, brandName, this.tokens.format, summary, options, previous), parse: (raw) => parsePickTune(raw, options, this.plan), fallback: () => null });
        if (tuned.value) {
          const base = options[tuned.value.index];
          const lookInput = { ...lookInputFor(ctx), ...(tuned.value.tension ? { tension: tuned.value.tension } : {}), ...(tuned.value.accent ? { accent: tuned.value.accent } : {}) };
          chosen = buildCandidate(ctx, base.pattern, tuned.value.params, lookInput);
        }
      } else if (this.policy.agents.pick) {
        const picked = await runTask({ policy: TASK_POLICIES.pick, level, call, budget: this.budget, recorder, prompt: () => pickPrompt(this.plan, brandName, this.tokens.format, summary, options, previous), parse: (raw) => parsePick(raw, options.length), fallback: () => -1 });
        if (picked.value >= 0) chosen = options[picked.value];
      }
      if (this.policy.agents.author) {
        const result = await runTask({ policy: TASK_POLICIES.author, level, call, budget: this.budget, recorder, prompt: () => authorPrompt(this.plan, brandName, this.tokens.format, section, analysis, previous), parse: (raw) => parseAuthored(raw, section, this.tokens.format), fallback: () => undefined });
        if (result.value) {
          const look = chosen ? chosen.lookInput : lookInputFor(ctx);
          authored = { ref: section.id, pattern: { id: 'authored', params: {} }, density: look.density, strategy: look.strategy, mood: look.mood, tension: look.tension, accent: look.accent, root: result.value.root, ...(result.value.decor.length ? { decor: result.value.decor } : {}) };
          for (const r of result.value.repaired) recorder.repair({ code: 'author_tree', detail: r, by: 'code' });
        }
      }
    }

    // ── 2. Rendu mesuré, avec repli sur les compositions suivantes ────────────────────────
    const queue: Array<{ spec: SectionSpec; candidate?: Candidate }> = [];
    if (authored) queue.push({ spec: authored });
    if (chosen) queue.push({ spec: specOf(chosen, section.id), candidate: chosen });
    for (const c of menu(ranked, 4)) if (!chosen || c.pattern.id !== chosen.pattern.id) queue.push({ spec: specOf(c, section.id), candidate: c });

    let best: Attempt | null = null;
    const isBlocking = (a: Attempt) => a.issues.some((i) => i.severity === 'blocking');
    for (const item of queue.slice(0, 4)) {
      recorder.attempts += 1;
      const fp = item.candidate ? serialize(item.candidate.fingerprint) : `authored|||||`;
      let attempt = await this.renderAttempt(item.spec, section, meta, fp, recorder, analysis.light, shoot);
      attempt.candidate = item.candidate;
      // Avant de changer de composition : les décors cèdent la place au contenu (accent et tension retirés).
      const c = item.candidate;
      if (isBlocking(attempt) && c && (c.lookInput.accent !== 'none' || c.lookInput.tension !== 'calm')) {
        const simple = buildCandidate(ctx, c.pattern, c.params, { ...c.lookInput, accent: 'none', tension: 'calm' });
        const retry = await this.renderAttempt(specOf(simple, section.id), section, meta, serialize(simple.fingerprint), recorder, analysis.light, shoot);
        retry.candidate = simple;
        recorder.repair({ code: 'simplify_chrome', detail: `${c.pattern.id} : accent « ${c.lookInput.accent} » et tension « ${c.lookInput.tension} » retirés`, by: 'code' });
        if (retry.score >= attempt.score) attempt = retry;
      }
      if (!best || attempt.score > best.score) best = attempt;
      if (!isBlocking(attempt)) break;
      recorder.repair({ code: 'next_candidate', detail: `${item.spec.pattern.id} : ${attempt.issues.filter((i) => i.severity === 'blocking').map((i) => i.code).join(', ')}`, by: 'code' });
    }
    let final = best as Attempt;

    // ── 3. Réparation ciblée (High+) quand le code n'a pas su ─────────────────────────────
    const blocking = final.issues.filter((i) => i.severity === 'blocking');
    if (blocking.length && this.policy.agents.repair && final.candidate) {
      const alternatives = menu(ranked, 4).filter((c) => c.pattern.id !== final.candidate?.pattern.id);
      const blockIds = section.blocks.map((b) => b.id);
      const choice = await runTask({ policy: TASK_POLICIES.repair, level, call, budget: this.budget, recorder, prompt: () => repairPrompt(blocking, alternatives, blockIds), parse: (raw) => parseRepair(raw, alternatives.length, blockIds), fallback: () => undefined });
      if (choice.value) {
        let spec = final.spec;
        if (choice.value.kind === 'switch') spec = specOf(alternatives[choice.value.index], section.id);
        if (choice.value.kind === 'dense') spec = { ...spec, density: 'dense' };
        if (choice.value.kind === 'drop-decor') spec = { ...spec, decor: [] };
        if (choice.value.kind === 'compact') {
          const target = choice.value.blockId;
          const root = JSON.parse(JSON.stringify(spec.root));
          walk(root, (node) => {
            if (node.t === 'block' && node.ref === target) {
              const kind = section.blocks.find((b) => b.id === target)?.kind ?? '';
              node.variant = { ...(node.variant ?? {}), ...(COMPACT_VARIANTS[kind] ?? {}) };
            }
          });
          spec = { ...spec, root };
        }
        const retry = await this.renderAttempt(spec, section, meta, serialize(final.candidate.fingerprint), recorder, analysis.light, shoot);
        if (retry.score > final.score) {
          final = { ...retry, candidate: final.candidate };
          recorder.repair({ code: 'targeted_repair', detail: `réparation ciblée : ${choice.value.kind}`, by: 'agent' });
        }
      }
    }

    // ── 4. Critique visuelle (High+) : départager des rendus que le moteur a tous su produire ──
    const analyze = engineHost().analyzeImage;
    if (critic && analyze && final.png && !final.issues.some((i) => i.severity === 'blocking')) {
      const judge = async (png: Buffer): Promise<number | undefined> => {
        const r = await runTask({ policy: TASK_POLICIES.critic, level, call: visionCall(analyze, png), budget: this.budget, recorder, prompt: () => ({ system: CRITIC_INSTRUCTION, user: 'image' }), parse: (raw) => parseCritique(raw)?.score, fallback: () => undefined });
        return r.value;
      };
      final.critique = await judge(final.png);
      const extra = level === 'high' ? 1 : 2;
      if (final.critique !== undefined && final.critique < 3.6 && !authored) {
        for (const alt of menu(ranked, 1 + extra).filter((c) => c.pattern.id !== final.candidate?.pattern.id).slice(0, extra)) {
          const attempt = await this.renderAttempt(specOf(alt, section.id), section, meta, serialize(alt.fingerprint), recorder, analysis.light, true);
          if (attempt.issues.some((i) => i.severity === 'blocking') || !attempt.png) continue;
          attempt.candidate = alt;
          attempt.critique = await judge(attempt.png);
          if ((attempt.critique ?? 0) > (final.critique ?? 0)) {
            recorder.repair({ code: 'critic_choice', detail: `la critique préfère ${alt.pattern.id} (${attempt.critique} contre ${final.critique})`, by: 'agent' });
            final = attempt;
          }
        }
      }
    }

    // ── 5. Résultat ────────────────────────────────────────────────────────────────────────
    const fingerprint = final.candidate ? final.candidate.fingerprint : fingerprintOf('authored', {}, { strategy: final.spec.strategy, tension: final.spec.tension, accent: final.spec.accent }, []);
    // Un arbre d'auteur n'a pas de régions déclarées : sa silhouette est celle MESURÉE sur la page rendue.
    if (!final.candidate && final.measurement) fingerprint.silhouette = final.measurement.silhouette;
    this.memory.add(fingerprint, slot.index);
    this.specs.set(section.id, final.spec);
    // La charge de texte contre le budget de la page : un CONSEIL (le moteur ne retire jamais un mot) que
    // l'hôte renvoie au rédacteur — changer de représentation ou diviser, plutôt que réduire le corps.
    const load = textLoad(analysis, section.intent?.textBudget);
    if (load.over > 1.25) final.issues = [...final.issues, { code: 'text_heavy', severity: 'advisory', message: `Page trop textuelle pour son rôle : ${load.detail}.`, fix: 'montrer plutôt qu’écrire (points illustrés, schéma, image) ou diviser la page' }];
    const usage = recorder.usage();
    const trace = recorder.finish({ pattern: final.spec.pattern.id, quality: Math.round(final.score), ...(assets.length ? { assets } : {}) });
    engineHost().onTrace?.(trace);
    if (final.issues.some((i) => i.severity === 'blocking')) log().warn('graphic.section_blocking', { event: 'graphic.section_blocking', section: section.id, pattern: final.spec.pattern.id, issues: final.issues.map((i) => i.code) });
    const m = final.measurement;
    const result: RenderResult = {
      version: '1.0',
      documentType: this.options.documentType,
      format: this.options.format,
      sectionId: section.id,
      html: final.html,
      ...(this.head ? { head: this.head } : {}),
      provenance: { engine: ENGINE_VERSION, components: COMPONENT_LIBRARY_VERSION, specHash: stableHash(final.spec, 12), tokensHash: this.tokens.hash, pattern: final.spec.pattern.id, fingerprint: serialize(fingerprint) },
      ...(m ? { measured: { width: Math.round(m.width), height: Math.round(m.height), fill: Math.round(m.fill * 100) / 100, overflowPx: m.overflowPx, minContrast: m.minContrast, silhouette: m.silhouette } } : {}),
      repairs: recorder.repairs,
      issues: final.issues,
      usage: { agentCalls: usage.agentCalls, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, ms: usage.ms },
    };
    return { spec: final.spec, result, png: final.png, trace };
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
      { generationLeft: Math.max(0, GENERATION_CAP[this.policy.level] - this.generatedAssets) }
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

  /** Le DesignSpec du document (les sections composées jusqu'ici, dans l'ordre du plan). */
  designSpec(): DesignSpec {
    const order = this.plan.order.length ? this.plan.order : [...this.specs.keys()];
    const sections = [...order.filter((id) => this.specs.has(id)), ...[...this.specs.keys()].filter((id) => !order.includes(id))].map((id) => this.specs.get(id) as SectionSpec);
    return {
      version: '1.0',
      documentType: this.options.documentType,
      format: this.options.format,
      creativity: this.policy.level,
      direction: { styleId: this.plan.styleId, ...(this.options.direction?.keywords?.length ? { keywords: this.options.direction.keywords.slice(0, 10) } : {}) },
      tokensHash: this.tokens.hash,
      seed: this.options.seed.slice(0, 120),
      engine: { version: ENGINE_VERSION, components: COMPONENT_LIBRARY_VERSION },
      sections,
    };
  }

  /** Les empreintes de ce document, confiées à la mémoire de l'hôte (diversité entre documents). */
  async remember(): Promise<void> {
    const host = engineHost();
    if (this.options.memoryScope && host.rememberFingerprints) await host.rememberFingerprints(this.options.memoryScope, this.memory.snapshot()).catch(() => undefined);
  }
}

export const createDocument = (options: DocumentOptions): Promise<GraphicDocument> => GraphicDocument.create(options);

/** Une toile d'une seule section (une face de carte, un visuel, une couverture de réseau). */
export async function renderSingle(options: DocumentOptions & { content: SectionContent }): Promise<SectionOutput> {
  const doc = await createDocument({ ...options, sections: [{ id: options.content.id, role: options.content.role }] });
  const out = await doc.composeSection(options.content, { index: 1, total: 1 });
  await doc.remember();
  return out;
}

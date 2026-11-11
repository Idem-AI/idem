/**
 * LE FLUX D'UNE GÉNÉRATION — l'orchestrateur du moteur (2.7, catalogue seul).
 *
 *   contenu → médias → matière à plat (clés) → [langage visuel de la marque, plan du document : crans hauts] →
 *   graphe du catalogue filtré et classé par le code → le modèle choisit et règle la configuration (petite réponse
 *   JSON) → le code assemble la page → assainie, remplie, compilée → « s'affiche-t-elle ? » → RenderResult + trace
 *
 * Aucune page n'est écrite librement par un modèle (l'ancien auteur libre est retiré le 11/11/2026). Une composition
 * qui ne s'affiche pas cède la place au candidat suivant, puis au squelette intégré ; ce qui résiste lève
 * `GraphicRenderError` : l'hôte le dit, rien n'est remplacé en silence.
 */
import type { CreativityLevel, DocumentType, FormatId, Issue } from './contracts/common';
import type { Block, SectionContent } from './contracts/content-model';
import type { DesignSpec, SectionSpec } from './contracts/design-spec';
import { isAuthoredSpec } from './contracts/design-spec';
import type { RenderResult } from './contracts/render-result';
import { validateSectionContent } from './contracts/validate';
import { applyAssets, GENERATION_CAP, planAssets, resolveAssets } from './asset-planner';
import { BrandInput, buildTokens, DesignTokens, DirectionInput } from './design-system/tokens';
import { FormatDef, FORMATS } from './design-system/formats';
import { stableHash } from './foundation/hash';
import { AgentCall, engineHost, FingerprintScope, log } from './host';
import { GenerationTrace, TraceRecorder } from './observability/traces';
import { ENGINE_VERSION, COMPONENT_LIBRARY_VERSION } from './version';
import { deliverableLine, DocumentContext, DocumentPlan, explorePrompt, IdeaTrack, languagePrompt, parseLanguage, parsePlan, parseTracks, planPrompt, PlannedPage, ReferenceComposition } from './author/prompts';
import { callModel } from './author/model';
import { catalogEffortFor, effortFor } from './foundation/effort';
import { buildContentMap, ContentMap, fixBrandNameTypos } from './runtime/content-map';
import { expandPage, sanitizeHtml, stripInventedText, withSize } from './runtime/expand';
import { compileTailwind } from './runtime/tailwind';
import { checkRender, QualityFrame } from './runtime/check';
import { catalog as loadCatalog, catalogOverrides, ensureHtml } from './catalog/registry';
import { assemblePage, capPlainText, pageUnits } from './catalog/assemble';
import { brandTraits, Candidate, CatalogState, comboFingerprint, compatibleComponents, newCatalogState, rankSkins, shortlist } from './catalog/graph';
import { chooseSystem, chooseUser, parseChoices, parseSkin, skinUser } from './catalog/choose';
import { CatalogElement, ComponentNode, elementOf, LayoutNode, PageConfig, SkinNode } from './catalog/types';
import { chunkHtml, fitFigures, flowPieces, measureFlow, packPages, pageTemplate, PieceMetrics } from './catalog/paginate';
import { ALL_AXES, analyzeSaliency, axisLine, decodeVector, encodeVector, imageEmbedding, judgeImage, novelty, PageMetrics, pickAxis, scoreVariant, StartAxis, textEmbedding, VariantScore } from '@idem/design-tools';

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
  /** Le pays de la marque (ISO alpha-2 ou alpha-3) : il oriente le tirage de l'axe de départ (13 pays ouverts). */
  country?: string;
  /**
   * Des portées de mémoire de PLUS (utilisateur, secteur) : leurs idées sont relues pour ne pas les refaire, et l'idée
   * de ce document y est écrite aussi. La portée principale reste `memoryScope`.
   */
  memoryScopes?: FingerprintScope[];
  /** L'IDÉE d'une toile seule (visuel), décidée par l'étape concept de l'hôte : l'auteur en part. */
  concept?: string;
  /** L'axe de départ déjà tiré par l'hôte (étape concept d'un visuel) : gardé tel quel en mémoire. */
  axisId?: string;
  /** Le nombre de variantes imposé par l'hôte (1 : une seule écriture, quand personne ne choisira). */
  variants?: number;
}

/** Ce que la mémoire de l'hôte rend pour un document : idées déjà faites, axes déjà servis, empreintes de rendus. */
interface DocumentMemory {
  ideas: string[];
  axes: string[];
  renders: Float32Array[];
  /** Les combinaisons du catalogue déjà livrées (portée exigée par le cran) et les habillages de la marque. */
  templates: string[];
  skins: string[];
}

/** La portée mondiale de la mémoire du catalogue (Ultra : jamais une combinaison déjà livrée à un autre client). */
const GLOBAL_CATALOG_SCOPE: FingerprintScope = { documentType: 'catalog', key: 'catalog:global' };
const CHOOSE_TIMEOUT = 45_000;
const DIRECTOR_TIMEOUT = 60_000;
/** La plus petite réduction d'une zone qui reste lisible ; en dessous, la composition est écartée. */
const MIN_ZONE_SCALE = 0.7;

/** La mémoire des idées, par portée (projet, utilisateur, secteur) : 30 jours, les 40 dernières marques. Tous les hôtes s'y tiennent. */
export const MEMORY_TTL_S = 30 * 24 * 3600;
export const MEMORY_MAX = 40;
/** `IDEM_QUALITY_MEMORY=0` : ni lecture ni écriture de la mémoire (essais répétés sur un même projet ou une même marque). */
export const memoryEnabled = (): boolean => process.env.IDEM_QUALITY_MEMORY !== '0';
/** Ajoute des marques à la mémoire d'une portée, en gardant les plus récentes. */
export const mergeMemory = (previous: string[], added: string[]): string[] => [...previous, ...added].slice(-MEMORY_MAX);

/** L'exploration des idées (plan du document, crans hauts) : active par défaut ; `IDEM_QUALITY_EXPLORE=0` la coupe. */
const exploreEnabled = (): boolean => process.env.IDEM_QUALITY_EXPLORE !== '0';

/** L'état des interrupteurs du moteur, écrit au démarrage des services : un processus resté sur l'ancien code se voit. */
export function qualityStatus(): Record<string, boolean> {
  return { catalog: true, explore: exploreEnabled(), memory: memoryEnabled() };
}

export interface SectionOutput {
  spec: SectionSpec;
  result: RenderResult;
  png?: Buffer;
  trace: GenerationTrace;
  /**
   * Les AUTRES variantes écrites pour cette page (plan qualité créative), de la mieux mesurée à la moins bien : déjà
   * payées, elles peuvent être proposées au client. Absentes quand une seule variante a été écrite.
   */
  alternatives?: Array<{ spec: SectionSpec; result: RenderResult; png?: Buffer; score: number }>;
  /** Le score de la page retenue (quand plusieurs variantes ont été mesurées). */
  score?: number;
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

/** Les blocs dont les aplats vides SONT le contenu (nuancier, démonstrations de grille et de densité). */
// (Le nuancier n'en est pas : ses aplats sont reconnus à leur couleur ; un rond gris vide à côté reste un cadre vide.)
const SHAPE_CONTENT = new Set<Block['kind']>(['compositionPrinciples', 'typeScale', 'typeSpecimen']);
const LOGO_BLOCKS = new Set<Block['kind']>(['logoDisplay', 'logoStory']);

/**
 * Ce que le code mesure sur CETTE page (`runtime/check.ts`, `QUALITY`) : les actifs de la marque qu'elle montre
 * (entiers, et grands quand la page n'existe que pour eux), et si ses aplats vides sont du contenu.
 */
export function qualityFrame(section: SectionContent, map: ContentMap, format: FormatDef): QualityFrame {
  const logoBlocks = section.blocks.filter((b) => LOGO_BLOCKS.has(b.kind)).map((b) => b.id);
  const assets = [...map.entries.values()].filter((e) => e.kind === 'url' && logoBlocks.some((id) => e.key.startsWith(`${id}.`))).map((e) => e.value);
  const only = section.blocks.length === 1 && logoBlocks.length === 1 && format.kind === 'fixed';
  const minAssetSide = only ? (section.blocks[0].kind === 'logoStory' ? 0.25 : assets.length <= 1 ? 0.3 : assets.length <= 3 ? 0.15 : 0.1) : undefined;
  // Les fonds voulus des logos (une déclinaison « fond sombre » se pose sur du sombre).
  const grounds: Array<{ src: string; ground: 'light' | 'dark' }> = [];
  for (const b of section.blocks) {
    if (b.kind === 'logoDisplay') for (const v of b.variants) if (v.background === 'dark' || v.background === 'light') grounds.push({ src: v.url, ground: v.background });
  }
  // Le nuancier : chaque couleur doit être peinte.
  const swatches = section.blocks.flatMap((b) => (b.kind === 'swatches' ? b.items.map((i) => i.hex) : []));
  // Le NOM de chaque couleur se pose contre son aplat (le code et le rôle suivent le nom, dessous).
  const swatchKeys = section.blocks.flatMap((b) => (b.kind === 'swatches' ? b.items.map((_, i) => [`${b.id}.items.${i}.name`]) : []));
  // Les rôles des textes : le titre, et les textes simples qui ne doivent jamais lui ressembler. Les spécimens
  // typographiques (leurs échantillons SONT des tailles), la couverture (sa composition est libre) et les faces de carte
  // (sans titre à montrer) en sont exempts.
  const specimen = section.role === 'cover' || section.role === 'card-face' || section.role === 'visual' || section.blocks.some((b) => b.kind === 'typeScale' || b.kind === 'typeSpecimen' || b.kind === 'cover' || b.kind === 'copy' || b.kind === 'contact');
  const roles: Record<string, 'title' | 'text'> = {};
  if (!specimen) {
    for (const key of map.entries.keys()) {
      if (key === 'title') roles[key] = 'title';
      else if (TEXT_KEY.test(key)) roles[key] = 'text';
    }
  }
  return {
    ...(assets.length ? { assets } : {}),
    ...(minAssetSide ? { minAssetSide } : {}),
    ...(section.blocks.some((b) => SHAPE_CONTENT.has(b.kind)) ? { allowEmptyShapes: true } : {}),
    ...(Object.keys(roles).length ? { roles } : {}),
    ...(swatches.length ? { swatches, swatchKeys } : {}),
    ...(grounds.length ? { grounds } : {}),
  };
}

/** Les clés des textes SIMPLES : chapô, sur-titre, libellés, légendes, descriptions, paragraphes, notes. */
const TEXT_KEY = /^(lede|kicker)$|\.(text|body|caption|label|note|detail|basis|readingKey|role|usage|description|rationale|statement|hex|family|name|subject|quote)$|\.paragraphs\.\d+$|\.(items|dos|donts|keywords)\.\d+$/;

interface Rendered {
  template: string;
  html: string;
  head: string;
  png?: Buffer;
  width?: number;
  height?: number;
  issues: Issue[];
  /** Les mesures de la page (quand le moteur choisit entre des variantes ou retouche par la mesure). */
  metrics?: PageMetrics;
  /** Les variantes écartées (la meilleure étant celle-ci), avec leur score. */
  alternatives?: Array<{ page: Rendered; score: number }>;
  score?: number;
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
  /** Les idées déjà faites (marque, utilisateur, secteur), les plus récentes d'abord. */
  private readonly previousIdeas: string[];
  /** L'axe de départ tiré par le code pour ce document (absent : modèle du client, ou exploration coupée). */
  readonly axis: StartAxis | undefined;
  /** La piste d'idée retenue après l'exploration. */
  private chosenTrack: IdeaTrack | undefined;
  /** Les empreintes CLIP des pages retenues (gardées pour que les prochains documents fassent autrement). */
  private readonly renderVectors: Float32Array[] = [];
  /** Le catalogue : l'état du document (habillage, squelettes pris), son habillage, les combinaisons livrées. */
  private catalogState: CatalogState | undefined;
  private skinPromise: Promise<string> | null = null;
  private readonly templateMarks: string[] = [];

  private constructor(
    readonly options: DocumentOptions,
    private readonly memory: DocumentMemory
  ) {
    // Les polices sont TOUJOURS celles de la charte (la « police d'accroche » hors charte des visuels est retirée, 11/11/2026).
    this.tokens = buildTokens({ brand: options.brand, direction: options.direction, format: options.format, allowDark: options.allowDark, size: options.size });
    this.policy = { level: options.creativity === ('max' as CreativityLevel) ? 'high' : options.creativity ?? 'medium' };
    this.generationId = `${options.documentType}:${stableHash([options.seed, Date.now()], 10)}`;
    this.previousIdeas = memory.ideas;
    // L'axe de départ : déterministe (marque, livrable, graine), jamais deux fois le même pour la marque.
    this.axis = exploreEnabled() && !options.reference ? ALL_AXES.find((a) => a.id === options.axisId) ?? pickAxis({ seed: `${options.brand.name}|${options.documentType}|${options.seed}`, country: options.country, used: memory.axes, medium: 'document' }) : undefined;
  }

  /** Toutes les portées de mémoire du document (la principale d'abord). */
  private static scopes(options: DocumentOptions): FingerprintScope[] {
    return [options.memoryScope, ...(options.memoryScopes ?? [])].filter((s): s is FingerprintScope => Boolean(s?.key));
  }

  static async create(options: DocumentOptions): Promise<GraphicDocument> {
    const host = engineHost();
    const lists = memoryEnabled() && host.recentFingerprints ? await Promise.all(GraphicDocument.scopes(options).map((scope) => host.recentFingerprints!(scope).catch(() => [] as string[]))) : [];
    // Les plus récentes d'abord ; une idée déjà vue dans une autre portée n'est comptée qu'une fois.
    const all = lists.flatMap((l) => [...l].reverse());
    const pick = (prefix: RegExp) => [...new Set(all.filter((r) => prefix.test(r)).map((r) => r.replace(prefix, '')))];
    const renders = pick(/^render:/).slice(0, 20).map((v) => {
      try {
        return decodeVector(v);
      } catch {
        return null;
      }
    }).filter((v): v is Float32Array => v !== null && v.length === 512);
    const ideas = pick(/^(idea|bible):/).slice(0, 10);
    const axes = pick(/^axis:/).reverse();
    // La mémoire du catalogue : la marque (Low, Medium), toutes les portées (High), plus tous les clients (Ultra).
    const level = options.creativity === ('max' as CreativityLevel) ? 'high' : options.creativity ?? 'medium';
    const novelty = catalogEffortFor(level).novelty;
    const scoped = novelty === 'brand' ? (lists[0] ?? []) : lists.flat();
    const global = novelty === 'global' && memoryEnabled() && host.recentFingerprints ? await host.recentFingerprints(GLOBAL_CATALOG_SCOPE).catch(() => [] as string[]) : [];
    const templates = [...new Set([...scoped, ...global].filter((r) => r.startsWith('tpl:')).map((r) => r.slice(4)))];
    const skins = [...new Set((lists[0] ?? []).filter((r) => r.startsWith('skin:')).map((r) => r.slice(5)))];
    // Ce que la mémoire écarte est dit, pas caché : un résultat contraint s'explique.
    if (ideas.length || axes.length) log().info('graphic.memory', { documentType: options.documentType, ideas: ideas.length, axes: axes.length, renders: renders.length, scopes: GraphicDocument.scopes(options).map((s) => s.key.slice(0, 60)) });
    return new GraphicDocument(options, { ideas, axes, renders, templates, skins });
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

  /**
   * La toile d'UNE page : la couverture d'un document A4 en flux (business plan) est une composition pleine page —
   * elle se compose sur la page A4 FIXE (210 × 297 mm), et non dans un flux qui s'allonge, où elle ne pouvait pas
   * occuper la hauteur de la page.
   */
  private formatOf(section: Pick<SectionContent, 'role'>): FormatDef {
    const base = this.format;
    if (section.role === 'cover' && base.kind === 'flow' && base.mm?.width === 210 && !this.options.size) return FORMATS['page-a4'];
    return base;
  }

  private context(format: FormatDef = this.format): DocumentContext {
    return {
      documentType: this.options.documentType,
      documentLabel: this.options.documentLabel,
      locale: this.options.locale ?? 'fr',
      tokens: this.tokens,
      format,
      direction: this.options.direction,
      allowDark: this.options.allowDark === true,
      brief: this.options.brief,
      layoutNote: this.options.layoutNote,
      ...(this.options.reference ? { reference: this.options.reference } : {}),
      bindings: this.options.bindings ?? 'values',
      ...(this.axis ? { startingPoint: axisLine(this.axis, 'document') } : {}),
      ...(this.chosenTrack ? { chosenIdea: `${this.chosenTrack.title} — ${this.chosenTrack.idea}` } : this.options.concept?.trim() ? { chosenIdea: this.options.concept.trim().slice(0, 600) } : {}),
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
        if (exploreEnabled() && effortFor(this.policy.level).explore && !this.options.reference) await this.explore(recorder, call, pages, language);
        const { system, user } = planPrompt(this.context(), pages, language, this.previousIdeas);
        const run = await callModel({ call, recorder, task: 'direct', role: 'graphic.director', profile: 'agents', level: this.policy.level, system, user, timeoutMs: DIRECTOR_TIMEOUT, validate: (raw) => parsePlan(raw, pages.length) !== null });
        this.planValue = run.ok ? parsePlan(run.raw, pages.length) ?? undefined : undefined;
        return this.planValue;
      })();
    }
    return this.planPromise;
  }

  /**
   * L'EXPLORATION (plan qualité créative) : quatre pistes d'idée qui divergent, puis le CODE en retient une — la plus
   * éloignée des idées déjà faites (marque, utilisateur, secteur), mesurée par embedding de texte. Sans piste lisible,
   * le plan s'écrit comme avant, avec le seul point de départ.
   */
  private async explore(recorder: TraceRecorder, call: AgentCall, pages: PlannedPage[], language: string | undefined): Promise<void> {
    const { system, user } = explorePrompt(this.context(), pages, language, this.previousIdeas);
    const run = await callModel({ call, recorder, task: 'direct', role: 'graphic.explore', profile: 'agents', level: this.policy.level, system, user, timeoutMs: DIRECTOR_TIMEOUT * 2, validate: (raw) => parseTracks(raw).length >= 2 });
    const tracks = run.ok ? parseTracks(run.raw) : [];
    if (!tracks.length) return;
    const history = this.previousIdeas.map((i) => textEmbedding(i));
    const ranked = tracks.map((t, i) => ({ t, i, n: novelty(textEmbedding(`${t.title} ${t.idea}`), history) })).sort((a, b) => b.n - a.n || a.i - b.i);
    this.chosenTrack = ranked[0].t;
    recorder.repair({ code: 'idea_explored', detail: `${tracks.length} pistes ; retenue « ${ranked[0].t.title} » (nouveauté ${ranked[0].n})`.slice(0, 240), by: 'code' });
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
    const pageFormat = this.formatOf(section);
    const map = buildContentMap(section, this.options.bindings ?? 'values');
    const index = o.index ?? 1;
    const total = o.total ?? (this.options.sections?.length || 1);

    let rendered: Rendered | null = null;
    /** Ce qui a guidé la page (gardé avec elle) : le langage de la marque et la ligne du plan. */
    let bible: string | undefined;
    // 1. Une page rejouée : son code, le nouveau contenu, aucun modèle.
    if (o.replay && isAuthoredSpec(o.replay) && !o.revise) {
      const r = o.replay.catalog && this.pagedFlow(pageFormat) ? await this.renderPaged(o.replay.html, map, section.id, recorder, undefined, pageFormat) : await this.render(o.replay.html, map, section.id, recorder, undefined, pageFormat);
      if (r.ok) rendered = r.page;
      else recorder.repair({ code: 'replay_failed', detail: `la page gardée ne s'affiche plus (${r.error.slice(0, 160)}) : réécrite`, by: 'code' });
      bible = o.replay.bible;
    }
    /** La configuration du catalogue retenue pour la page (absente : une page gardée, rejouée telle quelle). */
    let catalogInfo: SectionSpec['catalog'] = o.replay?.catalog;
    if (!rendered) {
      const quality = { ...qualityFrame(section, map, pageFormat), ...(this.options.allowDark ? { allowDark: true } : {}), ...(this.tokens.brand.logos.onDark ? { logoOnDark: this.tokens.brand.logos.onDark } : {}) };
      const out = await this.composeFromCatalog(section, map, recorder, { index, total, format: pageFormat, quality, revise: o.revise });
      if (!out) throw new GraphicRenderError(section.id, 'aucune composition du catalogue ne s’affiche');
      rendered = out.page;
      catalogInfo = { version: out.version, config: out.config };
      bible = out.summary;
    }

    const patternId = catalogInfo ? 'catalog' : 'authored';
    const spec: SectionSpec = { version: 2, ref: section.id, pattern: { id: patternId }, html: rendered.template, ...(bible ? { bible: bible.slice(0, 2400) } : {}), level, ...(catalogInfo ? { catalog: catalogInfo } : {}) };
    this.specs.set(section.id, spec);
    this.contents.set(section.id, section);
    const usage = recorder.usage();
    const trace = recorder.finish({ pattern: patternId, ...(assets.length ? { assets } : {}) });
    engineHost().onTrace?.(trace);
    const result: RenderResult = {
      version: '1.0',
      documentType: this.options.documentType,
      format: this.options.format,
      sectionId: section.id,
      html: rendered.html,
      head: rendered.head,
      provenance: { engine: ENGINE_VERSION, components: COMPONENT_LIBRARY_VERSION, specHash: stableHash(spec.html, 12), tokensHash: this.tokens.hash, pattern: patternId, fingerprint: catalogInfo ? `catalog|${comboFingerprint(catalogInfo.config)}|${level}` : `authored|${level}` },
      ...(rendered.width ? { measured: { width: rendered.width, height: rendered.height ?? 0 } } : {}),
      repairs: recorder.repairs,
      issues: rendered.issues,
      usage: { agentCalls: usage.agentCalls, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, ms: usage.ms },
    };
    // Les variantes écartées, prêtes à être proposées au client (même contenu, même trace, autre composition).
    const alternatives = (rendered.alternatives ?? []).map(({ page, score }) => ({
      spec: { ...spec, html: page.template },
      result: { ...result, html: page.html, head: page.head, issues: page.issues, provenance: { ...result.provenance, specHash: stableHash(page.template, 12) }, ...(page.width ? { measured: { width: page.width, height: page.height ?? 0 } } : {}) },
      ...(page.png ? { png: page.png } : {}),
      score,
    }));
    return { spec, result, png: rendered.png, trace, ...(alternatives.length ? { alternatives } : {}), ...(rendered.score !== undefined ? { score: rendered.score } : {}) };
  }

  /** L'élément du catalogue de ce document (un graphique seul prend le squelette intégré). */
  private catalogElement(format: FormatDef): CatalogElement {
    return elementOf(this.options.documentType, format) ?? (format.kind === 'flow' ? 'business-plan' : 'pitch-deck');
  }

  /** Une ligne sur la marque pour le modèle qui choisit (nom, style, mots, rapport à l'image). */
  private brandLine(): string {
    const d = this.options.direction;
    return [this.options.brand.name, d?.styleId && `style ${d.styleId}`, d?.keywords?.length && `keywords ${d.keywords.slice(0, 8).join(', ')}`, d?.imageryMedium && `imagery ${d.imageryMedium}`, this.options.brief && `project: ${this.options.brief.replace(/\s+/g, ' ').slice(0, 220)}`].filter(Boolean).join(' · ');
  }

  /**
   * L'HABILLAGE du document, une fois pour toutes ses pages : choisi par le code (accord avec la direction artistique,
   * cohérence avec les livrables déjà faits pour la marque, graine), ou par le modèle parmi quatre (High, Ultra, plus
   * d'une page).
   */
  private ensureSkin(element: CatalogElement, recorder: TraceRecorder, cat: Awaited<ReturnType<typeof loadCatalog>>, overrides: Awaited<ReturnType<typeof catalogOverrides>>): Promise<string> {
    if (!this.skinPromise) {
      this.skinPromise = (async () => {
        const traits = brandTraits(this.options.direction, this.options.allowDark === true);
        const ranked = rankSkins(cat, element, traits, this.catalogState!, `${this.options.brand.name}|${this.options.seed}`, overrides);
        const call = this.agent();
        const multi = (this.options.sections?.length ?? 0) >= 2;
        if (catalogEffortFor(this.policy.level).docSkin === 'model' && multi && ranked.length > 1 && call) {
          const options = ranked.slice(0, 4);
          const language = await this.ensureLanguage(recorder);
          const run = await callModel({ call, recorder, task: 'direct', role: 'graphic.template', profile: 'agents', level: this.policy.level, system: chooseSystem(deliverableLine(this.context())), user: skinUser({ deliverable: '', brandLine: this.brandLine(), language, traits }, options), timeoutMs: CHOOSE_TIMEOUT, validate: (raw) => Boolean(parseSkin(raw, options)) });
          const picked = run.ok ? parseSkin(run.raw, options) : undefined;
          if (picked) {
            recorder.repair({ code: 'catalog_skin', detail: `habillage du document : ${picked.id} (choisi par le modèle parmi ${options.length})`, by: 'agent' });
            return picked.id;
          }
        }
        recorder.repair({ code: 'catalog_skin', detail: `habillage du document : ${ranked[0].id} (choisi par le code)`, by: 'code' });
        return ranked[0].id;
      })();
    }
    return this.skinPromise;
  }

  /**
   * LA PAGE ASSEMBLÉE DEPUIS LE CATALOGUE. Le code filtre et classe le graphe (0 jeton), le modèle choisit et met à jour
   * la configuration (Medium et au-delà, une petite réponse JSON), le code assemble, rend et mesure. Une composition qui
   * ne s'affiche pas cède la place au candidat suivant (sans modèle), puis au squelette intégré. `null` : rien ne s'affiche.
   */
  private async composeFromCatalog(
    section: SectionContent,
    map: ContentMap,
    recorder: TraceRecorder,
    o: { index: number; total: number; format: FormatDef; quality: QualityFrame; revise?: { spec?: SectionSpec; instruction: string } }
  ): Promise<{ page: Rendered; config: PageConfig; version: string; summary: string } | null> {
    const level = this.policy.level;
    const effort = catalogEffortFor(level);
    const [cat, overrides] = await Promise.all([loadCatalog(), catalogOverrides()]);
    const element = this.catalogElement(o.format);
    const traits = brandTraits(this.options.direction, this.options.allowDark === true);
    if (!this.catalogState) this.catalogState = newCatalogState(this.memory.templates, this.memory.skins);
    const state = this.catalogState;
    const skinId = await this.ensureSkin(element, recorder, cat, overrides);
    // Un habillage retiré du catalogue en cours de document : le minimum intégré prend le relais.
    const skin = (cat.nodes.get(skinId)?.kind === 'skin' ? cat.nodes.get(skinId) : cat.nodes.get('builtin.plain')) as SkinNode;
    const units = pageUnits(section);
    const facts = { element, format: o.format, role: section.role, units, index: o.index, total: o.total };
    const seed = `${this.options.brand.name}|${this.options.seed}|${section.id}`;
    const current = o.revise?.spec?.catalog?.config;
    let candidates = shortlist(cat, facts, { level, skin: skin.id, traits, state, seed, overrides });
    // Une retouche écrite part de la configuration actuelle (en tête de liste).
    if (current) {
      const layout = cat.nodes.get(current.layout);
      if (layout?.kind === 'layout') candidates = [{ ref: 'A', layout: layout as LayoutNode, config: { ...current, skin: skin.id }, score: 99, fingerprint: comboFingerprint(current) }, ...candidates.filter((c) => c.fingerprint !== comboFingerprint(current))].map((c, i) => ({ ...c, ref: String.fromCharCode(65 + i) }));
    }
    const single = o.total <= 1 && o.format.kind === 'fixed';
    // L'hôte peut imposer le nombre de compositions (1 : personne ne choisira — fichiers de la charte).
    const wanted = this.options.variants !== undefined ? Math.max(1, Math.min(4, Math.round(this.options.variants))) : Math.max(effort.picks, single ? 2 : 1);
    const picks = Math.min(candidates.length, wanted);
    let chosen: Candidate[] = candidates.slice(0, picks);
    let by: 'code' | 'agent' = 'code';
    // LE MODÈLE CHOISIT (Medium et au-delà, ou une retouche écrite) : une réponse JSON vérifiée.
    const call = this.agent();
    const askModel = call && (effort.chooser === 'model' || o.revise) && (candidates.length > 1 || o.revise);
    if (askModel) {
      const disabled = new Set(overrides.disabled ?? []);
      const componentOptions = new Map<string, ComponentNode[]>();
      if (effort.assembly === 'zones' || effort.assembly === 'mixed' || o.revise) {
        for (const u of units) {
          const comps = compatibleComponents(cat, u, ['header', 'main', 'side', 'media', 'any'], disabled).slice(0, effort.assembly === 'mixed' ? 5 : 3);
          if (comps.length > 1) componentOptions.set(u.id, comps);
        }
      }
      const language = await this.ensureLanguage(recorder);
      if (effort.assembly === 'zones' || effort.assembly === 'mixed') await this.ensurePlan(recorder, language);
      // L'idée retenue d'un visuel (étape concept de l'hôte) guide le choix comme la ligne du plan guide une page.
      const planLine = this.planFor(section.id, o.index)?.page ?? (this.options.concept?.trim() ? `idea: ${this.options.concept.trim().slice(0, 280)}` : undefined);
      const layoutNote = [this.options.layoutNote, !current ? o.revise?.instruction : undefined].filter(Boolean).join(' — ') || undefined;
      const user = chooseUser(cat, { deliverable: '', brandLine: this.brandLine(), language, traits, ...(planLine ? { plan: planLine } : {}), ...(layoutNote ? { layoutNote } : {}), ...(this.options.reference ? { reference: JSON.stringify(this.options.reference).slice(0, 400) } : {}) }, { section, units, candidates, level, componentOptions, skin, ...(current ? { current, instruction: o.revise?.instruction } : {}) });
      const parseOpts = { componentOptions, skin, params: effort.assembly === 'mixed' };
      const run = await callModel({ call: call!, recorder, task: o.revise ? 'revise' : 'direct', role: 'graphic.template', profile: 'agents', level, system: chooseSystem(deliverableLine(this.context(o.format))), user, timeoutMs: CHOOSE_TIMEOUT, validate: (raw) => parseChoices(raw, cat, candidates, parseOpts).length > 0 });
      const parsed = run.ok ? parseChoices(run.raw, cat, candidates, parseOpts).map((c) => ({ ...c, fingerprint: comboFingerprint(c.config) })) : [];
      if (parsed.length) {
        by = 'agent';
        const seen = new Set(parsed.map((c) => c.fingerprint));
        chosen = [...parsed, ...candidates.filter((c) => !seen.has(c.fingerprint))].slice(0, Math.max(picks, parsed.length));
      }
    }
    // Le HTML des composants retenus (et des candidats de repli) : téléchargé, vérifié par son empreinte.
    const queue = [...chosen, ...candidates.filter((c) => !chosen.includes(c))].slice(0, chosen.length + 3);
    await ensureHtml(cat, queue.flatMap((c) => Object.values(c.config.components)));
    const ctx = { section, map, format: o.format, tokens: this.tokens, documentType: this.options.documentType };
    const done: Array<{ page: Rendered; cand: Candidate }> = [];
    let partial: { page: Rendered; cand: Candidate } | undefined;
    const tried: string[] = [];
    /** `force` : le dernier recours — la zone est réduite autant qu'il faut (plancher 0,35) et la page livrée, signalée. */
    const tryCandidate = async (cand: Candidate, force = false): Promise<void> => {
      const comps = new Map(Object.entries(cand.config.components).map(([unit, id]) => [unit, cat.nodes.get(id) as ComponentNode | undefined]));
      const choice = { layout: cand.layout, skin, components: comps, config: cand.config };
      const assemble = (zoom?: Map<string, number>) => {
        const a = assemblePage(ctx, choice, units, zoom);
        return 'error' in a || !o.quality.roles ? a : { ...a, html: capPlainText(a.html, o.format.base, (k) => o.quality.roles?.[k] === 'text') };
      };
      let asm = assemble();
      if ('error' in asm) {
        tried.push(`${cand.config.gabarit ?? cand.layout.id}: ${asm.error}`);
        return;
      }
      // Premier rendu sans réduction de la page entière : on mesure d'abord ce que chaque ZONE doit réduire.
      // Le business plan : le moteur compose lui-même ses pages A4 fixes (aperçu = PDF).
      if (this.pagedFlow(o.format)) {
        const paged = await this.renderPaged(asm.html, map, section.id, recorder, o.quality, o.format);
        if (paged.ok) done.push({ page: paged.page, cand });
        else {
          tried.push(`${cand.config.gabarit ?? cand.layout.id}: ${paged.error.slice(0, 120)}`);
          if (paged.partial && !partial) partial = { page: paged.partial, cand };
        }
        return;
      }
      let r = await this.render(asm.html, map, section.id, recorder, o.quality, o.format, picks > 1, o.format.kind !== 'fixed');
      // LE CODE FAIT TENIR chaque zone : celle qui déborde est réduite à l'échelle exacte ; sous 70 % (un corps de
      // texte illisible, un graphique écrasé), le candidat est écarté (le suivant prend la page).
      const over = o.format.kind === 'fixed' && r.zoneFits ? Object.entries(r.zoneFits).filter(([, k]) => k < 0.995) : [];
      if (!force && over.some(([, k]) => k < MIN_ZONE_SCALE)) {
        tried.push(`${cand.config.gabarit ?? cand.layout.id}: zone trop petite (${over.map(([z, k]) => `${z} ${Math.round(k * 100)} %`).join(', ')})`);
        return;
      }
      if (over.length) {
        // Jusqu'à trois passes : le texte réduit se recompose, la mesure suivante affine l'échelle de chaque zone.
        const scale = new Map<string, number>(over.map(([z, k]) => [z, force ? Math.max(0.35, k) : k]));
        for (let pass = 0; pass < 3; pass++) {
          const zoomed = assemble(scale);
          if ('error' in zoomed) break;
          asm = zoomed;
          r = await this.render(asm.html, map, section.id, recorder, o.quality, o.format, picks > 1, pass === 2);
          const still = r.zoneFits ? Object.entries(r.zoneFits).filter(([, k]) => k < 0.995) : [];
          if (!still.length) break;
          for (const [z, k] of still) scale.set(z, Math.max(force ? 0.35 : MIN_ZONE_SCALE - 0.05, (scale.get(z) ?? 1) * k));
        }
        recorder.repair({ code: 'zone_fit', detail: `zones ramenées à leur taille : ${[...scale.entries()].map(([z, k]) => `${z} ${Math.round(k * 100)} %`).join(', ')}`, by: 'code' });
        if (!r.ok && o.format.kind === 'fixed') r = await this.render(asm.html, map, section.id, recorder, o.quality, o.format, picks > 1);
      } else if (!r.ok && o.format.kind === 'fixed') {
        // Aucune zone ne déborde mais la page dépasse : la réduction de la page entière (plancher 0,6).
        r = await this.render(asm.html, map, section.id, recorder, o.quality, o.format, picks > 1);
      }
      if (r.ok) done.push({ page: r.page, cand });
      else {
        tried.push(`${cand.config.gabarit ?? cand.layout.id}: ${r.error.slice(0, 120)}`);
        if (r.partial && !partial) partial = { page: r.partial, cand };
      }
    };
    for (const cand of queue) {
      if (done.length >= picks) break;
      await tryCandidate(cand);
    }
    // Le squelette intégré ferme la marche.
    if (!done.length && !partial) {
      const builtin = shortlist({ ...cat, nodes: new Map([...cat.nodes].filter(([, n]) => n.id.startsWith('builtin.') || n.kind === 'component')) }, facts, { level: 'low', skin: skin.id, traits, state, seed, overrides });
      for (const cand of builtin.slice(0, 1)) await tryCandidate(cand);
    }
    // LE DERNIER RECOURS : rien ne s'est affiché proprement ni presque — le premier candidat, réduit autant qu'il faut.
    // Une page n'est jamais perdue faute de place ; elle est livrée et signalée.
    if (!done.length && !partial && queue.length) await tryCandidate(queue[0], true);
    if (tried.length) recorder.repair({ code: 'catalog_fallback', detail: `écartés : ${tried.slice(0, 4).join(' ; ')}`.slice(0, 240), by: 'code' });
    let best = done[0] ?? partial;
    if (!best) {
      log().warn('graphic.catalog_failed', { event: 'graphic.catalog_failed', documentType: this.options.documentType, section: section.id, tried: tried.slice(0, 8) });
      return null;
    }
    let alternatives: Array<{ page: Rendered; score: number }> = [];
    let score: number | undefined;
    if (done.length > 1) {
      const scored = await Promise.all(done.map(async (d) => ({ d, ...(await this.evaluate(d.page)) })));
      // Le choix du modèle garde une légère préséance ; la mesure départage.
      scored.sort((a, b) => b.score.score + (b.d === done[0] && by === 'agent' ? 0.03 : 0) - (a.score.score + (a.d === done[0] && by === 'agent' ? 0.03 : 0)));
      best = scored[0].d;
      score = scored[0].score.score;
      if (scored[0].vector) this.renderVectors.push(scored[0].vector);
      alternatives = scored.slice(1).map((x) => ({ page: x.d.page, score: x.score.score }));
      recorder.repair({ code: 'variant_selected', detail: `${scored.length} compositions du catalogue rendues ; gardée ${scored[0].score.score}`, by: 'code' });
    }
    const config = best.cand.config;
    const fingerprint = comboFingerprint(config);
    state.byIndex.set(o.index, { layout: config.layout, ...(config.gabarit ? { gabarit: config.gabarit } : {}) });
    for (const id of [config.layout, config.gabarit, ...Object.values(config.components)]) if (id) state.use.set(id, (state.use.get(id) ?? 0) + 1);
    state.seen.add(fingerprint);
    this.templateMarks.push(`tpl:${fingerprint}`);
    const summary = `catalog ${cat.version} · ${config.gabarit ? `gabarit ${config.gabarit} · ` : ''}layout ${config.layout}${config.mirror ? ' (mirror)' : ''} · skin ${config.skin} · ${Object.entries(config.components).map(([u, c]) => `${u}=${c}`).join(', ')}`;
    recorder.repair({ code: 'catalog_pick', detail: summary.slice(0, 240), by });
    return { page: { ...best.page, ...(score !== undefined ? { score } : {}), ...(alternatives.length ? { alternatives } : {}) }, config, version: cat.version, summary };
  }

  /** Les mesures d'une page rendue, réunies en un score transparent (`@idem/design-tools`, `scoreVariant`). */
  private async evaluate(page: Rendered): Promise<{ score: VariantScore; judgeFaults: string[]; vector?: Float32Array }> {
    const blocking = page.issues.filter((i) => i.severity === 'blocking').length;
    const advisory = page.issues.length - blocking;
    if (!page.png) return { score: scoreVariant({ issues: { blocking, advisory }, ...(page.metrics ? { metrics: page.metrics } : {}) }), judgeFaults: [] };
    const png = page.png;
    const [sal, verdict, vector] = await Promise.all([
      analyzeSaliency(png, page.metrics?.regions ?? {}).catch(() => undefined),
      engineHost().judgeImage && effortFor(this.policy.level).judge ? judgeImage(engineHost().judgeImage, png) : Promise.resolve(undefined),
      imageEmbedding(png).catch(() => null),
    ]);
    const focalShare = sal ? Math.max(sal.shares.title ?? 0, sal.shares.visual ?? 0, sal.shares.logo ?? 0) : undefined;
    const score = scoreVariant({
      issues: { blocking, advisory },
      ...(page.metrics ? { metrics: page.metrics } : {}),
      ...(sal ? { focalCount: sal.focalCount, ...(focalShare !== undefined && page.metrics && Object.keys(page.metrics.regions).length ? { focalShare } : {}) } : {}),
      ...(verdict && !verdict.unavailable ? { judge: verdict.score } : {}),
      ...(vector ? { novelty: novelty(vector, [...this.memory.renders, ...this.renderVectors]) } : {}),
    });
    return { score, judgeFaults: verdict && !verdict.unavailable ? verdict.faults : [], ...(vector ? { vector } : {}) };
  }

  /** Une page de flux du catalogue (business plan, rapport) : mise en pages A4 par le moteur (`catalog/paginate.ts`). */
  private pagedFlow(format: FormatDef): boolean {
    return format.kind === 'flow' && (this.options.documentType === 'business-plan' || this.options.documentType === 'report') && process.env.GRAPHIC_BP_PAGED !== '0';
  }

  /**
   * LA MISE EN PAGES : le flux est mesuré dans Chromium, réparti en pages A4 de hauteur exacte, puis chaque page est
   * rendue et contrôlée comme une toile fixe. La page gardée reste le flux (rejouable) ; le rendu, ce sont les pages
   * (`data-ge-page`), que l'aperçu affiche et que le PDF imprime telles quelles.
   */
  private async renderPaged(template: string, map: ContentMap, sectionId: string, recorder: TraceRecorder, quality: QualityFrame | undefined, format: FormatDef): Promise<{ ok: true; page: Rendered } | { ok: false; error: string; template: string; partial?: Rendered }> {
    const t0 = Date.now();
    const pieces = flowPieces(template);
    if (!pieces.length) return this.render(template, map, sectionId, recorder, quality, format);
    // 1. La mesure du flux (même largeur que la page : 210 mm moins les marges d'impression).
    const clean = sanitizeHtml(template).html;
    const flow = expandPage(clean, map, this.tokens, format, { sectionId, locale: this.options.locale ?? 'fr', engine: ENGINE_VERSION });
    const flowCss = await compileTailwind(flow.html, this.tokens);
    const flowHead = `${this.head ? `${this.head}\n` : ''}<style data-ge-tailwind>${flowCss}</style>`;
    let metrics: PieceMetrics[];
    try {
      metrics = await measureFlow(flow.html, flowHead, format.width, pieces);
      // Des chiffres trop longs pour leur case : réduits par le code, puis le flux est mesuré de nouveau.
      const fits = (metrics as { fits?: Array<{ key: string; scale: number }> }).fits ?? [];
      if (fits.length) {
        template = fitFigures(template, fits);
        pieces.splice(0, pieces.length, ...flowPieces(template));
        const again = expandPage(sanitizeHtml(template).html, map, this.tokens, format, { sectionId, locale: this.options.locale ?? 'fr', engine: ENGINE_VERSION });
        const againHead = `${this.head ? `${this.head}\n` : ''}<style data-ge-tailwind>${await compileTailwind(again.html, this.tokens)}</style>`;
        metrics = await measureFlow(again.html, againHead, format.width, pieces);
        recorder.repair({ code: 'figure_fit', detail: `${fits.length} chiffre(s) ramené(s) à leur case`, by: 'code' });
      }
    } catch (error) {
      log().warn('graphic.paged_measure_failed', { section: sectionId, reason: String((error as Error)?.message ?? error).slice(0, 160) });
      return this.render(template, map, sectionId, recorder, quality, format);
    }
    // 2. Les pages : A4 (297 mm), moins les marges d'impression (12 mm) et une marge de sécurité.
    const MM = 96 / 25.4;
    const pageH = (format.mm?.height ?? 297) * MM;
    const pad = 12 * MM;
    const capacity = pageH - 2 * pad - 6;
    const pages = packPages(pieces, metrics, { capacity });
    const pageFormat: FormatDef = { ...format, kind: 'fixed', height: Math.round(pageH), css: { ...format.css, height: `${format.mm?.height ?? 297}mm` } };
    // 3. Chaque page, rendue et contrôlée comme une toile fixe (un léger dépassement est ramené à sa taille).
    const htmls: string[] = [];
    const issues: Issue[] = [];
    for (const [i, p] of pages.entries()) {
      const tpl = pageTemplate(p.chunks.map((c, k) => chunkHtml(pieces[c.piece], metrics[c.piece], c, k === 0)), '12mm', p.used / capacity);
      const r = await this.render(tpl, map, sectionId, recorder, quality, pageFormat, false, true, true);
      const page = r.ok ? r.page : r.partial;
      if (!page) return { ok: false, error: `page ${i + 1} : ${r.ok ? '' : r.error}`, template };
      if (!r.ok) issues.push({ code: 'page_defect', severity: 'advisory', message: `Page ${i + 1} : ${r.error}`.slice(0, 380) });
      issues.push(...page.issues.filter((x) => x.code !== 'content_not_shown'));
      htmls.push(page.html.replace(/^<div /, `<div data-ge-page="${i + 1}" `));
    }
    const html = htmls.join('');
    const css = await compileTailwind(html, this.tokens);
    const head = `${this.head ? `${this.head}\n` : ''}<style data-ge-tailwind>${css}</style>`;
    recorder.repair({ code: 'paged', detail: `${pages.length} page(s) A4 composée(s) : ${pages.map((p) => `${Math.round((p.used / (pageH - 2 * pad)) * 100)} %`).join(' / ')}`, by: 'code' });
    recorder.task({ task: 'render', source: 'code', inputTokens: 0, outputTokens: 0, ms: Date.now() - t0, outcome: 'accepted' });
    return { ok: true, page: { template, html, head, issues } };
  }

  /** Assainir, remplir, compiler, puis demander à Chromium si la page s'affiche. Rien n'est jugé d'autre. */
  private async render(raw: string, map: ContentMap, sectionId: string, recorder: TraceRecorder, quality?: QualityFrame, format: FormatDef = this.format, measure = false, autoFit = true, partial = false): Promise<{ ok: true; page: Rendered; zoneFits?: Record<string, number> } | { ok: false; error: string; template: string; partial?: Rendered; zoneFits?: Record<string, number> }> {
    const t0 = Date.now();
    const clean = sanitizeHtml(raw);
    if (!clean.html.trim()) return { ok: false, error: 'the page is empty after removing what is not allowed (scripts, styles, external resources)', template: clean.html };
    const issues: Issue[] = [];
    // Un dessin SVG écrit par l'auteur (une coche, un faux schéma, une illustration) est une décoration inventée : seuls
    // les outils du code dessinent (logo, icônes, motifs, graphiques). Retiré par le code.
    if (/<svg\b/i.test(clean.html)) {
      clean.html = clean.html.replace(/<svg\b[\s\S]*?<\/svg>/gi, '');
      issues.push({ code: 'invented_drawing_removed', severity: 'advisory', message: 'Dessin SVG écrit par l’auteur, retiré (seuls les outils du code dessinent).' });
    }
    // Une icône que le contenu ne demande pas (aucune clé d'icône) est une décoration inventée : retirée par le code.
    if (![...map.entries.values()].some((e) => e.kind === 'icon') && /<idem-icon\b/i.test(clean.html)) {
      clean.html = clean.html.replace(/<idem-icon\b[^>]*?\/?>(?:\s*<\/idem-icon>)?/gi, '');
      issues.push({ code: 'invented_icon_removed', severity: 'advisory', message: 'Icônes décoratives non demandées par le contenu, retirées.' });
    }
    // Les mots viennent du contenu : le texte écrit en dur par l'auteur est retiré (dit dans les constats).
    const words = stripInventedText(clean.html);
    if (words.loops) return { ok: false, error: 'template loops ({{#each}}, {{/each}}) do not exist here: write every content key explicitly, one element per item', template: clean.html };
    if (words.removed.length) {
      clean.html = words.html;
      issues.push({ code: 'invented_text_removed', severity: 'advisory', message: `Texte écrit par l'auteur hors contenu, retiré : ${words.removed.slice(0, 6).join(' · ')}`.slice(0, 380) });
    }
    if (clean.nativeCss) issues.push({ code: 'native_css_removed', severity: 'advisory', message: `${clean.nativeCss} style(s) CSS natif(s) retiré(s) : la page est en Tailwind.` });
    const page = expandPage(clean.html, map, this.tokens, format, { sectionId, locale: this.options.locale ?? 'fr', engine: ENGINE_VERSION });
    if (page.unknown.length) issues.push({ code: 'unknown_keys', severity: 'advisory', message: `Clés inconnues ignorées : ${page.unknown.slice(0, 8).join(', ')}` });
    if (page.orphans.length) issues.push({ code: 'unknown_blocks', severity: 'advisory', message: `Primitives sans bloc : ${page.orphans.slice(0, 6).join(', ')}` });
    // Le titre d'un visuel, d'une face de carte ou d'une couverture est une étiquette (le texte du visuel le porte) : il
    // n'a pas à être posé.
    const unused = [...map.entries.keys()].filter((k) => !page.used.has(k) && !(k === 'title' && quality && !quality.roles?.title) && !/\.visual$/.test(k));
    const unusedBlocks = [...map.primitives.keys()].filter((id) => !page.used.has(`#${id}`));
    // Une PAGE d'une section mise en pages ne montre qu'une partie du contenu : rien n'y manque.
    if (!partial && (unused.length || unusedBlocks.length)) issues.push({ code: 'content_not_shown', severity: 'advisory', message: `Contenu non placé par l'auteur : ${[...unusedBlocks.map((b) => `#${b}`), ...unused].slice(0, 12).join(', ')}` });
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
    const check = await checkRender(page.html, head, format, { lang: this.options.locale, shoot: Boolean(this.options.png), ...(quality ? { quality } : {}), ...(measure ? { measure: true } : {}) });
    recorder.task({ task: 'render', source: 'code', inputTokens: 0, outputTokens: 0, ms: Date.now() - t0, outcome: check.ok ? 'accepted' : 'refused' });
    if (check.infra) log().warn('graphic.render_unchecked', { event: 'graphic.render_unchecked', section: sectionId, reason: check.error });
    // LE CODE FAIT TENIR : un contenu qui déborde d'une toile fixe est réduit à l'échelle exacte (plancher 0,6), la
    // composition intacte — le modèle n'estime pas des hauteurs, et la page ne repart pas pour si peu.
    if (autoFit && !check.ok && check.fit && check.fit >= 0.6 && !/\[zoom:/.test(clean.html)) {
      const z = check.fit;
      const wrapped = `<div class="h-[${(100 / z).toFixed(3)}%] w-[${(100 / z).toFixed(3)}%] [zoom:${z}]">${clean.html}</div>`;
      const fitted = await this.render(wrapped, map, sectionId, recorder, quality, format, measure, true, partial);
      if (fitted.ok) {
        recorder.repair({ code: 'auto_fit', detail: `contenu réduit à ${Math.round(z * 100)} % pour tenir dans la page`, by: 'code' });
        return fitted;
      }
      // Réduite, la page a d'autres défauts : ceux-là partent à l'auteur (la version réduite sert de base).
      return fitted;
    }
    if (!check.ok) {
      // Un texte coupé par le bord : la page s'affiche presque entière — gardée comme REPLI si la correction échoue.
      const partial = check.cut ? { template: clean.html, html: page.html, head, png: check.png, issues: [...issues, { code: 'text_cut', severity: 'blocking' as const, message: (check.error ?? '').slice(0, 380) }] } : undefined;
      return { ok: false, error: check.error ?? 'the page did not display', template: clean.html, ...(partial ? { partial } : {}), ...(check.zoneFits ? { zoneFits: check.zoneFits } : {}) };
    }
    const done: Rendered = { template: clean.html, html: page.html, head, png: check.png, width: check.width, height: check.height, issues, ...(check.metrics ? { metrics: check.metrics } : {}) };
    // Un graphique, un tableau, une galerie ou un actif de la marque oublié par l'auteur : la page perd sa preuve.
    // Renvoyée à l'auteur ; livrée signalée si la correction échoue.
    const missingAssets = quality?.assets?.length ? [...map.entries.values()].filter((e) => e.kind === 'url' && quality.assets!.includes(e.value) && !page.used.has(e.key)).map((e) => `{{${e.key}}}`) : [];
    // Le titre de la page est toujours montré (une page de motifs sans titre ne se lit pas) — sauf sur la couverture.
    const missingTitle = quality && quality.roles?.title && map.entries.has('title') && !page.used.has('title') ? ['{{title}}'] : [];
    if (!partial && quality && (unusedBlocks.length || missingAssets.length || missingTitle.length)) {
      const missing = [...missingTitle, ...unusedBlocks.map((id) => `<idem-${map.primitives.get(id)?.kind === 'table' ? 'table' : map.primitives.get(id)?.kind === 'mockupShowcase' ? 'gallery' : 'chart'} data-block="${id}">`), ...missingAssets];
      const error = `content is missing from the page: ${missing.slice(0, 6).join(', ')} — place every chart, table, gallery and brand asset image, readable`;
      return { ok: false, error, template: clean.html, partial: { ...done, issues: [...issues, { code: 'content_missing', severity: 'blocking', message: error.slice(0, 380) }] } };
    }
    return { ok: true, page: done, ...(check.zoneFits ? { zoneFits: check.zoneFits } : {}) };
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
      { level: this.policy.level, documentType: this.options.documentType, locale: this.options.locale, userId: this.options.user?.userId, projectId: this.options.user?.projectId, brandName: this.options.brand.name, styleId: this.options.direction?.styleId, keywords: this.options.direction?.keywords, ...(this.options.direction?.imagery ? { imagery: this.options.direction.imagery } : {}), ...(this.options.direction?.imageryMedium ? { imageryMedium: this.options.direction.imageryMedium } : {}) },
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
    if (!host.rememberFingerprints || !memoryEnabled()) return;
    const idea = this.planValue?.idea || (this.chosenTrack ? `${this.chosenTrack.title} — ${this.chosenTrack.idea}` : this.options.concept?.trim() || '');
    const skin = this.skinPromise ? await this.skinPromise.catch(() => undefined) : undefined;
    const marks = [...(idea ? [`idea:${idea.slice(0, 300)}`] : []), ...(this.axis ? [`axis:${this.axis.id}`] : []), ...this.renderVectors.slice(0, 3).map((v) => `render:${encodeVector(v)}`), ...this.templateMarks, ...(skin ? [`skin:${skin}`] : [])];
    if (!marks.length) return;
    // Ultra : les combinaisons livrées vont aussi dans la mémoire de TOUS les clients.
    if (this.templateMarks.length && catalogEffortFor(this.policy.level).novelty === 'global') await host.rememberFingerprints(GLOBAL_CATALOG_SCOPE, this.templateMarks).catch(() => undefined);
    // L'idée et l'axe vont dans toutes les portées (marque, utilisateur, secteur) ; les empreintes de rendu, dans la
    // portée principale seulement (elles sont lourdes).
    const scopes = GraphicDocument.scopes(this.options);
    await Promise.all(scopes.map((scope, i) => host.rememberFingerprints!(scope, i === 0 ? marks : marks.filter((m) => !m.startsWith('render:'))).catch(() => undefined)));
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

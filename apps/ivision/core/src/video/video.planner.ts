/**
 * LE PLANIFICATEUR CRÉATIF — de la « variété par exclusion » à la « créativité par recherche ».
 *
 * Le moteur savait éviter de se répéter (moteur de VARIÉTÉ : concepts, directions, kits récents
 * exclus). Il lui manquait un moteur de CRÉATIVITÉ : chercher, dans l'espace des motifs
 * (`video.patterns.ts`), une combinaison pertinente, fidèle à la charte ET nouvelle. Les deux
 * tournent ensemble ; aucun appel de modèle ici, tout est déterministe (graine de la vidéo).
 *
 * Trois mémoires :
 *   projet   les 10 dernières vidéos de la marque (empreintes, `video.fingerprint.ts`) → éviter les redites
 *   globale  ce qui marche en général (`video.experience.ts`) → privilégier les motifs performants
 *   session  ce que cette vidéo a déjà utilisé → ne pas se répéter À L'INTÉRIEUR du film
 *
 * Le score d'un motif candidat (« CreativeScore ») :
 *   0,35 × pertinence (l'intention de la scène) + 0,25 × qualité (a priori + expérience)
 *   + 0,20 × nouveauté (mémoire du projet)      + 0,10 × fidélité à la marque (direction, DA)
 *   + 0,10 × faisabilité (coût de rendu)        + bonus d'exploration − répétitions dans le film
 * La nouveauté ne remplace pas la pénalité de réutilisation récente du graphe : elle mesure ce
 * qui reste SOUS-EXPLORÉ, pas seulement ce qui vient de servir. Et elle ne pèse que 20 % : la
 * créativité n'est pas la distance maximale, c'est cohérence + pertinence + nouveauté.
 *
 * L'ADN de mouvement : la direction, le rythme et une ou deux familles de motifs que la vidéo garde
 * partout. L'ACCENT CRÉATIF : une seule scène (25 % du film au plus) reçoit une touche d'une autre
 * famille — Swiss, grille et coupes nettes… et, scène 4, une annotation au crayon.
 *
 * Le cran fixe la part d'EXPLORATION (combinaisons compatibles mais peu courantes), réalisée par le
 * graphe et non par des tokens : Low 5 %, Medium 15 %, High 25 %, Max 40 %, Ultra 70 %.
 * Et le même moteur sert tous les crans : en dessous de High le planificateur décide ; dès High les
 * agents choisissent dans ses 3 à 5 meilleurs motifs ; au cran Max l'IA choisit aussi la direction
 * créative parmi trois ; au cran Ultra le directeur reçoit l'univers créatif (motifs, sous-explorés,
 * combinaisons compatibles) et chaque plan codé ne reçoit que les briques de son motif.
 */
import { CreativityLevel } from '../creativity/levels';
import { VideoKit, VideoStoryboard } from './video.model';
import { applyKitOverrides, KitContext } from './video.capabilities';
import { rng } from './video.music';
import { BriefFacts } from './video.copy';
import { DirectionId, DIRECTIONS } from './video.direction';
import { LayoutScene, LAYOUT_SCENES } from './video.layouts';
import { CONCEPT_IDS } from './video.concepts';
import { ExperienceMemory } from './video.experience';
import { CreativeFingerprint, fingerprintOf, noveltyAgainst } from './video.fingerprint';
import {
  FAMILY_PITCH,
  factsAllow,
  IntentId,
  isExperimental,
  PATTERN_BY_ID,
  PATTERN_FAMILIES,
  PatternDef,
  PatternFamily,
  patternAffinity,
  patternFits,
  PATTERNS,
  derivedPattern,
  patternForLayout,
  sceneIntents,
} from './video.patterns';

export const EXPLORATION_BUDGET: Record<CreativityLevel, number> = { low: 0.05, medium: 0.15, high: 0.25, max: 0.4, ultra: 0.7 };
/**
 * Repère de nouveauté par cran (affiché dans le rapport). Le contrôle créatif ne répare que sous
 * 0,30 : pousser chaque vidéo vers ce repère rendrait les films artificiellement extravagants.
 */
export const NOVELTY_TARGET: Record<CreativityLevel, number> = { low: 0.35, medium: 0.4, high: 0.45, max: 0.5, ultra: 0.55 };
export const CREATIVE_WEIGHTS = { relevance: 0.35, quality: 0.25, novelty: 0.2, brandFit: 0.1, feasibility: 0.1 } as const;

const r3 = (v: number) => Math.round(v * 1000) / 1000;

// ─── Mémoire du projet ──────────────────────────────────────────────────────

export interface ProjectMemory {
  /** Empreintes des dernières vidéos, la plus récente en dernier. */
  fingerprints: CreativeFingerprint[];
  /** Part pondérée (récence) des vidéos où l'élément a servi : 0 = jamais, 1 = dans toutes. */
  usage: (kind: 'pattern' | 'family' | 'node' | 'concept', id: string) => number;
  /** Usage des nœuds du graphe (pour le routeur du kit). */
  nodeUsage: Record<string, number>;
}

/** La mémoire d'un projet, lue sur les empreintes (stockées, ou calculées pour les vidéos anciennes). */
export function projectMemory(videos: { storyboard?: VideoStoryboard }[], limit = 10): ProjectMemory {
  const fingerprints = videos
    .filter((v) => v.storyboard?.scenes?.length)
    .slice(-limit)
    .map((v) => v.storyboard!.creative?.fingerprint || fingerprintOf(v.storyboard!));
  // Récence : la dernière vidéo pèse 1, l'avant-dernière 0,8… (mémoire qui s'estompe).
  const weights = fingerprints.map((_, i) => Math.pow(0.8, fingerprints.length - 1 - i));
  const total = weights.reduce((s, w) => s + w, 0) || 1;
  const tally = (pick: (fp: CreativeFingerprint) => string[]) => {
    const m = new Map<string, number>();
    fingerprints.forEach((fp, i) => {
      for (const id of new Set(pick(fp))) m.set(id, (m.get(id) || 0) + weights[i]);
    });
    return m;
  };
  const maps = {
    pattern: tally((fp) => fp.patterns),
    family: tally((fp) => fp.families),
    node: tally((fp) => fp.nodes),
    concept: tally((fp) => (fp.concept ? [fp.concept] : [])),
  };
  const usage = (kind: keyof typeof maps, id: string) => Math.min(1, (maps[kind].get(id) || 0) / total);
  const nodeUsage: Record<string, number> = {};
  for (const [id, w] of maps.node) nodeUsage[id] = r3(Math.min(1, w / total));
  return { fingerprints, usage, nodeUsage };
}

/** Ce que cette vidéo a déjà utilisé (répétitions à l'intérieur du film). */
export class SessionMemory {
  readonly patterns: string[] = [];
  readonly layouts: string[] = [];
  readonly families: PatternFamily[] = [];
  use(p: PatternDef) {
    this.patterns.push(p.id);
    if (p.tools.layout) this.layouts.push(p.tools.layout);
    this.families.push(p.family);
  }
}

// ─── Phase A : le brief créatif (avant le stratège) ─────────────────────────

export interface CreativeStrategy {
  id: 'a' | 'b' | 'c';
  /** Nom court (rapport, interface). */
  label: string;
  /** Une ligne pour le stratège du cran Max (anglais). */
  pitch: string;
  families: PatternFamily[];
  accentFamily?: PatternFamily;
  exploration: number;
  score: number;
}

export interface CreativeBriefInput {
  level: CreativityLevel;
  direction: DirectionId;
  facts?: BriefFacts;
  photos: number;
  durationSec: number;
  excludedLayouts?: string[];
  boosts?: Record<string, number>;
  memory: ProjectMemory;
  experience?: ExperienceMemory;
  seed: number;
}

export interface CreativeBrief {
  level: CreativityLevel;
  direction: DirectionId;
  budget: number;
  noveltyTarget: number;
  strategies: CreativeStrategy[];
  strategy: CreativeStrategy;
  /** Bonus des concepts sous-explorés dans le projet (ajoutés au classement du graphe). */
  conceptBoosts: Record<string, number>;
  memory: ProjectMemory;
  experience?: ExperienceMemory;
  input: CreativeBriefInput;
}

/** Affinité d'une famille avec la direction (moyenne de ses trois meilleurs motifs utilisables). */
function familyAffinity(family: PatternFamily, input: CreativeBriefInput): number {
  const list = PATTERNS.filter((p) => p.family === family && (p.role === 'scene' || p.role === 'overlay') && factsAllow(p, input.facts, input.photos))
    .map((p) => patternAffinity(p, input.direction))
    .sort((a, b) => b - a)
    .slice(0, 3);
  return list.length ? list.reduce((s, x) => s + x, 0) / list.length : 0;
}

/** Familles éligibles à l'ADN et à l'accent (le logo et les plans de médias ont leurs propres règles). */
const DNA_FAMILIES: PatternFamily[] = ['type', 'data', 'graphic', 'drawn', 'spatial'];

export function briefCreative(input: CreativeBriefInput): CreativeBrief {
  const budget = EXPLORATION_BUDGET[input.level];
  const { memory } = input;
  const families = DNA_FAMILIES.map((f) => ({ f, aff: familyAffinity(f, input), used: memory.usage('family', f) })).filter((x) => x.aff > 0);
  // Une famille de données sans aucun chiffre dans le brief n'a rien à montrer.
  const usable = families.filter((x) => x.f !== 'data' || (input.facts && input.facts.prices.length + input.facts.percents.length + input.facts.stats.length > 0));
  const byAffinity = [...usable].sort((a, b) => b.aff - a.aff || a.f.localeCompare(b.f));
  const byFreshness = [...usable].sort((a, b) => a.used - b.used || b.aff - a.aff || a.f.localeCompare(b.f));
  const top = byAffinity[0]?.f || 'type';
  const second = byAffinity.find((x) => x.f !== top)?.f;
  const freshest = (exclude: PatternFamily[]) => byFreshness.find((x) => !exclude.includes(x.f))?.f;
  const leastSuited = (exclude: PatternFamily[]) => [...usable].filter((x) => !exclude.includes(x.f)).sort((a, b) => a.aff - b.aff || a.used - b.used)[0]?.f;

  const sigFamilies = [top, ...(second ? [second] : [])] as PatternFamily[];
  const conFamilies = [top, ...(freshest([top]) ? [freshest([top])!] : [])] as PatternFamily[];
  const strategies: Omit<CreativeStrategy, 'score'>[] = [
    { id: 'a', label: 'signature', pitch: '', families: sigFamilies, accentFamily: freshest(sigFamilies), exploration: budget },
    { id: 'b', label: 'contraste', pitch: '', families: conFamilies, accentFamily: freshest(conFamilies), exploration: budget },
    { id: 'c', label: 'exploration', pitch: '', families: [top], accentFamily: leastSuited([top]) || freshest([top]), exploration: Math.min(0.7, budget + 0.15) },
  ];
  // Deux stratégies identiques ne font pas un choix : la seconde prend la famille suivante.
  if (strategies[1].families.join() === strategies[0].families.join()) {
    const alt = byAffinity.find((x) => !sigFamilies.includes(x.f))?.f;
    if (alt) strategies[1].families = [top, alt];
    strategies[1].accentFamily = freshest(strategies[1].families);
  }
  for (const s of strategies) {
    const fam = s.families.map((f) => FAMILY_PITCH[f].split(' (')[0]).join(' + ');
    s.pitch = `${fam}${s.accentFamily ? `; one surprising ${s.accentFamily === 'type' ? 'typographic' : s.accentFamily === 'data' ? 'data' : s.accentFamily === 'drawn' ? 'hand-drawn' : s.accentFamily} accent` : ''}${s.id === 'c' ? '; bolder, less common combinations' : ''}`;
  }
  // Le choix du graphe : fidélité (affinité des familles), nouveauté (familles peu vues dans le
  // projet) et appétit d'exploration du cran — tirage déterministe parmi les plus proches.
  const maxAff = Math.max(0.1, ...usable.map((x) => x.aff));
  const scored: CreativeStrategy[] = strategies.map((s) => {
    const fit = s.families.reduce((n, f) => n + (usable.find((x) => x.f === f)?.aff || 0), 0) / s.families.length / maxAff;
    const novelty = 1 - s.families.reduce((n, f) => n + memory.usage('family', f), 0) / s.families.length;
    const appetite = s.id === 'c' ? budget : s.id === 'a' ? 1 - budget : 0.5;
    return { ...s, score: r3(0.5 * fit + 0.3 * novelty + 0.2 * appetite) };
  });
  const best = Math.max(...scored.map((s) => s.score));
  const close = scored.filter((s) => s.score >= best - 0.06);
  const strategy = close[Math.floor(rng(input.seed ^ 0x57a7)() * close.length)];

  const conceptBoosts: Record<string, number> = {};
  for (const id of CONCEPT_IDS) {
    const used = memory.usage('concept', id);
    if (memory.fingerprints.length) conceptBoosts[id] = r3(0.5 * (1 - used));
  }
  return { level: input.level, direction: input.direction, budget, noveltyTarget: NOVELTY_TARGET[input.level], strategies: scored, strategy, conceptBoosts, memory, experience: input.experience, input };
}

/** La direction créative choisie par l'IA (cran Max) remplace celle du graphe si elle existe. */
export function withStrategy(brief: CreativeBrief, id: string | undefined): CreativeBrief {
  const s = brief.strategies.find((x) => x.id === id);
  return s ? { ...brief, strategy: s } : brief;
}

/** Les trois directions créatives, une ligne chacune (menu du stratège au cran Max). */
export function strategyMenu(brief: CreativeBrief): string[] {
  return brief.strategies.map((s) => `${s.id}) ${s.label}: ${s.pitch}`);
}

// ─── Phase B : un motif par scène ───────────────────────────────────────────

export interface ScoredPattern {
  id: string;
  family: PatternFamily;
  experimental: boolean;
  score: number;
  parts: { relevance: number; quality: number; novelty: number; brandFit: number; feasibility: number; bonus: number };
}

export interface ScenePatternPlan {
  index: number;
  intent: IntentId;
  /** Le motif du graphe (repli de l'agent). */
  pattern?: string;
  /** Le menu de l'agent directeur artistique : 3 à 5 motifs, le meilleur d'abord. */
  options: string[];
  experimental: boolean;
  scored: ScoredPattern[];
}

export interface CreativeAccent {
  index: number;
  pattern: string;
  family: PatternFamily;
  kind: 'scene' | 'overlay';
}

export interface PatternPlan {
  scenes: ScenePatternPlan[];
  accent?: CreativeAccent;
  experimental: number;
  /** Scènes de contenu (où un motif a été choisi). */
  considered: number;
}

export interface PatternScene extends LayoutScene {
  key?: string;
}

/**
 * Peu courant dans ce contexte ? Une combinaison expérimentale que la mémoire globale a vue
 * réussir assez souvent (15 fois au moins dans cette direction) devient éprouvée : le graphe apprend.
 */
export function experimentalIn(p: PatternDef, brief: Pick<CreativeBrief, 'direction' | 'experience'>): boolean {
  if (!isExperimental(p, brief.direction)) return false;
  const seen = brief.experience?.counts(`p:${p.id}|d:${brief.direction}`).n || 0;
  return !(seen >= 15 && (brief.experience?.quality(p.id, brief.direction, 0.62).value || 0) >= 0.7);
}

/** Le score créatif d'un motif sur une scène. */
export function scorePattern(p: PatternDef, sc: PatternScene, intents: IntentId[], brief: CreativeBrief, opts: { accent?: boolean } = {}): ScoredPattern {
  const intentAt = intents.findIndex((i) => p.intents.includes(i));
  const relevance = p.generic ? 0.55 : intentAt === 0 ? 1 : intentAt > 0 ? 0.7 : 0.3;
  const experimental = experimentalIn(p, brief);
  const prior = experimental ? 0.62 : 0.8;
  const quality = brief.experience ? brief.experience.quality(p.id, brief.direction, prior).value : prior;
  const usedPattern = brief.memory.usage('pattern', p.id);
  const usedFamily = brief.memory.usage('family', p.family);
  const novelty = 1 - (0.7 * usedPattern + 0.3 * usedFamily);
  const aff = patternAffinity(p, brief.direction);
  const boost = (p.tools.layout ? brief.input.boosts?.[`layout:${p.tools.layout}`] : 0) || (p.tools.background ? brief.input.boosts?.[`bg:${p.tools.background}`] : 0) || (p.tools.annotate ? brief.input.boosts?.[`annotate:${p.tools.annotate}`] : 0) || 0;
  const brandFit = aff <= 0 ? (opts.accent ? 0.2 : 0) : Math.min(1, (aff + Math.max(0, boost)) / 3);
  const feasibility = Math.max(0, 1 - 0.12 * p.cost - (brief.input.durationSec <= 6 && experimental ? 0.2 : 0));
  const w = CREATIVE_WEIGHTS;
  const base = w.relevance * relevance + w.quality * quality + w.novelty * novelty + w.brandFit * brandFit + w.feasibility * feasibility;
  return { id: p.id, family: p.family, experimental, score: r3(base), parts: { relevance, quality: r3(quality), novelty: r3(novelty), brandFit: r3(brandFit), feasibility: r3(feasibility), bonus: 0 } };
}

/** Une scène ne choisit un motif « scène » que si elle a une mise en page ou des entrées à décider. */
const PATTERNED = (sceneId: string) => LAYOUT_SCENES.has(sceneId) || sceneId === 'kinetic' || sceneId === 'wordswap';

/** Tirage déterministe parmi les candidats proches du meilleur (variété sans perdre la cohérence). */
function drawClose<T extends { score: number }>(list: T[], seed: number, band = 0.05): T | undefined {
  if (!list.length) return undefined;
  const best = list[0].score;
  const close = list.filter((x) => x.score >= best - band);
  return close[Math.floor(rng(seed)() * close.length)];
}

/**
 * Le motif de chaque scène, l'accent créatif et le menu des agents. Les scènes de médias et la
 * signature n'en reçoivent pas ici : leur motif se lit après coup sur le kit (`derivedPattern`).
 */
export function planPatterns(brief: CreativeBrief, scenes: PatternScene[], ctx: { concept?: string; accentIndex?: number; seed: number }): PatternPlan {
  const dna = brief.strategy.families;
  const session = new SessionMemory();
  const fitCtx = { direction: brief.direction, excludedLayouts: brief.input.excludedLayouts, boosts: brief.input.boosts };
  const intentsOf = scenes.map((sc) => sceneIntents(sc.sceneId, sc.slots, ctx.concept));
  const content = scenes.map((sc, i) => ({ sc, i })).filter(({ sc }) => PATTERNED(sc.sceneId));
  // Part d'exploration : le nombre de scènes qui portent une combinaison peu courante (95/5 en Low,
  // 85/15 en Medium, 75/25 en High, 60/40 en Max, 30/70 en Ultra), réalisée par le graphe.
  const allowed = Math.round(brief.strategy.exploration * content.length);
  let experimentalUsed = 0;

  // 1. L'accent : une scène de contenu (jamais l'ouverture ni la signature), 25 % du film au plus.
  let accent: CreativeAccent | undefined;
  if (scenes.length >= 4 && content.length >= 2) {
    const middle = content.filter(({ i }) => i > 0 && i < scenes.length - 1);
    const preferred = middle.find(({ i }) => i === ctx.accentIndex) ? ctx.accentIndex! : undefined;
    const order = [...middle].sort((a, b) => (a.i === preferred ? -1 : b.i === preferred ? 1 : Math.abs(a.i - scenes.length / 2) - Math.abs(b.i - scenes.length / 2)));
    const choices: (ScoredPattern & { index: number; kind: 'scene' | 'overlay' })[] = [];
    for (const { sc, i } of order.slice(0, 3)) {
      for (const p of PATTERNS) {
        if (p.role !== 'scene' && p.role !== 'overlay') continue;
        if (dna.includes(p.family) || p.family === 'brand' || p.family === 'photo') continue;
        if (!patternFits(p, sc, { ...fitCtx, accent: true })) continue;
        if (p.tools.transitionIn && i === 0) continue;
        const s = scorePattern(p, sc, intentsOf[i], brief, { accent: true });
        // En Low et Medium, la surprise reste une touche éprouvée ; l'accent expérimental vient dès High.
        if (s.experimental && brief.strategy.exploration < 0.25) continue;
        // La famille annoncée par la stratégie, puis la scène du grand moment, passent devant.
        s.parts.bonus = (p.family === brief.strategy.accentFamily ? 0.12 : 0) + (i === preferred ? 0.05 : 0);
        s.score = r3(s.score + s.parts.bonus);
        choices.push({ ...s, index: i, kind: p.role === 'overlay' ? 'overlay' : 'scene' });
      }
    }
    choices.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    const pick = drawClose(choices, ctx.seed ^ 0xacce47);
    if (pick) accent = { index: pick.index, pattern: pick.id, family: pick.family, kind: pick.kind };
  }

  // 2. Les scènes qui explorent : celles où la meilleure combinaison peu courante coûte le moins
  //    par rapport à la meilleure combinaison éprouvée (jamais plus de 0,2 de score perdu).
  const explore = new Set<number>();
  if (allowed > 0) {
    const gaps = content
      .filter(({ i }) => !(accent?.index === i && accent.kind === 'scene'))
      .map(({ sc, i }) => {
        const list = PATTERNS.filter((p) => p.role === 'scene' && patternFits(p, sc, fitCtx)).map((p) => scorePattern(p, sc, intentsOf[i], brief));
        const safe = Math.max(-1, ...list.filter((x) => !x.experimental).map((x) => x.score));
        const exp = Math.max(-1, ...list.filter((x) => x.experimental).map((x) => x.score));
        return { i, loss: exp < 0 ? Infinity : safe - exp };
      })
      .filter((g) => g.loss < 0.2)
      .sort((a, b) => a.loss - b.loss || a.i - b.i);
    for (const g of gaps.slice(0, allowed)) explore.add(g.i);
  }

  // 3. Un motif par scène de contenu, dans l'ordre du film (mémoire de session).
  const out: ScenePatternPlan[] = scenes.map((_, i) => ({ index: i, intent: intentsOf[i][0], options: [], experimental: false, scored: [] }));
  for (const { sc, i } of content) {
    const accentHere = accent?.index === i;
    const forced = accentHere && accent!.kind === 'scene' ? PATTERN_BY_ID.get(accent!.pattern) : undefined;
    // Une annotation en accent ne se dessine que sur la composition de la direction ou le bandeau.
    const overlay = accentHere && accent!.kind === 'overlay' ? PATTERN_BY_ID.get(accent!.pattern) : undefined;
    const needsClassic = !!overlay?.tools.annotate;
    const previous = out[i - 1]?.pattern ? PATTERN_BY_ID.get(out[i - 1].pattern!) : undefined;
    const candidates = PATTERNS.filter((p) => p.role === 'scene' && patternFits(p, sc, fitCtx) && (!needsClassic || ['classic', 'ticker'].includes(p.tools.layout || '')));
    const scored = candidates
      .map((p) => {
        const s = scorePattern(p, sc, intentsOf[i], brief);
        let bonus = 0;
        if (session.patterns.includes(p.id)) bonus -= 0.5;
        if (p.tools.layout && p.tools.layout !== 'classic' && session.layouts.includes(p.tools.layout)) bonus -= 0.35;
        if (p.generic && session.patterns.filter((id) => PATTERN_BY_ID.get(id)?.generic).length >= Math.max(1, Math.floor(content.length / 3))) bonus -= 0.3;
        if (previous && previous.family === p.family && previous.id !== p.id) bonus -= 0.03;
        // L'ADN : la vidéo garde ses familles ; ailleurs que sur l'accent, une autre famille recule.
        bonus += dna.includes(p.family) ? 0.06 : -0.08;
        if (s.experimental) bonus += explore.has(i) ? 0.3 : -0.35;
        s.parts.bonus = r3(bonus);
        s.score = r3(s.score + bonus);
        return s;
      })
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    const chosen = forced ? scored.find((s) => s.id === forced.id) || scorePattern(forced, sc, intentsOf[i], brief, { accent: true }) : drawClose(scored, ctx.seed ^ (0x9a77 + i * 131));
    if (chosen) {
      const def = PATTERN_BY_ID.get(chosen.id)!;
      session.use(def);
      if (chosen.experimental) experimentalUsed++;
      // Le menu de l'agent : le choix du graphe d'abord, puis les meilleurs autres (une option sobre comprise).
      const rest = scored.filter((s) => s.id !== chosen.id);
      const menu = [chosen.id, ...rest.slice(0, 3).map((s) => s.id)];
      const sober = rest.find((s) => PATTERN_BY_ID.get(s.id)?.generic);
      if (sober && !menu.includes(sober.id)) menu.push(sober.id);
      out[i] = { index: i, intent: intentsOf[i][0], pattern: chosen.id, options: forced ? [chosen.id] : menu.slice(0, 5), experimental: chosen.experimental, scored: scored.slice(0, 6) };
    }
  }
  return { scenes: out, accent, experimental: experimentalUsed, considered: content.length };
}

/**
 * L'entrée de titre qu'un motif appelle sur une scène : dans le vocabulaire de la direction, jamais
 * celle de la scène précédente, celles de la vidéo précédente du projet en dernier recours.
 */
export function patternTechnique(patternId: string | undefined, direction: DirectionId, previous?: string, used: string[] = [], avoid: string[] = []): string | undefined {
  const p = patternId ? PATTERN_BY_ID.get(patternId) : undefined;
  if (!p?.tools.techniques?.length) return undefined;
  const vocab = new Set<string>(DIRECTIONS[direction].headline);
  const list = p.tools.techniques.filter((t) => vocab.has(t) && t !== previous && used.filter((u) => u === t).length < 2);
  return list.find((t) => !avoid.includes(t)) || list[0];
}

/**
 * Le motif de chaque scène, accordé à ce que le film montre VRAIMENT : une mise en page remplacée
 * (répétition, règles, critique, contrôle créatif, retouche) emporte son motif ; les plans de médias
 * et la signature prennent le motif lu sur le kit.
 */
export function reconcilePatterns(sb: VideoStoryboard, preferred: (index: number) => string[] = () => []): void {
  sb.scenes.forEach((sc, i) => {
    const derived = derivedPattern(sc.sceneId, sb.kit, sc.key);
    if (derived) {
      if (!sb.scenes[i].code?.tsx || !sc.pattern) sc.pattern = derived;
      return;
    }
    if (!PATTERNED(sc.sceneId) || sc.code?.tsx) return;
    const matches = (id?: string) => {
      const def = id ? PATTERN_BY_ID.get(id) : undefined;
      if (!def || def.role !== 'scene' || !def.scenes.includes(sc.sceneId)) return false;
      return LAYOUT_SCENES.has(sc.sceneId) ? (def.tools.layout || 'classic') === (sc.layout || 'classic') : !def.tools.layout;
    };
    if (matches(sc.pattern)) return;
    sc.pattern = preferred(i).find(matches) || patternForLayout(sc.sceneId, sc.layout, sc.motion?.headline);
  });
}

/** L'empreinte et la nouveauté recalculées (après une retouche) ; le reste du rapport est gardé. */
export function refreshCreative(sb: VideoStoryboard, memory: ProjectMemory, level: CreativityLevel): VideoStoryboard['creative'] {
  const fingerprint = fingerprintOf(sb);
  const { index: _index, ...novelty } = noveltyAgainst(fingerprint, memory.fingerprints);
  const base: NonNullable<VideoStoryboard['creative']> = sb.creative || { v: 1, level, exploration: { budget: EXPLORATION_BUDGET[level], experimental: 0, scenes: 0 }, dna: { direction: sb.direction, rhythm: sb.rhythm, families: fingerprint.families } };
  return { ...base, fingerprint, novelty: { ...novelty, target: NOVELTY_TARGET[(base.level as CreativityLevel) || level] ?? NOVELTY_TARGET[level], compared: memory.fingerprints.length } };
}

// ─── Cran Ultra : l'univers créatif du directeur ────────────────────────────

/**
 * Ce que le directeur du film d'auteur reçoit au lieu de la documentation du moteur : les motifs
 * possibles (groupés par famille), ce qui a servi récemment, ce qui reste sous-exploré, des
 * combinaisons compatibles pour explorer, l'ADN suggéré et l'accent. ≈ 300 tokens.
 */
export function creativeUniverse(brief: CreativeBrief, opts: { photos: number }): { text: string; patterns: string[] } {
  const usable = PATTERNS.filter((p) => (p.role === 'scene' || p.role === 'ultra' || p.role === 'overlay') && p.family !== 'brand' && factsAllow(p, brief.input.facts, opts.photos) && patternAffinity(p, brief.direction) > 0);
  const byFamily = new Map<PatternFamily, PatternDef[]>();
  for (const p of usable) {
    if (p.generic) continue;
    byFamily.set(p.family, [...(byFamily.get(p.family) || []), p]);
  }
  const lines: string[] = ['CREATIVE UNIVERSE (patterns the engine renders well, by family; name one per shot, or explore)'];
  const shown: string[] = [];
  for (const f of PATTERN_FAMILIES) {
    // Les identifiants disent ce qu'ils font (counterAcceleration, brushReveal…) : cinq par famille, les plus affins d'abord.
    const list = (byFamily.get(f) || []).sort((a, b) => patternAffinity(b, brief.direction) - patternAffinity(a, brief.direction) || a.id.localeCompare(b.id)).slice(0, 5);
    if (!list.length) continue;
    shown.push(...list.map((p) => p.id));
    lines.push(`${f} — ${FAMILY_PITCH[f].split(' (')[1]?.replace(/\)$/, '') || f}: ${list.map((p) => p.id).join(', ')}`);
  }
  const recent = [...new Set(brief.memory.fingerprints.slice(-3).flatMap((fp) => fp.patterns))].filter((id) => PATTERN_BY_ID.has(id) && PATTERN_BY_ID.get(id)!.family !== 'brand').slice(0, 8);
  if (recent.length) lines.push(`RECENTLY USED by this brand (avoid repeating): ${recent.join(', ')}`);
  const under = shown.filter((id) => brief.memory.usage('pattern', id) === 0).slice(0, 6);
  if (under.length && brief.memory.fingerprints.length) lines.push(`UNDER-EXPLORED (consider): ${under.join(', ')}`);
  lines.push(`EXPLORE (compatible combinations, write "PATTERN: explore A+B"): ${COMBOS.filter((c) => c.every((k) => kitAllowed(k, brief, opts.photos))).slice(0, 4).map((c) => c.join('+')).join(' · ')}`);
  lines.push(`MOTION DNA: a ${brief.strategy.families.map((f) => FAMILY_PITCH[f].split(' (')[0]).join(' + ')} language across the film${brief.strategy.accentFamily ? `; ONE shot (not the first, not the signature) breaks it on purpose with a ${FAMILY_PITCH[brief.strategy.accentFamily].split(' (')[0]} accent` : ''}.`);
  lines.push(`EXPLORATION BUDGET: about ${Math.round(brief.budget * 100)} % of the shots may explore (an unusual pattern or "explore A+B"); the others use proven patterns.`);
  return { text: lines.join('\n'), patterns: shown };
}

/** Combinaisons de briques compatibles, peu courantes : le chemin d'exploration d'Ultra. */
const COMBOS: string[][] = [
  ['Flat3D', 'Odometer'],
  ['FlowField', 'Kinetic'],
  ['Sketch', 'ChartJs'],
  ['AfricaMap', 'Kinetic'],
  ['Brush', 'Odometer'],
  ['VoronoiField', 'Kinetic'],
  ['GrowArea', 'Sketch'],
  ['Flat3D', 'FlowField'],
];

function kitAllowed(name: string, brief: CreativeBrief, photos: number): boolean {
  const owner = PATTERNS.filter((p) => p.kit.includes(name));
  return !owner.length || owner.some((p) => factsAllow(p, brief.input.facts, photos));
}

// ─── L'accent créatif dans le pipeline des menus ────────────────────────────

/**
 * Pose l'accent créatif sur sa scène : une annotation (sur la composition de la direction ou le
 * bandeau, titre de trois mots au moins), un fond (scène sans média), une traversée (la coupe qui
 * ouvre la scène). Un motif « scène » a déjà été posé par la mise en page : on vérifie qu'il a
 * survécu. Rien n'est forcé : un accent impossible est simplement abandonné.
 */
export function applyCreativeAccent(
  sb: VideoStoryboard,
  kit: VideoKit,
  accent: CreativeAccent | undefined,
  kctx: KitContext,
  excludedTransitions: string[] = []
): { kit: VideoKit; applied?: CreativeAccent & { key: string } } {
  if (!accent || accent.index < 0) return { kit };
  const sc = sb.scenes[accent.index];
  const def = PATTERN_BY_ID.get(accent.pattern);
  if (!sc || !def) return { kit };
  const applied = { ...accent, key: sc.key };
  if (accent.kind === 'scene') return sc.pattern === def.id ? { kit, applied } : { kit };
  const t = def.tools;
  if (t.annotate) {
    const words = (sc.slots.title || '').split(/\s+/).filter(Boolean).length;
    if (!['classic', 'ticker'].includes(sc.layout || 'classic') || words < 3 || !['hook', 'statement', 'cta'].includes(sc.sceneId)) return { kit };
    const r = applyKitOverrides(kit, { annotate: t.annotate }, kctx);
    if (r.refused.length) return { kit };
    return { kit: { ...r.kit, annotateScene: sc.key }, applied };
  }
  if (t.background) {
    if (sc.image || sc.video) return { kit };
    const r = applyKitOverrides(kit, { background: t.background }, kctx);
    if (r.refused.length) return { kit };
    return { kit: { ...r.kit, backdropScenes: [sc.key] }, applied };
  }
  if (t.transitionIn?.length && accent.index > 0 && sc.motion) {
    const prev = sb.scenes[accent.index - 1]?.motion?.transition;
    const after = sb.scenes[accent.index + 1]?.motion?.transition;
    const pick = t.transitionIn.find((x) => !excludedTransitions.includes(x) && x !== prev && x !== after);
    if (!pick) return { kit };
    sc.motion = { ...sc.motion, transition: pick };
    return { kit, applied };
  }
  return { kit };
}

/** Le résumé lisible du moteur créatif (rapport de la vidéo, détail dans l'interface). */
export function creativeIntent(opts: { concept?: string; strategy: CreativeStrategy; direction: string; rhythm?: string; camera?: string; entrance?: string; narrative: string[]; accent?: { pattern: string; index: number } }): NonNullable<NonNullable<VideoStoryboard['creative']>['intent']> {
  const accent = opts.accent ? PATTERN_BY_ID.get(opts.accent.pattern) : undefined;
  return {
    concept: opts.concept,
    narrativeShape: opts.narrative.join(' › '),
    visualStrategy: `${opts.strategy.families.map((f) => FAMILY_PITCH[f].split(' (')[0]).join(' + ')}${accent ? `, accent ${FAMILY_PITCH[accent.family].split(' (')[0]}` : ''}`,
    motionStrategy: [opts.direction, opts.rhythm, opts.camera && `camera ${opts.camera}`, opts.entrance && `entrances ${opts.entrance}`].filter(Boolean).join(' · '),
    ...(accent ? { surprise: `${accent.label} (scène ${opts.accent!.index + 1})` } : {}),
  };
}

/**
 * LE FILM ASSEMBLÉ DEPUIS LE CATALOGUE — l'orchestrateur du moteur vidéo par catalogue.
 *
 *   storyboard (scènes : rôle, énergie, textes exacts, médias) → emplacements de chaque scène (code)
 *   → liste courte par scène et thèmes classés (graphe, 0 jeton)
 *   → le MODÈLE choisit pour tout le film en un appel (Medium et au-delà ; Low : le code seul)
 *   → le CODE assemble chaque scène (HTML + chorégraphie) et ses transitions → contrat de scène HyperFrames
 *
 * Une scène qui plante ou dont un texte ne tient pas cède la place au candidat suivant (sans modèle). Une retouche
 * écrite repart de la configuration actuelle de la scène (un petit appel). Tout se rejoue sans modèle depuis les
 * configurations gardées (`reassembleFilm`).
 */
import logger from '../../runtime/logger';
import { coreHost } from '../../runtime/host';
import type { CreativityLevel } from '../../creativity/levels';
import { inTier } from '@idem/graphic-engine';
import { callFilmModel, FilmCallContext } from '../agents';
import { assembleScene, DEVELOP_FREE_MIN, finalInnerScale, RuntimeScene, sceneHtml, SceneQuality } from './assemble';
import { ChooseScene, chooseSystem, chooseUser, parseChoices, videoEffortFor } from './choose';
import { animationFits, animationFor, energyOf, FilmState, inDirection, layoutFits, rankThemes, rolesIn, sceneFingerprint, sceneSlots, SceneFacts, SceneSlots, shortlist, SceneCandidate, stableHash, transitionFor, videoIndex } from './graph';
import { videoCatalog } from './registry';
import type { AnimationNode, CarryRole, DevelopNode, FilmFormatId, LayoutNode, LoadedVideoCatalog, SceneConfig, SceneRole, SequenceNode, ThemeNode, TransitionNode, VideoStyle } from './types';
import { ROLE_TARGET, SCENE_ROLES } from './types';

export interface CatalogScene {
  key: string;
  duration: number;
  texts: Record<string, string>;
  media: Array<{ id: string; kind: 'image' | 'video' }>;
  role?: string;
  energy?: number;
  beat?: { bpm: number; first: number };
}

export interface ComposeInput {
  scenes: CatalogScene[];
  film: { title: string; concept: string; style?: string; seed: string | number };
  brand: { name: string; hasLogo: boolean; hasDarkLogo?: boolean; line: string; /** La DA de la marque (catalogue des DA). */ direction?: string };
  formats: FilmFormatId[];
  level: CreativityLevel;
  call: FilmCallContext;
  /** Un fond sombre n'est permis que sur demande explicite (politique de surface claire). */
  allowDark?: boolean;
  /** La portée de la mémoire (marque, projet) : les combinaisons déjà livrées sont évitées. */
  memoryKey?: string;
}

export interface ComposedScene {
  key: string;
  html: string;
  script: string;
  config: SceneConfig;
  /** Ce que l'assemblage a mesuré (temps libre, temps mort, développement, traversée) : contrôles et journal. */
  quality?: SceneQuality;
}

export interface ComposedFilm {
  version: string;
  theme: string;
  vars: Record<string, string>;
  scenes: ComposedScene[];
  trace: { source: 'llm' | 'code'; tokens: { input: number; output: number }; ms: number; failure?: string; detail: string };
}

const STYLES: VideoStyle[] = ['energetic', 'premium', 'playful', 'corporate'];
const asRole = (r?: string): SceneRole | undefined => (SCENE_ROLES.includes(r as SceneRole) ? (r as SceneRole) : undefined);

/**
 * Le rôle narratif d'une scène que le storyboard n'a pas nommé : déduit de sa PLACE et de sa FORME (jamais de ses
 * mots) — la première accroche, la dernière conclut (appel à l'action s'il y en a un, sinon signature), un chiffre
 * prouve, une image montre, le reste affirme.
 */
function inferRole(s: CatalogScene, index: number, count: number, slots: SceneSlots): SceneRole {
  const hasCta = Object.keys(s.texts).some((k) => /^(cta|action|button)$/i.test(k));
  if (index === 0) return 'hook';
  if (index === count - 1) return hasCta ? 'cta' : 'signature';
  if (slots.figure) return 'proof';
  if (slots.items.length >= 2) return 'benefits';
  if (slots.media) return 'feature';
  return 'statement';
}

function factsOf(scenes: CatalogScene[], formats: FilmFormatId[], hasLogo: boolean): SceneFacts[] {
  return scenes.map((s, index) => {
    const given = asRole(s.role);
    const first = sceneSlots(s.texts, s.media, hasLogo, given);
    const role = given ?? inferRole(s, index, scenes.length, first);
    const slots = given ? first : sceneSlots(s.texts, s.media, hasLogo, role);
    return { index, count: scenes.length, role, energy: energyOf(role, s.energy), duration: s.duration, slots, texts: s.texts, formats };
  });
}

/** La forme d'une scène pour le modèle : des longueurs et des genres, jamais les mots. */
function shapeOf(slots: SceneSlots, texts: Record<string, string>): string {
  const parts: string[] = [];
  for (const k of ['title', 'body', 'figure', 'label', 'cta', 'attribution'] as const) if (slots[k]) parts.push(`${k} ${(texts[slots[k]!] ?? '').length} chars`);
  if (slots.items.length) parts.push(`${slots.items.length} items`);
  if (slots.media) parts.push(`media ${slots.media.kind}`);
  return parts.join(', ') || 'no text';
}

async function memoryOf(key?: string): Promise<{ templates: Set<string>; themes: string[]; sequences: Set<string> }> {
  const host = coreHost();
  if (!key || !host.recentFingerprints || process.env.IDEM_QUALITY_MEMORY === '0') return { templates: new Set(), themes: [], sequences: new Set() };
  const marks = await host.recentFingerprints({ documentType: 'video', key }).catch(() => [] as string[]);
  return {
    templates: new Set(marks.filter((m) => m.startsWith('vtpl:')).map((m) => m.slice(5))),
    themes: marks.filter((m) => m.startsWith('vtheme:')).map((m) => m.slice(7)),
    sequences: new Set(marks.filter((m) => m.startsWith('vseq:')).map((m) => m.slice(5))),
  };
}

const jitter = (seed: string): number => (parseInt(stableHash([seed], 6), 16) % 1000) / 1000;
const inRange = (range: [number, number] | undefined, e: number): number => (!range ? 0.5 : e >= range[0] && e <= range[1] ? 1 : 0.3);
const hasRole = (layout: LayoutNode | undefined, role: string) => !!layout && new RegExp(`data-v="${role}"`).test(layout.html);

/**
 * LES SÉQUENCES DU FILM — posées par le CODE (0 jeton). Pour chaque suite de 2 ou 3 scènes consécutives, les séquences
 * du catalogue (DA de la marque, gamme du cran) dont chaque scène sert le rôle narratif ET montre toute la scène
 * (mise en page qui tient tous ses textes) ; l'élément porté doit exister des deux côtés de la coupe (deux médias,
 * deux chiffres, un logo). Les meilleures sont retenues sans chevauchement, chacune une fois par film ; une séquence
 * déjà livrée à la marque passe après les autres. Résultat : la configuration de chaque scène retenue.
 */
export function planSequences(cat: LoadedVideoCatalog, facts: SceneFacts[], o: { direction?: string; level?: string; seed: string; seen?: Set<string>; hasLogo: boolean; scenes: CatalogScene[] }): Map<number, SceneConfig> {
  const out = new Map<number, SceneConfig>();
  if (process.env.VIDEO_SEQUENCES === 'off') return out;
  const pool = inTier(inDirection(cat, (videoIndex(cat).get('sequence') ?? []) as SequenceNode[], o.direction), o.level, 4);
  const options: Array<{ at: number; seq: SequenceNode; score: number }> = [];
  for (let at = 0; at < facts.length; at++) {
    for (const seq of pool) {
      const n = seq.scenes.length;
      if (at + n > facts.length) continue;
      let score = 0;
      let ok = true;
      for (let k = 0; k < n && ok; k++) {
        const f = facts[at + k];
        const step = seq.scenes[k];
        const layout = cat.nodes.get(step.layout);
        if (layout?.kind !== 'layout' || !f.role || !step.roles.includes(f.role) || !layoutFits(layout, f)) ok = false;
        else if (step.carry) {
          const p = facts[at + k - 1];
          if (step.carry === 'media') {
            ok = !!(p.slots.media && f.slots.media);
            // La même image des deux côtés : la continuité est parfaite (le sujet reste à l'écran).
            if (ok && p.slots.media!.id === f.slots.media!.id) score += 0.3;
          } else if (step.carry === 'figure') ok = !!(p.slots.figure && f.slots.figure);
          else ok = o.hasLogo;
          score += 0.4;
        }
        score += 0.1 * inRange(seq.energy, f.energy);
      }
      if (!ok) continue;
      score += 0.15 * jitter(`${o.seed}|${at}|${seq.id}`) - (o.seen?.has(seq.id) ? 0.25 : 0);
      options.push({ at, seq, score });
    }
  }
  const taken = new Set<number>();
  const used = new Set<string>();
  for (const opt of options.sort((a, b) => b.score - a.score)) {
    const span = opt.seq.scenes.map((_, k) => opt.at + k);
    if (used.has(opt.seq.id) || span.some((i) => taken.has(i))) continue;
    used.add(opt.seq.id);
    opt.seq.scenes.forEach((step, k) => {
      taken.add(opt.at + k);
      out.set(opt.at + k, {
        layout: step.layout,
        animations: { ...(step.animations ?? {}) },
        sequence: opt.seq.id,
        step: k,
        ...(step.carry ? { carry: step.carry } : {}),
        ...(step.develop ? { develop: step.develop } : {}),
      });
    });
  }
  return out;
}

/** L'élément porté qui tient vraiment : même séquence, scène suivante, élément présent des deux côtés. */
function validCarry(cat: LoadedVideoCatalog, c: SceneConfig, prev: SceneConfig | undefined, f: SceneFacts, pf: SceneFacts | undefined, hasLogo: boolean): CarryRole | undefined {
  if (!c.carry || !prev || !pf || !c.sequence || prev.sequence !== c.sequence || (prev.step ?? -1) !== (c.step ?? 0) - 1) return undefined;
  const a = cat.nodes.get(prev.layout) as LayoutNode | undefined;
  const b = cat.nodes.get(c.layout) as LayoutNode | undefined;
  if (!hasRole(a, c.carry) || !hasRole(b, c.carry)) return undefined;
  if (c.carry === 'media' && !(pf.slots.media && f.slots.media)) return undefined;
  if (c.carry === 'figure' && !(pf.slots.figure && f.slots.figure)) return undefined;
  if (c.carry === 'logo' && !hasLogo) return undefined;
  return c.carry;
}

/** L'ordre de préférence d'un développement : celui réservé au rôle de la scène, puis média, liste, chiffre, logo, titre. */
const DEVELOP_RANK: Partial<Record<string, number>> = { media: 1, items: 2, figure: 3, logo: 4, title: 5, body: 6 };

/**
 * LES DÉVELOPPEMENTS POSÉS PAR LE CODE — une scène qui a du temps libre après sa lecture (≥ `DEVELOP_FREE_MIN`) et
 * aucun développement de séquence en reçoit un : celui de son rôle visé le plus parlant (le problème se barre, l'image
 * se découvre, la liste s'accomplit…). Variété du film : jamais le même deux scènes de suite, deux fois au plus.
 */
function autoDevelops(cat: LoadedVideoCatalog, facts: SceneFacts[], configs: SceneConfig[], specs: RuntimeScene[], quality: SceneQuality[], seed: string): DevelopNode[][] {
  const nodes = [...cat.nodes.values()].filter((n): n is DevelopNode => n.kind === 'develop');
  const count = new Map<string, number>();
  // Un même effet deux fois par film au plus (un peu plus dans un long film : une fois toutes les cinq scènes).
  const cap = Math.max(2, Math.ceil(facts.length / 5));
  // Un effet qui dure toute la tenue (une caméra) ou un effet court (un trait, un éclat).
  const long = (n: DevelopNode) => n.steps.some((s) => typeof s.duration === 'string' && s.duration.includes('$hold'));
  const out: DevelopNode[][] = [];
  for (let i = 0; i < facts.length; i++) {
    const explicit = configs[i].develop ? cat.nodes.get(configs[i].develop!) : undefined;
    const chosen: DevelopNode[] = [];
    let free = quality[i].free;
    if (explicit?.kind === 'develop') {
      chosen.push(explicit);
      free -= long(explicit) ? 0.4 : 1.1;
    }
    if (process.env.VIDEO_DEVELOP !== 'off') {
      const roles = new Set(specs[i].roles.map((r) => r.role));
      const sceneRole = facts[i].role;
      const rank = (n: DevelopNode) => (n.sceneRoles?.includes(sceneRole as SceneRole) ? 0 : DEVELOP_RANK[n.role] ?? 9);
      // Deux au plus : le premier, puis — s'il reste assez de temps libre — un effet court sur un AUTRE élément. Une
      // caméra sur l'image (effet qui court dès que l'image est posée) ne gêne pas la lecture : elle se juge sur le temps
      // de présence de l'image, pas sur le temps libre après lecture (sinon une photo restait figée pendant que l'on lit).
      const room = (n: DevelopNode) => (n.start === 'entered' && long(n) ? facts[i].duration - 1 : free);
      while (chosen.length < 2) {
        const fits = nodes
          .filter((n) => roles.has(n.role) && (!n.sceneRoles?.length || n.sceneRoles.includes(sceneRole as SceneRole)))
          .filter((n) => room(n) >= Math.max(DEVELOP_FREE_MIN, n.minHold * 0.8) && (count.get(n.id) ?? 0) < cap && !out[i - 1]?.some((p) => p.id === n.id))
          .filter((n) => n.role !== 'items' || facts[i].slots.items.length >= 2)
          .filter((n) => !chosen.some((c) => c.role === n.role) && (!chosen.length || !long(n)))
          .sort((a, b) => rank(a) - rank(b) || jitter(`${seed}|${i}|${a.id}`) - jitter(`${seed}|${i}|${b.id}`));
        const pick = fits[0];
        if (!pick) break;
        chosen.push(pick);
        // Une caméra laisse place à un effet court par-dessus ; un effet court consomme environ une seconde.
        free = long(pick) ? free - 0.4 : free - 1.1;
      }
    }
    for (const d of chosen) count.set(d.id, (count.get(d.id) ?? 0) + 1);
    out.push(chosen);
  }
  return out;
}

/** Assembler toutes les scènes d'après leurs configurations (aucun modèle) : transitions, traversées, développements. */
export function assembleFilm(cat: LoadedVideoCatalog, input: Pick<ComposeInput, 'scenes' | 'brand' | 'formats'>, theme: ThemeNode, configs: SceneConfig[], vars: Record<string, string> = {}): ComposedScene[] {
  const facts = factsOf(input.scenes, input.formats, input.brand.hasLogo);
  const carries = configs.map((c, i) => validCarry(cat, c, configs[i - 1], facts[i], facts[i - 1], input.brand.hasLogo));
  const used: string[] = [];
  const transitions: Array<TransitionNode | undefined> = configs.map((c, i) => {
    if (i === 0) return undefined;
    // Une traversée est une coupe franche : l'élément porté fait le lien, aucun panneau ne le cache.
    if (carries[i]) return cat.nodes.get('builtin.cut') as TransitionNode;
    const tr = transitionFor(cat, theme, c, used);
    used.push(tr.id);
    return tr;
  });
  // Un film posé laisse ses éléments sortir juste avant une coupe ; les autres transitions s'en chargent elles-mêmes.
  const calm = theme.motion.dIn >= 0.85;
  const configOf = (i: number): SceneConfig => {
    // La première scène n'entre par aucune transition : la configuration ne garde que celle qui sert.
    const { transition: _unused, ...rest } = configs[i];
    return { ...rest, ...(transitions[i] && !carries[i] ? { transition: transitions[i]!.id } : {}) };
  };
  const build = (i: number, develop: DevelopNode[] | undefined, innerFrom?: number) => {
    const s = input.scenes[i];
    const next = transitions[i + 1];
    return assembleScene({
      cat,
      theme,
      config: configOf(i),
      slots: facts[i].slots,
      texts: s.texts,
      scene: { key: s.key, duration: s.duration, energy: facts[i].energy, ...(facts[i].role ? { role: facts[i].role } : {}), ...(s.beat ? { beat: s.beat } : {}) },
      brand: input.brand,
      ...(transitions[i] && !carries[i] ? { transitionIn: transitions[i], prevKey: input.scenes[i - 1].key } : {}),
      ...(carries[i] ? { carryIn: { role: carries[i]!, prevKey: input.scenes[i - 1].key, ...(innerFrom ? { innerFrom } : {}) } } : {}),
      ...(carries[i + 1] ? { carryOut: carries[i + 1] } : {}),
      exitAtEnd: calm && i < input.scenes.length - 1 && !carries[i + 1] && (!next || next.duration === 0),
      vars,
      ...(develop?.length ? { develop } : {}),
    });
  };
  // 1. Une première passe mesure le temps libre de chaque scène (avant tout développement).
  const explicit = configs.map((c) => (c.develop && cat.nodes.get(c.develop)?.kind === 'develop' ? [cat.nodes.get(c.develop) as DevelopNode] : undefined));
  const first = input.scenes.map((_, i) => build(i, explicit[i]));
  // 2. Les développements du film (séquences, puis temps libre), 3. l'assemblage final, scène après scène : une image
  //    portée repart du cadrage où la scène d'avant l'a laissée.
  const develops = autoDevelops(cat, facts, configs, first.map((a) => a.spec), first.map((a) => a.quality), `${input.brand.name}|${input.scenes.map((s) => s.key).join(',')}`);
  const out: ComposedScene[] = [];
  let previous: RuntimeScene | undefined;
  input.scenes.forEach((s, i) => {
    const innerFrom = carries[i] === 'media' && previous ? finalInnerScale(previous, 'media') : undefined;
    const a = build(i, develops[i], innerFrom);
    previous = a.spec;
    out.push({ key: s.key, html: a.html, script: a.script, config: configOf(i), quality: a.quality });
  });
  return out;
}

/**
 * La variété des titres, garantie par le code : jamais la même animation d'entrée de titre trois scènes de suite (le
 * spectateur ne voit plus qu'un procédé). La troisième prend une autre animation de texte de la gamme et de la DA.
 */
function varyTitles(cat: LoadedVideoCatalog, theme: ThemeNode, facts: SceneFacts[], configs: SceneConfig[], o: { direction?: string; level?: string; seed: string }): SceneConfig[] {
  const out = configs.map((c) => ({ ...c, animations: { ...c.animations } }));
  const titleText = (f: SceneFacts) => (f.slots.title ? f.texts[f.slots.title] ?? '' : '');
  const anim = (i: number) => (facts[i].slots.title ? animationFor(cat, theme, out[i], 'title', titleText(facts[i]), facts[i].role) : undefined);
  const texts = inTier(inDirection(cat, [...cat.nodes.values()].filter((n): n is AnimationNode => n.kind === 'animation' && !n.id.startsWith('builtin.') && n.targets.includes('text')), o.direction), o.level, 6);
  for (let i = 2; i < out.length; i++) {
    const a = anim(i);
    if (!a || a !== anim(i - 1) || a !== anim(i - 2)) continue;
    const alt = texts.filter((n) => n.id !== a && animationFits(cat, n.id, 'title', titleText(facts[i]), facts[i].role)).sort((x, y) => jitter(`${o.seed}|${i}|${x.id}`) - jitter(`${o.seed}|${i}|${y.id}`))[0];
    if (alt) out[i].animations.title = alt.id;
  }
  return out;
}

/** LE FILM : liste courte, choix (code ou modèle), assemblage. Jamais d'exception : au pire, le choix du code. */
export async function composeFilmFromCatalog(input: ComposeInput): Promise<ComposedFilm> {
  const t0 = Date.now();
  const cat = await videoCatalog();
  const effort = videoEffortFor(input.level);
  const memory = await memoryOf(input.memoryKey);
  const facts = factsOf(input.scenes, input.formats, input.brand.hasLogo);
  const style = STYLES.includes(input.film.style as VideoStyle) ? (input.film.style as VideoStyle) : undefined;
  const seed = `${input.brand.name}|${input.film.seed}`;
  const state: FilmState = { layouts: [], use: new Map(), seen: memory.templates };
  // Les SÉQUENCES d'abord (code, 0 jeton) : les scènes enchaînées gardent la configuration de leur séquence.
  const sequences = planSequences(cat, facts, { direction: input.brand.direction, level: input.level, seed, seen: memory.sequences, hasLogo: input.brand.hasLogo, scenes: input.scenes });
  const lists: SceneCandidate[][] = [];
  for (const f of facts) {
    const list = shortlist(cat, f, { style, direction: input.brand.direction, state, seed, size: effort.shortlist, level: input.level });
    lists.push(list);
    const chosen = sequences.get(f.index)?.layout ?? list[0].layout.id;
    state.layouts[f.index] = chosen;
    state.use.set(chosen, (state.use.get(chosen) ?? 0) + 1);
  }
  const avgEnergy = facts.reduce((n, f) => n + f.energy, 0) / Math.max(1, facts.length);
  const themes = rankThemes(cat, { style, direction: input.brand.direction, energy: avgEnergy, allowDark: input.allowDark === true, seed, used: memory.themes, level: input.level });
  let theme = themes[0];
  let configs = lists.map((l, i) => sequences.get(i) ?? l[0].config);
  let trace: ComposedFilm['trace'] = { source: 'code', tokens: { input: 0, output: 0 }, ms: 0, detail: '' };

  if (effort.chooser === 'model' && (lists.some((l) => l.length > 1) || (effort.themes > 1 && themes.length > 1))) {
    const offered = themes.slice(0, effort.themes);
    const scenes: ChooseScene[] = facts.map((f, i) => ({
      key: input.scenes[i].key,
      role: f.role,
      energy: f.energy,
      duration: f.duration,
      shape: shapeOf(f.slots, f.texts),
      candidates: lists[i],
      roles: Object.fromEntries(lists[i].map((c) => [c.ref, rolesIn(sceneHtml(c.layout, theme, f.slots, input.brand)).filter((r) => r !== 'item')])),
    }));
    const user = chooseUser(cat, { brandLine: input.brand.line, film: input.film, themes: offered, scenes, effort, level: input.level, direction: input.brand.direction });
    const run = await callFilmModel(input.call, 'video.template', chooseSystem(), user, (raw) => parseChoices(raw, cat, { themes: offered, scenes, effort }) !== null);
    const parsed = run.raw ? parseChoices(run.raw, cat, { themes: offered, scenes, effort }) : null;
    trace = { source: parsed ? 'llm' : 'code', tokens: run.tokens, ms: run.ms, ...(run.failure ? { failure: run.failure } : {}), detail: '' };
    if (parsed) {
      if (parsed.theme) theme = parsed.theme;
      // Une scène de séquence garde sa configuration : le choix du modèle ne vaut que pour les scènes isolées.
      configs = scenes.map((s, i) => (sequences.has(i) ? configs[i] : parsed.scenes.get(s.key)?.config ?? configs[i]));
    }
  }
  // La variété, garantie par le code : jamais la même mise en page deux scènes de suite (le candidat suivant la remplace),
  // sauf au sein d'une même séquence (une continuité voulue).
  for (let i = 1; i < configs.length; i++) {
    if (configs[i].layout !== configs[i - 1].layout || (configs[i].sequence && configs[i].sequence === configs[i - 1].sequence)) continue;
    if (sequences.has(i)) continue;
    const alt = lists[i].find((c) => c.layout.id !== configs[i - 1].layout);
    if (alt) configs[i] = alt.config;
  }
  configs = varyTitles(cat, theme, facts, configs, { direction: input.brand.direction, level: input.level, seed });
  const scenes = assembleFilm(cat, input, theme, configs);
  trace.ms = Date.now() - t0;
  const seqIds = [...new Set(scenes.map((s) => s.config.sequence).filter(Boolean))];
  trace.detail = `catalogue ${cat.version} · thème ${theme.id}${seqIds.length ? ` · séquences ${seqIds.join(', ')}` : ''} · ${scenes.map((s) => `${s.key}=${s.config.sequence ? `${s.config.sequence}#${(s.config.step ?? 0) + 1}` : s.config.gabarit ?? s.config.layout}${s.quality?.carry ? `⇠${s.quality.carry}` : s.config.transition ? `↤${s.config.transition}` : ''}${s.quality?.develop ? `+${s.quality.develop}` : ''}`).join(', ')}`.slice(0, 900);
  logger.info('video.catalog_film', { event: 'video.catalog_film', level: input.level, by: trace.source, detail: trace.detail, idle: scenes.map((s) => s.quality?.idle ?? 0) });
  const host = coreHost();
  if (input.memoryKey && host.rememberFingerprints && process.env.IDEM_QUALITY_MEMORY !== '0') {
    await host.rememberFingerprints({ documentType: 'video', key: input.memoryKey }, [`vtheme:${theme.id}`, ...scenes.map((s) => `vtpl:${sceneFingerprint(s.config)}`), ...seqIds.map((id) => `vseq:${id}`)]).catch(() => undefined);
  }
  return { version: cat.version, theme: theme.id, vars: {}, scenes, trace };
}

/** Le film réassemblé depuis ses configurations gardées (texte, durée ou ordre changés) : aucun modèle. */
export async function reassembleFilm(input: Pick<ComposeInput, 'scenes' | 'brand' | 'formats'>, themeId: string, configs: SceneConfig[], vars: Record<string, string> = {}): Promise<ComposedScene[]> {
  const cat = await videoCatalog();
  const theme = (cat.nodes.get(themeId)?.kind === 'theme' ? cat.nodes.get(themeId) : cat.nodes.get('builtin.plain')) as ThemeNode;
  // Un nœud retiré du catalogue depuis : l'empilement intégré montre la scène.
  const safe = configs.map((c): SceneConfig => (c && cat.nodes.get(c.layout)?.kind === 'layout' ? c : { layout: 'builtin.stack', animations: {} }));
  return assembleFilm(cat, input, theme, safe, vars);
}

/**
 * Le candidat SUIVANT d'une scène (elle plante, un texte ne tient pas, ou le client veut « une autre version ») : le
 * premier de sa liste courte qui n'a pas encore été essayé, sans modèle. `null` : la liste est épuisée.
 */
export async function nextSceneConfig(input: Pick<ComposeInput, 'scenes' | 'brand' | 'formats' | 'film'>, index: number, tried: SceneConfig[]): Promise<SceneConfig | null> {
  const cat = await videoCatalog();
  const facts = factsOf(input.scenes, input.formats, input.brand.hasLogo);
  const style = STYLES.includes(input.film.style as VideoStyle) ? (input.film.style as VideoStyle) : undefined;
  const list = shortlist(cat, facts[index], { style, direction: input.brand.direction, state: { layouts: [], use: new Map(), seen: new Set() }, seed: `${input.brand.name}|${input.film.seed}`, size: 12 });
  const done = new Set(tried.map(sceneFingerprint));
  const fresh = list.find((c) => !done.has(sceneFingerprint(c.config)));
  if (fresh) return fresh.config;
  // Une seule mise en page montre la scène : une nouvelle version change alors le MOUVEMENT de son rôle principal
  // (une autre animation compatible), dans l'ordre du catalogue — jamais au hasard.
  const base = list[0]?.config;
  if (!base) return null;
  const html = sceneHtml(list[0].layout, cat.nodes.get('builtin.plain') as ThemeNode, facts[index].slots, input.brand);
  const roles = rolesIn(html).filter((r) => r !== 'item');
  const lead = (['title', 'figure', 'media', 'logo'] as const).find((r) => roles.includes(r));
  if (!lead) return null;
  const target = ROLE_TARGET[lead];
  const alternatives = [...cat.nodes.values()].filter((n) => n.kind === 'animation' && !n.id.startsWith('builtin.') && n.targets.includes(target)).map((n) => n.id).sort();
  for (const id of alternatives) {
    const variant: SceneConfig = { ...base, animations: { ...base.animations, [lead]: id } };
    if (!done.has(sceneFingerprint(variant))) return variant;
  }
  return null;
}

/** La RETOUCHE écrite d'une scène : le modèle repart de sa configuration actuelle et de la consigne (un appel). */
export async function reviseSceneConfig(input: ComposeInput, index: number, themeId: string, current: SceneConfig, instruction: string): Promise<{ config: SceneConfig; trace: ComposedFilm['trace'] }> {
  const cat = await videoCatalog();
  const effort = { ...videoEffortFor(input.level), chooser: 'model' as const, motion: true };
  const facts = factsOf(input.scenes, input.formats, input.brand.hasLogo);
  const f = facts[index];
  const theme = (cat.nodes.get(themeId)?.kind === 'theme' ? cat.nodes.get(themeId) : cat.nodes.get('builtin.plain')) as ThemeNode;
  const style = STYLES.includes(input.film.style as VideoStyle) ? (input.film.style as VideoStyle) : undefined;
  let list = shortlist(cat, f, { style, direction: input.brand.direction, state: { layouts: [], use: new Map(), seen: new Set() }, seed: `${input.brand.name}|${input.film.seed}|revise`, size: Math.max(6, effort.shortlist), level: input.level });
  // La configuration actuelle en tête (« A ») : la consigne la modifie, elle ne repart pas de zéro.
  const layout = cat.nodes.get(current.layout);
  if (layout?.kind === 'layout') list = [{ ref: 'A', layout: layout as LayoutNode, config: current, score: 99 }, ...list.filter((c) => sceneFingerprint(c.config) !== sceneFingerprint(current))].map((c, i) => ({ ...c, ref: String.fromCharCode(65 + i) }));
  const key = input.scenes[index].key;
  const scenes: ChooseScene[] = [{ key, role: f.role, energy: f.energy, duration: f.duration, shape: shapeOf(f.slots, f.texts), candidates: list, roles: Object.fromEntries(list.map((c) => [c.ref, rolesIn(sceneHtml(c.layout, theme, f.slots, input.brand)).filter((r) => r !== 'item')])) }];
  const user = chooseUser(cat, { brandLine: input.brand.line, film: input.film, themes: [theme], scenes, effort, level: input.level, direction: input.brand.direction, revise: { key, current, instruction } });
  const run = await callFilmModel(input.call, 'video.template', chooseSystem(), user, (raw) => (parseChoices(raw, cat, { themes: [theme], scenes, effort })?.scenes.size ?? 0) > 0);
  const parsed = run.raw ? parseChoices(run.raw, cat, { themes: [theme], scenes, effort }) : null;
  const config = parsed?.scenes.get(key)?.config ?? list.find((c) => sceneFingerprint(c.config) !== sceneFingerprint(current))?.config ?? current;
  return { config, trace: { source: parsed ? 'llm' : 'code', tokens: run.tokens, ms: run.ms, ...(run.failure ? { failure: run.failure } : {}), detail: `${key}: ${config.gabarit ?? config.layout}` } };
}

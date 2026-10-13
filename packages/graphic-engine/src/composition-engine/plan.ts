/**
 * Le PLAN DE DOCUMENT : ce qui se décide UNE fois pour tout le livrable, et ce qui varie d'une page à
 * l'autre.
 *
 * Constant (cohérence) : humeur typographique, densité, pied de page, stratégie de couleur principale.
 * Variable (diversité) : la composition de chaque page, et — par cycles — la stratégie, la tension et
 * l'accent. Un document professionnel garde sa typographie ; il varie ses mises en page.
 *
 * RÉSERVATIONS : les sections d'un livrable sont souvent composées EN PARALLÈLE. Classées chacune de son
 * côté, elles tombaient sur la même mise en page (défaut constaté sur six pages identiques). Le plan
 * distribue donc, avant toute composition, une préférence de motifs par section, décalée d'une section
 * à l'autre, et dit à chaque section ce que ses voisines ont réservé.
 *
 * Tout tirage est SEMÉ PAR LA CLÉ DU DOCUMENT : trois projets du même style reçoivent trois suites
 * différentes ; le même projet, la même suite.
 */
import type { CreativityLevel, DocumentType, FormatId } from '../contracts/common';
import type { SectionRole } from '../contracts/content-model';
import type { Accent, ColorStrategy, Density, Tension, TypeMood } from '../contracts/design-spec';
import { FORMATS, FormatFamily } from '../design-system/formats';
import { patternsFor } from '../design-system/patterns/registry';
import { resolveStyle } from '../design-system/tokens';
import { Rng } from '../foundation/rng';
import { STYLE_TAGS } from './profiles';

export interface SlotPlan {
  index: number;
  strategy: ColorStrategy;
  tension: Tension;
  accent: Accent;
  /** Motifs préférés pour cette section, du plus au moins souhaité. */
  prefer: string[];
  /** Motifs réservés par les sections voisines : à éviter. */
  avoid: string[];
}

export interface DocumentPlan {
  documentType: DocumentType;
  format: FormatId;
  seed: string;
  creativity: CreativityLevel;
  styleId: string;
  mood: TypeMood;
  density: Density;
  footer: 'full' | 'logo' | 'none';
  strategy: ColorStrategy;
  alternates: ColorStrategy[];
  tensions: Tension[];
  accents: Accent[];
  order: string[];
  slots: Record<string, SlotPlan>;
}

export interface PlanInput {
  documentType: DocumentType;
  format: FormatId;
  seed: string;
  creativity?: CreativityLevel;
  styleId?: string;
  density?: Density;
  /** Les sections attendues, dans l'ordre (rôles connus d'avance : couverture, chapitres…). */
  sections?: Array<{ id: string; role?: SectionRole }>;
  /** Une photo existe (la stratégie « couleurs de l'image » devient possible). */
  hasImage?: boolean;
}

/**
 * Humeurs admises dans un long document remis à un banquier : un contour ou une lettre ornée sur CHAQUE
 * titre d'un business plan fatigue et fait décoratif ; ces gestes restent aux decks, chartes et visuels.
 */
const LONG_DOC_MOODS: TypeMood[] = ['neutral', 'tight-display', 'weight-clash', 'staggered'];

export function styleAffinity(tags: string[], styleId: string): number {
  const wanted = STYLE_TAGS[styleId] ?? [];
  if (!wanted.length) return 0.5;
  const hits = tags.filter((t) => wanted.includes(t)).length;
  return Math.min(1, hits / 2);
}

export function planDocument(input: PlanInput): DocumentPlan {
  const rng = new Rng(`${input.seed}:plan`);
  const style = resolveStyle(input.styleId);
  const format = FORMATS[input.format];
  const family: FormatFamily = format.family;
  const long = input.documentType === 'business-plan' || input.documentType === 'report';

  const moods = (long ? style.moods.filter((m) => LONG_DOC_MOODS.includes(m)) : style.moods).filter(Boolean);
  const mood = moods.length ? rng.pick(moods) : 'neutral';
  const density = input.density ?? style.densities[0] ?? 'balanced';
  const footer: DocumentPlan['footer'] = family === 'document' ? 'full' : family === 'slide' ? (input.documentType === 'brand-charter' ? 'full' : rng.pick(['full', 'logo'] as const)) : 'none';

  // L'inversion (page de couleur) n'existe pas dans un document paginé ; les couleurs d'une image, seulement s'il y en a une.
  const usable = style.strategies.filter((s) => (s !== 'inverse' || family !== 'document') && (s !== 'image-extracted' || input.hasImage));
  const strategy = usable[0] ?? 'monochrome-accent';
  const alternates = usable.slice(1);
  const tensions = rng.shuffle(style.tensions.length ? style.tensions : (['calm'] as Tension[])).slice(0, 2);
  const accents = rng.shuffle(style.accents.filter((a) => a !== 'none')).slice(0, 2);

  const sections = input.sections ?? [];
  const order = sections.map((s) => s.id);
  // Une suite de motifs propre au projet : l'affinité du style penche, le tirage du projet départage.
  // Les motifs qui exigent une matière (image, points) sont écartés AVANT le tirage : le plan ne voit pas le
  // contenu, et la suite tirée pour un projet ne dépend pas de leur présence dans la bibliothèque.
  const pool = (role?: SectionRole) =>
    patternsFor(family, role)
      .filter((p) => !p.needs?.length)
      .map((p) => ({ id: p.id, score: styleAffinity(p.tags, style.id) + rng.float(0, 0.9) }))
      .sort((a, b) => b.score - a.score)
      .map((p) => p.id);

  const slots: Record<string, SlotPlan> = {};
  const reserved: string[] = [];
  sections.forEach((s, i) => {
    const candidates = pool(s.role);
    // Décalage : chaque section commence sa liste plus loin que la précédente.
    const offset = candidates.length ? (i * 3) % candidates.length : 0;
    const rotated = [...candidates.slice(offset), ...candidates.slice(0, offset)];
    const prefer = rotated.filter((id) => id !== reserved[i - 1]).slice(0, 4);
    reserved[i] = prefer[0];
    const alternate = alternates.length && i % 4 === 3 ? alternates[(i >> 2) % alternates.length] : strategy;
    slots[s.id] = {
      index: i + 1,
      strategy: alternate,
      tension: tensions.length ? (i % 3 === 2 ? 'calm' : tensions[i % tensions.length]) : 'calm',
      accent: accents.length ? accents[i % accents.length] : 'none',
      prefer,
      avoid: [],
    };
  });
  sections.forEach((s, i) => {
    slots[s.id].avoid = [reserved[i - 1], reserved[i + 1]].filter((x): x is string => Boolean(x) && x !== reserved[i]);
  });

  return { documentType: input.documentType, format: input.format, seed: input.seed, creativity: input.creativity ?? 'medium', styleId: style.id, mood, density, footer, strategy, alternates, tensions, accents, order, slots };
}

/** Le créneau d'une section absente du plan (ajoutée après coup) : on le dérive de la graine. */
export function slotFor(plan: DocumentPlan, sectionId: string, index?: number): SlotPlan {
  const known = plan.slots[sectionId];
  if (known) return known;
  const rng = new Rng(`${plan.seed}:slot:${sectionId}`);
  const i = index ?? plan.order.length + 1;
  return {
    index: i,
    strategy: plan.alternates.length && rng.chance(0.25) ? rng.pick(plan.alternates) : plan.strategy,
    tension: plan.tensions.length ? rng.pick(plan.tensions) : 'calm',
    accent: plan.accents.length ? rng.pick(plan.accents) : 'none',
    prefer: [],
    avoid: [],
  };
}

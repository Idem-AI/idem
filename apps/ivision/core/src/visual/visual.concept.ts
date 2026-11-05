/**
 * L'IDÉE D'UN VISUEL — avant les mots, la photo et la page (plan qualité créative).
 *
 * Avant : le rédacteur écrivait les mots ET décidait seul de la photo, puis la page s'adaptait aux deux — la recette du
 * visuel attendu. Maintenant, le directeur propose QUATRE pistes qui divergent (métaphore, cadrage, rapport texte /
 * image), chacune avec le rôle de l'image (photo, illustration vectorielle, sujet détouré, aucune), son traitement et
 * son registre typographique ; le CODE retient la plus éloignée des visuels déjà faits (marque, utilisateur, secteur).
 * Les mots, l'image et la page suivent ensuite la même idée.
 *
 * Le rôle `graphic.explore` décide (modèle le plus fort, raisonnement) ; aucun mot-clé n'interprète la demande.
 */
import type { AgentCall } from '../creativity/orchestrator';
import type { CreativityLevel } from '../creativity/levels';
import { axisLine, displayFor, novelty, pickAxis, textEmbedding } from '../../../../../packages/design-tools/src';
import type { PhotoTreatment } from '../../../../../packages/design-tools/src';

export type ImageRole = 'photo' | 'illustration' | 'cutout' | 'none';

export interface VisualConcept {
  title: string;
  idea: string;
  image: ImageRole;
  /** Ce que l'image montre (sujet de la photo ou de l'illustration). */
  imageSubject?: string;
  treatment: PhotoTreatment;
  type: 'brand' | 'expressive';
}

export interface ConceptChoice {
  concept: VisualConcept;
  tracks: number;
  novelty: number;
  axis?: string;
}

const IMAGE_ROLES: ImageRole[] = ['photo', 'illustration', 'cutout', 'none'];
const TREATMENTS: PhotoTreatment[] = ['natural', 'duotone', 'tint', 'mono'];

export function conceptPrompt(o: { request: string; brand: string; business: string; tone?: string; format: string; language: string; previous: string[]; startingPoint?: string; hasUserPhoto: boolean }): { system: string; user: string } {
  const system = [
    'You are the art director of an African brand. Before any word is written, propose FOUR clearly different ideas for ONE social-media visual.',
    'They differ in kind: another metaphor, another framing (close-up, wide, object, people, type alone), another relation between words and image. One of them starts from the STARTING POINT. None repeats a visual already made.',
    'For each idea choose the IMAGE ROLE: photo (a real-looking photo), illustration (a flat vector illustration in the brand colours), cutout (one subject cut out of its background, set on a brand colour field), or none (typography and colour only).',
    'Choose the TREATMENT of a photo: natural, duotone (two brand colours), tint (a light brand tint) or mono; and the TYPE: brand (the brand fonts) or expressive (a bolder display face for the headline only).',
    'Every idea serves the message: the viewer understands what is offered at a glance. Professional, never decoration for its own sake.',
    'Answer in English with exactly four blocks of five lines:',
    'TRACK n: <short title> — <the idea in two sentences: what we see and how words and image work together>',
    'IMAGE n: photo|illustration|cutout|none — <what the image shows, concrete>',
    'TREATMENT n: natural|duotone|tint|mono',
    'TYPE n: brand|expressive',
    '',
  ].join('\n');
  const user = [
    `REQUEST (verbatim): ${o.request.slice(0, 2000)}`,
    `BRAND: ${o.brand} — ${o.business}${o.tone ? ` — tone: ${o.tone}` : ''}`,
    `FORMAT: ${o.format} · texts in ${o.language}`,
    o.hasUserPhoto ? 'THE CLIENT GAVE A PHOTO: every idea uses it (photo or cutout).' : '',
    o.startingPoint ?? '',
    o.previous.length ? `VISUALS ALREADY MADE FOR THIS BRAND OR ITS SECTOR (never repeat them):\n${o.previous.slice(0, 10).join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  return { system, user };
}

export function parseConcepts(raw: string): VisualConcept[] {
  const text = (raw || '').replace(/```[a-z]*\n?|```/g, '').replace(/\*\*/g, '');
  const field = (name: string, n: string) => text.match(new RegExp(`^\\s*${name}\\s*${n}\\s*[:.)—–-]\\s*(.+)$`, 'im'))?.[1]?.trim() ?? '';
  const out: VisualConcept[] = [];
  for (const m of text.matchAll(/^\s*TRACK\s*(\d)\s*[:.)—–-]\s*(.+?)\s*[—–:-]\s+(.+)$/gim)) {
    const n = m[1];
    const imageLine = field('IMAGE', n);
    const role = IMAGE_ROLES.find((r) => new RegExp(`^${r}\\b`, 'i').test(imageLine)) ?? 'photo';
    const treatment = TREATMENTS.find((t) => new RegExp(`\\b${t}\\b`, 'i').test(field('TREATMENT', n))) ?? 'natural';
    const type = /expressive/i.test(field('TYPE', n)) ? 'expressive' : 'brand';
    const idea = m[3].trim();
    if (idea.length < 20) continue;
    out.push({ title: m[2].trim().slice(0, 80), idea: idea.slice(0, 400), image: role, ...(imageLine.split(/[—–-]\s+/)[1] ? { imageSubject: imageLine.split(/[—–-]\s+/).slice(1).join(' - ').trim().slice(0, 240) } : {}), treatment, type });
  }
  return out.slice(0, 4);
}

/** Le texte d'une idée, pour la mémoire et la mesure de nouveauté. */
export const conceptText = (c: VisualConcept) => `${c.title} — ${c.idea}`;

/** La piste la plus éloignée de ce qui a déjà été fait (à nouveauté égale, la première). */
export function chooseConcept(concepts: VisualConcept[], previous: string[]): { concept: VisualConcept; novelty: number } | null {
  if (!concepts.length) return null;
  const history = previous.map((p) => textEmbedding(p));
  return concepts.map((c, i) => ({ concept: c, i, novelty: novelty(textEmbedding(conceptText(c)), history) })).sort((a, b) => b.novelty - a.novelty || a.i - b.i)[0];
}

/** L'étape concept : quatre pistes, une retenue. `null` sans modèle ou sans réponse lisible (le visuel se fait comme avant). */
export async function chooseVisualConcept(call: AgentCall | undefined, o: Parameters<typeof conceptPrompt>[0] & { level: CreativityLevel; seed: string; country?: string; usedAxes?: string[] }): Promise<ConceptChoice | null> {
  if (!call || process.env.IDEM_QUALITY_EXPLORE === '0') return null;
  const axis = pickAxis({ seed: o.seed, country: o.country, used: o.usedAxes, medium: 'document' });
  const { system, user } = conceptPrompt({ ...o, startingPoint: axisLine(axis, 'document') });
  let raw = '';
  try {
    raw = await call({ role: 'graphic.explore', profile: 'agents', system, user, level: o.level, validate: (r) => parseConcepts(r).length >= 2 });
  } catch {
    return null;
  }
  const concepts = parseConcepts(raw);
  const picked = chooseConcept(concepts, o.previous);
  return picked ? { concept: picked.concept, tracks: concepts.length, novelty: picked.novelty, axis: axis.id } : null;
}

/** La police d'accroche d'une idée « expressive » : une face de titre qui contraste avec celles de la marque. */
export function accentFontFor(brand: { primaryFont?: string; secondaryFont?: string }, seed: string): string | undefined {
  const own = new Set([brand.primaryFont, brand.secondaryFont].filter(Boolean).map((f) => f!.toLowerCase()));
  const candidates = [...displayFor(brand.secondaryFont || 'Inter').map((p) => p.family), 'Bebas Neue', 'Anton', 'Archivo Black', 'Syne', 'Unbounded', 'DM Serif Display', 'Fraunces', 'Playfair Display'].filter((f, i, all) => all.indexOf(f) === i && !own.has(f.toLowerCase()));
  if (!candidates.length) return undefined;
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return candidates[h % candidates.length];
}

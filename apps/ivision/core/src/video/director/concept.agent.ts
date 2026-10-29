/**
 * LE DIRECTEUR CRÉATIF — invente le film : un concept, une bible visuelle, une idée par scène.
 *
 * Aucune liste de mises en page, de motifs ou de concepts : le modèle invente. Il reçoit la demande,
 * la marque, les médias et le cadre (durée, format), rien d'autre. Le même travail à tous les crans :
 * la jauge de créativité choisit le MODÈLE qui le fait (`config/creative-roles.ts`, échelle « design »).
 */
import { callFilmModel, FilmCallContext, ModelRun } from '../agents';
import { FilmBrief, formatLine, intentLine, languageLine, mediaLines, sceneRange, scriptLines, skeletonLine } from './brief';
import { clampEnergy, directionMenu, directionOf, DirectionId } from '../../../../../../packages/motion-compiler/src';
import { parseFilmPlan } from './film-format';
import { specConstraints } from '../request/request';

export interface FilmConcept {
  title: string;
  concept: string;
  bible: string;
  /** Une ligne par scène : ce qu'on voit et comment ça bouge. */
  outline: string[];
  /** La direction visuelle nommée (et la seconde, si la première vient de servir au film précédent). */
  direction?: DirectionId;
  alternative?: DirectionId;
  /** L'énergie de chaque scène (1 posé → 5 nerveux) : une courbe, un seul pic. */
  energy?: number[];
  raw: string;
}

export function buildConceptPrompt(brief: FilmBrief): { system: string; user: string } {
  const [min, max] = sceneRange(brief.durationSec);
  const scripted = !!brief.spec && brief.spec.mode === 'script' && brief.spec.scenes.length > 0;
  const system = [
    'You are the creative director of short motion-design films for social media, made for African businesses and brands.',
    'Invent ONE original film for this request. You are free: composition, shapes, metaphors, typography, camera, rhythm, transitions — nothing is imposed, no template exists.',
    'The film will be coded in Motion Canvas (2D vector animation: shapes, lines, text, photos and video clips, masks, gradients, filters). Design for that medium: precise, physical, rhythmic motion design — not a slideshow.',
    'Serve the message first: the viewer must understand what is offered and what to do. Avoid clichés (floating icons, generic gradients, "Welcome to…" intros).',
    'Make it a FILM, not slides: scenes flow into each other — the same subject stays while the text changes, the camera keeps moving through a cut, a shape or colour carries over, an image answers the previous line. Never a sequence of text cards that appear and disappear.',
    'SHOW the business: most scenes are built around a concrete subject (its product, place, customers, team, craft, the problem it solves) as a photo, a filmed shot or an illustration — available media first, otherwise a new photo or clip. Pure typography only for a short statement or the call to action.',
    'When the REQUEST is a production brief with a flow of beats, follow its beats in order (merge or split them to fit the scene count) and keep its subjects, its key message and its tone.',
    'Brand rule: use the brand colours and fonts; light backgrounds by default unless the client asks otherwise.',
    `Pick ONE named visual direction for the whole film (it sets type scale, colour use, motion personality and transitions — the code applies it), and a second choice:\n${directionMenu()}`,
    brief.previousDirections?.length ? `The previous film of this brand used "${brief.previousDirections[0]}": choose a different direction.` : '',
    'Give each scene an ENERGY from 1 (calm, slow, one thing at a time) to 5 (punchy, fast): one curve for the film with a single peak (the payoff, around 60–80 % of the film).',
    brief.skeleton && !(brief.spec && brief.spec.mode === 'script' && brief.spec.scenes.length) ? `This is a product film: follow (scale, merge or skip) the eight beats ${skeletonLine()}.` : '',
    '',
    'Answer in English with exactly these fields:',
    'TITLE: a short working title',
    'DIRECTION: <direction id>, second: <direction id>',
    'ENERGY: one integer 1-5 per scene, comma-separated',
    'CONCEPT: the idea of the film in one or two sentences',
    'BIBLE: 3 to 6 lines — how colours are used, typography (sizes, case, weight), graphic language (shapes, lines, textures), motion personality (easing, speed, rhythm), how scenes connect',
    scripted ? `SCENE n: one line per scene of the client's script (${brief.spec!.scenes.length} scenes) — what we see and how it moves` : `SCENE n: one line per scene (${min} to ${max} scenes) — the concrete subject we see, how it moves, and what carries over to the next scene`,
  ]
    .filter((l) => l !== '')
    .join('\n');
  const user = [
    `REQUEST (verbatim):\n${brief.request.slice(0, 6000)}`,
    `LANGUAGE OF ON-SCREEN TEXTS: ${languageLine(brief.language)}`,
    `FORMAT: ${formatLine(brief)}`,
    intentLine(brief) ? `INTENT: ${intentLine(brief)}` : '',
    brief.anonymous ? 'BRAND: none (no logo, no brand name on screen)' : `BRAND:\n${brief.brandSheet}`,
    specConstraints(brief.spec),
    scripted ? `CLIENT SCRIPT (follow it scene by scene):\n${scriptLines(brief.spec!)}` : '',
    `MEDIA AVAILABLE:\n${mediaLines(brief)}`,
    brief.newMedia.images || brief.newMedia.clips ? `NEW MEDIA THAT CAN BE GENERATED: up to ${brief.newMedia.images} photos and ${brief.newMedia.clips} short video clips` : 'NO NEW PHOTO OR CLIP CAN BE GENERATED: build visuals with shapes, type and the media above.',
    brief.reference ? `REFERENCE FILM TO REPRODUCE (the client's model: same number of shots, same timing, same composition and motion per shot):\n${brief.reference.slice(0, 6000)}` : '',
    brief.previous.length ? `FILMS ALREADY MADE FOR THIS BRAND (do something different):\n${brief.previous.slice(0, 6).join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  return { system, user };
}

export function parseConcept(raw: string): FilmConcept | null {
  const plan = parseFilmPlan(raw.replace(/^\s*(IDEAS?|DIRECTION|ENERGY):.*$/gim, ''));
  const outline = [...raw.matchAll(/^[\s#>*_-]*(?:scene|scène|shot|plan)\s*\d{1,2}\s*[:.)—–-]\s*(.+)$/gim)].map((m) => m[1].trim()).filter(Boolean);
  if (!plan.concept && !outline.length) return null;
  // DIRECTION: tech, second: editorial — lu avec tolérance (la liste est fermée : un nom inconnu est ignoré).
  const dirLine = raw.match(/^[\s*_#-]*DIRECTION\s*[:=]\s*(.+)$/im)?.[1] || '';
  const [first, second] = dirLine.split(/,|;|\bsecond\b|\balternative\b/i).map((x) => directionOf(x.replace(/[:()]/g, ' ').trim().split(/\s+/).pop()));
  const energyLine = raw.match(/^[\s*_#-]*ENERGY\s*[:=]\s*(.+)$/im)?.[1] || '';
  const energy = (energyLine.match(/\d/g) || []).map((d) => clampEnergy(Number(d)));
  return { title: plan.title, concept: plan.concept, bible: plan.bible, outline, ...(first ? { direction: first } : {}), ...(second && second !== first ? { alternative: second } : {}), ...(energy.length ? { energy } : {}), raw };
}

export async function runConcept(ctx: FilmCallContext, brief: FilmBrief): Promise<{ concept: FilmConcept | null; run: ModelRun }> {
  const { system, user } = buildConceptPrompt(brief);
  const run = await callFilmModel(ctx, 'video.concept', system, user, (raw) => parseConcept(raw) !== null);
  return { concept: run.raw ? parseConcept(run.raw) : null, run };
}

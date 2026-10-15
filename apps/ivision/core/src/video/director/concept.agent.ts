/**
 * LE DIRECTEUR CRÉATIF — invente le film : un concept, une bible visuelle, une idée par scène.
 *
 * Aucune liste de mises en page, de motifs ou de concepts : le modèle invente. Il reçoit la demande,
 * la marque, les médias et le cadre (durée, format), rien d'autre. Le même travail à tous les crans :
 * la jauge de créativité choisit le MODÈLE qui le fait (`config/creative-roles.ts`, échelle « design »).
 */
import { callFilmModel, FilmCallContext, ModelRun } from '../agents';
import { FilmBrief, formatLine, intentLine, languageLine, mediaLines, sceneRange, scriptLines } from './brief';
import { parseFilmPlan } from './film-format';
import { specConstraints } from '../request/request';

export interface FilmConcept {
  title: string;
  concept: string;
  bible: string;
  /** Une ligne par scène : ce qu'on voit et comment ça bouge. */
  outline: string[];
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
    'Brand rule: use the brand colours and fonts; light backgrounds by default unless the client asks otherwise.',
    '',
    'Answer in English with exactly these fields:',
    'TITLE: a short working title',
    'CONCEPT: the idea of the film in one or two sentences',
    'BIBLE: 3 to 6 lines — how colours are used, typography (sizes, case, weight), graphic language (shapes, lines, textures), motion personality (easing, speed, rhythm), how scenes connect',
    scripted ? `SCENE n: one line per scene of the client's script (${brief.spec!.scenes.length} scenes) — what we see and how it moves` : `SCENE n: one line per scene (${min} to ${max} scenes) — what we see and how it moves`,
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
    brief.reference ? `REFERENCE FILM TO FOLLOW (its rhythm, cuts and motion):\n${brief.reference.slice(0, 1500)}` : '',
    brief.previous.length ? `FILMS ALREADY MADE FOR THIS BRAND (do something different):\n${brief.previous.slice(0, 6).join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  return { system, user };
}

export function parseConcept(raw: string): FilmConcept | null {
  const plan = parseFilmPlan(raw.replace(/^\s*IDEAS?:.*$/gim, ''));
  const outline = [...raw.matchAll(/^[\s#>*_-]*(?:scene|scène|shot|plan)\s*\d{1,2}\s*[:.)—–-]\s*(.+)$/gim)].map((m) => m[1].trim()).filter(Boolean);
  if (!plan.concept && !outline.length) return null;
  return { title: plan.title, concept: plan.concept, bible: plan.bible, outline, raw };
}

export async function runConcept(ctx: FilmCallContext, brief: FilmBrief): Promise<{ concept: FilmConcept | null; run: ModelRun }> {
  const { system, user } = buildConceptPrompt(brief);
  const run = await callFilmModel(ctx, 'video.concept', system, user, (raw) => parseConcept(raw) !== null);
  return { concept: run.raw ? parseConcept(run.raw) : null, run };
}

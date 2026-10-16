/**
 * LE PLANIFICATEUR — transforme le concept en storyboard que l'auteur codera scène par scène :
 * durée, intention, idée visuelle, idée de mouvement, entrée, textes exacts, médias, voix.
 *
 * Sans concept (directeur en panne), il invente aussi le film dans son appel. Le code ne touche à rien de créatif ;
 * il garantit seulement ce qui est TECHNIQUE ou CONTRACTUEL :
 *   - les durées font la durée achetée (mise à l'échelle) ;
 *   - un scénario écrit par l'utilisateur garde ses scènes, ses textes et sa voix mot pour mot ;
 *   - un nombre absent de la demande (prix, date, numéro) ne s'affiche pas — l'écart est DIT ;
 *   - les médias cités existent ; les médias à produire tiennent dans les plafonds.
 */
import { callFilmModel, FilmCallContext, ModelRun } from '../agents';
import { isGrounded, urlInBrief } from '../request/facts';
import { specConstraints } from '../request/request';
import { wordBudget } from '../audio/voice';
import type { FilmConcept } from './concept.agent';
import { FilmBrief, formatLine, intentLine, languageLine, mediaLines, sceneRange, scriptLines } from './brief';
import { parseFilmPlan, PlannedFilm, PlannedScene } from './film-format';

export interface StoryboardScene extends PlannedScene {
  start: number;
  duration: number;
}

export interface Storyboard {
  title: string;
  concept: string;
  bible: string;
  scenes: StoryboardScene[];
  /** Ce qui n'a pas pu suivre la demande (dit à l'utilisateur). */
  fidelity: string[];
}

const scripted = (brief: FilmBrief) => !!brief.spec && brief.spec.mode === 'script' && brief.spec.scenes.length > 0;

export function buildPlannerPrompt(brief: FilmBrief, concept: FilmConcept | null): { system: string; user: string } {
  const [min, max] = sceneRange(brief.durationSec);
  const script = scripted(brief);
  const count = script ? `exactly ${brief.spec!.scenes.length} scenes (one per scene of the client's script, same order)` : concept?.outline.length ? `${Math.min(max, Math.max(min, concept.outline.length))} scenes` : `${min} to ${max} scenes`;
  const system = [
    'You write the storyboard of a short motion-design film. An animator will code each scene separately in Motion Canvas, reading ONLY its scene card — so each card must be concrete and complete.',
    !concept ? 'First invent the film: TITLE, CONCEPT (one or two sentences), BIBLE (3 to 6 lines: colour use, typography, graphic language, motion personality). Be original — no template exists, nothing is imposed.' : 'The concept is given: develop it faithfully.',
    '',
    'Output format (plain lines, no JSON, no markdown):',
    'TITLE: …',
    'CONCEPT: …',
    'BIBLE: …',
    'SCENE 1 | <seconds>',
    'purpose: what this scene must make the viewer understand or feel',
    'visual: what is on screen — elements, their place in the frame, sizes, colours (brand colours by role: primary, secondary, accent, background, text), media used',
    'motion: how each element enters, moves and leaves, timing and easing, the strongest moment',
    'transition: how this scene takes over from the previous one (first scene: how the film opens)',
    script ? '' : 'text.<key>: an exact on-screen text (key in lowercase: headline, sub, cta, figure, label…) — one line per text',
    'media: ids of the available media shown in this scene (e.g. m1, m3), or nothing — ONLY a medium whose description shows what this scene says (never one placed just to fill the frame: a scene without a fitting medium uses a new image/clip or typography)',
    brief.newMedia.images || brief.newMedia.clips ? 'new image: <what the photo shows, in English> | <2-4 word search query>   (only if no available medium fits)' : '',
    brief.newMedia.clips ? 'new clip: <what the filmed shot shows, in English> | <2-4 word search query>' : '',
    'voice: the voice-over line for this scene, as it must be SPOKEN (words + ElevenLabs delivery tags, see rules)',
    '',
    'Rules:',
    `- ${count}; durations in seconds add up to ${brief.durationSec}.`,
    script ? '- The on-screen texts are FIXED by the client: do not write text lines, design around them.' : `- On-screen texts in ${languageLine(brief.language)}; few words (a headline is rarely more than 7 words; at most 3 texts per scene). Never invent a price, number, date, address, claim or name that is not in the request.`,
    `- Voice lines in ${languageLine(brief.language)}, natural spoken sentences, about ${Math.round(wordBudget(brief.durationSec / Math.max(1, min + 1), brief.language))} words for a ${Math.round(brief.durationSec / Math.max(1, min + 1))}-second scene. Never invent facts.`,
    `- Voice delivery (read by ElevenLabs Eleven v4): write it like a voice actor's script so the intonation is natural. Start a line with ONE delivery tag in English, in square brackets, when the tone matters: [warmly], [confident], [excited], [softly], [curious], [reassuring], [cheerfully], [serious], [proudly]. Mark breaths with "…" or [short pause], stress with punctuation (a short sentence. Then the key word!), questions with "?". At most two tags per line, never a tag alone, never tags in the client's own words (a fixed script line stays word for word, tags may only be added before it). The film's lines follow one arc: a hook, a build, a confident close.`,
    `- ONE continuous narration, not one slogan per scene: the lines are read in a single take by one narrator and must flow into each other like a story told to a friend — a line may end on a comma or an open idea that the next scene completes, use connectors (and, but, so, because, then / et, mais, alors, parce que, puis), never restart with the same structure or re-announce the brand in every line. Read all the lines one after the other: they must sound like one natural paragraph. Delivery tags only where the tone really changes (usually on 1 or 2 lines of the film), not on every line.`,
    brief.anonymous ? '- No brand name or logo on screen.' : '- The film ends on the brand (its logo or name) and, when the request has one, the call to action.',
    brief.newMedia.images || brief.newMedia.clips ? `- At most ${brief.newMedia.images} new images and ${brief.newMedia.clips} new clips in the whole film.` : '- No new image or clip can be produced: use the available media, shapes and typography.',
    '- Every new image/clip shows the subject of ITS scene (what the voice line and the texts of that scene talk about), described concretely in the shot — never a generic or decorative picture.',
    '- Visual and motion: specific and buildable (positions, sizes, directions, durations), different from scene to scene, coherent with the bible.',
  ]
    .filter((l) => l !== '')
    .join('\n');
  const user = [
    `REQUEST (verbatim):\n${brief.request.slice(0, 6000)}`,
    `FORMAT: ${formatLine(brief)}`,
    intentLine(brief) ? `INTENT: ${intentLine(brief)}` : '',
    brief.anonymous ? 'BRAND: none' : `BRAND:\n${brief.brandSheet}`,
    specConstraints(brief.spec),
    script ? `CLIENT SCRIPT:\n${scriptLines(brief.spec!)}` : '',
    `MEDIA AVAILABLE:\n${mediaLines(brief)}`,
    brief.reference ? `REFERENCE FILM TO FOLLOW (cuts, rhythm, motion):\n${brief.reference.slice(0, 1500)}` : '',
    concept ? `CONCEPT (from the creative director):\nTITLE: ${concept.title}\nCONCEPT: ${concept.concept}\nBIBLE: ${concept.bible}\n${concept.outline.map((o, i) => `SCENE ${i + 1}: ${o}`).join('\n')}` : '',
    !concept && brief.previous.length ? `FILMS ALREADY MADE FOR THIS BRAND (do something different):\n${brief.previous.slice(0, 6).join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  return { system, user };
}

/** Une réponse est exploitable si elle porte au moins une scène avec une idée visuelle ou de mouvement. */
export const usablePlan = (plan: PlannedFilm) => plan.scenes.some((s) => s.visual || s.motion);

/**
 * Le storyboard ramené à ce que le contrat exige (durées, scénario, faits). Ne refuse jamais une
 * idée : seules les contraintes techniques et la fidélité à la demande sont appliquées, et chaque
 * écart est noté.
 */
export function normalizeStoryboard(plan: PlannedFilm, brief: FilmBrief, concept: FilmConcept | null, timeline?: { start: number; duration: number }[]): Storyboard {
  const fidelity: string[] = [];
  const say = (fr: string, en: string) => (brief.language.startsWith('en') ? en : fr);
  const [, max] = sceneRange(brief.durationSec);
  const script = scripted(brief);
  let scenes = plan.scenes.filter((s) => s.visual || s.motion || Object.keys(s.texts).length);

  if (script) {
    const spec = brief.spec!;
    // Une scène par scène du scénario : celles que le planificateur a oubliées gardent leur description.
    // Les scènes du planificateur retrouvées par leur NUMÉRO (une scène sautée ne décale pas les suivantes).
    const numbered = scenes.every((s) => s.number) && new Set(scenes.map((s) => s.number)).size === scenes.length;
    const byNumber = (i: number) => (numbered ? scenes.find((s) => s.number === i + 1) : scenes[i]);
    scenes = spec.scenes.map((s, i) => {
      const found = byNumber(i);
      const planned = found || { purpose: '', visual: '', motion: '', texts: {}, media: [], needs: [] };
      if (!found) fidelity.push(say(`Scène ${i + 1} : construite à partir de votre description seulement.`, `Scene ${i + 1}: built from your description only.`));
      const texts: Record<string, string> = {};
      s.texts.forEach((t, k) => (texts[k === 0 ? 'headline' : `text${k + 1}`] = t));
      s.props.forEach((t, k) => (texts[`prop${k + 1}`] = t));
      return {
        ...planned,
        purpose: planned.purpose || s.label || '',
        visual: planned.visual || s.description,
        texts,
        ...(s.voice.length ? { voice: s.voice.join(' ') } : {}),
      };
    });
  } else if (scenes.length > max) {
    fidelity.push(say(`${scenes.length - max} scène(s) retirée(s) : ${max} au plus tiennent dans ${brief.durationSec} s.`, `${scenes.length - max} scene(s) dropped: at most ${max} fit in ${brief.durationSec} s.`));
    scenes = [...scenes.slice(0, max - 1), scenes[scenes.length - 1]];
  }

  // Les faits : un nombre absent de la demande ne s'affiche pas, une adresse web non plus.
  const source = `${brief.request}\n${brief.spec?.texts.join('\n') || ''}`;
  scenes = scenes.map((s, i) => {
    const texts: Record<string, string> = {};
    for (const [k, v] of Object.entries(s.texts)) {
      const url = v.match(/\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\/\S*)?/i)?.[0];
      if (!script && (!isGrounded(v, source) || (url && !urlInBrief(url, source)))) {
        fidelity.push(say(`Scène ${i + 1} : le texte « ${v} » n’est pas affiché (chiffre ou adresse absent de votre demande).`, `Scene ${i + 1}: the text "${v}" is not shown (number or address not in your request).`));
        continue;
      }
      texts[k] = v.slice(0, 220);
    }
    const voice = s.voice && (script || isGrounded(s.voice, source)) ? s.voice.slice(0, 400) : undefined;
    if (s.voice && !voice) fidelity.push(say(`Scène ${i + 1} : ligne de voix off retirée (chiffre absent de votre demande).`, `Scene ${i + 1}: voice line removed (number not in your request).`));
    return { ...s, texts, ...(voice ? { voice } : { voice: undefined }) };
  });

  // Les médias cités existent ; les médias à produire tiennent dans les plafonds.
  const known = new Set(brief.media.map((m) => m.id));
  let images = brief.newMedia.images;
  let clips = brief.newMedia.clips;
  scenes = scenes.map((s) => ({
    ...s,
    media: [...new Set(s.media.filter((m) => known.has(m)))],
    needs: s.needs.filter((n) => (n.kind === 'video' ? clips-- > 0 : images-- > 0)),
  }));

  // Les durées : celles du scénario, sinon celles du planificateur, mises à l'échelle de la durée achetée.
  const total = brief.durationSec;
  let durations: number[];
  if (timeline && timeline.length === scenes.length) durations = timeline.map((t) => t.duration);
  else {
    const raw = scenes.map((s) => (s.duration && s.duration > 0 ? s.duration : total / Math.max(1, scenes.length)));
    const floor = Math.min(1.2, total / Math.max(1, scenes.length));
    const sum = raw.reduce((a, b) => a + b, 0) || 1;
    durations = raw.map((d) => Math.max(floor, (d * total) / sum));
    const over = durations.reduce((a, b) => a + b, 0) - total;
    if (over > 0.001) {
      const room = durations.map((d) => Math.max(0, d - floor));
      const roomSum = room.reduce((a, b) => a + b, 0) || 1;
      durations = durations.map((d, i) => d - (over * room[i]) / roomSum);
    }
  }
  let start = 0;
  const placed = scenes.map((s, i) => {
    const at = Math.round(start * 1000) / 1000;
    start += durations[i];
    return { ...s, start: at, duration: Math.round(durations[i] * 1000) / 1000 };
  });
  if (placed.length) {
    const last = placed[placed.length - 1];
    last.duration = Math.round((total - last.start) * 1000) / 1000;
  }
  return {
    title: plan.title || concept?.title || '',
    concept: plan.concept || concept?.concept || '',
    bible: plan.bible || concept?.bible || '',
    scenes: placed,
    fidelity,
  };
}

export async function runPlanner(ctx: FilmCallContext, brief: FilmBrief, concept: FilmConcept | null, timeline?: { start: number; duration: number }[]): Promise<{ storyboard: Storyboard | null; runs: ModelRun[] }> {
  const { system, user } = buildPlannerPrompt(brief, concept);
  const runs: ModelRun[] = [];
  // Une réponse illisible (format) est redemandée une fois, avec le rappel du format : c'est une
  // erreur de forme, pas un jugement sur le contenu.
  for (let attempt = 0; attempt < 2; attempt++) {
    const reminder = attempt ? '\n\nYOUR PREVIOUS ANSWER COULD NOT BE READ. Use exactly the line format: "SCENE 1 | 3.5" then "visual: …", "motion: …" lines.' : '';
    const run = await callFilmModel(ctx, 'video.planner', system, user + reminder, (raw) => usablePlan(parseFilmPlan(raw)));
    runs.push(run);
    const plan = parseFilmPlan(run.raw);
    if (usablePlan(plan)) return { storyboard: normalizeStoryboard(plan, brief, concept, timeline), runs };
    if (run.failure === 'no_model') break;
  }
  return { storyboard: null, runs };
}

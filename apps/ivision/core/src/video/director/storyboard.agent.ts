/**
 * LE PLANIFICATEUR — UN appel pour tout le film (22/11/2026) : l'idée (titre, concept, direction nommée, musique,
 * narrateur) puis le storyboard (rôle, énergie, intention, sujet montré, textes exacts, médias, voix).
 *
 * Avant, quatre appels se succédaient en relisant chacun la demande : le directeur de création (`video.brief`), le
 * concept (`video.concept`), le storyboard, puis le choix dans le catalogue (`video.template`). Le film est assemblé
 * par le CODE depuis le catalogue (mises en page, animations, séquences, développements) : le modèle ne décrit donc
 * plus ni positions, ni tailles, ni courbes, ni transitions — une prose que rien ne lisait. Il décide ce que chaque
 * scène DIT et MONTRE. L'ancien enchaînement reste disponible (`IDEM_VIDEO_CONCEPT=1`, `IDEM_VIDEO_AUTO_BRIEF=1`).
 *
 * Le code ne touche à rien de créatif ; il garantit seulement ce qui est TECHNIQUE ou CONTRACTUEL :
 *   - les durées font la durée achetée (mise à l'échelle) ;
 *   - un scénario écrit par l'utilisateur garde ses scènes, ses textes et sa voix mot pour mot ;
 *   - un nombre absent de la demande (prix, date, numéro) ne s'affiche pas — l'écart est DIT ;
 *   - les médias cités existent ; les médias à produire tiennent dans les plafonds.
 */
import { callFilmModel, FilmCallContext, ModelRun } from '../agents';
import { isGrounded, urlInBrief } from '../request/facts';
import { specConstraints } from '../request/request';
import { wordBudget } from '../audio/voice';
import { BRIEF_MOODS, BRIEF_PERSONAS, BriefMood, BriefPersona } from '../request/enhance';
import { directionMenu } from '../../../../../../packages/motion-compiler/src';
import type { DirectionId } from '../../../../../../packages/motion-compiler/src';
import { FilmConcept, parseConcept } from './concept.agent';
import { FilmBrief, formatLine, intentLine, languageLine, mediaLines, sceneRange, scriptLines, skeletonLine } from './brief';
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
  /** L'idée du film quand le planificateur l'a écrite lui-même (appel unique) : direction nommée, musique, narrateur. */
  direction?: DirectionId;
  alternative?: DirectionId;
  music?: BriefMood;
  persona?: BriefPersona;
  /** La présence des effets sonores décidée par le planificateur (24/11/2026) : le code en tire tous les niveaux. */
  sound?: SoundPresence;
}

export const SOUND_PRESENCES = ['subtle', 'normal', 'punchy'] as const;
export type SoundPresence = (typeof SOUND_PRESENCES)[number];

const scripted = (brief: FilmBrief) => !!brief.spec && brief.spec.mode === 'script' && brief.spec.scenes.length > 0;

/** L'appel unique (sans concept donné) : le planificateur écrit aussi l'idée, la direction, la musique et la voix. */
export function buildPlannerPrompt(brief: FilmBrief, concept: FilmConcept | null): { system: string; user: string } {
  const [min, max] = sceneRange(brief.durationSec);
  const script = scripted(brief);
  const count = script ? `exactly ${brief.spec!.scenes.length} scenes (one per scene of the client's script, same order)` : brief.referenceShots?.length ? `exactly ${brief.referenceShots.length} scenes (one per shot of the client's model, same order)` : concept?.outline.length ? `${Math.min(max, Math.max(min, concept.outline.length))} scenes` : `${min} to ${max} scenes`;
  const canMedia = brief.newMedia.images || brief.newMedia.clips;
  const system = [
    'You plan a short motion-design film for an African business, in ONE answer.',
    'The film is ASSEMBLED BY CODE from a catalogue of animated scene layouts (text reveals, photo and clip frames, big figures, lists, the brand close). The code picks the layouts, the motion and the transitions, and chains consecutive scenes about the same subject (the photo or the figure stays on screen across the cut). So you never describe positions, sizes, easing or transitions: you decide what each scene SAYS and SHOWS.',
    !concept ? 'First the idea of the film (TITLE, CONCEPT, DIRECTION, MUSIC, NARRATOR), then its scenes. Be original and serve the message: the viewer understands what is offered and what to do.' : 'The concept is given: develop it faithfully.',
    '',
    'Output format (plain lines, no JSON, no markdown):',
    'TITLE: a short working title',
    'CONCEPT: the idea of the film in one or two sentences',
    !concept ? `DIRECTION: <direction id>, second: <direction id> — one named visual direction for the whole film:\n${directionMenu()}` : '',
    !concept ? `MUSIC: ${BRIEF_MOODS.join(' | ')}` : '',
    !concept && brief.voice ? `NARRATOR: ${BRIEF_PERSONAS.join(' | ')} (the voice that fits the brand)` : '',
    `SOUND: ${SOUND_PRESENCES.join(' | ')} — how present the sound effects (whooshes on cuts, hits, pops) are in this film: subtle for a calm, premium, emotional or narrated film; punchy for a fast promo, sport, launch or sale; normal otherwise. Follow what the client says about sound.`,
    'SCENE 1 | <seconds>',
    'role: hook | problem | reveal | feature | benefits | proof | cta | signature | statement | data',
    'energy: 1 to 5 — one curve for the film with a single peak (the payoff, around 60–80 % of the film)',
    'purpose: what this scene must make the viewer understand or feel',
    'visual: the concrete subject on screen, in one short line (what the photo, the clip or the figure shows)',
    script ? '' : 'text.<key>: an exact on-screen text (key in lowercase: headline, sub, cta, figure, label…) — one line per text',
    'media: ids of the available media shown in this scene (e.g. m1, m3), or nothing — ONLY a medium whose description shows what this scene says (a scene without a fitting medium asks for a new image or clip)',
    canMedia ? 'new image: <what the photo shows, in English> | <2-4 word search query>   (only if no available medium fits)' : '',
    brief.newMedia.clips ? 'new clip: <what the filmed shot shows, in English> | <2-4 word search query>   (only for continuous physical motion, see rules)' : '',
    'voice: the voice-over line for this scene, as it must be SPOKEN (words + delivery tags, see rules)',
    '',
    'Rules:',
    `- ${count}; durations in seconds add up to ${brief.durationSec}.`,
    script ? '- The on-screen texts are FIXED by the client: do not write text lines, design around them.' : `- On-screen texts in ${languageLine(brief.language)} that SAY something: a headline (up to 8 words) carrying a concrete benefit or fact, and when it helps one supporting line (up to 14 words) with the concrete detail; at most 3 texts per scene. Never an empty slogan ("Discover our brand", "The future is here"). Never invent a price, number, date, address, claim or name that is not in the request.`,
    `- Voice lines in ${languageLine(brief.language)}, natural spoken sentences, about ${Math.round(wordBudget(brief.durationSec / Math.max(1, min + 1), brief.language))} words for a ${Math.round(brief.durationSec / Math.max(1, min + 1))}-second scene. Never invent facts.`,
    `- Voice delivery: ONE narrator with ONE steady tone for the whole film — warm, confident, natural, like a person talking to a friend; never shouting, never hype, no sudden change of energy from one scene to the next. At most ONE delivery tag in the whole film, at the start of the first line, among [warmly], [confident], [reassuring], [calmly]. Mark breaths with "…" or [short pause], questions with "?"; no exclamation marks (one at most in the whole film). Never tags in the client's own words (a fixed script line stays word for word). The lines follow one arc: a hook, a build, a confident close.`,
    '- When a voice line must SAY a web address, a phone number, a code or a figure differently from how the screen WRITES it, write {written|spoken}, e.g. {kora.sn|kora point S N} — the screen keeps the written form, the narrator says the spoken one.',
    `- ONE continuous narration, not one slogan per scene: the lines are read in a single take by one narrator and must flow into each other like a story told to a friend — a line may end on a comma or an open idea that the next scene completes, use connectors (and, but, so, because, then / et, mais, alors, parce que, puis), never restart with the same structure or re-announce the brand in every line.`,
    brief.anonymous ? '- No brand name or logo on screen.' : '- The film ends on the brand (its logo or name) and, when the request has one, the call to action.',
    canMedia ? `- At most ${brief.newMedia.images} new images and ${brief.newMedia.clips} new clips in the whole film.` : '- No new image or clip can be produced: use the available media, shapes and typography.',
    '- Every new image/clip shows the subject of ITS scene (what the voice line and the texts of that scene talk about), described concretely in the shot — never a generic or decorative picture.',
    // L'échelle des médias (leçon d'OpenMotion) : une image fixe animée par la caméra du code avant un clip généré.
    brief.newMedia.clips ? '- A new CLIP only when the shot needs continuous physical motion a still photo cannot carry (people acting, hands at work, liquid, fabric, smoke, vehicles moving). Otherwise ask a new IMAGE: the code moves the camera over it. Never a clip just to look richer.' : '',
    canMedia || brief.media.length ? '- SHOW, do not only tell: at least two scenes out of three are built around a concrete subject (an available medium, or a new image/clip of the product, the place, the customers, the team, the craft). Typography-only scenes are the exception: a short statement or the call to action.' : '',
    '- ONE film, not slides: when two consecutive scenes talk about the same subject, they show the SAME medium (the code keeps it on screen across the cut while the text changes); a figure that proves the previous scene follows it directly.',
    '- When the REQUEST is a production brief with a flow of beats, follow its beats in order (merge or split them to fit the scene count) and keep its subjects to show, its key message and its narration tone.',
    brief.skeleton && !script ? `- Product film skeleton (scale it to the duration, merge or skip beats, keep the order): ${skeletonLine()}. The payoff is the biggest visual moment, once, around 60–80 % of the film.` : '',
    '- The first two seconds are the densest: never open on a logo alone or "Welcome to…"; the brand mark lands once, with weight, at the end.',
    !concept && brief.previousDirections?.length ? `- The previous film of this brand used the direction "${brief.previousDirections[0]}": choose a different one.` : '',
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
    brief.reference ? `REFERENCE FILM TO REPRODUCE (the client's model — write exactly ${brief.referenceShots?.length || 'its'} scenes, scene n = shot n, same role and rhythm; your own texts and media):\n${brief.reference.slice(0, 6000)}` : '',
    concept ? `CONCEPT (from the creative director):\nTITLE: ${concept.title}\nCONCEPT: ${concept.concept}\nBIBLE: ${concept.bible}${concept.direction ? `\nDIRECTION: ${concept.direction}` : ''}${concept.energy?.length ? `\nENERGY: ${concept.energy.join(', ')}` : ''}\n${concept.outline.map((o, i) => `SCENE ${i + 1}: ${o}`).join('\n')}` : '',
    !concept && brief.previous.length ? `FILMS ALREADY MADE FOR THIS BRAND (do something different):\n${brief.previous.slice(0, 6).join('\n')}` : '',
    // Le point de départ tiré par le code (plan qualité créative) : jamais le même pour la marque.
    !concept && !script && !brief.reference && brief.axis ? brief.axis.line : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  return { system, user };
}

/** Une réponse est exploitable si elle porte au moins une scène qui dit ou montre quelque chose. */
export const usablePlan = (plan: PlannedFilm) => plan.scenes.some((s) => s.visual || s.motion || Object.keys(s.texts).length || s.voice);

/** L'idée écrite dans l'appel unique : direction (liste fermée), musique, narrateur — un mot inconnu est ignoré. */
export function parseFilmIdea(raw: string): Pick<Storyboard, 'direction' | 'alternative' | 'music' | 'persona' | 'sound'> {
  const idea = parseConcept(raw);
  const word = (key: string, allowed: readonly string[]) => {
    const line = raw.match(new RegExp(`^[\\s*_#-]*${key}\\s*[:=]\\s*(.+)$`, 'im'))?.[1] ?? '';
    return allowed.find((a) => new RegExp(`\\b${a}\\b`, 'i').test(line));
  };
  const music = word('MUSIC', BRIEF_MOODS) as BriefMood | undefined;
  const persona = word('NARRATOR', BRIEF_PERSONAS) as BriefPersona | undefined;
  const sound = word('SOUND', SOUND_PRESENCES) as SoundPresence | undefined;
  return { ...(idea?.direction ? { direction: idea.direction } : {}), ...(idea?.alternative ? { alternative: idea.alternative } : {}), ...(music ? { music } : {}), ...(persona ? { persona } : {}), ...(sound ? { sound } : {}) };
}

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
  let scenes = plan.scenes.filter((s) => s.visual || s.motion || Object.keys(s.texts).length || s.voice);

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
  } else if (brief.referenceShots?.length) {
    // Le MODÈLE du client : une scène par plan, dans l'ordre. La dernière scène du planificateur (marque, appel)
    // reste la dernière ; chaque scène porte la fiche de son plan, lue telle quelle par l'auteur de la scène.
    const shots = brief.referenceShots;
    const kept = scenes.length > shots.length ? [...scenes.slice(0, shots.length - 1), scenes[scenes.length - 1]] : scenes;
    const empty = (): PlannedScene => ({ purpose: '', visual: '', motion: '', texts: {}, media: [], needs: [] });
    const aligned = kept.length < shots.length ? [...kept.slice(0, -1), ...Array.from({ length: shots.length - kept.length }, empty), ...kept.slice(-1)] : kept;
    scenes = shots.map((shot, i) => {
      const planned = aligned[i] || empty();
      return {
        ...planned,
        visual: [planned.visual, `AS IN THE CLIENT'S MODEL (shot ${i + 1}): ${shot.line}`].filter(Boolean).join('\n'),
        ...(shot.transition && !planned.transition ? { transition: shot.transition } : {}),
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

  // « Montrer, pas seulement dire » tenu par le CODE : un storyboard qui n'a demandé aucun média (le modèle oublie
  // souvent les lignes `new image:`) donnait un film sans une image. Tant qu'il reste de quoi produire, les scènes
  // de récit sans média reçoivent une image de LEUR sujet (sa raison d'être et son visuel), obtenue comme les autres :
  // génération, puis Pexels en repli. L'accroche finale, la signature et une affirmation restent typographiques.
  const shown = (s: PlannedScene) => s.media.length > 0 || s.needs.length > 0;
  const target = Math.ceil((scenes.length * 2) / 3);
  const typographic = (s: PlannedScene, i: number) => /^(cta|signature|statement)$/i.test(s.role ?? '') || (i === scenes.length - 1 && !brief.anonymous);
  let added = 0;
  for (const [i, s] of scenes.entries()) {
    if (scenes.filter(shown).length >= target || images <= 0) break;
    if (shown(s) || typographic(s, i)) continue;
    const shot = sceneShot(s);
    if (!shot) continue;
    s.needs = [{ kind: 'image', shot, query: shotQuery(s) }];
    images--;
    added++;
  }
  if (added) fidelity.push(say(`${added} image(s) ajoutée(s) aux scènes qui n’en montraient aucune.`, `${added} image(s) added to scenes that showed none.`));

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

const SHOT_STOP = new Set(['the', 'and', 'with', 'for', 'from', 'into', 'onto', 'over', 'this', 'that', 'scene', 'viewer', 'understand', 'feel', 'show', 'shows', 'must', 'make', 'their', 'brand', 'text', 'headline', 'screen', 'frame', 'left', 'right', 'top', 'bottom', 'center', 'centre', 'large', 'small']);
const contentWords = (text: string) => text.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 2 && !SHOT_STOP.has(w.toLowerCase()) && !/^\d/.test(w));

/** Ce que l'image d'une scène montre : son visuel décrit (sans les cotes de mise en page), sinon sa raison d'être. */
export function sceneShot(s: PlannedScene): string {
  const visual = s.visual.replace(/\b\d+(?:\.\d+)?\s?(?:px|%|s|ms)\b/gi, '').replace(/\s+/g, ' ').trim();
  const text = [s.purpose, visual].filter(Boolean).join('. ');
  return contentWords(text).length >= 3 ? text.slice(0, 300) : '';
}

/** La recherche de la banque pour cette image : trois mots porteurs de la raison d'être de la scène. */
export function shotQuery(s: PlannedScene): string {
  return contentWords(s.purpose || s.visual).slice(0, 3).join(' ').toLowerCase() || contentWords(s.visual).slice(0, 3).join(' ').toLowerCase();
}

export async function runPlanner(ctx: FilmCallContext, brief: FilmBrief, concept: FilmConcept | null, timeline?: { start: number; duration: number }[]): Promise<{ storyboard: Storyboard | null; runs: ModelRun[] }> {
  const { system, user } = buildPlannerPrompt(brief, concept);
  const runs: ModelRun[] = [];
  // Une réponse illisible (format) est redemandée une fois, avec le rappel du format : c'est une
  // erreur de forme, pas un jugement sur le contenu.
  for (let attempt = 0; attempt < 2; attempt++) {
    const reminder = attempt ? '\n\nYOUR PREVIOUS ANSWER COULD NOT BE READ. Use exactly the line format: "SCENE 1 | 3.5" then "role: …", "visual: …", "text.headline: …" lines.' : '';
    const run = await callFilmModel(ctx, 'video.planner', system, user + reminder, (raw) => usablePlan(parseFilmPlan(raw)));
    runs.push(run);
    const plan = parseFilmPlan(run.raw);
    if (usablePlan(plan)) return { storyboard: { ...normalizeStoryboard(plan, brief, concept, timeline), ...(concept ? (({ sound }) => (sound ? { sound } : {}))(parseFilmIdea(run.raw)) : parseFilmIdea(run.raw)) }, runs };
    if (run.failure === 'no_model') break;
  }
  return { storyboard: null, runs };
}

/**
 * LE FILM D'AUTEUR — les crans High, Max et Ultra de la vidéo : l'IA conçoit et crée tout le film.
 *
 * Aux crans Low et Medium, le code compose avec des menus (concepts, mises en page, transitions) que le
 * graphe a filtrés. Ici, plus aucun menu ; le cran règle les MOYENS, pas la liberté (`AUTHOR_MEANS`) :
 * High = directeur à l'étage de rédaction, un tour de contrôle par plan, pas de critique visuelle ;
 * Max = directeur à l'étage de raisonnement, deux tours, critique visuelle ; Ultra = trois tours.
 *
 *   1. le DIRECTEUR (étage raisonnement) conçoit le film plan par plan — durée, textes, OUTIL du
 *      plan (plan filmé par le générateur vidéo, photo, interface du produit, motion design,
 *      signature), ce qu'on voit et comment ça bouge, passage au plan suivant. Deux cas :
 *        · SCÉNARIO : l'utilisateur a écrit son film scène par scène (video.request.ts). Le
 *          directeur le DÉCOUPE sans rien inventer : mêmes scènes, même ordre, même minutage,
 *          chaque texte à l'écran MOT POUR MOT ; il choisit l'outil de chaque plan et décrit les
 *          plans filmés pour le générateur ;
 *        · LIBRE : sans scénario, il invente le film (concept, bible, plans) avec les mêmes outils.
 *      Le code VALIDE tout : durées et temps de lecture, textes remis à leur place (jamais
 *      réécrits), scène oubliée rajoutée, aucun chiffre absent du brief, plafond de plans filmés ;
 *   2. les MÉDIAS sont produits APRÈS, plan par plan, pour ce que le directeur a décidé (clip
 *      généré, sinon vidéo libre, sinon photo animée ; capture du produit de la marque) ;
 *   3. un CODEUR par plan écrit son composant React avec tout le kit du moteur, le clip ou la
 *      capture du plan au centre (`SceneMedia`, `ScreenFrame`) ;
 *   4. la BOUCLE DE QUALITÉ, trois tours au plus : réparations mécaniques, lint, compilation, rendu
 *      réel mesuré (erreurs, textes visibles et dans le cadre, média visible, mouvement,
 *      déterminisme, chiffres des graphiques), puis CRITIQUE VISUELLE. Un plan qui échoue encore
 *      reprend la composition éprouvée de SON support (plan filmé, interface, typographie).
 */
import sharp from 'sharp';
import type { Page } from 'puppeteer';
import { VideoSceneInstance, VideoStoryboard } from './video.model';
import { agentLines } from '../creativity/agent-io';
import { CreativeOrchestrator } from '../creativity/orchestrator';
import { languageName } from '../text/language';
import { DIRECTION_PITCH } from './video.agents';
import { autoFixSceneCode, compileSceneCode, extractCode, inspectRenderedScene, KIT_NAMES, lintSceneCode, scopedKitManifest, visibleTexts } from './video.coder';
import { BriefFacts, fitLength, isGrounded } from './video.copy';
import { DirectionId } from './video.direction';
import { requiredHold } from './video.rules';
import { inferPatternFromText, isExperimental, kitOfPatterns, PATTERN_BY_ID } from './video.patterns';
import { cleanFootage, normText, RequestSpec, sceneTimeline, SpecMedium } from './video.request';
import { textSlots } from './video.script';

// ─── Le film, tel que le directeur l'écrit ──────────────────────────────────

/** Le type de scène d'un plan : il porte ses cases de texte et sa composition de repli. */
export type ShotKind = 'statement' | 'cta' | 'logo' | 'footage' | 'screen' | 'kinetic';

/** Le support d'un plan, donc l'outil qui le produit : ceux du scénario, plus la photo (générée ou trouvée, animée). */
export type ShotMedium = SpecMedium | 'photo';
export const SHOT_MEDIA: ShotMedium[] = ['footage', 'photo', 'screen', 'motion', 'logo'];

const SURFACES = ['light', 'primary', 'secondary', 'accent', 'tint', 'deep'] as const;
type Surface = (typeof SURFACES)[number];

export interface AuthoredShot {
  kind: ShotKind;
  duration: number;
  /** Cases de texte de la scène (`title`, `sub` ; `action`, `contact` ; `tagline`, `url` ; `l1`…`l4`). */
  slots: Record<string, string>;
  /** Ce qu'on voit et comment ça bouge : la consigne du codeur. */
  visual: string;
  /** Média de la liste (1…n) : photo ou capture de la marque, import de l'utilisateur. */
  media?: number;
  /** Le passage au plan suivant. */
  handoff?: string;
  surface?: Surface;
  /** Le motif nommé par le directeur dans l'univers créatif (video.patterns.ts). */
  pattern?: string;
  /** Chemin d'exploration : une combinaison de briques du kit que le directeur invente (« Flat3D+FlowField »). */
  explore?: string[];
  /** Le support du plan (l'outil qui le produit). Absent : motion design (films d'avant les supports). */
  medium?: ShotMedium;
  /** La scène du scénario (0…) que ce plan raconte. */
  scene?: number;
  /** Plan filmé ou photo : ce que le générateur doit montrer (anglais), et la requête de banque. */
  footage?: string;
  query?: string;
  /** Interface : les textes montrés DANS l'écran (saisie, dossier), mot pour mot. */
  props?: string[];
}

export interface AuthoredFilm {
  title: string;
  concept: string;
  /** Signature de mouvement, usage des couleurs, attitude typographique. */
  bible: string;
  /** Le personnage récurrent et la lumière des plans filmés (même personne d'un plan à l'autre). */
  cast?: string;
  look?: string;
  shots: AuthoredShot[];
  /** Ce que la validation a remis d'aplomb (textes replacés, scène rajoutée, plans filmés en trop…). */
  repairs?: string[];
}

/** Ce que le moteur sait faire, dit au directeur (il imagine dans ce champ, sans menu). */
export const AUTHOR_TOOLS = [
  'FILMED SHOTS made by our AI video generator — people, places, real gestures (describe them in FOOTAGE; the same person keeps the same look from shot to shot)',
  'the brand\'s REAL product interface: a screenshot from MEDIA in a browser window that loads and slowly pushes in, or an interface drawn by the engine with the client\'s own words (a request being typed, a folder and its files)',
  'motion design ON TOP of a filmed shot, a photo or a screen: titles, lines and shapes that interact with the image',
  'kinetic typography (twenty-four text techniques, always fitted to the frame)',
  'animated charts (bars, lines, rings, radar, treemap, sankey) and gauges — ONLY with the numbers of the FACTS',
  'a map of Africa lighting up the countries or cities named in the text',
  'hand-drawn sketches (circles, frames, arrows, underlines), brush strokes, organic flow fields, colour mosaics',
  'flat 3D objects (boxes, rings, spheres, cylinders) without heavy 3D',
  'seeded particles (drifting dust, rising embers, confetti, a burst from a point, dust converging, a headline dissolving into dust)',
  'living backgrounds in shaders (aurora, satin, plasma, ink in water, mesh gradient, contour lines, waves, metaballs), a sliding gradient, a network of linked points',
  'effects on a photo (RGB split, shockwave, bulge, twist, zoom blur, pixel reveal, glitch, liquid ripple, old TV)',
  'refractive liquid glass over the scene, shapes that morph into others, icons and brand logos as SVG that draw, assemble, pop or morph',
  'the brand logo, animated (drawn, assembled, wiped…), and line icons',
  'sound cues synced to the motion, and the beat of the music',
].join('; ');

export interface DirectorInput {
  brief: { message: string; details?: string; objective?: string };
  /** La demande complète : le seul endroit d'où un chiffre peut venir. */
  briefText: string;
  facts: BriefFacts;
  sheet: string;
  direction: DirectionId;
  durationSec: number;
  formats: string[];
  /** Nombre de plans, signature comprise. */
  range: [number, number];
  /** Les médias disponibles AVANT le film (photos et captures de la marque, imports), décrits, numérotés à partir de 1. */
  media: string[];
  brandName: string;
  language: string;
  recentConcepts?: string[];
  /** L'univers créatif (video.planner.ts#creativeUniverse) : motifs, sous-explorés, combinaisons, ADN. */
  universe?: string;
  /** Le film modèle à reproduire (reference/reference.plan.ts#blueprintForDirector). */
  reference?: string;
  /** Le cahier des charges de la demande ; en mode `script`, le film de l'utilisateur à découper. */
  script?: RequestSpec;
  /** Le minutage des scènes du scénario dans la durée achetée (video.request.ts#sceneTimeline). */
  timeline?: { start: number; duration: number }[];
  /** Les consignes de l'utilisateur (video.request.ts#specConstraints). */
  constraints?: string;
  /** Plans filmés que la vidéo peut porter (plafond de clips générés ; 0 : aucun). */
  maxFootage?: number;
}

/** Les faits chiffrés autorisés, une ligne : le directeur n'en écrit pas d'autres. */
export function factsLine(f: BriefFacts): string {
  const parts = [
    ...f.prices.map((v) => `price ${v}`),
    ...f.percents.map((v) => `percent ${v}`),
    ...f.stats.map((s) => `${s.value} ${s.label}`.trim()),
    ...f.dates.map((v) => `date ${v}`),
    ...f.times.map((v) => `time ${v}`),
    ...f.phones.map((v) => `phone ${v}`),
    ...f.urls.map((v) => `site ${v}`),
    ...f.places.map((v) => `place ${v}`),
  ];
  return parts.length ? parts.slice(0, 24).join(' · ') : 'none — write no figure at all';
}

const scriptOf = (input: Pick<DirectorInput, 'script'>) => (input.script?.mode === 'script' && input.script.scenes.length >= 2 ? input.script : undefined);

/** Le scénario de l'utilisateur, tel que le directeur le reçoit. */
export function scriptBlock(script: RequestSpec, timeline: { start: number; duration: number }[]): string {
  const lines = ['SCRIPT — written by the client. Follow it: these scenes, in this order, in these time windows.'];
  script.scenes.forEach((s, k) => {
    const t = timeline[k];
    lines.push(`SCENE ${k + 1} · ${t.start.toFixed(1)}–${(t.start + t.duration).toFixed(1)} s (${t.duration.toFixed(1)} s)${s.label ? ` · ${s.label}` : ''} · suggested tools: ${s.media.join(', ')}`);
    if (s.description) lines.push(`  what happens: ${s.description.slice(0, 700)}`);
    if (s.texts.length) lines.push(`  ON-SCREEN TEXTS (verbatim, in order): ${s.texts.map((x) => `«${x}»`).join(' ')}`);
    else lines.push('  ON-SCREEN TEXTS: none');
    if (s.props.length) lines.push(`  texts INSIDE the interface (not titles): ${s.props.map((x) => `«${x}»`).join(' ')}`);
    if (s.voice.length) lines.push(`  voice-over (client's words): ${s.voice.map((x) => `«${x}»`).join(' ')}`);
  });
  return lines.join('\n');
}

export function buildDirectorPrompt(input: DirectorInput): { system: string; user: string } {
  const [min, max] = input.range;
  const lang = languageName(input.language);
  const script = scriptOf(input);
  const footageCap = Math.max(0, input.maxFootage ?? 4);
  const system = [
    input.reference
      ? 'You are the creative director AND author of a short professional brand film. The client gave a REFERENCE FILM: reproduce its animation shot by shot (same number of shots, same timing, same composition, same motion and transitions) with THIS brand, its own texts and its own media. Never copy the reference texts.'
      : script
        ? 'You are the director of a professional brand film. The client WROTE THE FILM scene by scene: you do not invent the story. You cut each scene into shots, choose the right TOOL for every shot, and describe precisely how each shot looks and moves — like a film crew and a motion design studio working together.'
        : 'You are the creative director AND author of a short professional brand film. Invent an ORIGINAL film — not a template: a concept, a visual language, and every shot.',
    'Every shot is made with ONE tool, its MEDIUM: footage = a filmed live-action shot made by our AI video generator (people, places, real gestures) · photo = a photograph, generated or found, animated · screen = the brand\'s product interface (a screenshot from MEDIA, or an interface drawn by the engine with the client\'s words) · motion = pure motion design · logo = the brand signature. Motion design also lives ON TOP of footage, photo and screen shots.',
    `Motion designers code each shot from your notes, with these tools: ${AUTHOR_TOOLS}.`,
    'RULES',
    script
      ? `- Follow the SCRIPT exactly: every scene, in order, inside its time window; 1 to 3 shots per scene; the shots of a scene add up to its duration; total EXACTLY ${input.durationSec} s. Never add a scene, a text or a feature the script does not have.`
      : `- ${min} to ${max} shots, total EXACTLY ${input.durationSec} s.`,
    '- Each shot 1.6–8 s and long enough to read its text (about 3 words per second + 0.8 s); a long scene gets several shots.',
    script
      ? '- Every ON-SCREEN TEXT of a scene appears exactly once, VERBATIM (same words, same punctuation, same language), on a TEXT line of one of the shots of THAT scene, in the script\'s order. A shot may carry no text. Texts INSIDE the interface are not titles: they belong to the screen shot.'
      : `- Few words, written in ${lang}. Per shot: TITLE (≤ 60 characters) and optional SUB (≤ 80). The call to action shot adds ACTION (button, ≤ 26) and CONTACT copied from the brief.`,
    `- People, places or real actions → medium footage, described in FOOTAGE (English, for a video model: subject, action, setting, framing, camera move, light; no text, no logo, no readable screen). At most ${footageCap} footage shots${footageCap === 0 ? ' — none for this film: use photo, screen or motion' : ''}; beyond, use photo.`,
    '- An interface moment (a website, an app, a folder, someone typing) → medium screen: name the MEDIA screenshot that fits (SCREEN: n), or SCREEN: none and the engine draws it with the client\'s words — never a fake dashboard full of invented numbers.',
    '- Figures: ONLY those of FACTS, exactly as written. Never invent a number, a price, a date, a percentage.',
    script ? '- The script\'s final scene stays the signature when it shows the logo (medium logo, its texts on TEXT lines).' : '- The LAST shot is the SIGNATURE: the brand logo, with an optional TAGLINE (≤ 48).',
    '- TOOLBOX FIRST: describe each VISUAL with the tools above. Anything the toolbox already does (a living background, a photo effect, glass, a morph, particles, animated icons, a chart) must be NAMED with its tool — never described as a custom abstract drawing.',
    '- Every shot has its own composition idea; plan how each shot hands over to the next, motivated by a gesture, the cursor, the screen or a line that carries on.',
    '- True to the brand charter and its art direction, and to every CLIENT constraint (who appears, what to avoid).',
    'OUTPUT EXACTLY this format, nothing else:',
    `FILM: <title, in ${lang}>`,
    'CONCEPT: <one sentence>',
    'BIBLE: <motion signature, colour use, typography attitude — two sentences>',
    'CAST: <English: the recurring person(s) of the filmed shots — age, skin tone, hair, clothes — or none>',
    'LOOK: <English: light, lens, colour palette of the filmed shots>',
    `SHOT 1 | 4.5s | surface: deep | ${script ? 'scene: 1 | ' : ''}medium: footage`,
    'FOOTAGE: <footage and photo shots only>',
    'QUERY: <footage and photo shots only: 2–4 English words to find a similar clip or photo in a stock library>',
    script ? 'TEXT: <one on-screen text of this scene, verbatim — one TEXT line per text; no TEXT line if none>' : 'TITLE: …\nSUB: …',
    'SCREEN: <screen shots only: n from MEDIA, or none>',
    'VISUAL: <what we see and how it moves, which tools; on footage/photo/screen shots, what moves ON TOP of the image>',
    'MEDIA: <n of a MEDIA photo to show, or none>',
    ...(input.universe ? ['PATTERN: <one id from CREATIVE UNIVERSE, or "explore A+B" to combine engine tools in a new way>'] : []),
    'HANDOFF: <how it hands over to the next shot>',
    `SHOT 2 | 3s | surface: light | ${script ? 'scene: 1 | ' : ''}medium: motion`,
    '…',
    `SHOT N | 5s | surface: deep | ${script ? `scene: ${script.scenes.length} | ` : ''}medium: logo`,
    'SIGNATURE: yes',
    script ? 'TEXT: <each signature text of the script, verbatim, one per line>' : 'TAGLINE: …',
    'VISUAL: …',
    `Surfaces: ${SURFACES.join(', ')} (background colour of the shot, from the charter).`,
  ].join('\n');
  const timeline = script ? input.timeline || sceneTimeline(script, input.durationSec) : [];
  const user = [
    input.sheet,
    `MOTION DIRECTION: ${DIRECTION_PITCH[input.direction]}`,
    `BRAND: ${input.brandName}`,
    `LANGUAGE OF THE FILM: ${lang}`,
    input.constraints || '',
    script ? scriptBlock(script, timeline) : `REQUEST: ${input.brief.message}`,
    !script && input.brief.details ? `DETAILS: ${input.brief.details}` : '',
    input.brief.objective ? `OBJECTIVE: ${input.brief.objective}` : '',
    `FACTS (the only figures allowed): ${factsLine(input.facts)}`,
    `MEDIA: ${input.media.length ? input.media.map((m, i) => `#${i + 1} ${m}`).join(' · ') : 'none — screens are drawn by the engine, the rest is filmed or designed'}`,
    `DURATION: ${input.durationSec} s · FORMATS: ${input.formats.join(', ')}`,
    !input.reference && !script && input.recentConcepts?.length ? `RECENT FILMS OF THIS BRAND (do something different): ${input.recentConcepts.slice(-3).join(' / ')}` : '',
    input.reference || input.universe || '',
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Temps minimal d'un plan : la règle de lecture du moteur (`video.rules.ts#requiredHold` : entrée,
 * 3 mots/s, un chiffre compte pour un mot, un souffle) ; 2,2 s pour la signature.
 */
export function minDuration(shot: Pick<AuthoredShot, 'kind' | 'slots'>): number {
  if (shot.kind === 'logo') return 2.2;
  return requiredHold(shot.slots, shot.kind, 0.5);
}

/** Les durées : les envies du directeur, au moins le temps de lecture, somme = durée achetée. */
export function fitDurations(shots: AuthoredShot[], total: number): AuthoredShot[] | null {
  const mins = shots.map(minDuration);
  if (mins.reduce((a, b) => a + b, 0) > total + 0.05) return null;
  let wish = shots.map((sh, i) => Math.min(8, Math.max(mins[i], sh.duration || mins[i])));
  // Ajuste les plans qui ont du jeu jusqu'à tomber juste.
  for (let pass = 0; pass < 6; pass++) {
    const sum = wish.reduce((a, b) => a + b, 0);
    const gap = total - sum;
    if (Math.abs(gap) < 0.05) break;
    const free = wish.map((w, i) => (gap > 0 ? 8 - w : w - mins[i]));
    const room = free.reduce((a, b) => a + Math.max(0, b), 0);
    if (room <= 0) break;
    wish = wish.map((w, i) => w + (gap * Math.max(0, free[i])) / room);
  }
  // Ce que les plans ne peuvent plus prendre (8 s au plus chacun) se répartit sur tous.
  const left = total - wish.reduce((a, b) => a + b, 0);
  if (left > 0.05) wish = wish.map((w) => w + left / wish.length);
  const rounded = wish.map(round1);
  const drift = total - rounded.reduce((a, b) => a + b, 0);
  rounded[rounded.length - 1] = round1(rounded[rounded.length - 1] + drift);
  if (rounded.some((d, i) => d < mins[i] - 0.11 || d <= 0)) return null;
  return shots.map((sh, i) => ({ ...sh, duration: rounded[i] }));
}

/** Une case : bornée, sans chiffre absent du brief. */
function cleanSlot(value: string | undefined, max: number, briefText: string): string | undefined {
  const v = (value || '').replace(/^["«“]+|["»”]+$/g, '').trim();
  if (!v || /^(none|n\/a|-)$/i.test(v)) return undefined;
  if (!isGrounded(v, briefText)) return undefined;
  return fitLength(v, max) || undefined;
}

/** Les textes d'une ligne TEXT (« « A » « B » », « A / B ») : sans guillemets, un par élément. */
function textsOfLine(value: string): string[] {
  const quoted = [...value.matchAll(/«\s*([^«»]+?)\s*»|“([^“”]+)”|"([^"]+)"/g)].map((m) => (m[1] ?? m[2] ?? m[3] ?? '').trim()).filter(Boolean);
  if (quoted.length) return quoted;
  const v = value.replace(/^["«“'\s]+|["»”'\s]+$/g, '').trim();
  if (!v || /^(none|aucun|n\/a|-)$/i.test(v)) return [];
  return [v];
}

/** Ressemblance de deux textes (mots en commun, coefficient de Dice) : un texte à peine retouché se reconnaît. */
function likeness(a: string, b: string): number {
  const words = (s: string) => normText(s).replace(/[^\p{L}\p{N}' ]+/gu, ' ').split(/\s+/).filter(Boolean);
  const x = words(a);
  const y = words(b);
  if (!x.length || !y.length) return 0;
  const pool = [...y];
  let common = 0;
  for (const w of x) {
    const at = pool.indexOf(w);
    if (at >= 0) {
      common++;
      pool.splice(at, 1);
    }
  }
  return (2 * common) / (x.length + y.length);
}

const wordsIn = (t: string) => t.split(/\s+/).filter(Boolean).length;

/** Le type de scène d'un plan selon son support et ses textes. */
function kindOf(medium: ShotMedium | undefined, texts: string[], fallback: ShotKind): ShotKind {
  if (medium === 'logo') return 'logo';
  if (medium === 'footage' || medium === 'photo') return 'footage';
  if (medium === 'screen') return 'screen';
  if (medium === 'motion') return texts.length >= 3 && texts.every((t) => wordsIn(t) <= 3) ? 'kinetic' : fallback === 'cta' ? 'cta' : 'statement';
  return fallback;
}

/** Le film écrit par le directeur, validé ; `undefined` s'il est inutilisable. */
export function parseFilm(raw: string, input: DirectorInput): AuthoredFilm | undefined {
  const text = (raw || '').replace(/\r/g, '').replace(/\*\*/g, '');
  const head = agentLines(text.split(/^\s*SHOT\s*\d+/im)[0] || '');
  const marks = [...text.matchAll(/^\s*SHOT\s*(\d+)\s*[|:,.\-–—]?\s*([\d.,]+)?\s*s?\b([^\n]*)$/gim)];
  if (!marks.length) return undefined;
  const script = scriptOf(input);
  const lowerBrief = input.briefText.toLowerCase();
  const shots: AuthoredShot[] = [];
  const repairs: string[] = [];
  let lastScene = 0;
  marks.forEach((m, i) => {
    const block = text.slice((m.index ?? 0) + m[0].length, marks[i + 1]?.index ?? text.length);
    const l = agentLines(block);
    const header = m[3] || '';
    const surface = header.match(/surface\s*[:=]\s*([a-z]+)/i)?.[1]?.toLowerCase() as Surface | undefined;
    const mediumSaid = (header.match(/medium\s*[:=]\s*([a-z]+)/i)?.[1] || l.medium || '').toLowerCase();
    let medium = (SHOT_MEDIA as string[]).includes(mediumSaid) ? (mediumSaid as ShotMedium) : undefined;
    const lineTexts = [...block.matchAll(/^\s*[-*_>]*\s*TEXTS?\s*[:=]\s*(.+)$/gim)].flatMap((x) => textsOfLine(x[1]));
    const isLast = i === marks.length - 1;
    const signature = medium === 'logo' || /^(yes|oui|true)/i.test(l.signature || '') || (isLast && !l.title && !lineTexts.length && !!(l.tagline || /logo/i.test(l.visual || '')));
    if (signature) medium = 'logo';
    const action = cleanSlot(l.action, 26, input.briefText);
    const contactRaw = cleanSlot(l.contact, 40, input.briefText);
    // Un contact n'est jamais inventé : il figure tel quel dans le brief.
    const contact = contactRaw && lowerBrief.includes(contactRaw.toLowerCase().replace(/\s+/g, ' ').slice(0, 12)) ? contactRaw : undefined;
    const footage = cleanFootage(l.footage || '', 420);
    const query = cleanFootage(l.query || '', 48).split(/\s+/).slice(0, 5).join(' ');
    const mediaNo = Number((l.media || '').match(/\d+/)?.[0]);
    const screenNo = Number((l.screen || '').match(/\d+/)?.[0]);
    const pick = (n: number) => (n >= 1 && n <= input.media.length ? n : undefined);
    const said = (l.pattern || '').trim();
    const exploreNames = /^explore\b/i.test(said) ? said.replace(/^explore\W*/i, '').split(/[+,&]|\band\b/).map((n) => n.trim()).filter((n) => KIT_NAMES.has(n)) : [];
    const named = said.match(/[A-Za-z][A-Za-z0-9]+/g)?.find((w) => PATTERN_BY_ID.has(w));
    const pattern = named || (exploreNames.length ? undefined : inferPatternFromText(l.visual || '')[0]);
    const base: Omit<AuthoredShot, 'kind' | 'slots'> = {
      duration: Number(String(m[2] || '').replace(',', '.')) || 0,
      visual: (l.visual || '').slice(0, 700),
      ...(pick(medium === 'screen' ? screenNo || mediaNo : mediaNo) ? { media: pick(medium === 'screen' ? screenNo || mediaNo : mediaNo) } : {}),
      ...(l.handoff ? { handoff: l.handoff.slice(0, 200) } : {}),
      ...(surface && (SURFACES as readonly string[]).includes(surface) ? { surface } : {}),
      ...(signature ? {} : pattern ? { pattern } : {}),
      ...(!signature && exploreNames.length >= 2 ? { explore: exploreNames.slice(0, 4) } : {}),
      ...(medium ? { medium } : {}),
      ...((medium === 'footage' || medium === 'photo') && footage.split(/\s+/).length >= 4 ? { footage } : {}),
      ...((medium === 'footage' || medium === 'photo') && query ? { query } : {}),
    };

    if (script) {
      // Le plan raconte une scène du scénario : celle qu'il nomme, sinon celle de ses textes, sinon la précédente.
      const said = Number(header.match(/scene\s*[:=#]?\s*(\d{1,2})/i)?.[1] || (l.scene || '').match(/\d+/)?.[0]);
      let k = said >= 1 && said <= script.scenes.length ? said - 1 : -1;
      if (k < 0) k = script.scenes.findIndex((s) => lineTexts.some((t) => s.texts.some((x) => likeness(x, t) >= 0.8)));
      if (k < 0) k = signature ? script.scenes.length - 1 : lastScene;
      if (k < lastScene) {
        repairs.push(`plan ${i + 1} : scène ${k + 1} remise dans l'ordre`);
        k = lastScene;
      }
      lastScene = k;
      // Les textes : ceux de SA scène, mot pour mot (un texte à peine retouché reprend sa forme exacte).
      const own = script.scenes[k].texts;
      const kept: string[] = [];
      for (const t of lineTexts) {
        const best = own.map((x) => ({ x, score: likeness(x, t) })).sort((a, b) => b.score - a.score)[0];
        if (best && best.score >= 0.75) kept.push(best.x);
        else repairs.push(`plan ${i + 1} : texte « ${t.slice(0, 40)} » absent du scénario, retiré`);
      }
      shots.push({ ...base, scene: k, kind: 'statement', slots: {}, visual: base.visual || script.scenes[k].description.slice(0, 400), _texts: kept } as AuthoredShot & { _texts: string[] });
      return;
    }

    // Film libre : titre et sous-titre du directeur, bornés et sans chiffre inventé.
    let slots: Record<string, string>;
    let kind: ShotKind;
    if (signature) {
      kind = 'logo';
      slots = {};
      const tagline = cleanSlot(l.tagline || l.title || lineTexts[0], 48, input.briefText);
      if (tagline) slots.tagline = tagline;
      const url = (l.url || '').trim();
      if (url && lowerBrief.includes(url.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, ''))) slots.url = url;
    } else {
      const title = cleanSlot(l.title || lineTexts[0], 60, input.briefText) || cleanSlot(l.sub, 60, input.briefText);
      if (!title && medium !== 'footage' && medium !== 'photo' && medium !== 'screen') return; // un plan sans texte ni image ne se replie pas proprement : écarté
      const sub = cleanSlot(l.sub || lineTexts[1], 80, input.briefText);
      kind = kindOf(medium, [], action ? 'cta' : 'statement');
      if (kind === 'cta' || (action && kind === 'statement')) {
        kind = 'cta';
        slots = { title: title || '', action: action!, ...(contact ? { contact } : {}) };
      } else slots = { ...(title ? { title } : {}), ...(sub && sub !== title ? { sub } : {}) };
    }
    shots.push({ ...base, kind, slots });
  });

  if (script) return finishScriptFilm(shots as (AuthoredShot & { _texts: string[] })[], input, script, head, repairs);

  // La signature : une seule, à la fin.
  const body = shots.filter((sh) => sh.kind !== 'logo');
  const signature = shots.filter((sh) => sh.kind === 'logo').pop() || { kind: 'logo' as const, duration: 2.4, slots: {}, visual: 'The brand logo resolves in the centre, calm and confident.', medium: 'logo' as const };
  const [, max] = input.range;
  let kept = capFootage(body.slice(0, Math.max(1, max - 1)), input.maxFootage ?? 4, repairs);
  if (!kept.length || kept.some((sh) => !sh.visual)) return undefined;
  // Le temps de lecture passe avant le nombre de plans : un film trop dense perd ses derniers
  // plans de contenu (jamais la signature) plutôt que d'être refusé en entier.
  let timed = fitDurations([...kept, signature], input.durationSec);
  while (!timed && kept.length > 1) {
    // Un plan du milieu s'en va : l'ouverture et l'appel à l'action restent.
    let drop = -1;
    for (let k = kept.length - 1; k >= 1; k--) if (kept[k].kind === 'statement') {
      drop = k;
      break;
    }
    kept = kept.filter((_, k) => k !== (drop >= 0 ? drop : kept.length - 1));
    timed = fitDurations([...kept, signature], input.durationSec);
  }
  if (!timed) return undefined;
  return {
    title: (head.film || head.title || input.brief.message).slice(0, 80),
    concept: (head.concept || '').slice(0, 300),
    bible: (head.bible || '').slice(0, 400),
    ...castAndLook(head),
    shots: timed,
    ...(repairs.length ? { repairs } : {}),
  };
}

function castAndLook(head: Record<string, string>): { cast?: string; look?: string } {
  const cast = cleanFootage(head.cast || '', 300);
  const look = cleanFootage(head.look || '', 240);
  return { ...(cast && !/^none\b/i.test(cast) ? { cast } : {}), ...(look && !/^none\b/i.test(look) ? { look } : {}) };
}

/** Au-delà du plafond de clips, un plan filmé devient une photo (générée ou trouvée, animée). */
function capFootage(shots: AuthoredShot[], cap: number, repairs: string[]): AuthoredShot[] {
  let filmed = 0;
  return shots.map((sh, i) => {
    if (sh.medium !== 'footage') return sh;
    filmed++;
    if (filmed <= cap) return sh;
    repairs.push(`plan ${i + 1} : plan filmé au-delà du plafond (${cap}), devenu une photo`);
    return { ...sh, medium: 'photo' };
  });
}

/**
 * Le film d'un SCÉNARIO, remis d'aplomb : chaque scène a au moins un plan (une scène oubliée est
 * rajoutée telle que l'utilisateur l'a écrite), chaque texte est à l'écran une fois, mot pour mot,
 * dans l'ordre, sur un plan de SA scène ; chaque scène dure le temps du scénario.
 */
function finishScriptFilm(raw: (AuthoredShot & { _texts: string[] })[], input: DirectorInput, script: RequestSpec, head: Record<string, string>, repairs: string[]): AuthoredFilm | undefined {
  const timeline = input.timeline || sceneTimeline(script, input.durationSec);
  const out: AuthoredShot[] = [];
  const cap = Math.max(0, input.maxFootage ?? 4);
  script.scenes.forEach((scene, k) => {
    let own = raw.filter((sh) => sh.scene === k);
    if (!own.length) {
      // La scène oubliée : un plan, son premier support, ses textes, ce que l'utilisateur a écrit.
      const medium: ShotMedium = scene.media[0] === 'logo' ? 'logo' : scene.media[0] || 'motion';
      own = [{ kind: 'statement', duration: timeline[k].duration, slots: {}, visual: scene.description.slice(0, 500) || 'As the script says.', scene: k, medium, ...(medium === 'footage' ? { footage: cleanFootage(scene.footage || scene.description, 420) } : {}), _texts: [] }];
      repairs.push(`scène ${k + 1} absente du découpage : ajoutée telle qu'écrite`);
    }
    // Les textes dans l'ordre du scénario : chaque plan garde le nombre de textes que le directeur lui a donnés.
    const expected = scene.texts;
    const placed = own.flatMap((sh) => sh._texts.map((t) => expected.findIndex((x) => normText(x) === normText(t))));
    const unique = placed.filter((v, i) => v >= 0 && placed.indexOf(v) === i);
    const ordered = unique.every((v, i) => i === 0 || v > unique[i - 1]);
    const counts = own.map((sh) => sh._texts.length);
    if (!ordered || unique.length !== placed.length) {
      repairs.push(`scène ${k + 1} : textes remis dans l'ordre du scénario`);
      let at = 0;
      own.forEach((sh, j) => {
        sh._texts = expected.slice(at, at + counts[j]);
        at += counts[j];
      });
    }
    // Les textes oubliés : sur le plan de la scène qui suit leur prédécesseur (ou le dernier plan qui peut porter un texte).
    const missing = expected.filter((t) => !own.some((sh) => sh._texts.some((x) => normText(x) === normText(t))));
    for (const t of missing) {
      const idx = expected.indexOf(t);
      const before = own.findIndex((sh) => sh._texts.some((x) => expected.indexOf(x) === idx - 1));
      const empty = own.findIndex((sh, j) => j >= Math.max(0, before) && !sh._texts.length && sh.medium !== 'logo');
      const target = empty >= 0 ? empty : before >= 0 ? before : own.length - 1;
      own[target]._texts = [...own[target]._texts, t].sort((a, b) => expected.indexOf(a) - expected.indexOf(b));
      repairs.push(`scène ${k + 1} : texte « ${t.slice(0, 40)} » replacé`);
    }
    // La signature du scénario (son logo) ; sinon un plan sans support déclaré prend le premier de la scène.
    for (const sh of own) {
      if (!sh.medium) sh.medium = scene.media[0] === 'logo' ? 'logo' : sh._texts.length && !sh.footage ? 'motion' : scene.media[0] || 'motion';
      if (sh.medium === 'footage' && !sh.footage) sh.footage = cleanFootage(scene.footage || scene.description, 420);
      if (sh.medium === 'screen' && scene.props.length) sh.props = scene.props;
      sh.kind = kindOf(sh.medium, sh._texts, 'statement');
      sh.slots = textSlots(sh.kind, sh._texts, input.brandName);
    }
    // Le temps de la scène, partagé entre ses plans (temps de lecture d'abord).
    const timed = fitDurations(own, timeline[k].duration) || own.map((sh) => ({ ...sh, duration: round1(timeline[k].duration / own.length) }));
    const sum = timed.reduce((a, sh) => a + sh.duration, 0);
    timed[timed.length - 1] = { ...timed[timed.length - 1], duration: round1(timed[timed.length - 1].duration + timeline[k].duration - sum) };
    out.push(...timed.map(({ _texts: _t, ...sh }: AuthoredShot & { _texts?: string[] }) => sh));
  });
  // Le total exact (arrondis), sur le dernier plan.
  const total = out.reduce((a, sh) => a + sh.duration, 0);
  if (out.length) out[out.length - 1].duration = round1(out[out.length - 1].duration + input.durationSec - total);
  const shots = capFootage(out, cap, repairs);
  if (!shots.length || shots.some((sh) => sh.duration <= 0.3)) return undefined;
  return {
    title: (head.film || head.title || script.title || input.brief.message).slice(0, 80),
    concept: (head.concept || '').slice(0, 300),
    bible: (head.bible || '').slice(0, 400),
    ...castAndLook(head),
    shots,
    ...(repairs.length ? { repairs } : {}),
  };
}

// ─── Le codeur d'un plan ────────────────────────────────────────────────────

export interface ShotBrief {
  /** Le plan correspondant de la vidéo modèle : ce qu'il faut reproduire. */
  reference?: string;
  film: AuthoredFilm;
  shot: AuthoredShot;
  index: number;
  sheet: string;
  direction: DirectionId;
  formats: string[];
  hasImage: boolean;
  /** Le clip filmé du plan (généré ou trouvé). */
  hasVideo?: boolean;
  /** Les textes DANS l'interface (plan d'écran), lus dans `s.props`. */
  props?: string[];
  /** Les consignes de l'utilisateur (qui apparaît, ce qu'il faut éviter). */
  constraints?: string;
}

/**
 * Les briques du kit qu'un plan appelle : celles de son motif, de son exploration, et celles que
 * sa consigne nomme. `undefined` (manifeste complet) si rien n'est reconnu.
 */
export function shotKit(shot: Pick<AuthoredShot, 'kind' | 'pattern' | 'explore' | 'visual' | 'medium'>): string[] | undefined {
  const inferred = inferPatternFromText(shot.visual);
  const names = [...(shot.explore || []), ...kitOfPatterns([...(shot.pattern ? [shot.pattern] : []), ...inferred])];
  if (shot.kind === 'logo') names.push('LogoMotion');
  if (shot.medium === 'footage' || shot.medium === 'photo') names.push('SceneMedia');
  if (shot.medium === 'screen') names.push('ScreenFrame', 'TypedPrompt', 'FileList');
  return names.length ? [...new Set(names)] : undefined;
}

/** Un plan qui explore (combinaison inventée, ou motif expérimental) passe une validation renforcée. */
export function isExploratoryShot(shot: Pick<AuthoredShot, 'pattern' | 'explore'>, direction: DirectionId): boolean {
  if (shot.explore?.length) return true;
  const p = shot.pattern ? PATTERN_BY_ID.get(shot.pattern) : undefined;
  return !!p && isExperimental(p, direction);
}

export function buildShotPrompt(b: ShotBrief): { system: string; user: string } {
  const prev = b.index > 0 ? b.film.shots[b.index - 1] : undefined;
  // Le codeur ne reçoit que les briques de son motif (le lint accepte toujours tout le kit).
  const system = [
    'You are a senior motion designer who codes. You are one of the authors of an ORIGINAL brand film: you write the React component of ONE shot, exactly as the creative director imagined it — an original composition, never a stock template.',
    'Answer with the TSX code only, in a single ```tsx block.',
    scopedKitManifest(shotKit(b.shot)),
  ].join('\n');
  const pattern = b.shot.pattern ? PATTERN_BY_ID.get(b.shot.pattern) : undefined;
  const texts = Object.entries(b.shot.slots).map(([k, v]) => `s.slots.${k} = "${v}"`);
  const user = [
    b.sheet,
    `MOTION DIRECTION: ${DIRECTION_PITCH[b.direction]}`,
    `FILM: ${b.film.title} — ${b.film.concept}`,
    b.film.bible ? `VISUAL BIBLE (every shot follows it): ${b.film.bible}` : '',
    `SHOT ${b.index + 1} of ${b.film.shots.length} · ${b.shot.duration.toFixed(1)} s${b.shot.kind === 'logo' ? ' · THE SIGNATURE: the brand logo must end clearly visible (<LogoMotion variant="draw" height={…} /> or data.logo images)' : ''}${b.shot.kind === 'cta' ? ' · THE CALL TO ACTION: the action must read as a button' : ''}.`,
    `DIRECTOR'S NOTES: ${b.shot.visual}`,
    b.reference ? `REFERENCE SHOT (reproduce THIS animation — composition, motion, timing — with this brand's texts and media): ${b.reference}` : '',
    pattern?.recipe ? `PATTERN: ${pattern.id} — ${pattern.recipe} (a starting point: the director's notes win)` : '',
    b.shot.explore?.length ? `EXPLORATION: combine ${b.shot.explore.join(' + ')} in a way the brand has never seen — keep it legible and true to the charter.` : '',
    prev?.handoff ? `ENTRANCE: the previous shot hands over like this — ${prev.handoff}. Start your shot accordingly.` : 'ENTRANCE: this is the opening of the film — grab attention in the first second.',
    b.shot.handoff ? `EXIT: hand over to the next shot like this — ${b.shot.handoff}. Do it in the last 0.4 s (useExitAt / useExitFactor).` : '',
    texts.length ? `TEXTS (read them from s.slots, show ALL of them, fully on screen): ${texts.join(' · ')}` : 'TEXTS: none — the shot is visual.',
    ...mediaLines(b),
    b.constraints ? `CLIENT CONSTRAINTS (respect them in every pixel): ${b.constraints.replace(/\n/g, ' · ').slice(0, 700)}` : '',
    `FORMATS: ${b.formats.join(', ')}.`,
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}

/** Ce que le codeur doit faire du média de son plan : le clip, la photo, la capture, ou rien d'inventé. */
function mediaLines(b: ShotBrief): string[] {
  const m = b.shot.medium;
  const out: string[] = [];
  if (m === 'footage' || m === 'photo') {
    if (b.hasVideo) out.push('FILMED SHOT: s.video is the clip filmed for this shot. <SceneMedia /> must fill the frame (or a very large box) for most of the shot — the engine plays it frame by frame; your motion design lives ON TOP of it (titles, lines, shapes that interact with the image) and keeps faces and gestures visible.');
    else if (b.hasImage) out.push('PHOTO: s.image is the photo of this shot. <SceneMedia /> (slow push-in) must fill the frame or a very large box; motion design on top of it.');
    else out.push('This shot was meant to be filmed but no footage could be made: compose it in pure motion design from the notes — never draw a fake photo or a person.');
  } else if (m === 'screen') {
    if (b.hasImage) out.push('PRODUCT INTERFACE: s.image is a REAL screenshot of the brand\'s product. Show it large and readable in <ScreenFrame src={s.image} url={s.slots.url} style={{ position: \'absolute\', … }} />; animate around it (a cursor, a highlight frame on a detail, a push-in), never draw a fake interface over it.');
    else out.push('PRODUCT INTERFACE without screenshot: draw it with <ScreenFrame> and, inside, <TypedPrompt text={s.props[i]} /> or <FileList items={…} title={…} /> using ONLY the texts of s.props — no invented numbers, charts or dashboards.');
  } else if (b.hasImage) out.push('PHOTO: s.image is the photo of this shot — show it large with <SceneMedia /> (masked, split or framed as the notes say).');
  if (b.props?.length) out.push(`TEXTS INSIDE THE INTERFACE (read them from s.props, verbatim): ${b.props.map((p, i) => `s.props[${i}] = "${p}"`).join(' · ')}`);
  return out;
}

export function buildRevisionPrompt(previous: string, issues: string[], critique: string[]): string {
  return [
    'Your shot was rendered and reviewed. Fix ALL of these and answer with the complete corrected TSX in a single ```tsx block:',
    ...issues.slice(0, 8).map((i) => `- ${i}`),
    ...critique.slice(0, 4).map((c) => `- art director: ${c}`),
    '',
    '```tsx',
    previous,
    '```',
  ].join('\n');
}

// ─── La critique visuelle ───────────────────────────────────────────────────

export function buildCritiquePrompt(b: ShotBrief, withReference = false): string {
  return [
    withReference
      ? 'TOP row: frames of the REFERENCE shot the client wants reproduced. BOTTOM row: three frames (start, middle, end) of OUR shot. Judge first whether ours reproduces the reference composition and motion (with another brand and other texts), then its quality.'
      : 'You review three frames (start, middle, end — left to right) of ONE shot of a professional brand film.',
    `Brand and charter: ${b.sheet.replace(/\n/g, ' · ').slice(0, 600)}`,
    `Director's intent for this shot: ${b.shot.visual.slice(0, 300)}`,
    b.shot.medium === 'footage' || b.shot.medium === 'photo' ? 'This is a FILMED shot: the footage must be clearly visible and the motion design must sit on it, not hide it.' : b.shot.medium === 'screen' ? 'This is the brand\'s PRODUCT INTERFACE: it must be readable and credible.' : '',
    b.constraints ? `Client constraints: ${b.constraints.replace(/\n/g, ' · ').slice(0, 400)}` : '',
    'Judge as a demanding art director: text legibility (size, contrast, nothing cut), composition (one focal point, balance, margins), professional finish (no clutter, no overlaps, no tiny lost elements), true to the brand colours, ORIGINALITY (does it look like a generic template?).',
    'Output ONLY: "verdict: ok" or "verdict: revise", then up to 4 lines "fix: <one concrete instruction>".',
  ].join('\n');
}

export function parseCritique(raw: string | null | undefined): { verdict: 'ok' | 'revise'; fixes: string[] } | null {
  if (!raw) return null;
  const verdict = /verdict\s*[:=]\s*revise/i.test(raw) ? 'revise' : /verdict\s*[:=]\s*ok/i.test(raw) ? 'ok' : null;
  if (!verdict) return null;
  const fixes = [...raw.matchAll(/^\s*[-*]?\s*fix\s*[:=]\s*(.+)$/gim)].map((m) => m[1].trim().slice(0, 200)).slice(0, 4);
  return { verdict: verdict === 'revise' && !fixes.length ? 'ok' : verdict, fixes };
}

/** Deux planches l'une au-dessus de l'autre (modèle en haut, notre plan en bas). */
export async function stackSheets(top: Buffer, bottom: Buffer, height = 300): Promise<Buffer> {
  const [a, b] = await Promise.all([sharp(top).resize({ height }).png().toBuffer({ resolveWithObject: true }), sharp(bottom).resize({ height }).png().toBuffer({ resolveWithObject: true })]);
  const width = Math.max(a.info.width, b.info.width);
  return sharp({ create: { width, height: height * 2 + 10, channels: 3, background: '#808080' } })
    .composite([
      { input: a.data, left: 0, top: 0 },
      { input: b.data, left: 0, top: height + 10 },
    ])
    .png()
    .toBuffer();
}

/** Les trois images d'un plan côte à côte, pour la critique visuelle. */
export async function contactSheet(frames: Buffer[], height = 360): Promise<Buffer> {
  const tiles = await Promise.all(frames.map((f) => sharp(f).resize({ height }).png().toBuffer({ resolveWithObject: true })));
  const width = tiles.reduce((w, t) => w + t.info.width, 0) + (tiles.length - 1) * 8;
  let x = 0;
  const composite = tiles.map((t) => {
    const left = x;
    x += t.info.width + 8;
    return { input: t.data, left, top: 0 };
  });
  return sharp({ create: { width, height, channels: 3, background: '#808080' } }).composite(composite).png().toBuffer();
}

// ─── La boucle : écrire, rendre, contrôler, critiquer, corriger ─────────────

export interface AuthorShotsInput {
  storyboard: VideoStoryboard;
  film: AuthoredFilm;
  sheet: string;
  direction: DirectionId;
  formats: string[];
  compose: (storyboard: VideoStoryboard) => Promise<{ html: string; spec: { width: number; height: number } }>;
  withPage: <T>(input: { html: string; width: number; height: number; strict?: boolean }, fn: (page: Page) => Promise<T>) => Promise<T>;
  orchestrator: CreativeOrchestrator;
  /** Modèle de vision : (planche PNG, consigne) → réponse. Absent : pas de critique visuelle. */
  critic?: (png: Buffer, prompt: string) => Promise<string>;
  rounds?: number;
  onShot?: (index: number, state: 'writing' | 'review' | 'revise' | 'done', info?: { ok?: boolean; round?: number }) => void;
  /** Vidéo modèle : la description de chaque plan à reproduire, et sa planche (critique comparée). */
  reference?: { shots: (string | undefined)[]; sheets?: (Buffer | undefined)[] };
  /** Les consignes de l'utilisateur, pour chaque codeur et pour la critique. */
  constraints?: string;
}

export interface AuthorShotsResult {
  tried: number;
  coded: number;
  /** Clés des plans repliés sur la composition éprouvée. */
  fallback: string[];
  /** Tours utilisés par plan. */
  rounds: Record<string, number>;
  /** Derniers défauts des plans repliés (journal). */
  rejected: Record<string, string[]>;
  /** Plans revus par la critique visuelle. */
  reviewed: number;
  /** Dernier verdict de la critique visuelle par plan (mémoire d'expérience). */
  critic: Record<string, 'ok' | 'revise'>;
  /** Plans qui ont exploré (combinaison inventée ou motif expérimental) : validation renforcée. */
  explored: string[];
}

export async function authorShots(input: AuthorShotsInput): Promise<AuthorShotsResult> {
  const { storyboard, film } = input;
  const rounds = input.rounds ?? 3;
  const result: AuthorShotsResult = { tried: 0, coded: 0, fallback: [], rounds: {}, rejected: {}, reviewed: 0, critic: {}, explored: [] };
  // Les rendus de contrôle passent un par un (CPU) ; les appels au modèle, eux, en parallèle.
  let lock: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(job: () => Promise<T>): Promise<T> => {
    const run = lock.then(job, job);
    lock = run.catch(() => undefined);
    return run;
  };

  const one = async (sc: VideoSceneInstance, i: number) => {
    result.tried++;
    const brief: ShotBrief = { film, shot: film.shots[i], index: i, sheet: input.sheet, direction: input.direction, formats: input.formats, hasImage: !!sc.image, hasVideo: !!sc.video, ...(sc.props?.length ? { props: sc.props } : {}), ...(input.constraints ? { constraints: input.constraints } : {}), reference: input.reference?.shots[i] };
    const referenceSheet = input.reference?.sheets?.[i];
    const shotPrompt: { system: string; user: string } = buildShotPrompt(brief);
    const slotKeys = Object.keys(sc.slots).filter((k) => sc.slots[k]);
    const texts = visibleTexts(sc.sceneId, sc.slots);
    const render = async (code: string, capture: { frames: Buffer[] }): Promise<string[]> => {
      try {
        await compileSceneCode(code);
      } catch (error: any) {
        return [`compilation failed: ${error?.errors?.[0]?.text || error?.message}`];
      }
      // Le plan seul passe en code pendant son contrôle ; les autres gardent leur composition.
      const probe: VideoStoryboard = { ...storyboard, scenes: storyboard.scenes.map((s) => (s.key === sc.key ? { ...s, code: { tsx: code } } : { ...s, code: undefined })) };
      const { html, spec } = await input.compose(probe);
      return exclusive(() =>
        input.withPage({ html, width: spec.width, height: spec.height, strict: true }, (page) => inspectRenderedScene(page, { key: sc.key, start: sc.start, duration: sc.duration, texts, media: !!(sc.image || sc.video) }, spec, capture))
      ).catch((error: any) => [`render check failed: ${error?.message || error}`]);
    };

    let tsx: string | null = null;
    let issues: string[] = [];
    let critique: string[] = [];
    /** Le dernier code qui a passé tous les contrôles mesurés (la critique visuelle est un conseil). */
    let sound: string | null = null;
    let used = 0;
    // Chemin d'exploration : un tour de plus, et la critique visuelle relit aussi le dernier tour.
    const exploratory = isExploratoryShot(film.shots[i], input.direction);
    if (exploratory) result.explored.push(sc.key);
    const maxRounds = exploratory ? Math.min(4, rounds + 1) : rounds;
    for (let round = 0; round < maxRounds; round++) {
      used = round + 1;
      input.onShot?.(i, round ? 'revise' : 'writing', { round });
      const user: string = round && tsx ? buildRevisionPrompt(tsx, issues, critique) : shotPrompt.user;
      const res: { value: string | null } = await input.orchestrator.run<string | null>({
        role: 'shotCoder',
        key: `shotCoder:${i + 1}${round ? `:r${round}` : ''}`,
        // Le film d'auteur existe dès High : ses codeurs travaillent à ce cran (le nombre de tours le borne).
        minLevel: 'high',
        profile: 'coder',
        prompt: () => ({ system: shotPrompt.system, user }),
        parse: (raw) => extractCode(raw) ?? undefined,
        fallback: () => null,
      });
      if (!res.value) {
        issues = ['no TSX code was returned: answer with the complete component in a ```tsx block'];
        critique = [];
        continue;
      }
      // Les maladresses d'écriture (une transition CSS oubliée, un nom voisin du kit) se réparent ici, sans tour de plus.
      tsx = autoFixSceneCode(res.value).code;
      const capture = { frames: [] as Buffer[] };
      let hard = await lintSceneCode(tsx, slotKeys);
      if (!hard.length) hard = await render(tsx, capture);
      if (hard.length) {
        issues = hard;
        critique = [];
        continue;
      }
      sound = tsx;
      issues = [];
      // Critique visuelle : conseil d'un directeur artistique sur les images réelles du plan.
      if (input.critic && capture.frames.length && (round < maxRounds - 1 || exploratory)) {
        input.onShot?.(i, 'review', { round });
        const ours = await contactSheet(capture.frames).catch(() => null);
        // Avec une vidéo modèle : son plan en haut, le nôtre en bas — la critique compare.
        const sheetPng = ours && referenceSheet ? await stackSheets(referenceSheet, ours).catch(() => ours) : ours;
        const verdict = sheetPng ? parseCritique(await input.critic(sheetPng, buildCritiquePrompt(brief, !!referenceSheet && sheetPng !== ours)).catch(() => null)) : null;
        if (verdict) {
          result.reviewed++;
          result.critic[sc.key] = verdict.verdict;
        }
        if (verdict?.verdict === 'revise' && round < maxRounds - 1) {
          critique = verdict.fixes;
          continue;
        }
      }
      break;
    }
    result.rounds[sc.key] = used;
    if (sound) {
      sc.code = { tsx: sound, agent: 'shotCoder' };
      result.coded++;
      input.onShot?.(i, 'done', { ok: true, round: used });
    } else {
      result.fallback.push(sc.key);
      result.rejected[sc.key] = issues;
      input.onShot?.(i, 'done', { ok: false, round: used });
    }
  };

  // Trois plans écrits en même temps au plus : le fournisseur ralentit au-delà.
  let next = 0;
  const worker = async () => {
    while (next < storyboard.scenes.length) {
      const i = next++;
      await one(storyboard.scenes[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, storyboard.scenes.length) }, worker));
  return result;
}

/**
 * Le RÔLE VISUEL de chaque plan (le contrat `AssetRequirement` du moteur graphique) : ce que le plan doit
 * montrer et d'où ce média peut venir. Une interface ne vient que du produit (import, projet, capture) —
 * jamais générée ; le motion design et la signature n'appellent aucun média.
 */
export function filmAssetPlan(film: Pick<AuthoredFilm, 'shots'>): import('@idem/graphic-engine').AssetRequirement[] {
  return film.shots.flatMap((shot, i) => {
    const medium = shot.medium || 'motion';
    if (medium === 'motion' || medium === 'logo') return [];
    const role = medium === 'footage' ? 'clip' : medium === 'screen' ? 'product-capture' : 'photo';
    const subject = (shot.footage || shot.query || shot.visual || shot.slots.title || 'brand shot').slice(0, 240);
    return [{
      assetId: `shot-${i + 1}`,
      role,
      purpose: (shot.slots.title || shot.visual || subject).slice(0, 240),
      subject,
      aspectRatio: 16 / 9,
      safeArea: 'none',
      sources: role === 'product-capture' ? ['user', 'project', 'capture'] : ['user', 'project', 'generated', 'stock'],
      fallback: role === 'product-capture' ? 'downgrade' : 'skip',
      target: {},
    } as import('@idem/graphic-engine').AssetRequirement];
  });
}

/** Les moyens du film d'auteur par cran : étage du directeur, tours par plan, critique visuelle. */
export const AUTHOR_MEANS: Record<'high' | 'max' | 'ultra', { director: 'writing' | 'reasoning'; rounds: number; critic: boolean }> = {
  high: { director: 'writing', rounds: 1, critic: false },
  max: { director: 'reasoning', rounds: 2, critic: true },
  ultra: { director: 'reasoning', rounds: 3, critic: true },
};

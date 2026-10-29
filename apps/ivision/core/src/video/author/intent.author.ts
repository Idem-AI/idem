/**
 * L'AUTEUR D'INTENTIONS (compilateur 0.3) — le modèle écrit l'INTENTION d'une scène (rôle, énergie, composition,
 * hiérarchie, verbes), jamais des coordonnées ; le code calcule le reste (`packages/motion-compiler/src/intent`).
 *
 *   préfixe stable   la référence du langage d'intention, le vocabulaire du système de design, les règles du mouvement
 *                    — identiques d'un essai à l'autre et d'une scène à l'autre : le cache des invites d'OpenRouter les
 *                    garde (et le même fournisseur sert les essais) ;
 *   fiche            la scène (intention du storyboard, textes par clé, médias décrits, voix, tempo), le film (concept,
 *                    direction, énergie) et une SCÈNE DE RÉFÉRENCE proche à éditer (PPTAgent) ;
 *   sortie           structurée et stricte (`json_schema` construit pour la scène : clés de texte et médias en énumérations) ;
 *                    lue avec tolérance (`validateIntent`) : rien d'inventé, rien d'oublié.
 *
 * Variantes : la température, la référence retrouvée et parfois le modèle changent d'un essai à l'autre (`sampler.ts`).
 */
import { callFilmModel, FilmCallContext, FilmRole } from '../agents';
import { intentJsonSchema, parseIntent, validateIntent, designVocabulary, DIRECTIONS, LAYOUT_KINDS, VERBS } from '../../../../../../packages/motion-compiler/src';
import type { IntentContext, ReferenceScene, SceneIntent } from '../../../../../../packages/motion-compiler/src';

export interface IntentSceneCard {
  key: string;
  index: number;
  count: number;
  duration: number;
  role?: string;
  energy?: number;
  purpose: string;
  visual: string;
  motion: string;
  transition?: string;
  texts: Record<string, string>;
  media: { kind: 'image' | 'video'; width: number; height: number; note?: string; screen?: boolean }[];
  voice?: { text: string; at: number; duration: number };
  bpm?: number;
}

export interface IntentAuthorInput {
  film: { title: string; concept: string; bible: string; direction?: string };
  formats: string[];
  hasLogo: boolean;
  scene: IntentSceneCard;
  previous?: string;
  next?: string;
  /** La scène de référence à éditer (la plus proche de la bibliothèque, ou une autre selon l'essai). */
  reference?: ReferenceScene;
  /** Un court menu d'icônes du catalogue. */
  icons?: string[];
  iconExists?: (name: string) => boolean;
  /** Réécriture : l'intention actuelle et la demande du client, ou le rapport mesuré du juge. */
  revise?: { intent: SceneIntent; instruction: string };
  repair?: { intent?: SceneIntent; report: string };
}

export interface AuthoredIntent {
  key: string;
  intent?: SceneIntent;
  warnings: string[];
  error?: string;
  tokens: { input: number; output: number };
  ms: number;
}

/** Le préfixe stable (mis en cache) : la référence du langage d'intention. */
export const INTENT_REFERENCE = `# IDEM scene intention — you write WHAT the scene does, the code computes WHERE and WHEN

Answer with ONE JSON object { role, energy, layout, background, elements, relations, beats, camera }.
You never write coordinates, sizes, durations or colours in numbers: positions are solved on a grid in every format,
times by a timing solver (reading time, overlaps, music beats), values come from the film's design system.

## layout (pick the composition)
- hero: one centred block of text (and an optional logo or icon above) — claims, questions, statements
- hero-left: the same block left-aligned on the grid, with room on the right — editorial, calmer
- media-split: a photo/clip on one side (or top), the text beside (or below) — features, problems with a picture
- full-bleed: the photo/clip fills the frame, the text sits on its calm area (or on a plate) — hooks, testimonials
- stacked: elements one under the other — before/after, sequences
- figure: one big real number with its label — data, proof
- list: a title and 2–4 items arriving one after the other — benefits
- quote: a quotation and who said it — testimonials
- device: a phone / laptop / browser frame drawn around a screenshot, text beside — app and website features
- end-card: the logo, the tagline, the call to action — the last scene
- grid: a title and up to 4 photos — catalogues, menus

## elements (the hierarchy)
- kind: text | image | video | logo | icon | device | shape | list | chip | button
- rank: 1 = the ONE main element (exactly one), 2 = secondary, 3 = detail
- text/chip/button: "text": "$KEY" (a key of this scene's texts — nothing else is ever shown); list: "items": ["$K1","$K2"]
- image/video/device: "media": index of a medium of the scene; device: "device": phone | laptop | browser
- level (optional): display | title | subtitle | body | caption | label — else from the rank
- shape: bar | underline | circle | ring | arc | block | pill | dots (a graphic device from the bible, never a text)
- icon: "icon": a name from the ICON MENU
- emphasis (text, optional): index of the ONE word that carries the meaning (shown in the accent colour)
- color (optional): a colour role (primary, accent, secondary…) — kept only if it reads on its background

## beats (the motion, in order) — { verb, target, style, from, intensity, sync, after, with }
- reveal: a title appears word by word (style words), letter by letter (letters) or the whole line out of blur (line)
- blur-in, rise, slide-in (from left/right/top/bottom: a PARTIAL travel), pop (spring), grow (a card or device)
- stack / cascade: list items or parts arrive one after the other ("target": "ID.*")
- draw: a line, ring or bar draws itself; wipe: a photo's frame opens (from a side); zoom: a slow push on a photo
- count: a number counts up; type: typewriter; highlight: the emphasis word takes the accent
- push / focus: the camera ("world") moves with intent; nudge: a composed group slides to make room; exit
- after: start once that element is mostly in (a wave, not a queue); with: start together
- sync: downbeat (land on a strong beat of the music) | beat | voice (start with the voice line)
- intensity: soft | normal | strong — strong once, on the payoff

## Motion rules (measured on professional launch films)
- Vary the entrances inside the scene and across the film: never everything "rise". A landed title stays still.
- Build in 2–4 beats: the main element first, then what completes it. Hold before the strongest moment.
- No idle loops (breathing, floating, pulsing). The camera moves only with an intent (push, focus).
- One accent word at most. Every medium of the scene appears. Every text of the scene is shown once.
- Energy: 1 calm (few elements, slow) … 5 punchy (fast cuts, strong pops) — follow the film's curve.

## Design vocabulary (named values the code resolves)
${designVocabulary()}
`;

export function buildIntentPrompt(c: IntentAuthorInput): { system: string; user: string } {
  const s = c.scene;
  const direction = c.film.direction && (DIRECTIONS as Record<string, { description: string }>)[c.film.direction];
  const system = [
    'You are a senior motion designer. You design ONE scene of a short brand film as an intention (JSON). The code solves the layout in every format, the timing, the colours and the motion curves exactly — your job is the idea: the composition, the hierarchy and the choreography.',
    '',
    INTENT_REFERENCE,
  ].join('\n');
  const lines = [
    `FILM: ${c.film.title || '(untitled)'} — ${c.film.concept}`,
    c.film.bible ? `BIBLE: ${c.film.bible}` : '',
    direction ? `VISUAL DIRECTION: ${c.film.direction} — ${direction.description}` : '',
    `FORMATS: ${c.formats.join(', ')} (one intention for all of them)`,
    `SCENE ${s.index + 1} of ${s.count} — ${s.duration.toFixed(1)} s${s.role ? ` — role: ${s.role}` : ''}${s.energy ? ` — energy ${s.energy}/5` : ''}`,
    c.previous ? `PREVIOUS SCENE: ${c.previous}`.slice(0, 300) : 'PREVIOUS SCENE: none (this scene opens the film)',
    c.next ? `NEXT SCENE: ${c.next}`.slice(0, 300) : 'NEXT SCENE: none (this scene closes the film)',
    `purpose: ${s.purpose}`,
    `visual idea: ${s.visual}`,
    `motion idea: ${s.motion}`,
    s.transition ? `transition: ${s.transition}` : '',
    `texts (use "$KEY"): ${Object.keys(s.texts).length ? Object.entries(s.texts).map(([k, v]) => `$${k} = "${v}"`).join(' · ') : 'none'}`,
    `media (every one must appear): ${s.media.length ? s.media.map((m, i) => `${i} = ${m.kind}${m.screen ? ' (screenshot of the product: show it in a device)' : ''} ${m.width}×${m.height}${m.note ? ` — ${m.note.slice(0, 140)}` : ''}`).join(' · ') : 'none'}`,
    `logo: ${c.hasLogo ? 'available (kind "logo")' : 'none'}`,
    s.voice ? `voice-over: "${s.voice.text}" (starts at ${s.voice.at.toFixed(1)} s)` : '',
    s.bpm ? `music: ${Math.round(s.bpm)} bpm (use sync "downbeat" on the strongest beat)` : '',
    c.icons?.length ? `ICON MENU: ${c.icons.join(', ')}` : '',
  ];
  if (c.reference) {
    lines.push('', `REFERENCE SCENE TO EDIT (a well-designed scene close to this one — adapt it: same craft, YOUR texts and media, change what the brief needs; its keys are generic):\n${JSON.stringify(c.reference.intent)}`);
  }
  if (c.revise) lines.push('', `CURRENT INTENTION OF THIS SCENE:\n${JSON.stringify(c.revise.intent)}`, `THE CLIENT ASKS: ${c.revise.instruction}`, 'Rewrite the intention to do what the client asks; keep what the request does not concern.');
  if (c.repair) lines.push('', ...(c.repair.intent ? [`CURRENT INTENTION:\n${JSON.stringify(c.repair.intent)}`] : []), `MEASURED PROBLEMS (from the judge — fix exactly these):\n${c.repair.report}`, 'Answer with the whole corrected intention.');
  return { system, user: lines.filter((l) => l !== '').join('\n') };
}

export function intentContext(c: IntentAuthorInput): IntentContext {
  return { texts: c.scene.texts, media: c.scene.media.map((m) => m.kind), hasLogo: c.hasLogo, ...(c.iconExists ? { iconExists: c.iconExists } : {}) };
}

/** Un essai : un appel (sortie structurée), la lecture tolérante ; une réponse illisible est redemandée une fois. */
export async function authorIntent(ctx: FilmCallContext, input: IntentAuthorInput, opts: { role?: FilmRole; temperature?: number; seed?: number } = {}): Promise<AuthoredIntent> {
  const { system, user } = buildIntentPrompt(input);
  const schema = intentJsonSchema({ texts: Object.keys(input.scene.texts), media: input.scene.media.length });
  const tokens = { input: 0, output: 0 };
  let ms = 0;
  let last = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = attempt === 0 ? user : `${user}\n\nYOUR PREVIOUS ANSWER WAS NOT A READABLE INTENTION (${last}). Answer with ONE JSON object.`;
    const run = await callFilmModel(ctx, opts.role || 'video.sampler', system, prompt, (raw) => !parseIntent(raw).error, { schema: { name: 'scene_intent', schema }, reasoning: false, ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}), ...(opts.seed !== undefined ? { seed: opts.seed } : {}) });
    tokens.input += run.tokens.input;
    tokens.output += run.tokens.output;
    ms += run.ms;
    if (!run.raw.trim()) {
      last = run.failure || 'empty_answer';
      if (run.failure === 'no_model') break;
      continue;
    }
    const parsed = parseIntent(run.raw);
    if (parsed.error) {
      last = parsed.error;
      continue;
    }
    const v = validateIntent(parsed.intent, intentContext(input));
    if (!v.ok) {
      last = v.errors.join(' ; ');
      continue;
    }
    return { key: input.scene.key, intent: v.intent, warnings: v.warnings, tokens, ms };
  }
  return { key: input.scene.key, warnings: [], error: last || 'no_intent', tokens, ms };
}

export { LAYOUT_KINDS, VERBS };

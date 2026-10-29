/**
 * LE DIRECTEUR DE CRÉATION — la demande de l'utilisateur, rendue PRODUCTIBLE.
 *
 * Une demande courte (« une annonce pour le lancement de ma marque ») donnait une vidéo courte d'idées : des cartons de
 * texte qui se succèdent, sans image, sans histoire. Avant le directeur et le storyboard, un agent écrit donc un BRIEF DE
 * PRODUCTION complet, à partir de la demande, de la marque (activité, promesse, ton, direction artistique), des médias
 * disponibles (ce que chacun montre), de la durée et du choix de voix off :
 *
 *   objectif, public, message clé, l'histoire en une phrase ;
 *   la narration : voix off ou non, et UN ton, constant d'un bout à l'autre (jamais un cri puis un murmure) ;
 *   le rythme et la continuité : un film, pas des diapositives qui se suivent ;
 *   ce qu'on MONTRE, concrètement (photos, plans filmés, illustrations du sujet réel de la marque) ;
 *   le déroulé, temps par temps : ce qu'on voit, ce que dit le texte à l'écran, ce que dit la voix, le lien avec la suite ;
 *   la fin (la marque, l'appel à l'action) et la musique.
 *
 * Le modèle répond en JSON ; le CODE écrit le brief. Ainsi le texte rendu ne ressemble jamais à un scénario « mot pour
 * mot » (aucun « Scène 1 », aucun minutage, aucun texte entre guillemets inventé : `parseRequest` le lit comme un brief,
 * il n'impose rien à la lettre), et un chiffre absent de la demande et de la marque est retiré avec sa phrase.
 *
 * Le même agent sert le bouton « Améliorer ma demande » (texte montré à l'utilisateur) et la reformulation automatique de
 * chaque création — IDEM (module Communication) et iVision. Sans réponse exploitable : une amélioration par gabarit.
 */
import { CopyContext, CopyWriter, estimateTokens } from './facts';
import { parseRequest } from './request';

export interface EnhanceInput {
  text: string;
  ctx: CopyContext;
  /** Médias joints, par sorte (« 2 photos, 1 clip »). */
  media: { images: number; videos: number; models: number; lotties: number };
  /** Résumé de la DA de la charte. */
  art?: string;
  /** Ce que montrent les médias disponibles (imports, captures et photos de la marque), une ligne par média. */
  mediaNotes?: string[];
  /** Durée achetée (s) : le déroulé s'y proportionne. */
  durationSec?: number;
  /** Le choix de voix off fait par l'utilisateur (undefined : le brief le propose). */
  voice?: boolean;
  /** L'objectif retenu (promotion, annonce, recrutement…). */
  objective?: string;
}

/** Les personnages de voix du moteur (`audio/voice.ts#VOICE_PERSONAS`). */
export const BRIEF_PERSONAS = ['warm', 'bright', 'smooth', 'confident', 'friendly', 'deep', 'energetic'] as const;
export type BriefPersona = (typeof BRIEF_PERSONAS)[number];
export const BRIEF_MOODS = ['upbeat', 'calm', 'epic', 'corporate', 'afro'] as const;
export type BriefMood = (typeof BRIEF_MOODS)[number];

export interface BriefBeat {
  /** Le nom du temps (« Ouverture », « La promesse »). */
  name: string;
  /** Ce qu'on voit, concrètement. */
  see: string;
  /** Ce que dit le texte à l'écran (le sens, pas forcément les mots exacts). */
  text?: string;
  /** Ce que dit la voix. */
  voice?: string;
  /** Le lien avec le temps suivant (continuité). */
  flow?: string;
}

/** Le brief de production, tel que l'agent l'a décidé (le texte en est la mise en forme). */
export interface CreativeBrief {
  objective?: string;
  audience?: string;
  keyMessage?: string;
  story?: string;
  voiceover: boolean;
  /** Le ton UNIQUE de la voix, en clair. */
  voiceTone?: string;
  persona?: BriefPersona;
  pacing?: string;
  look?: string;
  /** Ce qu'il faut montrer (sujets concrets). */
  show: string[];
  beats: BriefBeat[];
  ending?: string;
  music?: BriefMood;
}

export interface EnhanceResult {
  prompt: string;
  source: 'llm' | 'template';
  tokens: { input: number; output: number };
  /** Le brief structuré (absent en repli par gabarit). */
  brief?: CreativeBrief;
}

const LANG: Record<string, string> = { fr: 'French', en: 'English', pt: 'Portuguese', es: 'Spanish', ar: 'Arabic', sw: 'Swahili' };

/** Le nombre de temps du déroulé, d'après la durée (un temps ≈ 8 à 15 s ; 4 à 9 temps). */
export function beatCount(durationSec?: number): { min: number; max: number } {
  const d = Math.max(6, durationSec || 30);
  const min = Math.max(3, Math.min(7, Math.round(d / 15)));
  return { min, max: Math.max(min + 1, Math.min(9, Math.round(d / 9))) };
}

export function buildEnhancePrompt(input: EnhanceInput): { system: string; user: string } {
  const lang = LANG[(input.ctx.language || 'fr').slice(0, 2)] || 'French';
  const { min, max } = beatCount(input.durationSec);
  const voiceRule =
    input.voice === true
      ? '- The client WANTS a voice-over: "voiceover" is true; give every beat a voice idea.'
      : input.voice === false
        ? '- The client chose NO voice-over: "voiceover" is false; the film must be understood without sound, through its images and on-screen texts.'
        : '- Decide whether a voice-over serves this film (storytelling, explanation, launch, testimonial: usually yes; a quick visual teaser: maybe not).';
  const system = [
    `You are the creative director of a motion-design studio. Turn a client's request for a brand video into a complete, concrete PRODUCTION BRIEF that a storyboard artist and an animator can execute. Write every value in ${lang}.`,
    '',
    'What makes the film professional — apply it:',
    '- It is a FILM, not a slideshow. Never "one text card, then the next text card". Each beat continues the previous one: the same subject stays on screen while the text changes, the camera keeps moving, a shape or colour carries over, the next image answers the previous line.',
    '- It SHOWS. Most beats show a concrete subject of THIS business: its product, its place, its customers, its team, its craft, the problem it solves — as a photo, a filmed shot or an illustration. Describe each subject precisely (who, what, where, light). Typography alone only for a short statement or the final call to action.',
    '- On-screen texts SAY something: a benefit with its concrete detail, a fact from the request, a promise the viewer can check. Never empty slogans ("Discover our brand", "The future is here").',
    '- One clear arc: a hook in the first seconds (a tension, a question, a striking image), the build, ONE strongest moment around two thirds of the film, a calm and confident end on the brand and the call to action.',
    '- The voice-over (if any) is ONE narrator with ONE steady tone from start to finish — warm, confident, natural, like a person talking to a friend. Never shouting, never hype, no sudden change of energy between beats.',
    '',
    'Rules:',
    '- Keep every fact of the request exactly (names, prices, dates, places, phone numbers). Never invent a number, price, date, address, award, customer count or promise that is not given.',
    '- Use the brand context: what it sells, its promise, its tone, its art direction. Use the available media when their description fits a beat.',
    voiceRule,
    `- ${min} to ${max} beats, in order. Do not write timings, scene numbers or quotation marks.`,
    '- No emoji, no hashtag, no em dash.',
    '',
    'Answer ONLY with this JSON:',
    '{"objective":"…","audience":"…","keyMessage":"one sentence","story":"the arc in one or two sentences","voiceover":true,"voiceTone":"the ONE tone of the narrator","persona":"warm|bright|smooth|confident|friendly|deep|energetic","pacing":"rhythm and how scenes link","look":"visual style, colours, light, typography","show":["concrete subjects to show"],"beats":[{"name":"short name","see":"what we see, concretely","text":"what the on-screen text says","voice":"what the narrator says","flow":"how it leads into the next beat"}],"ending":"how the film ends","music":"upbeat|calm|epic|corporate|afro"}',
  ].join('\n');
  const m = input.media;
  const media = [m.images && `${m.images} photo(s)`, m.videos && `${m.videos} clip(s)`, m.models && `${m.models} 3D model(s)`, m.lotties && `${m.lotties} animation(s)`].filter(Boolean).join(', ');
  const user = [
    `BRAND: ${input.ctx.brandName}${input.ctx.businessType ? ` (${input.ctx.businessType})` : ''}`,
    input.ctx.valueProposition ? `WHAT IT OFFERS / PROMISE: ${input.ctx.valueProposition.slice(0, 600)}` : '',
    input.ctx.tone ? `BRAND TONE: ${input.ctx.tone}` : '',
    input.ctx.keywords?.length ? `KEYWORDS: ${input.ctx.keywords.slice(0, 10).join(', ')}` : '',
    input.art ? `ART DIRECTION: ${input.art}` : '',
    input.objective ? `OBJECTIVE: ${input.objective}` : '',
    input.durationSec ? `DURATION: ${Math.round(input.durationSec)} seconds` : '',
    media ? `ATTACHED BY THE CLIENT: ${media}` : '',
    input.mediaNotes?.length ? `AVAILABLE MEDIA (what each one shows):\n${input.mediaNotes.slice(0, 12).map((n) => `- ${n.slice(0, 200)}`).join('\n')}` : '',
    `REQUEST:\n${input.text.slice(0, 4000)}`,
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}

const FILLER = /\b(révolutionnaire|incontournable|ultime|inégalé|de nouvelle génération|à la pointe|de classe mondiale|seamless|revolutionary|cutting-edge|world-class|game-?changer|unleash|elevate)\b/gi;

/** Les nombres connus (demande, marque, durée) : seuls ceux-là peuvent apparaître. */
function numberCheck(sources: string): (s: string) => boolean {
  const known = new Set((sources.match(/\d[\d\s.,:/h-]*\d|\d/g) || []).map((n) => n.replace(/\s/g, '')));
  const knownDigits = sources.replace(/\D/g, '');
  return (s: string) =>
    (s.match(/\d[\d\s.,:/h-]*\d|\d/g) || []).every((n) => {
      const compact = n.replace(/\s/g, '');
      return known.has(compact) || knownDigits.includes(compact.replace(/\D/g, ''));
    });
}

/** Une valeur du brief nettoyée : sans guillemets, tirets longs, émojis ni mots creux ; les phrases à chiffre inventé retirées. */
export function groundEnhanced(output: string, sources: string, max = 1200): string {
  const ok = numberCheck(sources);
  const sentences = (output || '')
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/^\s*(improved request|demande améliorée)\s*[:：]\s*/i, '')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/#[\p{L}\d_]+/gu, '')
    .replace(FILLER, '')
    .replace(/[«»“”"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/);
  return sentences
    .filter(ok)
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/^[\s,.;:]+/, '')
    .trim()
    .slice(0, max);
}

/** Lit la réponse JSON de l'agent (tolérant : blocs de code, texte autour). */
export function parseCreativeBrief(raw: string, sources: string, voiceChoice?: boolean): CreativeBrief | null {
  const text = String(raw || '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let data: any;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const g = (v: unknown, max = 400) => (typeof v === 'string' ? groundEnhanced(v, sources, max) : '');
  const beats: BriefBeat[] = (Array.isArray(data?.beats) ? data.beats : [])
    .map((b: any) => ({ name: g(b?.name, 60), see: g(b?.see, 360), text: g(b?.text, 200) || undefined, voice: g(b?.voice, 320) || undefined, flow: g(b?.flow, 200) || undefined }))
    .filter((b: BriefBeat) => b.see)
    .slice(0, 9);
  if (beats.length < 2) return null;
  const voiceover = typeof voiceChoice === 'boolean' ? voiceChoice : data?.voiceover !== false;
  const persona = BRIEF_PERSONAS.includes(data?.persona) ? (data.persona as BriefPersona) : undefined;
  const music = BRIEF_MOODS.includes(data?.music) ? (data.music as BriefMood) : undefined;
  return {
    objective: g(data?.objective, 240) || undefined,
    audience: g(data?.audience, 240) || undefined,
    keyMessage: g(data?.keyMessage, 240) || undefined,
    story: g(data?.story, 400) || undefined,
    voiceover,
    voiceTone: voiceover ? g(data?.voiceTone, 200) || undefined : undefined,
    persona: voiceover ? persona : undefined,
    pacing: g(data?.pacing, 300) || undefined,
    look: g(data?.look, 300) || undefined,
    show: (Array.isArray(data?.show) ? data.show : []).map((s: unknown) => g(s, 160)).filter(Boolean).slice(0, 10),
    beats: beats.map((b) => (voiceover ? b : { ...b, voice: undefined })),
    ending: g(data?.ending, 300) || undefined,
    music,
  };
}

const LABELS = {
  fr: {
    objective: 'Objectif',
    audience: 'Public',
    key: 'Message clé',
    story: 'Histoire',
    voiceOn: (tone?: string) => `Ton de la narration : une voix off, un seul narrateur, ${tone ? `ton ${tone}` : 'ton chaleureux et posé'}, constant du début à la fin, sans cri ni changement brusque d'énergie.`,
    voiceOff: "Ton de la narration : pas de voix off, la vidéo se comprend sans le son, par ses images et ses textes à l'écran.",
    pacing: 'Rythme et continuité',
    look: 'Style visuel',
    show: 'À montrer',
    flowTitle: 'Déroulé',
    see: 'on voit',
    text: "à l'écran, une phrase qui dit",
    voice: 'la voix dit',
    flow: 'puis',
    ending: 'Fin',
    music: 'Musique',
    film: "C'est un film, pas une suite de diapositives : chaque moment prolonge le précédent.",
  },
  en: {
    objective: 'Objective',
    audience: 'Audience',
    key: 'Key message',
    story: 'Story',
    voiceOn: (tone?: string) => `Voice tone: one voice-over, a single narrator, ${tone ? `${tone} tone` : 'warm and steady tone'}, constant from start to finish, never shouting, no sudden change of energy.`,
    voiceOff: 'Voice tone: no voice-over, the video is understood without sound, through its images and on-screen texts.',
    pacing: 'Pacing and continuity',
    look: 'Visual style',
    show: 'To show',
    flowTitle: 'Flow',
    see: 'we see',
    text: 'on screen, a line saying',
    voice: 'the narrator says',
    flow: 'then',
    ending: 'Ending',
    music: 'Music',
    film: 'It is a film, not a slideshow: each moment carries on from the previous one.',
  },
};

const MOOD_LABEL: Record<BriefMood, { fr: string; en: string }> = {
  upbeat: { fr: 'entraînante', en: 'upbeat' },
  calm: { fr: 'calme', en: 'calm' },
  epic: { fr: 'ample, épique', en: 'epic' },
  corporate: { fr: 'sobre, professionnelle', en: 'corporate' },
  afro: { fr: 'afro, rythmée', en: 'afro' },
};

const trimEnd = (s: string) => s.replace(/[\s.;,]+$/, '');
/** Un deux-points dans une valeur ferait d'une ligne une « étiquette » (« Accroche : … ») pour le lecteur de demande. */
const noLabel = (s: string) => trimEnd(s.replace(/\s*:\s+/g, ', '));

/**
 * Le brief MIS EN FORME par le code : des lignes « Étiquette : valeur » et un déroulé en puces, sans numéro de scène,
 * sans minutage, sans guillemets — `parseRequest` le lit comme un brief, jamais comme un scénario à suivre mot pour mot.
 */
export function formatCreativeBrief(b: CreativeBrief, language = 'fr', request?: string): string {
  const L = (language || 'fr').startsWith('fr') ? LABELS.fr : LABELS.en;
  const fr = L === LABELS.fr;
  const line = (label: string, value?: string) => (value ? `${label}${fr ? ' :' : ':'} ${noLabel(value)}.` : '');
  // Un temps du déroulé n'a pas d'étiquette (« - Ouverture · on voit … ») : jamais lu comme un texte imposé.
  const beat = (x: BriefBeat) =>
    `- ${[x.name && noLabel(x.name), `${L.see} ${noLabel(x.see)}`].filter(Boolean).join(' · ')}${[x.text && `${L.text} ${noLabel(x.text)}`, x.voice && `${L.voice} ${noLabel(x.voice)}`, x.flow && `${L.flow} ${noLabel(x.flow)}`].filter(Boolean).map((p) => ` ; ${p}`).join('')}.`;
  return [
    request ? trimEnd(request.replace(/\s+/g, ' ').trim()) + '.' : '',
    line(L.objective, b.objective),
    line(L.audience, b.audience),
    line(L.key, b.keyMessage),
    line(L.story, b.story),
    b.voiceover ? L.voiceOn(b.voiceTone ? trimEnd(b.voiceTone) : undefined) : L.voiceOff,
    line(L.pacing, b.pacing ? `${trimEnd(b.pacing)}. ${L.film}` : L.film.replace(/[.]$/, '')),
    line(L.look, b.look),
    b.show.length ? line(L.show, b.show.map(trimEnd).join(' ; ')) : '',
    `${L.flowTitle}${fr ? ' :' : ':'}`,
    ...b.beats.map(beat),
    line(L.ending, b.ending),
    b.music ? line(L.music, fr ? MOOD_LABEL[b.music].fr : MOOD_LABEL[b.music].en) : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Amélioration sans modèle : la demande, plus le ton de la marque, la continuité et une fin qui appelle à l'action. */
export function templateEnhance(input: EnhanceInput): string {
  const fr = !(input.ctx.language || 'fr').startsWith('en');
  const text = input.text.trim().replace(/\s+/g, ' ');
  const base = /[.!?]$/.test(text) ? text : `${text}.`;
  const m = input.media;
  const show = m.models ? (fr ? 'Montrer le produit en 3D.' : 'Show the product in 3D.') : m.videos ? (fr ? 'Montrer les clips joints.' : 'Show the attached clips.') : m.images ? (fr ? 'Mettre en avant les photos jointes.' : 'Feature the attached photos.') : fr ? "Montrer en images ce que fait la marque : ses produits, ses clients, son lieu." : 'Show in pictures what the brand does: its products, its customers, its place.';
  const tone = input.ctx.tone ? (fr ? `Ton ${input.ctx.tone}.` : `Tone: ${input.ctx.tone}.`) : '';
  const film = fr ? "Un film fluide, pas une suite de diapositives : chaque moment prolonge le précédent." : 'A fluid film, not a slideshow: each moment carries on from the previous one.';
  const voice = input.voice ? (fr ? 'Une voix off au ton chaleureux et constant, sans cri.' : 'A voice-over with a warm, steady tone, never shouting.') : '';
  const cta = fr ? "Terminer sur la marque et un appel à l'action clair." : 'End on the brand with a clear call to action.';
  return [base, show, film, tone, voice, cta].filter(Boolean).join(' ');
}

/** Les textes entre guillemets d'une demande : ce que le client exige à la lettre. */
const quotedOf = (text: string) => new Set([...String(text || '').matchAll(/«\s*([^«»]{1,240}?)\s*»|“([^“”]{1,240})”|"([^"\n]{1,240})"/gu)].map((m) => (m[1] ?? m[2] ?? m[3] ?? '').trim()).filter(Boolean));

/** Le brief se lit comme un brief : aucune scène imposée, aucun texte exigé qui ne soit déjà dans la demande. */
export function safeBrief(brief: string, request: string): boolean {
  const out = parseRequest(brief);
  if (out.mode === 'script') return false;
  const asked = new Set(parseRequest(request).texts.map((t) => t.toLowerCase()));
  return out.texts.every((t) => asked.has(t.toLowerCase()));
}

export async function enhanceRequest(input: EnhanceInput, writer?: CopyWriter): Promise<EnhanceResult> {
  const prompt = buildEnhancePrompt(input);
  const sources = `${input.text}\n${input.ctx.valueProposition || ''}\n${input.ctx.brandName}\n${input.ctx.businessType || ''}\n${input.durationSec || ''}`;
  if (writer) {
    try {
      const raw = await writer(prompt.system, prompt.user);
      const brief = parseCreativeBrief(raw, sources, input.voice);
      if (brief) {
        // La demande du client reste en tête quand elle porte des textes exigés à la lettre (« … ») : ils ne se
        // perdent jamais dans la reformulation.
        const keepRequest = quotedOf(input.text).size > 0 ? input.text : undefined;
        const prompt2 = formatCreativeBrief(brief, input.ctx.language || 'fr', keepRequest);
        // Garde-fou : le brief mis en forme reste un BRIEF — jamais un scénario imposé mot pour mot, jamais un texte
        // exigé à la lettre que le client n'a pas écrit.
        if (safeBrief(prompt2, input.text)) {
          return { prompt: prompt2, source: 'llm', brief, tokens: { input: estimateTokens(prompt.system + prompt.user), output: estimateTokens(raw) } };
        }
      }
    } catch {
      /* repli par gabarit */
    }
  }
  return { prompt: templateEnhance(input), source: 'template', tokens: { input: 0, output: 0 } };
}

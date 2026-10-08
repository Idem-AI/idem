/**
 * LE FILM D'AUTEUR — le cran Ultra de la vidéo : l'IA invente et crée tout le film.
 *
 * En dessous d'Ultra, l'IA choisit dans des menus (concepts, mises en page, transitions) que le
 * graphe a filtrés. Ici, plus aucun menu :
 *
 *   1. le DIRECTEUR (étage raisonnement) invente le film : concept, « bible » visuelle, et chaque
 *      plan — durée, textes, ce qu'on voit et comment ça bouge, outils, média, passage au plan
 *      suivant. Le code ne fait que VALIDER : durées et temps de lecture, longueurs, aucun chiffre
 *      absent du brief, une signature à la fin ;
 *   2. un CODEUR par plan écrit son composant React avec tout le kit du moteur (typographie
 *      ajustée, Chart.js, visx et d3, carte, croquis, pinceau, bruit, 3D plate, logo, icônes) ;
 *   3. la BOUCLE DE QUALITÉ, trois tours au plus : lint, compilation, rendu réel mesuré (erreurs,
 *      textes visibles et dans le cadre, mouvement, déterminisme, chiffres des graphiques), puis
 *      CRITIQUE VISUELLE des images du plan par un modèle de vision. Défauts et critique repartent
 *      au codeur. Un plan qui échoue encore reprend la composition éprouvée de sa scène, et le
 *      résultat le dit.
 *
 * Les médias, la musique et les effets sonores viennent des étapes existantes du service.
 */
import sharp from 'sharp';
import type { Page } from 'puppeteer';
import { VideoSceneInstance, VideoStoryboard } from '../../../models/motionVideo.model';
import { agentLines } from '../../creativity/agent-io';
import { CreativeOrchestrator } from '../../creativity/orchestrator';
import { DIRECTION_PITCH } from './video.agents';
import { compileSceneCode, extractCode, inspectRenderedScene, KIT_MANIFEST, lintSceneCode, visibleTexts } from './video.coder';
import { BriefFacts, fitLength, isGrounded } from './video.copy';
import { DirectionId } from './video.direction';
import { requiredHold } from './video.rules';

// ─── Le film, tel que le directeur l'écrit ──────────────────────────────────

/** Le type de scène d'un plan : il porte ses cases de texte et sa composition de repli. */
export type ShotKind = 'statement' | 'cta' | 'logo';

const SURFACES = ['light', 'primary', 'secondary', 'accent', 'tint', 'deep'] as const;
type Surface = (typeof SURFACES)[number];

export interface AuthoredShot {
  kind: ShotKind;
  duration: number;
  /** Cases de texte de la scène (`title`, `sub` ; `action`, `contact` ; `tagline`). */
  slots: Record<string, string>;
  /** Ce qu'on voit et comment ça bouge : la consigne du codeur. */
  visual: string;
  /** Média de la liste (1…n), s'il en porte un. */
  media?: number;
  /** Le passage au plan suivant. */
  handoff?: string;
  surface?: Surface;
}

export interface AuthoredFilm {
  title: string;
  concept: string;
  /** Signature de mouvement, usage des couleurs, attitude typographique. */
  bible: string;
  shots: AuthoredShot[];
}

/** Ce que le moteur sait faire, dit au directeur (il imagine dans ce champ, sans menu). */
export const AUTHOR_TOOLS = [
  'kinetic typography (twenty text techniques, always fitted to the frame)',
  'animated charts (bars, lines, rings, radar, treemap, sankey) and gauges — ONLY with the numbers of the FACTS',
  'a map of Africa lighting up the countries or cities named in the text',
  'hand-drawn sketches (circles, frames, arrows, underlines), brush strokes, organic flow fields, colour mosaics',
  'flat 3D objects (boxes, rings, spheres, cylinders) without heavy 3D',
  'the brand logo, animated (drawn, assembled, wiped…), and line icons',
  'the photos of the MEDIA list (crop, mask, split, duotone, parallax)',
  'sound cues synced to the motion, and the beat of the music',
].join('; ');

export interface DirectorInput {
  brief: { message: string; details?: string; objective?: string };
  /** Message + détails : le seul endroit d'où un chiffre peut venir. */
  briefText: string;
  facts: BriefFacts;
  sheet: string;
  direction: DirectionId;
  durationSec: number;
  formats: string[];
  /** Nombre de plans, signature comprise. */
  range: [number, number];
  /** Les photos obtenues, numérotées à partir de 1. */
  media: string[];
  brandName: string;
  language: string;
  recentConcepts?: string[];
}

const LANG: Record<string, string> = { fr: 'French', en: 'English' };

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
  return parts.length ? parts.join(' · ') : 'none — write no figure at all';
}

export function buildDirectorPrompt(input: DirectorInput): { system: string; user: string } {
  const [min, max] = input.range;
  const system = [
    'You are the creative director AND author of a short professional brand film. Invent an ORIGINAL film — not a template: a concept, a visual language, and every shot.',
    `Motion designers will code each shot from your notes, with these tools: ${AUTHOR_TOOLS}.`,
    'RULES',
    `- ${min} to ${max} shots, total EXACTLY ${input.durationSec} s. Each shot 1.6–8 s and long enough to read its text (about 3 words per second + 0.8 s).`,
    `- Few words, written in ${LANG[input.language] || 'French'}. Per shot: TITLE (≤ 60 characters) and optional SUB (≤ 80). The call to action shot adds ACTION (button, ≤ 26) and CONTACT copied from the brief.`,
    '- Figures: ONLY those of FACTS, exactly as written. Never invent a number, a price, a date, a percentage.',
    '- The LAST shot is the SIGNATURE: the brand logo, with an optional TAGLINE (≤ 48).',
    '- Every shot has its own composition idea; plan how each shot hands over to the next (match cut, wipe in a brand colour, zoom through a shape…).',
    '- True to the brand charter and its art direction (colours, type, mood). A clear focal point per shot, generous space, nothing generic.',
    'OUTPUT EXACTLY this format, nothing else:',
    'FILM: <title>',
    'CONCEPT: <one sentence>',
    'BIBLE: <motion signature, colour use, typography attitude — two sentences>',
    'SHOT 1 | 3.5s | surface: primary',
    'TITLE: …',
    'SUB: …',
    'VISUAL: <what we see and how it moves, which tools; photo #n if used>',
    'MEDIA: <n or none>',
    'HANDOFF: <how it hands over to the next shot>',
    'SHOT 2 | 4s | surface: light',
    '…',
    `SHOT N | 2.6s | surface: light`,
    'SIGNATURE: yes',
    'TAGLINE: …',
    'VISUAL: …',
    `Surfaces: ${SURFACES.join(', ')} (background colour of the shot, from the charter).`,
  ].join('\n');
  const user = [
    input.sheet,
    `MOTION DIRECTION: ${DIRECTION_PITCH[input.direction]}`,
    `BRAND: ${input.brandName}`,
    `REQUEST: ${input.brief.message}`,
    input.brief.details ? `DETAILS: ${input.brief.details}` : '',
    input.brief.objective ? `OBJECTIVE: ${input.brief.objective}` : '',
    `FACTS (the only figures allowed): ${factsLine(input.facts)}`,
    `MEDIA: ${input.media.length ? input.media.map((m, i) => `#${i + 1} ${m}`).join(' · ') : 'no photo — draw everything'}`,
    `DURATION: ${input.durationSec} s · FORMATS: ${input.formats.join(', ')}`,
    input.recentConcepts?.length ? `RECENT FILMS OF THIS BRAND (do something different): ${input.recentConcepts.slice(-3).join(' / ')}` : '',
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

/** Le film écrit par le directeur, validé ; `undefined` s'il est inutilisable. */
export function parseFilm(raw: string, input: DirectorInput): AuthoredFilm | undefined {
  const text = (raw || '').replace(/\r/g, '').replace(/\*\*/g, '');
  const head = agentLines(text.split(/^\s*SHOT\s*\d+/im)[0] || '');
  const marks = [...text.matchAll(/^\s*SHOT\s*(\d+)\s*[|:,.\-–—]?\s*([\d.,]+)?\s*s?\b([^\n]*)$/gim)];
  if (!marks.length) return undefined;
  const lowerBrief = input.briefText.toLowerCase();
  const shots: AuthoredShot[] = [];
  marks.forEach((m, i) => {
    const block = text.slice((m.index ?? 0) + m[0].length, marks[i + 1]?.index ?? text.length);
    const l = agentLines(block);
    const surface = (m[3] || '').match(/surface\s*[:=]\s*([a-z]+)/i)?.[1]?.toLowerCase() as Surface | undefined;
    const isLast = i === marks.length - 1;
    const signature = /^(yes|oui|true)/i.test(l.signature || '') || (isLast && !l.title && !!(l.tagline || /logo/i.test(l.visual || '')));
    const action = cleanSlot(l.action, 26, input.briefText);
    const contactRaw = cleanSlot(l.contact, 40, input.briefText);
    // Un contact n'est jamais inventé : il figure tel quel dans le brief.
    const contact = contactRaw && lowerBrief.includes(contactRaw.toLowerCase().replace(/\s+/g, ' ').slice(0, 12)) ? contactRaw : undefined;
    let slots: Record<string, string>;
    let kind: ShotKind;
    if (signature) {
      kind = 'logo';
      slots = {};
      const tagline = cleanSlot(l.tagline || l.title, 48, input.briefText);
      if (tagline) slots.tagline = tagline;
    } else {
      const title = cleanSlot(l.title, 60, input.briefText) || cleanSlot(l.sub, 60, input.briefText);
      if (!title) return; // un plan sans texte lisible ne se replie pas proprement : écarté
      const sub = cleanSlot(l.sub, 80, input.briefText);
      kind = action ? 'cta' : 'statement';
      slots = kind === 'cta' ? { title, action: action!, ...(contact ? { contact } : {}) } : { title, ...(sub && sub !== title ? { sub } : {}) };
    }
    const media = Number((l.media || '').match(/\d+/)?.[0]);
    shots.push({
      kind,
      duration: Number(String(m[2] || '').replace(',', '.')) || 0,
      slots,
      visual: (l.visual || '').slice(0, 600),
      ...(media >= 1 && media <= input.media.length ? { media } : {}),
      ...(l.handoff ? { handoff: l.handoff.slice(0, 200) } : {}),
      ...(surface && (SURFACES as readonly string[]).includes(surface) ? { surface } : {}),
    });
  });
  // La signature : une seule, à la fin.
  const body = shots.filter((sh) => sh.kind !== 'logo');
  const signature = shots.filter((sh) => sh.kind === 'logo').pop() || { kind: 'logo' as const, duration: 2.4, slots: {}, visual: 'The brand logo resolves in the centre, calm and confident.' };
  const [, max] = input.range;
  let kept = body.slice(0, Math.max(1, max - 1));
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
    shots: timed,
  };
}

// ─── Le codeur d'un plan ────────────────────────────────────────────────────

export interface ShotBrief {
  film: AuthoredFilm;
  shot: AuthoredShot;
  index: number;
  sheet: string;
  direction: DirectionId;
  formats: string[];
  hasImage: boolean;
}

export function buildShotPrompt(b: ShotBrief): { system: string; user: string } {
  const prev = b.index > 0 ? b.film.shots[b.index - 1] : undefined;
  const system = [
    'You are a senior motion designer who codes. You are one of the authors of an ORIGINAL brand film: you write the React component of ONE shot, exactly as the creative director imagined it — an original composition, never a stock template.',
    'Answer with the TSX code only, in a single ```tsx block.',
    KIT_MANIFEST,
  ].join('\n');
  const texts = Object.entries(b.shot.slots).map(([k, v]) => `s.slots.${k} = "${v}"`);
  const user = [
    b.sheet,
    `MOTION DIRECTION: ${DIRECTION_PITCH[b.direction]}`,
    `FILM: ${b.film.title} — ${b.film.concept}`,
    b.film.bible ? `VISUAL BIBLE (every shot follows it): ${b.film.bible}` : '',
    `SHOT ${b.index + 1} of ${b.film.shots.length} · ${b.shot.duration.toFixed(1)} s${b.shot.kind === 'logo' ? ' · THE SIGNATURE: the brand logo must end clearly visible (<LogoMotion variant="draw" height={…} /> or data.logo images)' : ''}${b.shot.kind === 'cta' ? ' · THE CALL TO ACTION: the action must read as a button' : ''}.`,
    `DIRECTOR'S NOTES: ${b.shot.visual}`,
    prev?.handoff ? `ENTRANCE: the previous shot hands over like this — ${prev.handoff}. Start your shot accordingly.` : 'ENTRANCE: this is the opening of the film — grab attention in the first second.',
    b.shot.handoff ? `EXIT: hand over to the next shot like this — ${b.shot.handoff}. Do it in the last 0.4 s (useExitAt / useExitFactor).` : '',
    texts.length ? `TEXTS (read them from s.slots, show ALL of them, fully on screen): ${texts.join(' · ')}` : 'TEXTS: none — the shot is visual.',
    b.hasImage ? 'PHOTO: s.image is the photo URL of this shot — use it (an <img> with objectFit cover, masked, split or framed as the notes say).' : '',
    `FORMATS: ${b.formats.join(', ')}.`,
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
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

export function buildCritiquePrompt(b: ShotBrief): string {
  return [
    'You review three frames (start, middle, end — left to right) of ONE shot of a professional brand film.',
    `Brand and charter: ${b.sheet.replace(/\n/g, ' · ').slice(0, 600)}`,
    `Director's intent for this shot: ${b.shot.visual.slice(0, 300)}`,
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
}

export async function authorShots(input: AuthorShotsInput): Promise<AuthorShotsResult> {
  const { storyboard, film } = input;
  const rounds = input.rounds ?? 3;
  const result: AuthorShotsResult = { tried: 0, coded: 0, fallback: [], rounds: {}, rejected: {}, reviewed: 0 };
  // Les rendus de contrôle passent un par un (CPU) ; les appels au modèle, eux, en parallèle.
  let lock: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(job: () => Promise<T>): Promise<T> => {
    const run = lock.then(job, job);
    lock = run.catch(() => undefined);
    return run;
  };

  const one = async (sc: VideoSceneInstance, i: number) => {
    result.tried++;
    const brief: ShotBrief = { film, shot: film.shots[i], index: i, sheet: input.sheet, direction: input.direction, formats: input.formats, hasImage: !!sc.image };
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
        input.withPage({ html, width: spec.width, height: spec.height, strict: true }, (page) => inspectRenderedScene(page, { key: sc.key, start: sc.start, duration: sc.duration, texts }, spec, capture))
      ).catch((error: any) => [`render check failed: ${error?.message || error}`]);
    };

    let tsx: string | null = null;
    let issues: string[] = [];
    let critique: string[] = [];
    /** Le dernier code qui a passé tous les contrôles mesurés (la critique visuelle est un conseil). */
    let sound: string | null = null;
    let used = 0;
    for (let round = 0; round < rounds; round++) {
      used = round + 1;
      input.onShot?.(i, round ? 'revise' : 'writing', { round });
      const user: string = round && tsx ? buildRevisionPrompt(tsx, issues, critique) : shotPrompt.user;
      const res: { value: string | null } = await input.orchestrator.run<string | null>({
        role: 'shotCoder',
        key: `shotCoder:${i + 1}${round ? `:r${round}` : ''}`,
        minLevel: 'ultra',
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
      tsx = res.value;
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
      if (input.critic && capture.frames.length && round < rounds - 1) {
        input.onShot?.(i, 'review', { round });
        const sheetPng = await contactSheet(capture.frames).catch(() => null);
        const verdict = sheetPng ? parseCritique(await input.critic(sheetPng, buildCritiquePrompt(brief)).catch(() => null)) : null;
        if (verdict) result.reviewed++;
        if (verdict?.verdict === 'revise') {
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

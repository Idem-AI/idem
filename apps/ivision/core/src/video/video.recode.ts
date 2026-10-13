/**
 * RETOUCHER LE CODE D'UNE SCÈNE — ce que l'utilisateur demande dans la conversation s'applique au
 * rendu RÉEL : la scène est du code (plan écrit par l'IA en Ultra), c'est ce code qui change.
 *
 *   1. le codeur reçoit le composant actuel de la scène, ses textes à jour et la demande ; il rend
 *      le composant complet, modifié sur ce point seulement (sans code : il l'écrit) ;
 *   2. mêmes contrôles qu'à la création (video.coder.ts) : réparation mécanique, lint (dont « tous
 *      les textes de s.slots sont montrés »), compilation, rendu réel de la scène ;
 *   3. une réparation au plus ; refusé, l'appelant décide (garder l'ancien code, ou revenir à la
 *      composition éprouvée quand l'ancien code ne montre pas les nouveaux textes).
 *
 * Un texte retouché que le code lit déjà (`s.slots.title`) s'affiche sans passer ici : seul un
 * texte que le code ignore, ou une demande visuelle, coûte un appel au codeur.
 */
import type { Page } from 'puppeteer';
import { CreativeOrchestrator } from '../creativity/orchestrator';
import { DirectionId } from './video.direction';
import { VideoStoryboard } from './video.model';
import { SCENES } from './video.scenes';
import { autoFixSceneCode, buildCoderPrompt, buildRepairPrompt, CODABLE_SCENES, compileSceneCode, extractCode, inspectRenderedScene, lintSceneCode, visibleTexts } from './video.coder';

export interface RecodeInput {
  storyboard: VideoStoryboard;
  key: string;
  /** Ce que l'utilisateur veut voir changer dans la scène (ses mots). Absent : seuls les textes ont changé. */
  instruction?: string;
  sheet: string;
  direction: DirectionId;
  formats: string[];
  compose: (storyboard: VideoStoryboard) => Promise<{ html: string; spec: { width: number; height: number } }>;
  withPage: <T>(input: { html: string; width: number; height: number; strict?: boolean }, fn: (page: Page) => Promise<T>) => Promise<T>;
  orchestrator: CreativeOrchestrator;
}

export interface RecodeResult {
  ok: boolean;
  tsx?: string;
  issues: string[];
}

/** Les textes de la scène que son code n'affiche pas (cases remplies jamais lues dans `s.slots`). */
export async function unreadSlots(tsx: string, sceneId: string, slots: Record<string, string>): Promise<string[]> {
  const keys = (SCENES[sceneId]?.slots || []).map((d) => d.key).filter((k) => slots[k]?.trim());
  if (!keys.length) return [];
  const issues = await lintSceneCode(tsx, keys);
  const line = issues.find((i) => i.startsWith('these texts are never shown'));
  return line ? keys.filter((k) => line.includes(`s.slots.${k}`)) : [];
}

/** Une scène peut-elle recevoir du code écrit par l'IA ? (déjà codée, ou d'un type que le codeur sait écrire) */
export function canRecode(storyboard: VideoStoryboard, key: string): boolean {
  const sc = storyboard.scenes.find((s) => s.key === key);
  return !!sc && (!!sc.code?.tsx || CODABLE_SCENES.has(sc.sceneId));
}

function editPrompt(previous: string, texts: string[], instruction: string | undefined): string {
  return [
    'This is the CURRENT component of this scene, as it plays in the video:',
    '```tsx',
    previous,
    '```',
    instruction
      ? `THE CLIENT ASKS: « ${instruction.slice(0, 600)} ». Change the component to do exactly that — keep everything the client did not question (composition, colours, motion).`
      : 'The texts of this scene changed: the component must now show ALL of them.',
    texts.length ? `TEXTS (read them from s.slots, never write them in the code; show ALL of them, fully on screen): ${texts.join(' · ')}` : 'TEXTS: none.',
    'Answer with the complete updated TSX in a single ```tsx block.',
  ].join('\n');
}

export async function recodeScene(input: RecodeInput): Promise<RecodeResult> {
  const { storyboard } = input;
  const i = storyboard.scenes.findIndex((s) => s.key === input.key);
  const sc = storyboard.scenes[i];
  if (!sc) return { ok: false, issues: ['scene not found'] };
  const defs = SCENES[sc.sceneId]?.slots || [];
  const slotKeys = defs.map((d) => d.key).filter((k) => sc.slots[k]?.trim());
  const texts = defs.filter((d) => sc.slots[d.key]?.trim()).map((d) => `s.slots.${d.key} = "${sc.slots[d.key]}"`);
  const base = buildCoderPrompt(input.sheet, input.direction, {
    key: sc.key,
    sceneId: sc.sceneId,
    index: i,
    count: storyboard.scenes.length,
    duration: sc.duration,
    slots: sc.slots,
    accent: !!sc.accent,
    layout: sc.layout,
    hasImage: !!sc.image,
    hasIcons: !!storyboard.kit?.icons?.[sc.key]?.length,
    formats: input.formats,
    neighbours: [storyboard.scenes[i - 1], storyboard.scenes[i + 1]].filter(Boolean).map((n) => n!.sceneId),
  });
  const first = sc.code?.tsx
    ? [input.sheet, `SCENE ${i + 1} of ${storyboard.scenes.length}: ${sc.sceneId}; ${sc.duration.toFixed(1)} s. FORMATS: ${input.formats.join(', ')}.`, sc.image ? 'PHOTO: s.image is the photo URL of this scene — keep it visible.' : '', editPrompt(sc.code.tsx, texts, input.instruction)].filter(Boolean).join('\n')
    : `${base.user}${input.instruction ? `\nTHE CLIENT ASKS for this scene: « ${input.instruction.slice(0, 600)} ».` : ''}`;

  const ask = (user: string, attempt: number) =>
    input.orchestrator.run<string | null>({
      role: 'sceneCoder',
      key: `sceneEditor:${i + 1}${attempt ? ':repair' : ''}`,
      minLevel: 'ultra',
      profile: 'coder',
      prompt: () => ({ system: base.system, user }),
      parse: (raw) => extractCode(raw) ?? undefined,
      fallback: () => null,
    });

  const check = async (code: string): Promise<string[]> => {
    const lint = await lintSceneCode(code, slotKeys);
    if (lint.length) return lint;
    try {
      await compileSceneCode(code);
    } catch (error: any) {
      return [`compilation failed: ${error?.errors?.[0]?.text || error?.message}`];
    }
    // La scène seule passe en code pendant son contrôle : les autres gardent leur composition.
    const probe: VideoStoryboard = { ...storyboard, scenes: storyboard.scenes.map((s) => (s.key === sc.key ? { ...s, code: { tsx: code } } : { ...s, code: undefined })) };
    const { html, spec } = await input.compose(probe);
    return input
      .withPage({ html, width: spec.width, height: spec.height, strict: true }, (page) =>
        inspectRenderedScene(page, { key: sc.key, start: sc.start, duration: sc.duration, texts: visibleTexts(sc.sceneId, sc.slots), media: !!(sc.image || sc.video) }, spec)
      )
      .catch((error: any) => [`render check failed: ${error?.message || error}`]);
  };

  let tsx: string | null = null;
  let issues: string[] = ['no code returned'];
  for (let attempt = 0; attempt < 2; attempt++) {
    const user: string = attempt && tsx ? buildRepairPrompt(tsx, issues) : first;
    const raw: string | null = (await ask(user, attempt)).value;
    if (!raw) continue;
    tsx = autoFixSceneCode(raw).code;
    issues = await check(tsx);
    if (!issues.length) return { ok: true, tsx, issues: [] };
  }
  return { ok: false, issues };
}

/**
 * LE HARNAIS — ce qui entoure le code de chaque scène, sans jamais le modifier.
 *
 *   durée     la scène dure EXACTEMENT ce que prévoit le film : le code tourne en tâche fille,
 *             le harnais attend la durée prévue puis la scène se termine (ce qui dépasse est coupé,
 *             ce qui manque est tenu sur la dernière image) ;
 *   contexte  textes, médias, marque, voix et tempo passés en paramètre (`SceneContext`) ;
 *   erreurs   une exception du code est attribuée à SA scène et montrée telle quelle à sa place —
 *             jamais remplacée par une autre composition ;
 *   sons      `ctx.sfx(kind)` note l'instant ; le serveur mixe ces effets au rendu ;
 *   voix      les sous-titres de la voix off (s'ils sont demandés) sont posés au-dessus.
 */
import { makeScene2D, Rect, Txt, View2D } from '@motion-canvas/2d';
import { createRef, ThreadGenerator, useThread, waitFor } from '@motion-canvas/core';
import type { SceneContext, SfxKind } from '../kit/context';
import { readableOn, safeArea } from '../kit/helpers';
import type { FilmData, SceneErrorRecord, SfxCueRecord } from './film-data';

export type AuthorScene = (view: View2D, ctx: SceneContext) => ThreadGenerator;

export interface FilmHooks {
  onError(error: SceneErrorRecord): void;
  onCue(cue: SfxCueRecord): void;
}

const LABELS = {
  fr: (n: number) => `Scène ${n} — le code de cette scène ne s’exécute pas`,
  en: (n: number) => `Scene ${n} — this scene’s code does not run`,
};

function errorCard(view: View2D, data: FilmData, index: number, message: string): void {
  const unit = Math.min(data.width, data.height) / 100;
  view.add(
    <Rect width={data.width} height={data.height} fill={'#f3f0ea'} zIndex={2000} layout direction={'column'} justifyContent={'center'} alignItems={'center'} gap={unit * 3} padding={unit * 8}>
      <Txt text={LABELS[data.lang](index + 1)} fill={'#8a1c1c'} fontSize={unit * 4.2} fontWeight={700} fontFamily={'sans-serif'} textWrap textAlign={'center'} width={data.width - unit * 16} />
      <Txt text={message.slice(0, 400)} fill={'#3b3b3b'} fontSize={unit * 3} fontFamily={'monospace'} textWrap textAlign={'center'} width={data.width - unit * 16} />
    </Rect>
  );
}

function* captions(view: View2D, data: FilmData, sceneStart: number, sceneEnd: number): ThreadGenerator {
  const lines = (data.captions || []).filter((c) => c.end > sceneStart && c.start < sceneEnd);
  if (!lines.length) return;
  const unit = Math.min(data.width, data.height) / 100;
  const area = safeArea({ width: data.width, height: data.height, format: data.format });
  const ink = '#ffffff';
  const box = createRef<Rect>();
  const label = createRef<Txt>();
  view.add(
    <Rect ref={box} zIndex={1000} y={area.bottom - unit * 6} fill={'rgba(17,20,24,0.72)'} radius={unit * 1.4} padding={[unit * 1.4, unit * 2.6]} layout opacity={0}>
      <Txt ref={label} text={''} fill={readableOn('#111418', ink)} fontSize={unit * 3.6} fontWeight={600} fontFamily={data.brand.fonts.body} textWrap textAlign={'center'} maxWidth={area.width * 0.9} />
    </Rect>
  );
  for (const line of lines) {
    const at = Math.max(0, line.start - sceneStart);
    const rest = at - useThread().time();
    if (rest > 0) yield* waitFor(rest);
    label().text(line.text);
    box().opacity(1);
    const hold = Math.min(line.end, sceneEnd) - sceneStart - useThread().time();
    if (hold > 0) yield* waitFor(hold);
    box().opacity(0);
  }
}

/** Les scènes Motion Canvas du film : une par scène prévue, chacune enveloppée par le harnais. */
export function buildScenes(modules: Record<string, AuthorScene | undefined>, data: FilmData, hooks: FilmHooks) {
  return data.scenes.map((plan, index) => {
    const description = makeScene2D(function* (view) {
      // Les données sont relues à chaque passage : une retouche de texte se voit sans recompiler.
      const scene = data.scenes.find((s) => s.key === plan.key) || plan;
      view.fill(data.background);
      const last = index === data.scenes.length - 1;
      const ctx: SceneContext = {
        key: scene.key,
        index,
        count: data.scenes.length,
        format: data.format,
        width: data.width,
        height: data.height,
        unit: Math.min(data.width, data.height) / 100,
        duration: scene.duration,
        fps: data.fps,
        texts: { ...scene.texts },
        media: scene.media.map((m) => ({ ...m })),
        brand: data.brand,
        ...(scene.voice ? { voice: { ...scene.voice } } : {}),
        ...(data.beat?.bpm ? { beat: { bpm: data.beat.bpm, first: firstBeat(data.beat, scene.start) } } : {}),
        sfx: (kind: SfxKind, gain?: number) => hooks.onCue({ kind, t: Math.round((scene.start + useThread().time()) * 1000) / 1000, scene: scene.key, ...(gain !== undefined && gain > 0 && gain < 1 ? { gain } : {}) }),
      };
      const author = modules[scene.key];
      if (scene.compileError || typeof author !== 'function') {
        const message = scene.compileError || 'export default manquant';
        hooks.onError({ key: scene.key, stage: 'compile', message });
        errorCard(view, data, index, message);
      } else {
        yield guarded(author, view, ctx, (message) => {
          hooks.onError({ key: scene.key, stage: 'runtime', message });
          errorCard(view, data, index, message);
        });
      }
      if (data.captions?.length) yield captions(view, data, scene.start, scene.start + scene.duration);
      // Une image de plus pour toute scène suivie d'une autre : la première image de la suivante
      // remplace la dernière de celle-ci (Motion Canvas), le film garde ainsi sa durée exacte.
      yield* waitFor(scene.duration + (last ? 0 : 1 / data.fps));
    });
    (description as unknown as { name: string }).name = plan.key;
    return description;
  });
}

function* guarded(author: AuthorScene, view: View2D, ctx: SceneContext, fail: (message: string) => void): ThreadGenerator {
  try {
    yield* author(view, ctx);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

/** Le premier temps de la musique à partir du début d'une scène. */
function firstBeat(beat: { bpm: number; offset: number }, sceneStart: number): number {
  const period = 60 / beat.bpm;
  const k = Math.ceil((sceneStart - beat.offset) / period - 1e-6);
  return Math.max(0, beat.offset + k * period - sceneStart);
}

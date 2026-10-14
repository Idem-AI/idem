/**
 * Le pilote du RENDU serveur : la page expose `window.__IDEM_RENDER__`, que Puppeteer appelle.
 *
 *   init(from)   polices chargées, film calculé (erreurs et effets sonores connus), lecture placée à `from` ;
 *   step()       rend l'image courante, la rend en JPEG (base64), puis avance d'une image ;
 *   still(f)     l'image `f` seule (vignettes des scènes, contrôle technique).
 */
import { PlaybackState } from '@motion-canvas/core';
import { FilmEngine, loadFonts } from './engine';
import type { AuthorScene } from './harness';
import type { FilmData } from './film-data';

export function startRender(modules: Record<string, AuthorScene | undefined>, data: FilmData): void {
  let engine: FilmEngine | null = null;
  const api = {
    async init(from = 0) {
      await loadFonts(data.fontFamilies);
      engine = new FilmEngine(modules, data);
      await engine.init(PlaybackState.Rendering);
      if (from > 0) await engine.seek(from);
      return { frames: engine.frames, errors: engine.errorList(), cues: engine.cueList() };
    },
    async step(quality = 0.92) {
      if (!engine) throw new Error('not_initialized');
      await engine.draw();
      const data64 = engine.canvas.toDataURL('image/jpeg', quality).slice('data:image/jpeg;base64,'.length);
      const frame = engine.frame;
      const done = engine.finished || frame >= engine.frames - 1;
      if (!done) await engine.next();
      return { data: data64, frame, done };
    },
    async still(frame: number, quality = 0.85) {
      if (!engine) throw new Error('not_initialized');
      await engine.replay(frame);
      await engine.draw();
      return { data: engine.canvas.toDataURL('image/jpeg', quality).slice('data:image/jpeg;base64,'.length), errors: engine.errorList() };
    },
    errors: () => engine?.errorList() ?? [],
    cues: () => engine?.cueList() ?? [],
  };
  (window as unknown as { __IDEM_RENDER__: typeof api }).__IDEM_RENDER__ = api;
}

/**
 * LE LECTEUR DE L'APERÇU — le même film que le MP4, joué en temps réel dans un iframe isolé.
 *
 * Il dialogue avec l'éditeur parent (`@idem/shared-video-editor`) par `postMessage` :
 *
 *   → parent  `ivision:ready`    durée, scènes (début, fin), erreurs par scène
 *             `ivision:loading`  sons chargés sur sons à charger
 *             `ivision:playable` tous les sons sont prêts : la lecture peut être proposée
 *             `ivision:time`     instant courant et état de lecture
 *             `ivision:errors`   erreurs constatées pendant la lecture
 *   ← parent  `ivision:play` · `ivision:pause` · `ivision:seek {t}` · `ivision:focus {key}`
 *             `ivision:edit {key, texts?, media?}` : une retouche vue tout de suite (les données
 *             changent, le code de la scène reste le même)
 *
 * Le son : musique, voix off et effets sonores joués par des éléments audio calés sur la lecture.
 */
import { PlaybackState } from '@motion-canvas/core';
import { FilmEngine, loadFonts } from './engine';
import type { AuthorScene } from './harness';
import type { FilmAudio, FilmData } from './film-data';

type Incoming =
  | { type: 'ivision:play' }
  | { type: 'ivision:pause' }
  | { type: 'ivision:seek'; t: number }
  | { type: 'ivision:focus'; key: string }
  | { type: 'ivision:edit'; key: string; texts?: Record<string, string>; media?: { id: string; url: string; width?: number; height?: number }[]; focus?: boolean };

export function startPlayer(modules: Record<string, AuthorScene | undefined>, data: FilmData, audio: FilmAudio, mount: HTMLElement): void {
  const post = (message: Record<string, unknown>) => window.parent?.postMessage(message, '*');
  let engine: FilmEngine;
  let playing = false;
  let busy = false;
  let lastTick = 0;
  let acc = 0;
  let timers: number[] = [];
  const music = audio.music ? Object.assign(new Audio(audio.music.url), { preload: 'auto', volume: audio.music.gain }) : null;
  const voices = audio.voice.map((v) => ({ ...v, el: Object.assign(new Audio(v.url), { preload: 'auto' }) }));

  const now = () => engine.frame / data.fps;

  const stopAudio = () => {
    timers.forEach((t) => clearTimeout(t));
    timers = [];
    music?.pause();
    voices.forEach((v) => v.el.pause());
  };

  const startAudio = (t: number) => {
    stopAudio();
    if (music) {
      music.currentTime = Math.max(0, audio.music!.startAt + t);
      void music.play().catch(() => undefined);
    }
    for (const v of voices) {
      if (v.at + (v.el.duration || 30) < t) continue;
      const delay = (v.at - t) * 1000;
      const go = () => {
        v.el.currentTime = Math.max(0, t - v.at);
        void v.el.play().catch(() => undefined);
      };
      if (delay <= 0) go();
      else timers.push(window.setTimeout(() => ((v.el.currentTime = 0), void v.el.play().catch(() => undefined)), delay));
    }
    for (const cue of engine.cueList()) {
      const sound = audio.sfx[cue.kind];
      if (!sound || cue.t < t) continue;
      timers.push(
        window.setTimeout(() => {
          const el = new Audio(sound.url);
          el.volume = Math.min(1, sound.gain * (cue.gain ?? 1));
          void el.play().catch(() => undefined);
        }, (cue.t - t) * 1000)
      );
    }
  };

  let knownErrors = 0;
  const report = () => {
    post({ type: 'ivision:time', t: Math.round(now() * 1000) / 1000, playing });
    // Une scène qui échoue en cours de lecture (erreur apparue après le calcul) : l'éditeur le montre.
    const errors = engine.errorList();
    if (errors.length !== knownErrors) {
      knownErrors = errors.length;
      post({ type: 'ivision:errors', errors });
    }
  };

  const tick = async (stamp: number) => {
    if (!playing) return;
    if (!busy) {
      busy = true;
      acc += Math.min(0.25, (stamp - lastTick) / 1000);
      lastTick = stamp;
      const step = 1 / data.fps;
      let advanced = false;
      while (acc >= step) {
        acc -= step;
        if (engine.frame >= engine.frames - 1) {
          playing = false;
          stopAudio();
          break;
        }
        await engine.next();
        advanced = true;
      }
      if (advanced) await engine.draw();
      report();
      busy = false;
    }
    if (playing) requestAnimationFrame(tick);
  };

  const play = () => {
    if (playing) return;
    if (engine.frame >= engine.frames - 1) void seek(0);
    playing = true;
    engine.setState(PlaybackState.Playing);
    acc = 0;
    lastTick = performance.now();
    startAudio(now());
    requestAnimationFrame(tick);
    report();
  };

  const pause = () => {
    playing = false;
    engine.setState(PlaybackState.Paused);
    stopAudio();
    report();
  };

  const seek = async (t: number) => {
    const was = playing;
    if (was) pause();
    await engine.seek(t * data.fps);
    await engine.draw();
    report();
    if (was) play();
  };

  const edit = async (msg: Extract<Incoming, { type: 'ivision:edit' }>) => {
    const scene = data.scenes.find((s) => s.key === msg.key);
    if (!scene) return;
    if (msg.texts) scene.texts = { ...scene.texts, ...msg.texts };
    if (msg.media) for (const m of msg.media) scene.media = scene.media.map((x) => (x.id === m.id ? { ...x, ...m } : x));
    const was = playing;
    if (was) pause();
    const frame = msg.focus ? Math.round((scene.start + Math.min(scene.duration * 0.6, 1.4)) * data.fps) : engine.frame;
    await engine.replay(frame);
    await engine.draw();
    report();
  };

  /**
   * Sons, clips et photos chargés AVANT de proposer la lecture (une coupure en pleine vidéo serait pire
   * qu'une attente). Les clips et photos le sont comme les charge Motion Canvas (crossOrigin anonyme) :
   * le cache du navigateur les lui rend prêts. Avant, un clip pas encore chargé n'était pas dessiné en
   * temps réel — la scène restait sans son média alors que l'export, lui, l'attendait.
   */
  const preload = async () => {
    const urls = [...(music ? [audio.music!.url] : []), ...voices.map((v) => v.url), ...Object.values(audio.sfx).map((x) => x!.url)];
    const visuals = [...new Map(data.scenes.flatMap((s) => s.media).filter((m) => m.url).map((m) => [m.url, m.kind] as const)).entries()];
    const total = urls.length + visuals.length;
    let loaded = 0;
    post({ type: 'ivision:loading', loaded, total });
    const settle = (resolve: () => void) => () => {
      loaded++;
      post({ type: 'ivision:loading', loaded, total });
      resolve();
    };
    const sounds = urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const el = music && url === audio.music!.url ? music : voices.find((v) => v.url === url)?.el || new Audio(url);
          const done = settle(resolve);
          if (el.readyState >= 4) return done();
          const timer = window.setTimeout(done, 15000);
          el.addEventListener('canplaythrough', () => (clearTimeout(timer), done()), { once: true });
          el.addEventListener('error', () => (clearTimeout(timer), done()), { once: true });
          el.preload = 'auto';
          el.load();
        })
    );
    const media = visuals.map(
      ([url, kind]) =>
        new Promise<void>((resolve) => {
          const done = settle(resolve);
          const timer = window.setTimeout(done, 20000);
          const finish = () => (clearTimeout(timer), done());
          if (kind === 'image') {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = finish;
            img.onerror = finish;
            img.src = url;
            return;
          }
          const el = document.createElement('video');
          el.crossOrigin = 'anonymous';
          el.muted = true;
          el.preload = 'auto';
          el.addEventListener('canplaythrough', finish, { once: true });
          el.addEventListener('error', finish, { once: true });
          el.src = url;
          el.load();
        })
    );
    await Promise.all([...sounds, ...media]);
    // L'image affichée a pu être dessinée sans ses médias : elle est redessinée, maintenant qu'ils sont là.
    if (!playing && visuals.length) {
      await engine.replay(engine.frame);
      await engine.draw();
    }
    post({ type: 'ivision:playable' });
  };

  const fit = (canvas: HTMLCanvasElement) => {
    const scale = Math.min(window.innerWidth / data.width, window.innerHeight / data.height);
    canvas.style.width = `${Math.floor(data.width * scale)}px`;
    canvas.style.height = `${Math.floor(data.height * scale)}px`;
  };

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return;
    const msg = event.data as Incoming;
    if (!msg || typeof msg !== 'object' || !engine) return;
    if (msg.type === 'ivision:play') play();
    else if (msg.type === 'ivision:pause') pause();
    else if (msg.type === 'ivision:seek') void seek(Number(msg.t) || 0);
    else if (msg.type === 'ivision:focus') {
      const scene = data.scenes.find((s) => s.key === msg.key);
      if (scene) void seek(scene.start + Math.min(scene.duration * 0.6, 1.4));
    } else if (msg.type === 'ivision:edit') void edit(msg);
  });

  void (async () => {
    await loadFonts(data.fontFamilies);
    engine = new FilmEngine(modules, data);
    await engine.init(PlaybackState.Paused);
    const canvas = engine.canvas;
    canvas.setAttribute('role', 'img');
    canvas.addEventListener('click', () => (playing ? pause() : play()));
    mount.appendChild(canvas);
    fit(canvas);
    window.addEventListener('resize', () => fit(canvas));
    await engine.seek(Math.round(Math.min(1.2, data.scenes[0]?.duration ?? 1) * data.fps));
    await engine.draw();
    post({
      type: 'ivision:ready',
      duration: data.scenes.reduce((end, s) => Math.max(end, s.start + s.duration), 0),
      scenes: data.scenes.map((s) => ({ key: s.key, start: s.start, end: s.start + s.duration })),
      errors: engine.errorList(),
    });
    knownErrors = engine.errorList().length;
    report();
    void preload();
  })().catch((error) => post({ type: 'ivision:errors', errors: [{ key: '', stage: 'runtime', message: String(error?.message || error) }] }));
}

/**
 * Point d'entrée du moteur React.
 *
 * Contrat (inchangé pour le rendu et l'aperçu) :
 *   window.__IDEM_VIDEO__.ready      promesse : polices, images, ajustement, médias prêts
 *   window.__IDEM_VIDEO__.seek(t)    pose la vidéo à l'instant t (promesse si un clip doit se positionner)
 *   window.__IDEM_VIDEO__.cues()     moments sonores déclarés par les scènes et les transitions
 *
 * En aperçu, un PONT D'ÉDITION (postMessage, parent direct seulement) : l'éditeur d'iVision
 * et d'IDEM change un texte ou une image et la vidéo se redessine aussitôt, posée à l'instant
 * où ce texte est à l'écran (cf. `setupEditBridge`).
 */
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Video } from './App';
import { SceneData, VideoData } from './context';
import { timeline } from './transitions';
import { allCues } from './cues';
import { mediaReady, syncClipsExact, syncClipsPreview, syncLotties, syncThree } from './media';
// Feuille compilée au paquet : Tailwind (thème de la charte + utilitaires) puis engine.css.
import css from 'virtual:engine-css';

declare global {
  interface Window {
    __VIDEO_DATA__: VideoData;
    __IDEM_VIDEO__: { duration: number; ready: Promise<boolean>; seek: (t: number) => Promise<unknown> | undefined; cues: () => unknown[] };
  }
}

// `let` : le pont d'édition remplace les données (nouvel objet, les mémos du moteur se recalculent).
let data = window.__VIDEO_DATA__;
const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);

const host = document.createElement('div');
host.id = 'host';
document.body.appendChild(host);
const root = createRoot(host);
let current = 0;

/** Version des données : une retouche remonte la vidéo (textes réajustés, débordements remesurés). */
let version = 0;

function draw(t: number) {
  current = Math.max(0, Math.min(data.duration, t));
  flushSync(() => root.render(<Video key={version} data={data} t={current} />));
  syncLotties(current);
  syncThree(current);
}

const timeout = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Toutes les graisses des polices de la marque, avant la première mesure. */
async function loadFonts() {
  const jobs: Promise<unknown>[] = [];
  for (const f of [data.fonts.display, data.fonts.body]) {
    if (!f) continue;
    for (const w of ['400', '500', '600', '700', '800', '900']) jobs.push(document.fonts.load(`${w} 40px "${f}"`, 'AÀaé0').catch(() => undefined));
  }
  await Promise.race([Promise.all(jobs), timeout(10000)]);
  await Promise.race([document.fonts.ready, timeout(8000)]);
}

function waitImages() {
  return Promise.all(
    [...document.images].map(
      (img) =>
        new Promise<void>((res) => {
          const done = () => res();
          const failed = () => {
            img.style.display = 'none';
            res();
          };
          if (img.complete) (img.decode ? img.decode() : Promise.resolve()).then(done, failed);
          else {
            img.addEventListener('load', () => (img.decode ? img.decode() : Promise.resolve()).then(done, failed));
            img.addEventListener('error', failed);
          }
        })
    )
  );
}

/** Un logo illisible (SVG invalide, lien mort) est retiré : la signature affiche alors le nom. */
async function checkLogos() {
  const test = (src?: string) =>
    !src
      ? Promise.resolve(undefined)
      : new Promise<string | undefined>((res) => {
          const img = new Image();
          img.onload = () => (img.decode ? img.decode() : Promise.resolve()).then(() => res(src), () => res(undefined));
          img.onerror = () => res(undefined);
          img.src = src;
          setTimeout(() => res(src), 8000);
        });
  const [onLight, onDark, icon] = await Promise.all([test(data.logo.onLight), test(data.logo.onDark), test(data.logo.icon)]);
  data.logo = { onLight, onDark, icon };
}

const ready = (async () => {
  await Promise.all([loadFonts(), checkLogos()]);
  draw(0); // premier rendu : ajustement des textes (mesuré une fois) et montage des médias
  await Promise.race([waitImages(), timeout(15000)]);
  await Promise.race([mediaReady(), timeout(25000)]);
  draw(0);
  await (syncClipsExact(0) || Promise.resolve());
  if (data.mode === 'preview') setupEditBridge(setupPreview());
  return true;
})();

window.__IDEM_VIDEO__ = {
  duration: data.duration,
  ready,
  seek(t: number) {
    draw(t);
    return syncClipsExact(current) || undefined;
  },
  cues: () => allCues(),
};

// ─── Aperçu : lecture en temps réel, musique et effets synchronisés ─────────

function setupPreview() {
  document.body.classList.add('preview');
  const stage = document.getElementById('host')!;
  const wrap = document.createElement('div');
  wrap.className = 'pv-wrap';
  stage.parentNode!.insertBefore(wrap, stage);
  wrap.appendChild(stage);
  const resize = () => {
    const k = Math.min(window.innerWidth / data.width, window.innerHeight / data.height);
    stage.style.transform = `scale(${k})`;
    stage.style.transformOrigin = '0 0';
    wrap.style.width = `${data.width * k}px`;
    wrap.style.height = `${data.height * k}px`;
  };
  resize();
  window.addEventListener('resize', resize);

  const audio = data.music?.url ? new Audio(data.music.url) : null;
  if (audio) audio.preload = 'auto';
  const pools: Record<string, { list: HTMLAudioElement[]; i: number; gain: number }> = {};
  if (data.sfx?.enabled) {
    for (const [kind, snd] of Object.entries(data.sfx.sounds)) {
      pools[kind] = { list: [0, 1, 2].map(() => Object.assign(new Audio(snd.url), { preload: 'auto' })), i: 0, gain: snd.gain };
    }
  }
  const cueList = (allCues() as { t: number; kind: string; gain: number }[]).filter((c) => pools[c.kind]);

  const ui = document.createElement('div');
  ui.className = 'pv-ui';
  ui.innerHTML = '<button class="pv-btn" type="button" aria-label="Lecture">▶</button><div class="pv-bar"><div class="pv-fill"></div></div><span class="pv-time">0:00</span>';
  wrap.appendChild(ui);
  const btn = ui.querySelector<HTMLButtonElement>('.pv-btn')!;
  const bar = ui.querySelector<HTMLDivElement>('.pv-bar')!;
  const fill = ui.querySelector<HTMLDivElement>('.pv-fill')!;
  const time = ui.querySelector<HTMLSpanElement>('.pv-time')!;
  const big = document.createElement('button');
  big.className = 'pv-big';
  big.type = 'button';
  big.setAttribute('aria-label', 'Lecture');
  big.innerHTML = '<span>▶</span>';
  wrap.appendChild(big);

  let playing = false;
  let startedAt = 0;
  let offset = 0;
  let lastT = 0;
  const poster = Math.min(data.duration * 0.25, data.scenes[0] ? data.scenes[0].start + data.scenes[0].duration * 0.8 : 1);
  draw(poster);

  const now = () => (playing ? Math.min(data.duration, offset + (performance.now() - startedAt) / 1000) : offset);
  const syncAudio = (t: number) => {
    if (!audio || !data.music) return;
    const want = (data.music.startAt || 0) + t;
    if (Math.abs(audio.currentTime - want) > 0.15) audio.currentTime = want;
    audio.volume = Math.max(0, Math.min(1, Math.min(t / 0.5, (data.duration - t) / 1.2))) * 0.85;
  };
  const play = () => {
    if (offset >= data.duration - 0.05) offset = 0;
    playing = true;
    startedAt = performance.now();
    lastT = offset - 0.001;
    btn.textContent = '❚❚';
    big.style.display = 'none';
    if (audio) {
      syncAudio(offset);
      audio.play().catch(() => undefined);
    }
  };
  const pause = () => {
    offset = now();
    playing = false;
    btn.textContent = '▶';
    audio?.pause();
  };
  const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t) % 60).padStart(2, '0')}`;
  const loop = () => {
    const t = now();
    draw(t);
    syncClipsPreview(t, playing);
    fill.style.width = `${(t / data.duration) * 100}%`;
    time.textContent = fmt(t);
    if (playing) {
      syncAudio(t);
      for (const c of cueList) {
        if (c.t > lastT && c.t <= t) {
          const pool = pools[c.kind];
          const a = pool.list[pool.i++ % pool.list.length];
          a.currentTime = 0;
          a.volume = Math.min(1, pool.gain * c.gain);
          a.play().catch(() => undefined);
        }
      }
      if (t >= data.duration) {
        offset = 0;
        playing = false;
        audio?.pause();
        btn.textContent = '▶';
        big.style.display = 'flex';
        draw(poster);
      }
    }
    lastT = t;
    requestAnimationFrame(loop);
  };
  btn.addEventListener('click', () => (playing ? pause() : play()));
  big.addEventListener('click', () => {
    offset = 0;
    play();
  });
  bar.addEventListener('click', (e) => {
    const r = bar.getBoundingClientRect();
    offset = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * data.duration;
    startedAt = performance.now();
    lastT = offset;
    if (audio) syncAudio(offset);
    big.style.display = 'none';
  });
  requestAnimationFrame(loop);
  return {
    play,
    pause,
    seek(t: number) {
      if (playing) pause();
      offset = Math.max(0, Math.min(data.duration, t));
      lastT = offset;
      big.style.display = 'none';
      draw(offset);
    },
    state: () => ({ t: now(), playing }),
  };
}

type PreviewControls = ReturnType<typeof setupPreview>;

/** Les scènes replacées sur la ligne de temps (fenêtres d'entrée et de sortie). */
const timed = () => timeline(data.scenes as any, data.direction.pacing.transition, data.duration);

/** L'instant où les textes d'une scène sont pleinement à l'écran : entrés, pas encore sortis. */
function momentOf(key: string): number | null {
  const s = timed().find((x) => x.key === key);
  if (!s) return null;
  const until = s.tout ?? s.end;
  return Math.min(until - 0.05, s.tin + Math.max(0.35, (until - s.tin) * 0.55));
}

/** Ce que l'éditeur peut retoucher sans recomposer la vidéo : textes et médias d'une scène. */
type EditPatch = { slots?: Record<string, string>; image?: string; images?: string[] };

function applyEdit(key: string, patch: EditPatch): boolean {
  const scene = data.scenes.find((x) => x.key === key);
  if (!scene) return false;
  const next: SceneData = {
    ...scene,
    ...(patch.slots ? { slots: { ...scene.slots, ...Object.fromEntries(Object.entries(patch.slots).map(([k, v]) => [k, String(v ?? '').slice(0, 400)])) } } : {}),
    ...(typeof patch.image === 'string' && /^(https?:|data:image\/)/.test(patch.image) ? { image: patch.image } : {}),
    ...(Array.isArray(patch.images) ? { images: patch.images.filter((u) => typeof u === 'string' && /^(https?:|data:image\/)/.test(u)).slice(0, 12) } : {}),
  };
  data = { ...data, scenes: data.scenes.map((x) => (x.key === key ? next : x)) };
  window.__VIDEO_DATA__ = data;
  version++;
  return true;
}

/**
 * Le pont d'édition. Messages reçus du parent :
 *   { type: 'ivision:edit', key, slots?, image?, images?, focus? }  retouche + pose sur la scène
 *   { type: 'ivision:focus', key }                                  pose la vidéo sur la scène
 *   { type: 'ivision:seek', t } · { type: 'ivision:play' } · { type: 'ivision:pause' }
 * Messages envoyés : `ivision:ready` (durée, scènes et leurs instants), `ivision:time`.
 */
function setupEditBridge(controls: PreviewControls) {
  if (window.parent === window) return;
  const post = (message: Record<string, unknown>) => window.parent.postMessage(message, '*');
  post({
    type: 'ivision:ready',
    duration: data.duration,
    scenes: timed().map((s) => ({ key: s.key, sceneId: s.sceneId, start: s.start, end: s.end, moment: momentOf(s.key) })),
  });
  window.addEventListener('message', (event) => {
    // Seul le parent direct pilote l'aperçu (l'éditeur qui l'a ouvert).
    if (event.source !== window.parent) return;
    const m = event.data as { type?: string; key?: string; t?: number; focus?: boolean } & EditPatch;
    if (!m || typeof m.type !== 'string') return;
    if (m.type === 'ivision:edit' && typeof m.key === 'string') {
      if (!applyEdit(m.key, m)) return;
      const at = m.focus === false ? controls.state().t : momentOf(m.key);
      controls.seek(at ?? controls.state().t);
      // Une nouvelle image se charge : on redessine quand elle est prête.
      if (m.image || m.images) setTimeout(() => controls.seek(controls.state().t), 400);
    } else if (m.type === 'ivision:focus' && typeof m.key === 'string') {
      const at = momentOf(m.key);
      if (at !== null) controls.seek(at);
    } else if (m.type === 'ivision:seek' && typeof m.t === 'number') controls.seek(m.t);
    else if (m.type === 'ivision:play') controls.play();
    else if (m.type === 'ivision:pause') controls.pause();
  });
  let last = -1;
  const tick = () => {
    const { t, playing } = controls.state();
    if (Math.abs(t - last) > 0.08) {
      last = t;
      post({ type: 'ivision:time', t, playing });
    }
    setTimeout(tick, 100);
  };
  tick();
}

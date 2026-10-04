/**
 * Médias pilotés par le temps : clips vidéo, animations Lottie, scènes 3D.
 *
 * Chaque média s'inscrit dans un registre au montage ; à chaque image, le moteur
 * le pose à l'instant t (clip positionné, Lottie sur sa trame, 3D recalculée
 * puis dessinée). Au rendu, rien ne « joue » tout seul.
 */
import { useEffect, useRef } from 'react';
import { Timed, useScene } from './context';
import { addon, MountedMedia } from './shared';

// ─── Registres ──────────────────────────────────────────────────────────────

interface ClipEntry { v: HTMLVideoElement; s: Timed }
interface LottieEntry { anim: any; s: Timed; fr: number; total: number; loop: boolean }
interface DrivenEntry { s: Timed; media?: MountedMedia; failed?: boolean }

const clips: ClipEntry[] = [];
const lotties: LottieEntry[] = [];
const driven: DrivenEntry[] = [];
const pending: Promise<unknown>[] = [];

export function mediaReady(): Promise<unknown> {
  return Promise.all(pending);
}

const visible = (s: Timed, t: number) => t >= s.visFrom - 0.05 && t <= s.visTo + 0.05;

function clipTime(c: ClipEntry, t: number): number {
  const dur = c.v.duration || 0;
  if (!dur) return 0;
  const local = Math.max(0, t - c.s.visFrom);
  const usable = Math.max(0.5, dur - 0.05);
  return local > usable ? local % usable : local;
}

/** Rendu : chaque clip visible est posé exactement à son image (promesse). */
export function syncClipsExact(t: number): Promise<unknown> | null {
  const jobs: Promise<unknown>[] = [];
  for (const c of clips) {
    if (!visible(c.s, t) || !c.v.duration) continue;
    const want = clipTime(c, t);
    if (Math.abs(c.v.currentTime - want) < 0.004) continue;
    jobs.push(
      new Promise<void>((res) => {
        let done = false;
        const fin = () => {
          if (!done) {
            done = true;
            res();
          }
        };
        c.v.addEventListener('seeked', fin, { once: true });
        try {
          c.v.currentTime = want;
        } catch {
          fin();
        }
        setTimeout(fin, 3000);
      })
    );
  }
  return jobs.length ? Promise.all(jobs) : null;
}

/** Aperçu : les clips jouent nativement, recalés s'ils dérivent. */
export function syncClipsPreview(t: number, playing: boolean): void {
  for (const c of clips) {
    const on = visible(c.s, t);
    const want = clipTime(c, t);
    if (!on || !playing) {
      if (!c.v.paused) c.v.pause();
      if (on && Math.abs(c.v.currentTime - want) > 0.1) c.v.currentTime = want;
      continue;
    }
    if (Math.abs(c.v.currentTime - want) > 0.3) c.v.currentTime = want;
    if (c.v.paused) c.v.play().catch(() => undefined);
  }
}

export function syncLotties(t: number): void {
  for (const l of lotties) {
    if (!visible(l.s, t)) continue;
    let f = Math.max(0, t - l.s.tin) * l.fr;
    f = l.loop ? f % l.total : Math.min(l.total - 1, f);
    l.anim.goToAndStop(f, true);
  }
}

/** 3D et Rive : chaque média visible est posé à son temps local, puis dessiné. */
export function syncThree(t: number): void {
  for (const e of driven) {
    if (e.failed || !e.media || !visible(e.s, t)) continue;
    e.media.update(Math.max(0, t - e.s.tin));
  }
}

// ─── Clip vidéo ─────────────────────────────────────────────────────────────

export function Clip({ src, className }: { src: string; className?: string }) {
  const s = useScene();
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    clips.push({ v, s });
    pending.push(
      new Promise<void>((res) => {
        if (v.readyState >= 2) return res();
        v.addEventListener('loadeddata', () => res(), { once: true });
        v.addEventListener('error', () => {
          v.style.visibility = 'hidden';
          res();
        }, { once: true });
        setTimeout(res, 15000);
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <video ref={ref} className={className} src={src} muted playsInline preload="auto" />;
}

// ─── Lottie ─────────────────────────────────────────────────────────────────

export function LottieBox({ data, loop, className }: { data: unknown; loop: boolean; className?: string }) {
  const s = useScene();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const lottie = addon('lottie');
    if (!ref.current || !data || !lottie) return;
    const json: any = JSON.parse(JSON.stringify(data));
    pending.push(
      new Promise<void>((res) => {
        try {
          const anim = lottie.loadAnimation({ container: ref.current, renderer: 'svg', loop: false, autoplay: false, animationData: json, rendererSettings: { preserveAspectRatio: 'xMidYMid meet' } });
          lotties.push({ anim, s, fr: json.fr || 30, total: Math.max(1, (json.op || 60) - (json.ip || 0)), loop });
          anim.addEventListener('DOMLoaded', () => {
            anim.goToAndStop(0, true);
            res();
          });
        } catch {
          res();
        }
        setTimeout(res, 5000);
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={ref} className={className} />;
}

// ─── 3D (addon three : React Three Fiber) ───────────────────────────────────

/** Monte un média piloté (3D, Rive) : inscrit au registre, prêt avant la première capture. */
function useDriven(mount: (el: HTMLCanvasElement) => Promise<MountedMedia> | null) {
  const s = useScene();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const job = mount(ref.current);
    if (!job) return;
    const entry: DrivenEntry = { s };
    driven.push(entry);
    pending.push(
      job.then(
        (media) => {
          entry.media = media;
        },
        (e) => {
          entry.failed = true;
          console.error('driven media', e?.message);
        }
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

export function ThreeView({ cfg, width, height, horizontal }: { cfg: Record<string, any>; width: number; height: number; horizontal: boolean }) {
  const s = useScene();
  const ref = useDriven((canvas) => addon('three')?.mount(canvas, cfg, { width, height, horizontal, span: s.span || 4 }) ?? null);
  return <canvas ref={ref} className="three-canvas" width={width} height={height} />;
}

// ─── Rive (addon rive) ──────────────────────────────────────────────────────

export function RiveBox({ src, size, className }: { src: string; size: number; className?: string }) {
  const ref = useDriven((canvas) => {
    const rive = addon('rive');
    if (!rive) return null;
    return fetch(src)
      .then((r) => r.arrayBuffer())
      .then((buf) => rive.mount(canvas, buf))
      .then((m) => ({ update: (lt: number) => m.seek(lt) }));
  });
  return <canvas ref={ref} className={className} width={size} height={size} />;
}

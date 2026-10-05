/**
 * La vidéo : la scène (« stage »), les scènes visibles à l'instant t, les
 * calques de transition et le décor propre à la direction.
 */
import { CSSProperties, useLayoutEffect, useMemo } from 'react';
import { Engine, EngineCtx, SceneCtx, Timed, VideoData, makeEasings, useEngine, useScene } from './context';
import { cue } from './cues';
import { Backdrop } from './kit/Backdrop';
import { layoutFor } from './layouts';
import { SCENE_COMPONENTS } from './scenes';
import { clamp, progress } from './time';
import { sceneStyle, timeline, TransitionLayers } from './transitions';

export function useTimeline(data: VideoData): Timed[] {
  return useMemo(() => timeline(data.scenes as any, data.direction.pacing.transition, data.duration), [data]);
}

function surfaceVars(data: VideoData, surface: string): CSSProperties {
  const s = data.surfaces[surface] || data.surfaces.light;
  return {
    ['--bg' as any]: s.bg,
    ['--ink' as any]: s.ink,
    ['--muted' as any]: s.muted,
    ['--hl' as any]: s.hl,
    ['--hl-ink' as any]: s.hlInk,
    ['--hl-text' as any]: s.hlText,
    ['--hl-soft' as any]: s.hlSoft,
    ['--soft' as any]: s.soft,
    background: s.bg,
    color: s.ink,
  };
}

/** Si une scène déborde malgré l'ajustement, toutes ses tailles réduisent ensemble. */
function useShrinkOverflow() {
  useLayoutEffect(() => {
    document.querySelectorAll<HTMLElement>('section.scene').forEach((scene) => {
      const safe = scene.querySelector<HTMLElement>('.safe');
      if (!safe) return;
      const fits = [...safe.querySelectorAll<HTMLElement>('[data-fit]')];
      for (let i = 0; i < 10; i++) {
        const block = safe.querySelector<HTMLElement>('.comp-block');
        if (!block || block.scrollHeight <= safe.clientHeight + 1) return;
        fits.forEach((el) => (el.style.fontSize = `${parseFloat(el.style.fontSize) * 0.9}px`));
      }
    });
  }, []);
}

function Decor() {
  const { data, t, ease } = useEngine();
  const d = data.direction;
  const p = ease(progress(t, 0.1, 0.9));
  switch (d.decor) {
    case 'grid':
      return (
        <div className="decor-grid" style={{ opacity: 0.9 * p }}>
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} style={{ left: `${(i + 1) * (100 / 6)}%`, transform: `scaleY(${clamp(p * 1.4 - i * 0.08)})` }} />
          ))}
        </div>
      );
    case 'letterbox': {
      const h = data.width > data.height ? 9 : 5.5;
      return (
        <>
          <div className="letterbox" style={{ top: 0, height: `${h}%`, transform: `translateY(${(1 - p) * -100}%)` }} />
          <div className="letterbox" style={{ bottom: 0, height: `${h}%`, transform: `translateY(${(1 - p) * 100}%)` }} />
          <div className="grain" />
        </>
      );
    }
    case 'grain':
      return <div className="grain" />;
    case 'paper':
      return <div className="grain grain-paper" />;
    case 'frame':
      return <div className="frame-line" style={{ clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` }} />;
    default:
      return null;
  }
}

/** Grand moment « coup de poing » : un éclair de la couleur d'accent, très bref, et un impact. */
function AccentFlash() {
  const { t } = useEngine();
  const s = useScene();
  cue(`${s.key}:accent`, s.tin, 'impact', 0.9);
  const o = t >= s.tin ? 0.75 * (1 - clamp(progress(t, s.tin, 0.16))) : 0;
  return o > 0 ? <div className="pointer-events-none absolute inset-0 z-[400] bg-hl" style={{ opacity: o }} aria-hidden /> : null;
}

/** Scènes dont le plan plein cadre (photo, clip, 3D) ne doit pas porter de logo par-dessus. */
const FULL_BLEED = new Set(['footage', 'gallery', 'showcase3d']);

/**
 * Le logo pendant la vidéo — seulement si le graphe l'a retenu (`brandmark: corner`) :
 * monochrome, à la couleur du texte de la scène visible, sans conteneur, dans le coin
 * que les compositions laissent libre. Jamais sur un plan plein cadre ni sur la signature.
 */
function Brandmark() {
  const { data, t, scenes, u } = useEngine();
  const kit = data.kit;
  const html = useMemo(() => ({ __html: kit?.logoSvg || '' }), [kit?.logoSvg]);
  if (!kit || kit.brandmark !== 'corner' || !kit.logoSvg || scenes.length < 3) return null;
  const current = scenes.find((s) => t >= s.visFrom && t < s.visTo && t >= s.start) || scenes.find((s) => t >= s.visFrom && t < s.visTo);
  if (!current || current.sceneId === 'logo') return null;
  const fullBleed = FULL_BLEED.has(current.sceneId) || (current.sceneId === 'product' && !!current.image && current.variant === 0);
  const from = scenes[0].tin + 0.6;
  const to = scenes[scenes.length - 1].start;
  const o = clamp(progress(t, from, 0.4)) * (1 - clamp(progress(t, to - 0.35, 0.3))) * (fullBleed ? 0 : 1);
  if (o <= 0) return null;
  const sf = data.surfaces[current.surface] || data.surfaces.light;
  const corner = kit.brandmarkCorner || 'top-right';
  const pos: CSSProperties = {
    [corner.startsWith('top') ? 'top' : 'bottom']: corner.startsWith('top') ? 'calc(var(--st) * 0.45)' : 'calc(var(--sb) * 0.45)',
    [corner.endsWith('left') ? 'left' : 'right']: 'var(--sx)',
  };
  return <div className="kit-mark" style={{ ...pos, height: u * 4.6, color: sf.ink, opacity: o * 0.9 }} dangerouslySetInnerHTML={html} aria-hidden />;
}

/** Rayon des formes par direction (classe `rounded-brand`). */
const RADIUS: Record<string, string> = { brutal: '0px', swiss: '0px', precision: 'calc(var(--u) * 1.2)', kinetic: 'calc(var(--u) * 2.4)', collage: 'calc(var(--u) * 0.6)', editorial: 'calc(var(--u) * 0.4)', cinematic: 'calc(var(--u) * 0.8)', drenched: 'calc(var(--u) * 1.6)' };

export function Video({ data, t }: { data: VideoData; t: number }) {
  const scenes = useTimeline(data);
  const easings = useMemo(() => makeEasings(data.direction, data.kit), [data]);
  const engine: Engine = {
    data,
    t,
    u: Math.min(data.width, data.height) / 100,
    horizontal: data.width > data.height,
    scenes,
    ...easings,
  };
  useShrinkOverflow();
  const stageVars: CSSProperties = {
    width: data.width,
    height: data.height,
    ['--u' as any]: `${engine.u}px`,
    ['--st' as any]: `${data.zones.st}px`,
    ['--sb' as any]: `${data.zones.sb}px`,
    ['--sx' as any]: `${data.zones.sx}px`,
    // La charte, pour les classes Tailwind (bg-primary, text-accent…).
    ['--c-primary' as any]: data.palette.primary,
    ['--c-secondary' as any]: data.palette.secondary,
    ['--c-accent' as any]: data.palette.accent,
    ['--c-background' as any]: data.palette.background,
    ['--c-text' as any]: data.palette.text,
    ['--radius' as any]: RADIUS[data.direction.id] ?? '0px',
  };
  return (
    <EngineCtx.Provider value={engine}>
      <div id="stage" className={`dir-${data.direction.id} fmt-${data.format}`} style={stageVars}>
        {scenes.map((s) => {
          const on = t >= s.visFrom && t < s.visTo;
          // La mise en page choisie par le directeur artistique, sinon la composition de la scène.
          const Component = layoutFor(s) || SCENE_COMPONENTS[s.sceneId];
          return (
            <SceneCtx.Provider key={s.key} value={s}>
              <section className={`scene scene-${s.sceneId}${s.layout ? ` ly-${s.layout}` : ''}`} data-scene={s.sceneId} style={{ ...surfaceVars(data, s.surface), zIndex: 10 + s.index, visibility: on ? 'visible' : 'hidden', ...(on ? sceneStyle(engine, s) : {}) }}>
                <Backdrop />
                {Component ? <Component /> : null}
                {s.accent === 'punch' ? <AccentFlash /> : null}
              </section>
            </SceneCtx.Provider>
          );
        })}
        <TransitionLayers e={engine} />
        <Decor />
        <Brandmark />
      </div>
    </EngineCtx.Provider>
  );
}

/**
 * Composition : où se pose le bloc d'une scène, et comment les éléments
 * non textuels entrent.
 *
 * L'ancrage vient du plan de mouvement (serveur), tiré dans la grille de la
 * direction : le texte n'est pas centré par défaut, deux scènes de suite ne
 * partagent pas le même ancrage, et en mode suisse ou éditorial le texte est
 * ferré à gauche (« flush-left, ragged-right »).
 */
import { CSSProperties, ReactNode } from 'react';
import { useEngine, useLocalTime, useScene } from './context';
import { clamp, mix, progress } from './time';

const ANCHOR_STYLE: Record<string, CSSProperties> = {
  'top-left': { justifyContent: 'flex-start', alignItems: 'flex-start', textAlign: 'left' },
  'center-left': { justifyContent: 'center', alignItems: 'flex-start', textAlign: 'left' },
  'bottom-left': { justifyContent: 'flex-end', alignItems: 'flex-start', textAlign: 'left' },
  center: { justifyContent: 'center', alignItems: 'center', textAlign: 'center' },
  'bottom-center': { justifyContent: 'flex-end', alignItems: 'center', textAlign: 'center' },
  'top-center': { justifyContent: 'flex-start', alignItems: 'center', textAlign: 'center' },
  right: { justifyContent: 'center', alignItems: 'flex-start', textAlign: 'left', paddingLeft: '28%' },
};

/** Le bloc de contenu d'une scène, posé selon l'ancrage, dans la zone de sécurité. */
export function Composition({ children, anchor, gap = 3, width }: { children: ReactNode; anchor?: string; gap?: number; width?: string }) {
  const { horizontal } = useEngine();
  const scene = useScene();
  const a = anchor || scene.motion.anchor;
  const camera = useCamera();
  return (
    <div className="safe" style={{ ...ANCHOR_STYLE[a], gap: `calc(var(--u) * ${gap})`, ...camera }}>
      <div className="comp-block" style={{ width: width || (a === 'right' ? '100%' : horizontal ? '62%' : '100%'), display: 'flex', flexDirection: 'column', alignItems: ANCHOR_STYLE[a].alignItems, gap: `calc(var(--u) * ${gap})` }}>
        {children}
      </div>
    </div>
  );
}

/** Mouvement de caméra lent : une poussée ou une dérive, jamais sur toutes les directions. */
export function useCamera(): CSSProperties {
  const { t, data, ease } = useEngine();
  const s = useScene();
  const p = clamp((t - s.visFrom) / Math.max(0.1, s.span));
  // Grand moment « coup de poing » : un zoom bref à l'entrée de la scène, qui retombe vite.
  const punch = s.accent === 'punch' ? 1 + 0.08 * (1 - ease(progress(t, s.tin, 0.4))) * (t >= s.tin ? 1 : 0) : 1;
  switch (data.direction.camera) {
    case 'push':
      return { transform: `scale(${mix(1, 1.045, p) * punch})` };
    case 'drift':
      return { transform: `translateX(${mix(-0.6, 0.6, p)}%) scale(${punch})` };
    default:
      return punch !== 1 ? { transform: `scale(${punch})` } : {};
  }
}

export type EnterKind = 'rise' | 'scale' | 'pop' | 'wipeRight' | 'clipUp' | 'slideLeft' | 'fade' | 'drop';

/**
 * Entrée d'un élément non textuel (image, pastille, bouton, trait).
 * Distance courte et durée serrée : sans flou de mouvement, un long trajet fait
 * « animation web » plutôt que film.
 */
export function useEnter(kind: EnterKind, at: number, durScale = 1, exitAt: number | null = null): CSSProperties {
  const { data, ease, back, easeIn } = useEngine();
  const lt = useLocalTime();
  const dur = data.direction.pacing.enter * durScale;
  const p = (kind === 'pop' || kind === 'drop' ? back : ease)(progress(lt, at, dur));
  const q = exitAt != null ? easeIn(progress(lt, exitAt, dur * 0.66)) : 0;
  let style: CSSProperties;
  switch (kind) {
    case 'rise':
      style = { opacity: clamp(p * 1.4), transform: `translateY(${(1 - p) * 4}vmin)` };
      break;
    case 'scale':
      style = { opacity: p, transform: `scale(${mix(1.12, 1, p)})` };
      break;
    case 'pop':
      style = { opacity: clamp(p * 2), transform: `scale(${mix(0.4, 1, p)}) rotate(${(1 - p) * -12}deg)` };
      break;
    case 'wipeRight':
      style = { clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` };
      break;
    case 'clipUp':
      style = { clipPath: `inset(${(1 - p) * 100}% 0 0 0)` };
      break;
    case 'slideLeft':
      style = { opacity: clamp(p * 1.5), transform: `translateX(${(1 - p) * 6}vmin)` };
      break;
    case 'drop':
      style = { opacity: clamp(p * 2), transform: `translateY(${(1 - p) * -8}vmin) rotate(${(1 - p) * 6 - 2}deg)` };
      break;
    default:
      style = { opacity: p };
  }
  if (q > 0) {
    style = { ...style, opacity: (typeof style.opacity === 'number' ? style.opacity : 1) * (1 - q) };
  }
  return style;
}

/** Le moment où les éléments d'une scène sortent (null si la transition couvre déjà). */
export function useExitAt(): number | null {
  const s = useScene();
  return s.tout == null ? null : s.tout - s.start;
}

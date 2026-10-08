/**
 * Le mot mis en valeur, avec l'annotation retenue par le graphe : surligneur,
 * soulignement ou cercle tracés à la main, cercle au crayon (rough.js), coup de
 * pinceau (perfect-freehand), après que le mot s'est posé.
 * Une seule annotation par vidéo, jamais sur tous les titres (anti-slop).
 */
import { ReactNode } from 'react';
import { useEngine, useLocalTime, useScene } from '../context';
import { progress } from '../time';
import { Brush, Sketch } from './Sketch';

/** L'annotation n'existe que sur LA scène que le graphe a désignée. */
function useAnnotation(): string {
  const { data } = useEngine();
  const s = useScene();
  const kind = data.kit?.annotate || 'none';
  return kind !== 'none' && data.kit?.annotateScene === s.key ? kind : 'none';
}

export function Em({ children, at }: { children: ReactNode; at: number }) {
  if (useAnnotation() === 'none') return <span className="kt-em">{children}</span>;
  return (
    <span className="kt-em relative isolate inline-block">
      {children}
      <EmDecor at={at} />
    </span>
  );
}

/** Les tracés seuls, à poser dans un parent `relative isolate` (mots découpés en lettres). */
export function EmDecor({ at }: { at: number }) {
  const { ease, u } = useEngine();
  const lt = useLocalTime();
  const kind = useAnnotation();
  if (kind === 'none') return null;
  const p = ease(progress(lt, at, kind === 'marker' ? 0.45 : kind === 'sketch-circle' ? 0.8 : 0.6));
  const stroke = Math.max(2, u * 0.55);
  return (
    <>
      {kind === 'marker' ? (
        <span className="absolute -z-10 rounded-[0.08em] bg-hl-soft" style={{ left: '-0.06em', right: '-0.06em', top: '0.5em', bottom: '0.04em', transform: `scaleX(${p})`, transformOrigin: 'left center' }} />
      ) : null}
      {kind === 'underline' ? (
        <svg className="pointer-events-none absolute left-0 w-full overflow-visible" style={{ bottom: '-0.16em', height: '0.24em' }} viewBox="0 0 100 12" preserveAspectRatio="none">
          <path d="M2 8 C 24 3, 52 11, 98 4" fill="none" stroke="var(--hl)" strokeWidth={stroke} strokeLinecap="round" vectorEffect="non-scaling-stroke" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p} />
        </svg>
      ) : null}
      {kind === 'sketch-circle' ? (
        // Cercle au crayon (rough.js) : deux passages qui ne se superposent pas, comme à la main.
        <span className="pointer-events-none absolute" style={{ left: '-0.22em', right: '-0.22em', top: '-0.16em', bottom: '-0.16em' }}>
          <Sketch draw={{ shape: 'ellipse', cx: 50, cy: 50, w: 96, h: 86 }} p={p} weight={0.5} roughness={1.6} seed={7} />
        </span>
      ) : null}
      {kind === 'brush' ? (
        // Coup de pinceau à pression variable (perfect-freehand) sous le mot.
        <span className="pointer-events-none absolute -z-10" style={{ left: '-0.08em', right: '-0.08em', bottom: '-0.05em', height: '0.42em' }}>
          <Brush points={[[2, 62], [22, 52], [48, 58], [74, 46], [98, 50]]} p={p} size={38} thinning={0.7} color="var(--hl-soft)" />
        </span>
      ) : null}
      {kind === 'circle' ? (
        <svg className="pointer-events-none absolute overflow-visible" style={{ left: '-0.18em', right: '-0.18em', top: '-0.1em', bottom: '-0.12em', width: 'calc(100% + 0.36em)', height: 'calc(100% + 0.22em)' }} viewBox="0 0 100 40" preserveAspectRatio="none">
          <path d="M60 3 C 88 2, 99 14, 96 24 C 92 36, 30 40, 10 33 C -2 28, 2 10, 22 5 C 36 2, 52 2, 66 5" fill="none" stroke="var(--hl)" strokeWidth={stroke} strokeLinecap="round" vectorEffect="non-scaling-stroke" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p} />
        </svg>
      ) : null}
    </>
  );
}

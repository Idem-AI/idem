/**
 * <ImageFx> — une photo avec un effet visuel (addon `pixi` : PixiJS 7 + pixi-filters).
 *
 *   <ImageFx src={s.image} effect="rgbSplit" amount={1} zoom={0.06} />
 *
 * Effets : rgbSplit (canaux décalés), shockwave (onde de choc), bulge (bulbe), twist (torsion),
 * zoomBlur (flou de travelling), pixelate (révélation par pixels, suit `at`/`dur`), glitch (tranches
 * décalées par à-coups), wavy (ondulation liquide), crt (vieux téléviseur).
 *
 * Chaque effet est une fonction du temps de la scène ; le moteur pose les paramètres de l'instant,
 * aucune boucle ne tourne. La photo est d'abord montrée telle quelle (`<img>`) : sans WebGL, ou tant
 * que la toile n'est pas prête, elle reste à l'écran sans effet (voir `.imagefx-wrap` dans engine.css).
 */
import { CSSProperties, useRef } from 'react';
import { useEngine, useScene } from '../context';
import { useGl } from '../gl';
import { addon } from '../shared';
import { progress } from '../time';

export type ImageEffect = 'rgbSplit' | 'shockwave' | 'bulge' | 'twist' | 'zoomBlur' | 'pixelate' | 'glitch' | 'wavy' | 'crt';
export const IMAGE_EFFECTS: ImageEffect[] = ['rgbSplit', 'shockwave', 'bulge', 'twist', 'zoomBlur', 'pixelate', 'glitch', 'wavy', 'crt'];

export interface ImageFxProps {
  /** L'image (`s.image`). */
  src: string;
  effect?: ImageEffect;
  /** Intensité de l'effet, 1 = normal. */
  amount?: number;
  /** Zoom lent sur la durée de la scène (0,06 = 6 %). */
  zoom?: number;
  /** Début et durée (s) de l'effet d'entrée (pixelate). */
  at?: number;
  dur?: number;
  /** Définition de la toile, en part de la taille du cadre. */
  res?: number;
  style?: CSSProperties;
}

export function ImageFx({ src, effect = 'rgbSplit', amount = 1, zoom = 0.05, at = 0.1, dur = 1.4, res = 0.7, style }: ImageFxProps) {
  const { data } = useEngine();
  const s = useScene();
  const img = useRef<HTMLImageElement>(null);
  const id = IMAGE_EFFECTS.includes(effect) ? effect : 'rgbSplit';
  const k = Math.max(0.3, Math.min(1, res));
  const width = Math.max(96, Math.round(data.width * k));
  const height = Math.max(96, Math.round(data.height * k));
  const span = s.span || s.duration || 4;
  const ref = useGl({
    width,
    height,
    attrs: { 'data-image-fx': id },
    make: (canvas) => {
      const lib = addon('pixi');
      const image = img.current;
      if (!lib || !image) return null;
      // La photo se décode (le moteur attend ses images avant la première capture) : on réessaie.
      if (!image.complete) return undefined;
      if (!image.naturalWidth) return null;
      return lib.create(canvas, { effect: id, width, height, image, seed: (s.index || 0) * 3.1 + 1 });
    },
    params: (lt) => ({ lt, p: progress(lt, at, dur), amount, zoom, span }),
  });
  return (
    <div className="imagefx-wrap" style={style}>
      <img ref={img} className="imagefx-img" src={src} alt="" />
      <div ref={ref} className="gl-host" />
    </div>
  );
}

/**
 * La photo d'un plan : telle quelle, ou avec l'effet que le graphe a retenu pour la scène PRODUIT
 * (`kit.imageFx`). Seul endroit où les compositions de photos choisissent entre `<img>` et `ImageFx` :
 * sans effet retenu, ou sans WebGL, c'est la photo simple.
 */
export function PhotoEl({ src, className }: { src: string; className?: string }) {
  const { data } = useEngine();
  const s = useScene();
  const fx = (s.kitOver?.imageFx || data.kit?.imageFx) as ImageEffect | undefined;
  if (fx && IMAGE_EFFECTS.includes(fx) && s.sceneId === 'product') {
    return (
      <div className={className} style={{ position: 'relative' }}>
        <ImageFx src={src} effect={fx} zoom={0.05} />
      </div>
    );
  }
  return <img className={className} src={src} alt="" />;
}

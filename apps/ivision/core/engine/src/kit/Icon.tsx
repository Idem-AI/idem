/**
 * Pictogramme du kit. Le SVG est choisi et normalisé par le serveur
 * (video.icons.ts : Lucide, Phosphor, Tabler ou Heroicons selon la direction) ;
 * il hérite de la couleur du texte (`currentColor`). Aucune bibliothèque
 * d'icônes n'est embarquée dans la page : seulement les quelques SVG utilisés.
 *
 * Le graphe peut demander que les pictogrammes s'animent à l'entrée (`kit.iconMotion` : draw, stagger,
 * pop) : c'est `IconMotion`, qui joue sur les formes du SVG puis rend l'icône exactement comme la
 * version fixe. `index` décale l'entrée des pictogrammes d'une même scène.
 */
import { CSSProperties, useMemo } from 'react';
import { useEngine, useScene } from '../context';
import { cn } from './cn';
import { IconMode, IconMotion } from './IconMotion';

const MODES: IconMode[] = ['draw', 'stagger', 'pop'];

export function Icon({ svg, className, style, index = 0 }: { svg?: string; className?: string; style?: CSSProperties; index?: number }) {
  const { data } = useEngine();
  const s = useScene();
  const motion = (s.kitOver?.iconMotion || data.kit?.iconMotion) as IconMode | undefined;
  // Objet stable : React 19 réécrit innerHTML dès que l'objet change (à chaque image sinon).
  const html = useMemo(() => ({ __html: svg || '' }), [svg]);
  if (!svg) return null;
  const cls = cn('kit-icon inline-flex shrink-0 items-center justify-center', className);
  if (motion && MODES.includes(motion)) return <IconMotion svg={svg} mode={motion} at={0.3 + index * 0.2} dur={0.9} className={cls} style={style} />;
  return <span aria-hidden className={cls} style={style} dangerouslySetInnerHTML={html} />;
}

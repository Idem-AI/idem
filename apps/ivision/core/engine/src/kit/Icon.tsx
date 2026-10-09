/**
 * Pictogramme du kit. Le SVG est choisi et normalisé par le serveur
 * (video.icons.ts : Lucide, Phosphor, Tabler ou Heroicons selon la direction) ;
 * il hérite de la couleur du texte (`currentColor`). Aucune bibliothèque
 * d'icônes n'est embarquée dans la page : seulement les quelques SVG utilisés.
 */
import { CSSProperties, useMemo } from 'react';
import { cn } from './cn';

export function Icon({ svg, className, style }: { svg?: string; className?: string; style?: CSSProperties }) {
  // Objet stable : React 19 réécrit innerHTML dès que l'objet change (à chaque image sinon).
  const html = useMemo(() => ({ __html: svg || '' }), [svg]);
  if (!svg) return null;
  return <span aria-hidden className={cn('kit-icon inline-flex shrink-0 items-center justify-center', className)} style={style} dangerouslySetInnerHTML={html} />;
}

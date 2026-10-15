import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Un visuel du site (photo, dessin, vidéo, motif de la charte), tel que
 * `@/site/media` le décrit. Le cadre — ratio, rayon, ombre — se règle par
 * `className` ; l'image le remplit sans se déformer.
 *
 *   <Media asset={media['home-intro']} className="aspect-[4/3] rounded-card" priority />
 */
export interface MediaAsset {
  kind: 'image' | 'drawing' | 'video' | 'pattern';
  src: string;
  alt?: string;
  poster?: string;
  ground?: string;
  tile?: number;
  credit?: string;
}

export interface MediaProps extends React.HTMLAttributes<HTMLDivElement> {
  asset?: MediaAsset | null;
  /** Le visuel du haut de page : chargé tout de suite. */
  priority?: boolean;
  /** Ajustement de l'image dans son cadre (par défaut : couvrir). */
  fit?: 'cover' | 'contain';
}

function Media({ asset, priority = false, fit, className, ...props }: MediaProps) {
  if (!asset?.src) return null;
  const objectFit = (fit ?? (asset.kind === 'drawing' ? 'contain' : 'cover')) === 'contain' ? 'object-contain' : 'object-cover';

  if (asset.kind === 'pattern') {
    return (
      <div
        role="presentation"
        className={cn('relative overflow-hidden', className)}
        style={{ backgroundColor: asset.ground, backgroundImage: `url(${asset.src})`, backgroundSize: `${asset.tile ?? 160}px` }}
        {...props}
      />
    );
  }

  return (
    <div className={cn('relative overflow-hidden bg-muted', className)} {...props}>
      {asset.kind === 'video' ? (
        <video
          className={cn('block size-full', objectFit)}
          src={asset.src}
          poster={asset.poster}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        />
      ) : (
        <img
          className={cn('block size-full', objectFit)}
          src={asset.src}
          alt={asset.alt ?? ''}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
        />
      )}
    </div>
  );
}

export { Media };

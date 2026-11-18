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
  /**
   * La largeur affichée, pour que le navigateur choisisse la bonne taille d'image (`sizes` HTML). Par défaut, toute
   * la largeur de l'écran. Exemple pour une image en demi-colonne : `"(min-width: 768px) 50vw, 100vw"`.
   */
  sizes?: string;
}

/** Les largeurs proposées au navigateur, quand l'hébergeur de l'image sait la redimensionner. */
const WIDTHS = [640, 960, 1280, 1920];

/**
 * Les tailles d'une image d'un hébergeur qui redimensionne à la demande (Pexels, Unsplash) ; rien pour les autres
 * (le visuel est alors servi tel quel). Un téléphone télécharge ainsi ~1 280 px au lieu de ~1 900.
 */
function responsiveSrcSet(src: string): string | undefined {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return undefined;
  }
  const host = url.hostname;
  if (host !== 'images.pexels.com' && host !== 'images.unsplash.com') return undefined;
  return WIDTHS.map((width) => {
    const sized = new URL(url.href);
    sized.searchParams.delete('h');
    sized.searchParams.set('w', String(width));
    if (host === 'images.pexels.com') {
      sized.searchParams.set('dpr', '1');
      sized.searchParams.set('auto', 'compress');
      sized.searchParams.set('cs', 'tinysrgb');
    } else {
      sized.searchParams.set('auto', 'format');
      sized.searchParams.set('q', sized.searchParams.get('q') ?? '75');
    }
    return `${sized.href} ${width}w`;
  }).join(', ');
}

/**
 * Un cadre sans taille (ni ratio, ni hauteur, ni position absolue) prend la hauteur de l'image une fois chargée : la
 * page saute (CLS). Un ratio par défaut lui réserve sa place dès le premier affichage.
 */
const SIZED = /(^|\s)([\w[\]&:-]+:)?(aspect-|h-|min-h-|size-|inset-|absolute|fixed|row-span-|self-stretch|flex-1|grow)/;

function Media({ asset, priority = false, fit, sizes, className, ...props }: MediaProps) {
  // Une image qui ne se charge pas (adresse expirée, réseau) : le cadre
  // disparaît plutôt que d'afficher son texte de remplacement.
  const [failed, setFailed] = React.useState(false);
  const image = React.useRef<HTMLImageElement>(null);
  // Une image pré-rendue a pu échouer avant que React ne reprenne la page.
  React.useEffect(() => {
    const element = image.current;
    if (element?.complete && element.naturalWidth === 0) setFailed(true);
  }, []);
  if (!asset?.src || failed) return null;
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

  const srcSet = asset.kind === 'image' ? responsiveSrcSet(asset.src) : undefined;
  // `fetchpriority` en minuscules : React 18 le transmet tel quel (sa forme camelCase n'existe qu'à partir de 19).
  const eager = priority ? ({ fetchpriority: 'high' } as Record<string, string>) : {};

  return (
    <div className={cn('relative overflow-hidden bg-muted', !SIZED.test(className ?? '') && 'aspect-[4/3]', className)} {...props}>
      {asset.kind === 'video' ? (
        <video
          className={cn('block size-full', objectFit)}
          src={asset.src}
          poster={asset.poster}
          onError={() => setFailed(true)}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        />
      ) : (
        <img
          ref={image}
          className={cn('block size-full', objectFit)}
          src={asset.src}
          srcSet={srcSet}
          sizes={srcSet ? (sizes ?? '100vw') : undefined}
          alt={asset.alt ?? ''}
          loading={priority ? 'eager' : 'lazy'}
          {...eager}
          onError={() => setFailed(true)}
          decoding="async"
        />
      )}
    </div>
  );
}

export { Media };

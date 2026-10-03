import { useMemo, useState } from 'react';

import {
  IDEM_LOADER_BOX,
  IDEM_LOADER_SIZES,
  idemLoaderSeeds,
  nextIdemLoaderGradientId,
  type IdemLoaderSize,
} from '../index';

import '../loader.css';

export interface IdemLoaderProps {
  /** Taille du cercle : `xs` dans un bouton, `lg` au centre d'une page. */
  size?: IdemLoaderSize;
  /** Texte affiché sous le cercle, et lu par les lecteurs d'écran. */
  label?: string | null;
  /** Prend toute la largeur et se centre, avec de l'air au-dessus et dessous. */
  block?: boolean;
  /** Se superpose au contenu du parent positionné plutôt que de le remplacer. */
  overlay?: boolean;
  /** Couvre la fenêtre entière. */
  fullscreen?: boolean;
  /** Ce que lisent les lecteurs d'écran quand aucun `label` n'est affiché. */
  ariaLabel?: string;
  /** Classes ajoutées à l'hôte, pour l'intégration dans la page. */
  className?: string;
}

/**
 * L'unique indicateur de chargement d'Idem, rendu React (iCode / AppGen).
 *
 * Même semis d'awalé, même géométrie, mêmes styles que `<idem-loader>` côté
 * Angular : seul le rendu change, parce que le framework change.
 *
 * @example Dans un bouton
 * ```tsx
 * <button disabled={saving}>{saving && <IdemLoader size="xs" />} Enregistrer</button>
 * ```
 */
export function IdemLoader({
  size = 'md',
  label = null,
  block = false,
  overlay = false,
  fullscreen = false,
  ariaLabel = 'Chargement',
  className,
}: IdemLoaderProps) {
  const [gradientId] = useState(nextIdemLoaderGradientId);
  const seeds = useMemo(() => idemLoaderSeeds(size), [size]);
  const px = IDEM_LOADER_SIZES[size];

  const hostClass = [
    'idem-loader-host',
    block && 'idem-loader-host--block',
    overlay && 'idem-loader-host--overlay',
    fullscreen && 'idem-loader-host--fullscreen',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={hostClass}>
      <span className="idem-loader" role="status" aria-label={label || ariaLabel}>
        <svg
          className="idem-loader__ring"
          width={px}
          height={px}
          viewBox={`0 0 ${IDEM_LOADER_BOX} ${IDEM_LOADER_BOX}`}
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id={gradientId}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2={IDEM_LOADER_BOX}
              y2={IDEM_LOADER_BOX}
            >
              <stop offset="0%" stopColor="var(--color-primary-500, #1447e6)" />
              <stop offset="100%" stopColor="var(--color-secondary-500, #22d3ee)" />
            </linearGradient>
          </defs>
          <g fill={`url(#${gradientId})`}>
            {seeds.map((seed, i) => (
              <path
                key={i}
                className="idem-loader__seed"
                d={seed.d}
                style={{ animationDelay: seed.delay }}
              />
            ))}
          </g>
        </svg>
        {label ? <span className="idem-loader__label">{label}</span> : null}
      </span>
    </span>
  );
}

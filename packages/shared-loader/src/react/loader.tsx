import { useMemo, useState } from 'react';

import {
  IDEM_LOADER_BOX,
  IDEM_LOADER_SIZES,
  IDEM_LOADER_PATH,
  nextIdemLoaderId,
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
  const [pathId] = useState(nextIdemLoaderId);
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
          <path
            className="idem-loader__spiral-track"
            pathLength="1"
            d={IDEM_LOADER_PATH}
          />
          <path
            id={pathId}
            className="idem-loader__spiral-active"
            pathLength="1"
            d={IDEM_LOADER_PATH}
          />
          <circle className="idem-loader__spiral-dot" r="3.5">
            <animateMotion
              dur="2s"
              repeatCount="indefinite"
              calcMode="linear"
            >
              <mpath href={`#${pathId}`} />
            </animateMotion>
          </circle>
          <circle className="idem-loader__spiral-core" cx="62" cy="53" r="3" />
        </svg>
        {label ? <span className="idem-loader__label">{label}</span> : null}
      </span>
    </span>
  );
}

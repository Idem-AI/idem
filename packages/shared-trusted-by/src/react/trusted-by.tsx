import { useMemo } from 'react';

import { resolvePartners, TRUSTED_BY_ASSETS_BASE_PATH, type ResolvedPartner } from '../partners';

import '../trusted-by.css';

export interface TrustedByProps {
  /** Où l'application sert les logos. Par défaut, le chemin de `sync:trusted-by`. */
  basePath?: string;
  /** Intitulé au-dessus du bandeau. Omis, aucun titre n'est rendu. */
  label?: string;
  /** Classes ajoutées au conteneur, pour l'intégration dans la page hôte. */
  className?: string;
}

/**
 * Bandeau défilant « Ils nous font confiance », partagé par les applications
 * React d'Idem (iCode / AppGen).
 *
 * Même données, même feuille de style que la version Angular : seul le rendu
 * change, parce que le framework change. Les logos sont servis par
 * l'application hôte, où `npm run sync:trusted-by` les dépose.
 */
export function TrustedBy({ basePath, label, className }: TrustedByProps) {
  const partners = useMemo<ResolvedPartner[]>(
    () => resolvePartners(basePath ?? TRUSTED_BY_ASSETS_BASE_PATH),
    [basePath]
  );

  return (
    <div className={className ? `idem-trusted-by ${className}` : 'idem-trusted-by'}>
      {label ? <p className="idem-trusted-by__label">{label}</p> : null}
      <div className="idem-trusted-by__viewport">
        <div className="idem-trusted-by__track">
          {partners.map((partner) => (
            <a
              key={partner.name}
              className="idem-trusted-by__link"
              href={partner.url}
              title={partner.name}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img className="idem-trusted-by__logo" src={partner.logoUrl} alt={partner.name} />
            </a>
          ))}
        </div>
        {/* Copie décorative : elle assure la boucle, pas le contenu. */}
        <div className="idem-trusted-by__track" aria-hidden="true">
          {partners.map((partner) => (
            <span key={partner.name} className="idem-trusted-by__link">
              <img className="idem-trusted-by__logo" src={partner.logoUrl} alt="" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default TrustedBy;

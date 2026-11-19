import { useMemo, type ReactNode } from 'react';

import { resolveFooter, type FooterApp, type FooterServices, type ResolvedFooter } from '../apps';
import type { FooterLocale } from '../legal';

import '../footer.css';

export interface IdemFooterProps {
  /** L'application dont c'est le pied de page : décide colonnes et textes. */
  app: FooterApp;
  /** La langue affichée. L'hôte la tient (i18next, cookie partagé). */
  locale?: FooterLocale;
  /** Les adresses des services, telles que la configuration de l'hôte les porte. */
  services?: FooterServices;
  /** Une seule ligne, sans colonnes : pour l'atelier iCode. */
  compact?: boolean;
  logoLight?: string;
  logoDark?: string;
  logoAlt?: string;
  navLabel?: string;
  /** Où mène le logo. Par défaut la racine de l'application hôte. */
  homeHref?: string;
  /**
   * La zone de préférences, à droite de la ligne de signature : la bascule de
   * langue et de thème de l'hôte, parce qu'elles agissent sur lui.
   */
  prefs?: ReactNode;
  /** Un bloc de marque rendu par l'hôte à la place des deux logos. */
  brand?: ReactNode;
  className?: string;
}

/**
 * Le pied de page IDEM, pour les applications React du dépôt (iCode / AppGen).
 *
 * Mêmes données, même feuille de style que la version Angular : seul le rendu
 * change, parce que le framework change.
 */
export function IdemFooter({
  app,
  locale = 'fr',
  services,
  compact = false,
  logoLight = '/assets/icons/logo_white.png',
  logoDark = '/assets/icons/logo_dark.png',
  logoAlt = 'IDEM',
  navLabel = 'Navigation',
  homeHref = '/',
  prefs,
  brand,
  className,
}: IdemFooterProps) {
  const data = useMemo<ResolvedFooter>(
    () => resolveFooter(app, { locale, services }),
    [app, locale, services]
  );

  const classes = ['idem-ft', compact ? 'idem-ft--compact' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <footer className={classes}>
      {compact ? null : (
        <div className="idem-ft__shell idem-ft__body">
          <div className="idem-ft__brand">
            {brand ?? (
              <a href={homeHref} className="idem-ft__logo" aria-label={logoAlt}>
                {/* Deux fichiers, une seule variante `dark:` : la même que
                    l'en-tête, pour que les deux restent en phase. */}
                <img src={logoLight} alt="" width={120} height={34} className="dark:hidden" />
                <img src={logoDark} alt="" width={120} height={34} className="hidden dark:block" />
              </a>
            )}

            <p className="idem-ft__tagline">{data.tagline}</p>

            <ul className="idem-ft__social">
              {data.social.map((network) => (
                <li key={network.id}>
                  <a
                    className="idem-ft__social-link"
                    href={network.url}
                    aria-label={network.label}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <i className={network.icon} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <nav className="idem-ft__nav" aria-label={navLabel}>
            {data.columns.map((column) => (
              <div key={column.id}>
                <h2 className="idem-ft__col-title">{column.title}</h2>
                <ul className="idem-ft__list">
                  {column.links.map((link) => (
                    <li key={`${link.href}${link.label}`}>
                      <a
                        className={
                          link.external ? 'idem-ft__link idem-ft__link--out' : 'idem-ft__link'
                        }
                        href={link.href}
                        target={link.external ? '_blank' : undefined}
                        rel={link.external ? 'noopener noreferrer' : undefined}
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      )}

      <div className="idem-ft__shell idem-ft__foot">
        <p className="idem-ft__copy">
          <span>© {data.year} IDEM S.A.S.</span>
          <span className="idem-ft__sep" aria-hidden="true">
            ·
          </span>
          <span className="idem-ft__claim">{data.claim}</span>
        </p>

        <ul className="idem-ft__legal">
          {data.legal.map((link) => (
            <li key={link.href}>
              <a
                className="idem-ft__link"
                href={link.href}
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noopener noreferrer' : undefined}
              >
                {link.label}
              </a>
            </li>
          ))}
          <li>
            <a
              className="idem-ft__link"
              href={data.licenseUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {data.licenseLabel}
            </a>
          </li>
        </ul>

        {prefs ? <div className="idem-ft__prefs">{prefs}</div> : null}
      </div>
    </footer>
  );
}

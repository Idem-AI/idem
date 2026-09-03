/**
 * Illustrations SVG du produit.
 *
 * Une modale de publication qui n'affiche que du texte oblige à lire pour
 * comprendre le choix ; une image le fait saisir avant la lecture. Les tracés
 * sont volontairement schématiques : ils représentent le mécanisme (un
 * artefact qui part vers un hébergement, une chaîne de déploiement, une
 * requête qui échoue), pas une scène décorative.
 *
 * Toutes utilisent `currentColor` pour le trait et le jeton primaire pour
 * l'accent, donc elles suivent le thème sans variante à maintenir.
 */

interface IllustrationProps {
  className?: string;
  /** Hauteur en pixels ; la largeur suit le ratio du tracé. */
  size?: number;
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** Publication rapide : l'application part telle quelle vers le web. */
export function PublishQuickIllustration({ className = '', size = 96 }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 120 96"
      style={{ height: size }}
      className={`text-text-tertiary ${className}`}
      role="img"
      aria-hidden
    >
      {/* Fenêtre de l'application */}
      <rect x="8" y="14" width="58" height="44" rx="5" {...stroke} />
      <path d="M8 25h58" {...stroke} />
      <circle cx="16" cy="19.5" r="1.6" fill="currentColor" />
      <circle cx="22" cy="19.5" r="1.6" fill="currentColor" />
      <rect x="15" y="32" width="24" height="3" rx="1.5" fill="currentColor" opacity="0.35" />
      <rect x="15" y="39" width="36" height="3" rx="1.5" fill="currentColor" opacity="0.2" />
      <rect x="15" y="46" width="18" height="3" rx="1.5" fill="currentColor" opacity="0.2" />

      {/* Trajectoire vers le globe */}
      <path d="M70 40c10-6 18-6 26 0" {...stroke} strokeDasharray="4 4" className="text-primary" />
      <path d="M92 34l4 6-6 3" {...stroke} className="text-primary" />

      {/* Globe : en ligne, accessible partout */}
      <circle cx="99" cy="62" r="17" {...stroke} className="text-primary" />
      <ellipse cx="99" cy="62" rx="7" ry="17" {...stroke} className="text-primary" />
      <path d="M82.5 56h33M82.5 68h33" {...stroke} className="text-primary" />
    </svg>
  );
}

/** Pipeline iDeploy : l'artefact traverse des étapes avant la mise en ligne. */
export function PublishPipelineIllustration({ className = '', size = 96 }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 120 96"
      style={{ height: size }}
      className={`text-text-tertiary ${className}`}
      role="img"
      aria-hidden
    >
      {/* Paquet de départ */}
      <path d="M10 34l14-7 14 7v16l-14 7-14-7z" {...stroke} />
      <path d="M10 34l14 7 14-7M24 41v16" {...stroke} />

      {/* Chaîne d'étapes */}
      <path d="M40 42h12" {...stroke} strokeDasharray="3 3" />
      <rect x="52" y="30" width="20" height="24" rx="4" {...stroke} className="text-primary" />
      <path d="M57 42l4 4 6-8" {...stroke} className="text-primary" />

      <path d="M74 42h12" {...stroke} strokeDasharray="3 3" />

      {/* Serveur de destination */}
      <rect x="86" y="24" width="26" height="12" rx="3" {...stroke} className="text-primary" />
      <rect x="86" y="40" width="26" height="12" rx="3" {...stroke} className="text-primary" />
      <rect x="86" y="56" width="26" height="12" rx="3" {...stroke} className="text-primary" />
      <circle cx="92" cy="30" r="1.6" fill="currentColor" className="text-primary" />
      <circle cx="92" cy="46" r="1.6" fill="currentColor" className="text-primary" />
      <circle cx="92" cy="62" r="1.6" fill="currentColor" className="text-primary" />

      {/* Ancrage : l'infrastructure vous appartient */}
      <path d="M99 68v14M92 82h14" {...stroke} />
    </svg>
  );
}

/** Échec de récupération : la requête n'a pas abouti. */
export function LoadFailedIllustration({ className = '', size = 104 }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 120 104"
      style={{ height: size }}
      className={`text-text-tertiary ${className}`}
      role="img"
      aria-hidden
    >
      {/* Nuage de stockage */}
      <path
        d="M36 42a14 14 0 0126-7 11 11 0 0116 9 10 10 0 01-2 20H38a13 13 0 01-2-22z"
        {...stroke}
      />

      {/* Liaison rompue */}
      <path d="M48 74l8 10" {...stroke} className="text-danger" />
      <path d="M72 74l-8 10" {...stroke} className="text-danger" />
      <path d="M60 68v6M60 80v6" {...stroke} className="text-danger" />
      <circle cx="60" cy="92" r="8" {...stroke} className="text-danger" />
      <path d="M57 89l6 6M63 89l-6 6" {...stroke} className="text-danger" />
    </svg>
  );
}

/** Rien à exécuter : l'aperçu attend un serveur. */
export function EmptyPreviewIllustration({ className = '', size = 88 }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 120 88"
      style={{ height: size }}
      className={`text-text-disabled ${className}`}
      role="img"
      aria-hidden
    >
      <rect x="18" y="12" width="84" height="56" rx="6" {...stroke} />
      <path d="M18 24h84" {...stroke} />
      <circle cx="26" cy="18" r="1.6" fill="currentColor" />
      <circle cx="32" cy="18" r="1.6" fill="currentColor" />
      <circle cx="38" cy="18" r="1.6" fill="currentColor" />
      {/* Bouton lecture : ce qu'il reste à faire */}
      <circle cx="60" cy="46" r="13" {...stroke} className="text-primary" />
      <path d="M56 40l10 6-10 6z" {...stroke} className="text-primary" />
      <path d="M44 78h32" {...stroke} />
    </svg>
  );
}

/** Aide : la conversation pilote l'aperçu. */
export function HelpIllustration({ className = '', size = 88 }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 140 88"
      style={{ height: size }}
      className={`text-text-tertiary ${className}`}
      role="img"
      aria-hidden
    >
      {/* Panneau de conversation */}
      <rect x="8" y="14" width="46" height="60" rx="5" {...stroke} />
      <rect x="15" y="24" width="26" height="4" rx="2" fill="currentColor" opacity="0.35" />
      <rect x="15" y="33" width="32" height="4" rx="2" fill="currentColor" opacity="0.2" />
      <rect x="15" y="60" width="32" height="8" rx="4" {...stroke} className="text-primary" />

      {/* Flèche : la demande devient une application */}
      <path d="M58 44h12" {...stroke} strokeDasharray="3 3" className="text-primary" />
      <path d="M66 40l5 4-5 4" {...stroke} className="text-primary" />

      {/* Aperçu de l'application */}
      <rect x="76" y="14" width="56" height="60" rx="5" {...stroke} />
      <path d="M76 26h56" {...stroke} />
      <rect x="84" y="34" width="22" height="14" rx="3" {...stroke} className="text-primary" />
      <rect x="110" y="34" width="14" height="14" rx="3" fill="currentColor" opacity="0.2" />
      <rect x="84" y="54" width="40" height="4" rx="2" fill="currentColor" opacity="0.2" />
      <rect x="84" y="62" width="28" height="4" rx="2" fill="currentColor" opacity="0.2" />
    </svg>
  );
}

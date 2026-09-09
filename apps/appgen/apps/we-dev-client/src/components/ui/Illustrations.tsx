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

/* ==================================================================
   Illustrations de la page d'accueil
   ================================================================== */

/**
 * Maquette du produit : la coquille du builder, conversation à gauche et
 * aperçu à droite, avec la barre d'outils flottante.
 *
 * Une capture d'écran vieillirait à chaque évolution de l'interface et ne
 * saurait pas suivre le thème ; ce schéma dit la même chose — voilà à quoi
 * ressemble l'outil — et reste juste.
 */
export function ProductMockIllustration({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 640 380"
      className={`w-full h-auto text-text-tertiary ${className}`}
      role="img"
      aria-hidden
    >
      {/* Fenêtre */}
      <rect x="8" y="8" width="624" height="364" rx="14" {...stroke} />
      <path d="M8 44h624" {...stroke} />
      <circle cx="30" cy="26" r="4" fill="currentColor" opacity=".45" />
      <circle cx="46" cy="26" r="4" fill="currentColor" opacity=".3" />
      <circle cx="62" cy="26" r="4" fill="currentColor" opacity=".3" />
      <rect x="88" y="20" width="54" height="12" rx="6" className="text-primary" {...stroke} />
      <rect x="470" y="19" width="62" height="14" rx="7" fill="currentColor" opacity=".12" />
      <rect x="472" y="21" width="28" height="10" rx="5" fill="var(--color-primary)" opacity=".75" />
      <rect x="546" y="19" width="52" height="14" rx="7" fill="var(--color-primary)" opacity=".9" />
      <circle cx="614" cy="26" r="8" {...stroke} />

      {/* Conversation */}
      <path d="M212 44v328" {...stroke} />
      <rect x="32" y="70" width="120" height="9" rx="4.5" fill="currentColor" opacity=".28" />
      <rect x="32" y="88" width="152" height="9" rx="4.5" fill="currentColor" opacity=".16" />
      <rect x="72" y="118" width="112" height="9" rx="4.5" fill="var(--color-primary)" opacity=".5" />
      <rect x="32" y="150" width="140" height="9" rx="4.5" fill="currentColor" opacity=".16" />
      <rect x="32" y="168" width="96" height="9" rx="4.5" fill="currentColor" opacity=".16" />
      <rect x="32" y="326" width="152" height="30" rx="10" {...stroke} className="text-primary" />
      <path d="M164 341h10" {...stroke} className="text-primary" />

      {/* Aperçu */}
      <rect x="236" y="66" width="376" height="230" rx="10" {...stroke} opacity=".7" />
      <path d="M236 92h376" {...stroke} opacity=".7" />
      <rect x="256" y="116" width="150" height="86" rx="8" fill="currentColor" opacity=".14" />
      <rect x="424" y="116" width="168" height="12" rx="6" fill="currentColor" opacity=".22" />
      <rect x="424" y="140" width="130" height="12" rx="6" fill="currentColor" opacity=".14" />
      <rect x="424" y="170" width="86" height="24" rx="8" fill="var(--color-primary)" opacity=".85" />
      <rect x="256" y="224" width="336" height="10" rx="5" fill="currentColor" opacity=".12" />
      <rect x="256" y="246" width="248" height="10" rx="5" fill="currentColor" opacity=".12" />

      {/* Barre d'outils flottante */}
      <rect
        x="316"
        y="316"
        width="216"
        height="34"
        rx="12"
        fill="var(--idem-surface-1)"
        {...stroke}
      />
      <circle cx="344" cy="333" r="5" fill="var(--color-primary)" />
      <path d="M372 327v12M400 327v12M428 327v12" {...stroke} opacity=".4" />
      <path d="M452 329l8 8M460 329l-8 8" {...stroke} opacity=".4" />
      <path d="M486 327h20" {...stroke} opacity=".4" />
    </svg>
  );
}

/** Chaque projet reçoit une direction visuelle distincte. */
export function ArtDirectionIllustration({ size = 76 }: IllustrationProps) {
  return (
    <svg viewBox="0 0 96 76" style={{ height: size }} className="text-text-tertiary" role="img" aria-hidden>
      {/* Trois mises en page franchement différentes, pas trois variantes */}
      <rect x="4" y="8" width="26" height="60" rx="2" {...stroke} />
      <path d="M9 18h16M9 26h12" {...stroke} />
      <rect x="9" y="36" width="16" height="24" rx="1" fill="currentColor" opacity=".18" />

      <rect x="35" y="8" width="26" height="60" rx="9" {...stroke} className="text-primary" />
      <circle cx="48" cy="26" r="8" {...stroke} className="text-primary" />
      <path d="M40 44h16M40 52h10" {...stroke} className="text-primary" />

      <rect x="66" y="8" width="26" height="60" rx="0" {...stroke} />
      <rect x="66" y="8" width="26" height="22" fill="currentColor" opacity=".22" />
      <path d="M71 40h16M71 48h16M71 56h8" {...stroke} />
    </svg>
  );
}

/** Le contraste est mesuré, pas espéré. */
export function ContrastIllustration({ size = 76 }: IllustrationProps) {
  return (
    <svg viewBox="0 0 96 76" style={{ height: size }} className="text-text-tertiary" role="img" aria-hidden>
      <circle cx="30" cy="30" r="20" {...stroke} />
      <path d="M30 10a20 20 0 010 40z" fill="currentColor" opacity=".8" />
      <rect x="58" y="16" width="34" height="10" rx="5" fill="currentColor" opacity=".2" />
      <rect x="58" y="32" width="24" height="10" rx="5" fill="currentColor" opacity=".2" />
      {/* Le verdict chiffré : c'est lui qui fait la différence */}
      <rect x="14" y="58" width="68" height="14" rx="7" className="text-success" {...stroke} />
      <path d="M24 65l4 4 7-8" {...stroke} className="text-success" />
      <path d="M42 65h30" {...stroke} className="text-success" opacity=".6" />
    </svg>
  );
}

/** On corrige au clic, dans l'aperçu. */
export function VisualEditIllustration({ size = 76 }: IllustrationProps) {
  return (
    <svg viewBox="0 0 96 76" style={{ height: size }} className="text-text-tertiary" role="img" aria-hidden>
      <rect x="6" y="8" width="84" height="46" rx="5" {...stroke} />
      <rect x="16" y="20" width="40" height="8" rx="4" fill="currentColor" opacity=".22" />
      {/* Élément sélectionné */}
      <rect x="16" y="34" width="46" height="12" rx="3" {...stroke} className="text-primary" strokeDasharray="3 2" />
      <rect x="16" y="37" width="30" height="6" rx="3" fill="var(--color-primary)" opacity=".55" />
      {/* Curseur */}
      <path d="M56 44l14 16-5 1-3 8-6-14z" fill="currentColor" />
      <path d="M28 64h40" {...stroke} opacity=".35" />
    </svg>
  );
}

/**
 * Connexion requise : l'idée est écrite, il manque un compte pour la garder.
 *
 * L'illustration montre ce qui est en jeu — le travail déjà saisi d'un côté,
 * le compte de l'autre — plutôt qu'un cadenas générique qui ne dirait que
 * « interdit ».
 */
export function SignInIllustration({ className = '', size = 108 }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 160 108"
      style={{ height: size }}
      className={`text-text-tertiary ${className}`}
      role="img"
      aria-hidden
    >
      {/* La demande déjà écrite */}
      <rect x="10" y="26" width="62" height="44" rx="8" {...stroke} />
      <rect x="20" y="38" width="34" height="5" rx="2.5" fill="currentColor" opacity=".35" />
      <rect x="20" y="49" width="42" height="5" rx="2.5" fill="currentColor" opacity=".2" />
      <rect x="20" y="58" width="22" height="5" rx="2.5" fill="currentColor" opacity=".2" />

      {/* Le pont vers le compte */}
      <path d="M80 48h18" {...stroke} strokeDasharray="4 4" className="text-primary" />
      <path d="M92 43l6 5-6 5" {...stroke} className="text-primary" />

      {/* Le compte : un profil, pas un cadenas */}
      <circle cx="128" cy="40" r="12" {...stroke} className="text-primary" />
      <circle cx="128" cy="36" r="4.5" {...stroke} className="text-primary" />
      <path d="M120 47a9 9 0 0116 0" {...stroke} className="text-primary" />
      <rect x="106" y="62" width="44" height="26" rx="7" {...stroke} className="text-primary" />
      <path d="M116 75h24" {...stroke} className="text-primary" opacity=".6" />
      <path d="M116 81h14" {...stroke} className="text-primary" opacity=".4" />
    </svg>
  );
}

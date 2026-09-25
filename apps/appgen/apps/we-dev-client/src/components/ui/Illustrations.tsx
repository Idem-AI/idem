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

/**
 * Les scènes des sections de la page d'accueil.
 *
 * Elles occupent une colonne entière, pas une vignette : le tracé est pensé à
 * cette échelle (viewBox de 360 de large) pour que le trait garde son poids
 * de 1,5 à 2 px à l'écran au lieu de s'épaissir par agrandissement. La
 * largeur suit le conteneur, la hauteur suit le ratio.
 */
interface SceneProps {
  className?: string;
}

const scene = (className: string) => `w-full h-auto text-text-tertiary ${className}`;

/** Chaque projet reçoit une direction visuelle distincte. */
export function ArtDirectionIllustration({ className = '' }: SceneProps) {
  return (
    <svg viewBox="0 0 360 240" className={scene(className)} role="img" aria-hidden>
      {/* Éditorial : angles vifs, titre lourd, texte en colonnes */}
      <rect x="24" y="44" width="96" height="160" rx="3" {...stroke} />
      <path d="M24 60h96" {...stroke} />
      <rect x="34" y="72" width="70" height="8" rx="1" fill="currentColor" opacity=".35" />
      <rect x="34" y="86" width="52" height="8" rx="1" fill="currentColor" opacity=".35" />
      <path d="M34 104h76" {...stroke} />
      <path d="M34 114h32M34 121h32M34 128h32M34 135h24M78 114h32M78 121h32M78 128h32M78 135h20" {...stroke} opacity=".4" />
      <rect x="34" y="146" width="76" height="46" fill="currentColor" opacity=".16" />

      {/* Doux : formes arrondies, avatar, bouton en pilule — la direction retenue */}
      <rect x="132" y="24" width="96" height="192" rx="18" {...stroke} className="text-primary" />
      <rect x="144" y="40" width="72" height="12" rx="6" {...stroke} className="text-primary" />
      <circle cx="180" cy="86" r="18" {...stroke} className="text-primary" />
      <circle cx="180" cy="81" r="6" {...stroke} className="text-primary" />
      <path d="M169 97a12 12 0 0122 0" {...stroke} className="text-primary" />
      <rect x="152" y="116" width="56" height="5" rx="2.5" fill="var(--color-primary)" opacity=".5" />
      <rect x="160" y="127" width="40" height="5" rx="2.5" fill="var(--color-primary)" opacity=".3" />
      <rect x="144" y="144" width="72" height="30" rx="10" {...stroke} className="text-primary" />
      <rect x="156" y="186" width="48" height="14" rx="7" fill="var(--color-primary)" opacity=".85" />

      {/* Brut : bandeau plein, grille carrée, aucun arrondi */}
      <rect x="240" y="44" width="96" height="160" rx="0" {...stroke} />
      <rect x="240" y="44" width="96" height="44" fill="currentColor" opacity=".22" />
      <rect x="250" y="58" width="58" height="10" fill="currentColor" opacity=".5" />
      <rect x="250" y="98" width="36" height="36" {...stroke} />
      <rect x="290" y="98" width="36" height="36" fill="currentColor" opacity=".16" />
      <rect x="250" y="138" width="36" height="36" fill="currentColor" opacity=".16" />
      <rect x="290" y="138" width="36" height="36" {...stroke} />
      <path d="M250 188h76" {...stroke} />
    </svg>
  );
}

/** On corrige au clic, dans l'aperçu, et la correction atterrit dans le code. */
export function VisualEditIllustration({ className = '' }: SceneProps) {
  return (
    <svg viewBox="0 0 360 240" className={scene(className)} role="img" aria-hidden>
      {/* L'aperçu */}
      <rect x="16" y="20" width="232" height="168" rx="10" {...stroke} />
      <path d="M16 44h232" {...stroke} />
      <circle cx="30" cy="32" r="2.4" fill="currentColor" opacity=".45" />
      <circle cx="40" cy="32" r="2.4" fill="currentColor" opacity=".3" />
      <circle cx="50" cy="32" r="2.4" fill="currentColor" opacity=".3" />
      <rect x="36" y="60" width="120" height="10" rx="5" fill="currentColor" opacity=".28" />

      {/* Le texte sélectionné, en cours d'écriture */}
      <rect x="30" y="82" width="176" height="36" rx="4" {...stroke} className="text-primary" strokeDasharray="4 3" />
      <rect x="38" y="91" width="150" height="6" rx="3" fill="var(--color-primary)" opacity=".55" />
      <rect x="38" y="103" width="106" height="6" rx="3" fill="var(--color-primary)" opacity=".35" />
      <path d="M150 100v12" {...stroke} strokeWidth={2} className="text-primary" />
      {[
        [30, 82],
        [206, 82],
        [30, 118],
        [206, 118],
      ].map(([cx, cy]) => (
        <rect
          key={`${cx}-${cy}`}
          x={cx - 3}
          y={cy - 3}
          width="6"
          height="6"
          rx="1"
          fill="var(--idem-surface-1)"
          {...stroke}
          className="text-primary"
        />
      ))}

      <rect x="36" y="134" width="80" height="40" rx="6" fill="currentColor" opacity=".14" />
      <rect x="128" y="136" width="56" height="8" rx="4" fill="currentColor" opacity=".16" />
      <rect x="128" y="152" width="44" height="8" rx="4" fill="currentColor" opacity=".12" />

      {/* Le curseur */}
      <path d="M186 106l19.6 22.4-7 1.4-4.2 11.2-8.4-19.6z" fill="currentColor" />

      {/* La ligne du code source qui a changé */}
      <path d="M210 100h58a10 10 0 0110 10v18" {...stroke} strokeDasharray="4 4" className="text-primary" />
      <path d="M273 124l5 5 5-5" {...stroke} className="text-primary" />
      <rect x="196" y="134" width="150" height="92" rx="10" fill="var(--idem-surface-1)" {...stroke} />
      <path d="M214 146l-5 5 5 5M224 146l5 5-5 5" {...stroke} />
      <rect x="210" y="168" width="60" height="5" rx="2.5" fill="currentColor" opacity=".22" />
      <rect x="204" y="180" width="134" height="14" rx="4" fill="var(--color-primary)" opacity=".12" />
      <rect x="216" y="184.5" width="96" height="5" rx="2.5" fill="var(--color-primary)" opacity=".75" />
      <rect x="216" y="202" width="80" height="5" rx="2.5" fill="currentColor" opacity=".16" />
      <rect x="210" y="214" width="44" height="5" rx="2.5" fill="currentColor" opacity=".16" />
    </svg>
  );
}

/**
 * Le code part sur iDeploy après vérification, et reste un paquet standard
 * qui se remonte sur n'importe quel serveur.
 */
export function SovereignDeployIllustration({ className = '' }: SceneProps) {
  return (
    <svg viewBox="16 56 336 172" className={scene(className)} role="img" aria-hidden>
      {/* Le code généré */}
      <path d="M28 94l24-12 24 12v30l-24 12-24-12z" {...stroke} />
      <path d="M28 94l24 12 24-12M52 106v30" {...stroke} />

      {/* Les étapes vérifiées */}
      <path d="M84 110h22" {...stroke} strokeDasharray="4 4" />
      {[108, 160, 212].map((x) => (
        <g key={x} className="text-primary">
          <rect x={x} y="94" width="32" height="32" rx="7" {...stroke} />
          <path d={`M${x + 9} 110l5 5 9-10`} {...stroke} />
        </g>
      ))}
      <path d="M140 110h20M192 110h20M244 110h16" {...stroke} strokeDasharray="4 4" />

      {/* iDeploy */}
      {[64, 98, 132].map((y) => (
        <g key={y} className="text-primary">
          <rect x="264" y={y} width="80" height="28" rx="6" {...stroke} />
          <circle cx="277" cy={y + 14} r="2.6" fill="currentColor" />
          <path d={`M300 ${y + 14}h32`} {...stroke} opacity=".5" />
        </g>
      ))}
      <path d="M304 160v20M284 180h40" {...stroke} />

      {/* Ailleurs : le même paquet tourne sur un autre serveur */}
      <path d="M52 144v38a8 8 0 008 8h40" {...stroke} strokeDasharray="4 4" />
      <path d="M96 185l5 5-5 5" {...stroke} />
      {[178, 202].map((y) => (
        <g key={y}>
          <rect x="108" y={y} width="72" height="20" rx="5" {...stroke} />
          <circle cx="119" cy={y + 10} r="2.2" fill="currentColor" opacity=".6" />
          <path d={`M134 ${y + 10}h34`} {...stroke} opacity=".35" />
        </g>
      ))}
    </svg>
  );
}

/** Point d'entrée 1 : une phrase devient une application. */
export function EntryPromptIllustration({ className = '' }: SceneProps) {
  return (
    <svg viewBox="0 0 360 200" className={scene(className)} role="img" aria-hidden>
      {/* La phrase */}
      <rect x="16" y="56" width="152" height="88" rx="16" {...stroke} />
      <rect x="32" y="74" width="112" height="6" rx="3" fill="currentColor" opacity=".35" />
      <rect x="32" y="88" width="84" height="6" rx="3" fill="currentColor" opacity=".2" />
      <path d="M121 86v10" {...stroke} className="text-primary" />
      <path d="M30 126h8M34 122v8" {...stroke} opacity=".5" />
      <circle cx="148" cy="126" r="9" fill="var(--color-primary)" opacity=".9" />
      <path d="M148 130v-8M144.5 125.5l3.5-3.5 3.5 3.5" {...stroke} stroke="var(--idem-surface-1)" />

      <path d="M178 100h26" {...stroke} strokeDasharray="4 4" className="text-primary" />
      <path d="M200 95l5 5-5 5" {...stroke} className="text-primary" />

      {/* L'application générée */}
      <rect x="216" y="24" width="128" height="152" rx="10" {...stroke} />
      <path d="M216 44h128" {...stroke} />
      <circle cx="227" cy="34" r="2.2" fill="currentColor" opacity=".45" />
      <circle cx="235" cy="34" r="2.2" fill="currentColor" opacity=".3" />
      <circle cx="243" cy="34" r="2.2" fill="currentColor" opacity=".3" />
      <rect x="228" y="56" width="104" height="44" rx="7" {...stroke} className="text-primary" />
      <path d="M240 90l14-14 10 10 8-8 14 12" {...stroke} className="text-primary" />
      <rect x="228" y="112" width="80" height="6" rx="3" fill="currentColor" opacity=".3" />
      <rect x="228" y="124" width="60" height="6" rx="3" fill="currentColor" opacity=".18" />
      <rect x="228" y="144" width="46" height="18" rx="9" fill="var(--color-primary)" opacity=".85" />
      <rect x="282" y="144" width="42" height="18" rx="9" {...stroke} />
    </svg>
  );
}

/** Point d'entrée 2 : les livrables Idem alimentent la génération. */
export function EntryProjectIllustration({ className = '' }: SceneProps) {
  return (
    <svg viewBox="0 0 360 200" className={scene(className)} role="img" aria-hidden>
      {/* Business plan */}
      <rect x="16" y="16" width="104" height="48" rx="7" {...stroke} />
      <path d="M30 54V44M42 54V36M54 54V40M66 54V28" {...stroke} strokeWidth={5} opacity=".3" />
      <rect x="80" y="30" width="28" height="4" rx="2" fill="currentColor" opacity=".3" />
      <rect x="80" y="40" width="20" height="4" rx="2" fill="currentColor" opacity=".2" />

      {/* Charte graphique */}
      <rect x="16" y="76" width="104" height="48" rx="7" {...stroke} />
      <circle cx="36" cy="100" r="10" fill="var(--color-primary)" opacity=".85" />
      <circle cx="60" cy="100" r="10" fill="currentColor" opacity=".35" />
      <circle cx="84" cy="100" r="10" {...stroke} />
      <path d="M100 94h10M100 104h6" {...stroke} opacity=".4" />

      {/* Diagrammes */}
      <rect x="16" y="136" width="104" height="48" rx="7" {...stroke} />
      <rect x="28" y="146" width="22" height="12" rx="2" {...stroke} />
      <rect x="84" y="146" width="22" height="12" rx="2" {...stroke} />
      <rect x="56" y="164" width="22" height="12" rx="2" {...stroke} />
      <path d="M50 152h34M67 152v12" {...stroke} opacity=".6" />

      {/* Tout converge */}
      <path
        d="M126 40c40 0 40 60 78 60M126 100h78M126 160c40 0 40-60 78-60"
        {...stroke}
        strokeDasharray="4 4"
        className="text-primary"
      />
      <path d="M200 95l5 5-5 5" {...stroke} className="text-primary" />

      {/* Le code, aligné sur la marque */}
      <rect x="216" y="30" width="128" height="140" rx="10" {...stroke} className="text-primary" />
      <path d="M216 50h128" {...stroke} className="text-primary" />
      <path d="M232 36l-4 4 4 4M242 36l4 4-4 4" {...stroke} className="text-primary" />
      <rect x="230" y="64" width="44" height="5" rx="2.5" fill="var(--color-primary)" opacity=".6" />
      <rect x="240" y="78" width="80" height="5" rx="2.5" fill="currentColor" opacity=".25" />
      <rect x="240" y="92" width="60" height="5" rx="2.5" fill="currentColor" opacity=".25" />
      <rect x="250" y="106" width="70" height="5" rx="2.5" fill="currentColor" opacity=".18" />
      <rect x="240" y="120" width="44" height="5" rx="2.5" fill="currentColor" opacity=".25" />
      <rect x="230" y="134" width="28" height="5" rx="2.5" fill="var(--color-primary)" opacity=".6" />
      <rect x="230" y="150" width="90" height="5" rx="2.5" fill="currentColor" opacity=".16" />
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

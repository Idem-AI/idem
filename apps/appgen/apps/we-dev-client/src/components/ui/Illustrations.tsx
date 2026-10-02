/**
 * Illustrations SVG du produit.
 *
 * Une modale de publication qui n'affiche que du texte oblige à lire pour
 * comprendre le choix ; une image le fait saisir avant la lecture. Chaque
 * illustration est un objet de la culture africaine qui dit ce que dit
 * l'écran (AGENTS.md § 4) : la pirogue qui prend la mer, le grenier et sa
 * serrure, la calebasse vide ou fêlée, le tambour parleur.
 *
 * Deux encres : `currentColor` pour le trait, `--color-primary-500` pour le
 * seul détail qui compte. Elles suivent le thème sans variante à maintenir.
 */

interface IllustrationProps {
  className?: string;
  /** Hauteur en pixels ; la largeur suit le ratio du tracé. */
  size?: number;
}

/** L'encre de la marque, réservée au seul détail qui compte. */
const ACCENT = { color: 'var(--color-primary-500)' };

/** Attributs communs aux tracés : au trait, bouts et angles arrondis. */
const LINE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/**
 * Publication rapide : la pirogue prend la mer telle quelle, tout de suite.
 */
export function PublishQuickIllustration({ className = '', size = 96 }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 120 96"
      style={{ height: size }}
      className={`text-text-tertiary ${className}`}
      {...LINE}
      role="img"
      aria-hidden
    >
      <g transform="translate(0 4)">
        <path d="M8 38 C12 44 16 50 24 56 C40 66 82 66 98 56 C104 52 108 44 112 34" strokeWidth="2"/>
        <path d="M8 38 C18 46 40 50 60 50 C80 50 100 46 112 34" strokeWidth="1.6"/>
        <path d="M20 48 L26 55.4 L28.5 50.6 L35.1 57.6 L38.7 52.5 L45.3 59.1 L50 53.5 L56.2 59.7 L61.8 53.8 L67.3 59.6 L73.4 53.1 L78 58.5 L84.4 51.7 L87.8 56.6 L94.1 49.3 L96.4 53.8 L102 46" strokeWidth="1.1" opacity=".75"/>
        <path d="M44 50 L36 28 M36 28 L33 22 C32 20 34 19 35 21 L38 27" strokeWidth="1.6"/>
        <g style={ACCENT}>
          <path d="M112 34 L116 26 L110 30 Z" strokeWidth="1.8"/>
          <path d="M104 44 L107 40 L110 44 L107 48 Z" strokeWidth="1.6"/>
        </g>
        <path d="M14 72 C20 68 26 68 32 72 S44 76 50 72 S62 68 68 72 S80 76 86 72 S98 68 104 72" opacity=".5"/>
        <path d="M30 80 C36 77 42 77 48 80 S60 83 66 80 S78 77 84 80" opacity=".3"/>
      </g>
    </svg>
  );
}

/**
 * Pipeline iDeploy : la porte du grenier et sa serrure de bois — l'application
 * est rangée sur votre infrastructure, et c'est vous qui en tenez la clé.
 */
export function PublishPipelineIllustration({ className = '', size = 96 }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 120 96"
      style={{ height: size }}
      className={`text-text-tertiary ${className}`}
      {...LINE}
      role="img"
      aria-hidden
    >
      <g transform="translate(0 4)">
        <rect x="34" y="10" width="44" height="70" rx="2" strokeWidth="2"/>
        <path d="M40 16 H72 V74 H40Z" opacity=".55"/>
        <path d="M44 22 L50 28 L44 34 M68 22 L62 28 L68 34 M44 60 L50 66 L44 72 M68 60 L62 66 L68 72" strokeWidth="1.2" opacity=".7"/>
        <path d="M56 18 V36 M56 58 V74" strokeWidth="1" opacity=".5"/>
        <rect x="74" y="30" width="12" height="30" rx="2" strokeWidth="2"/>
        <path d="M78 34 h4 M78 56 h4" strokeWidth="1" opacity=".6"/>
        <g style={ACCENT}>
          <path d="M60 45 H96" strokeWidth="3"/>
          <path d="M96 41 V49" strokeWidth="2"/>
          <path d="M66 42 L69 45 L66 48 L63 45Z" strokeWidth="1.4"/>
        </g>
      </g>
    </svg>
  );
}

/**
 * Échec de récupération : la calebasse fêlée, rien n'a pu y être puisé.
 */
export function LoadFailedIllustration({ className = '', size = 104 }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 120 104"
      style={{ height: size }}
      className={`text-text-tertiary ${className}`}
      {...LINE}
      role="img"
      aria-hidden
    >
      <g transform="translate(0 8)">
        <path d="M26 36 C26 60 41 76 60 76 C79 76 94 60 94 36" strokeWidth="2"/>
        <ellipse cx="60" cy="36" rx="34" ry="8" strokeWidth="2"/>
        <path d="M29.5 50 Q60 60 90.5 50 M33 58 Q60 68 87 58"/>
        <path d="M29 50 L36.9 59.3 L37.9 52.4 L44.6 61.4 L46.7 54.1 L52.3 62.6 L55.6 54.9 L60 63 L64.4 54.9 L67.7 62.6 L73.3 54.1 L75.4 61.4 L82.1 52.4 L83.1 59.3 L91 50"/>
        <path d="M48 70.7h0.01 M60 72h0.01 M72 70.7h0.01" strokeWidth="3"/>
        <ellipse cx="60" cy="36" rx="30" ry="5.5" opacity=".5"/>
        <g style={ACCENT} strokeWidth="2">
          <path d="M68 28.5 L64 38 L70 46 L63 56 L67 64 L64 75"/>
          <path d="M70 46 L76 49"/>
        </g>
      </g>
    </svg>
  );
}

/**
 * Rien à exécuter : la calebasse vide attend d'être remplie.
 */
export function EmptyPreviewIllustration({ className = '', size = 88 }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 120 88"
      style={{ height: size }}
      className={`text-text-disabled ${className}`}
      {...LINE}
      role="img"
      aria-hidden
    >
      <path d="M26 36 C26 60 41 76 60 76 C79 76 94 60 94 36" strokeWidth="2"/>
      <ellipse cx="60" cy="36" rx="34" ry="8" strokeWidth="2"/>
      <path d="M29.5 50 Q60 60 90.5 50 M33 58 Q60 68 87 58"/>
      <path d="M29 50 L36.9 59.3 L37.9 52.4 L44.6 61.4 L46.7 54.1 L52.3 62.6 L55.6 54.9 L60 63 L64.4 54.9 L67.7 62.6 L73.3 54.1 L75.4 61.4 L82.1 52.4 L83.1 59.3 L91 50"/>
      <path d="M48 70.7h0.01 M60 72h0.01 M72 70.7h0.01" strokeWidth="3"/>
      <g style={ACCENT}>
        <ellipse cx="60" cy="36" rx="28" ry="5" strokeDasharray="3 4"/>
      </g>
    </svg>
  );
}

/**
 * Aide : le tambour parleur — on parle, et l'application répond.
 */
export function HelpIllustration({ className = '', size = 88 }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 140 88"
      style={{ height: size }}
      className={`text-text-tertiary ${className}`}
      {...LINE}
      role="img"
      aria-hidden
    >
      <g transform="translate(10 0)">
        <ellipse cx="60" cy="20" rx="16" ry="4.5" strokeWidth="2"/>
        <ellipse cx="60" cy="68" rx="16" ry="4.5" strokeWidth="2"/>
        <path d="M44 20 C51 34 51 54 44 68 M76 20 C69 34 69 54 76 68"/>
        <path d="M46 22.7 L46 66.7 M49.5 24 L49.5 68 M53 25 L53 69 M56.5 25.5 L56.5 69.5 M60 25.5 L60 69.5 M63.5 25 L63.5 69 M67 24 L67 68 M70.5 22.7 L70.5 66.7" strokeWidth="1" opacity=".6"/>
        <path d="M44 44 H76" strokeWidth="1.2" opacity=".6"/>
        <path d="M50 34 L54 38 L50 42 M70 34 L66 38 L70 42 M50 46 L54 50 L50 54 M70 46 L66 50 L70 54" strokeWidth="1.2" opacity=".75"/>
        <path d="M78 76 C88 70 94 62 96 52" strokeWidth="2"/>
        <g style={ACCENT} strokeWidth="1.8">
          <path d="M88 22 C92 26 92 32 88 36"/>
          <path d="M94 16 C101 23 101 35 94 42"/>
          <path d="M32 22 C28 26 28 32 32 36"/>
          <path d="M26 16 C19 23 19 35 26 42"/>
        </g>
      </g>
    </svg>
  );
}

/* ==================================================================
   Illustrations de la page d'accueil
   ================================================================== */

/** Tracé de la maquette : au trait, comme les autres illustrations. */
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** Losange plein (signature IDEM) centré en (x, y), de demi-diagonale r. */
const diamond = (x: number, y: number, r: number) =>
  `M${x} ${y - r} L${x + r} ${y} L${x} ${y + r} L${x - r} ${y}Z`;

/* Les motifs des bandes tissées de l'aperçu, calculés plutôt que recopiés. */
const WEAVE_TEETH = Array.from({ length: 42 }, (_, i) => `${i ? 'L' : 'M'}${260 + i * 8} ${i % 2 ? 227 : 219}`).join(' ');
const WEAVE_DIAMONDS = Array.from({ length: 14 }, (_, i) => diamond(268 + i * 24, 243, 5)).join(' ');
const WEAVE_DOTS = Array.from({ length: 21 }, (_, i) => `M${264 + i * 10} 263h0.01`).join(' ');
const WEAVE_WARP = Array.from({ length: 15 }, (_, i) => `M${478 + i * 8} 254V274`).join(' ');

/**
 * Maquette du produit : la coquille du builder, conversation à gauche et
 * aperçu à droite, avec la barre d'outils flottante.
 *
 * La disposition reste celle de l'outil, pour qu'on le reconnaisse ; ce qui
 * s'y construit est dessiné dans le vocabulaire IDEM. Le tambour parleur
 * porte la conversation, l'application générée est une façade en banco, et
 * la page se tisse en bandes étroites — kente, losanges, points de bogolan —
 * dont la dernière est encore sur le métier : la navette, seul détail en
 * couleur, dit que le code se fait fil à fil, sous les yeux.
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
      <path d={`${diamond(30, 26, 4)} ${diamond(46, 26, 4)} ${diamond(62, 26, 4)}`} fill="currentColor" opacity=".35" />
      <rect x="88" y="20" width="54" height="12" rx="6" {...stroke} />
      <rect x="470" y="19" width="62" height="14" rx="7" fill="currentColor" opacity=".12" />
      <rect x="472" y="21" width="28" height="10" rx="5" fill="currentColor" opacity=".3" />
      <rect x="546" y="19" width="52" height="14" rx="7" {...stroke} />
      <circle cx="614" cy="26" r="8" {...stroke} />

      {/* Conversation : le tambour parleur répond */}
      <path d="M212 44v328" {...stroke} />
      <g {...stroke} strokeWidth="1.2">
        <ellipse cx="42" cy="60" rx="11" ry="3.2" />
        <ellipse cx="42" cy="90" rx="11" ry="3.2" />
        <path d="M31 60C36 69 36 81 31 90M53 60C48 69 48 81 53 90" />
        <path d="M34 62.5L50 87.5M50 62.5L34 87.5M38 63L46 87M46 63L38 87" strokeWidth=".7" opacity=".6" />
      </g>
      <rect x="64" y="64" width="104" height="9" rx="4.5" fill="currentColor" opacity=".28" />
      <rect x="64" y="81" width="120" height="9" rx="4.5" fill="currentColor" opacity=".16" />
      <rect x="72" y="108" width="112" height="26" rx="8" {...stroke} />
      <rect x="84" y="117" width="88" height="8" rx="4" fill="currentColor" opacity=".28" />
      <rect x="32" y="152" width="140" height="9" rx="4.5" fill="currentColor" opacity=".16" />
      <path d={`${diamond(36, 186, 4)} ${diamond(36, 206, 4)} ${diamond(36, 226, 4)}`} {...stroke} strokeWidth="1.2" />
      <rect x="48" y="182" width="104" height="8" rx="4" fill="currentColor" opacity=".16" />
      <rect x="48" y="202" width="86" height="8" rx="4" fill="currentColor" opacity=".16" />
      <rect x="48" y="222" width="96" height="8" rx="4" fill="currentColor" opacity=".1" />
      <rect x="32" y="326" width="152" height="30" rx="10" {...stroke} />
      <path d="M164 341h10M170 337l4 4-4 4" {...stroke} />

      {/* Aperçu : l'application bâtie et sa page tissée */}
      <rect x="236" y="66" width="376" height="230" rx="10" {...stroke} opacity=".7" />
      <path d="M236 92h376" {...stroke} opacity=".7" />
      <path d={diamond(256, 79, 5)} {...stroke} strokeWidth="1.3" />
      <path d="M506 79h20M538 79h20M570 79h20" {...stroke} strokeWidth="3" opacity=".25" />

      {/* Façade en banco à torons */}
      <g transform="translate(265 112) scale(1.1)" {...stroke} strokeWidth="1">
        <path d="M12 80 H108" opacity=".4" />
        <path d="M20 80 V22 M36 80 V22 M84 80 V22 M100 80 V22" strokeWidth="1.1" />
        <path d="M20 22 C20 14 28 10 28 4 C28 10 36 14 36 22 M84 22 C84 14 92 10 92 4 C92 10 100 14 100 22" strokeWidth="1.2" />
        <path d="M52 22 C52 16 56 14 60 8 C64 14 68 16 68 22" strokeWidth="1.2" />
        <path d="M20 22 H100 V80 H20Z" strokeWidth="1.4" />
        <path d="M26 26 h8 M42 26 h8 M70 26 h8 M86 26 h8 M26 44 h8 M42 44 h8 M70 44 h8 M86 44 h8 M26 62 h8 M42 62 h8 M70 62 h8 M86 62 h8" strokeWidth="1.5" />
        <path d="M42 32 L46 36 L50 32 M70 32 L74 36 L78 32" strokeWidth=".7" opacity=".6" />
        <path d="M52 80 V58 C52 52 56 50 60 50 C64 50 68 52 68 58 V80" strokeWidth="1.4" />
      </g>
      <rect x="424" y="120" width="168" height="12" rx="6" fill="currentColor" opacity=".22" />
      <rect x="424" y="142" width="130" height="12" rx="6" fill="currentColor" opacity=".14" />
      <rect x="424" y="168" width="86" height="24" rx="6" {...stroke} />
      <rect x="440" y="177" width="54" height="6" rx="3" fill="currentColor" opacity=".3" />

      {/* Bandes tissées : kente, losanges, puis la bande encore sur le métier */}
      <g {...stroke} strokeWidth="1.1">
        <rect x="256" y="214" width="336" height="18" rx="1" opacity=".7" />
        <path d={WEAVE_TEETH} opacity=".7" />
        <rect x="256" y="236" width="336" height="14" rx="1" opacity=".7" />
        <path d={WEAVE_DIAMONDS} opacity=".7" />
        <path d="M256 256H470V270H256" opacity=".7" />
        <path d={WEAVE_DOTS} strokeWidth="2.6" opacity=".7" />
        <path d={WEAVE_WARP} strokeWidth=".8" opacity=".45" />
      </g>
      <g style={ACCENT} transform="translate(436 213)" {...stroke}>
        <path d="M34 50 C44 46 76 46 86 50 C76 54 44 54 34 50Z" strokeWidth="1.6" />
        <path d="M52 50 H68" strokeWidth="2.2" />
      </g>

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
      <path d={diamond(344, 333, 6)} {...stroke} />
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

/**
 * Chaque projet reçoit une direction visuelle distincte : trois étoffes —
 * kente, bogolan, wax — et celle du milieu est retenue.
 */
export function ArtDirectionIllustration({ className = '' }: SceneProps) {
  return (
    <svg viewBox="0 0 360 240" className={scene(className)} {...LINE} role="img" aria-hidden>
      <rect x="24" y="44" width="96" height="160" rx="2" strokeWidth="2"/>
      <path d="M34 53 h76 v18 h-76z M34 62 h76 M72 53 v18" strokeWidth="1.2" opacity=".75"/>
      <path d="M52 77.5 L62 87.5 L52 97.5 L42 87.5Z M92 77.5 L102 87.5 L92 97.5 L82 87.5Z" strokeWidth="1.2" opacity=".75"/>
      <path d="M34 104 h76 v18 h-76z M34 113 h76 M72 104 v18" strokeWidth="1.2" opacity=".75"/>
      <path d="M52 128.5 L62 138.5 L52 148.5 L42 138.5Z M92 128.5 L102 138.5 L92 148.5 L82 138.5Z" strokeWidth="1.2" opacity=".75"/>
      <path d="M34 155 h76 v18 h-76z M34 164 h76 M72 155 v18" strokeWidth="1.2" opacity=".75"/>
      <path d="M52 179.5 L62 189.5 L52 199.5 L42 189.5Z M92 179.5 L102 189.5 L92 199.5 L82 189.5Z" strokeWidth="1.2" opacity=".75"/>
      <rect x="132" y="24" width="96" height="192" rx="2" strokeWidth="2"/>
      <rect x="140" y="32" width="80" height="176" rx="1" strokeWidth="1" opacity=".55"/>
      <path d="M148 44 L153.3 52 L158.7 44 L164 52 L169.3 44 L174.7 52 L180 44 L185.3 52 L190.7 44 L196 52 L201.3 44 L206.7 52 L212 44" strokeWidth="1.2"/>
      <path d="M148 76 L153.3 84 L158.7 76 L164 84 L169.3 76 L174.7 84 L180 76 L185.3 84 L190.7 76 L196 84 L201.3 76 L206.7 84 L212 76" strokeWidth="1.2"/>
      <path d="M148 164 L153.3 172 L158.7 164 L164 172 L169.3 164 L174.7 172 L180 164 L185.3 172 L190.7 164 L196 172 L201.3 164 L206.7 172 L212 164" strokeWidth="1.2"/>
      <path d="M148 196 L153.3 204 L158.7 196 L164 204 L169.3 196 L174.7 204 L180 196 L185.3 204 L190.7 196 L196 204 L201.3 196 L206.7 204 L212 196" strokeWidth="1.2"/>
      <path d="M150 60h0.01 M150 180h0.01 M162 60h0.01 M162 180h0.01 M174 60h0.01 M174 180h0.01 M186 60h0.01 M186 180h0.01 M198 60h0.01 M198 180h0.01 M210 60h0.01 M210 180h0.01" strokeWidth="3"/>
      <g style={ACCENT}>
        <path d="M180 96 L204 120 L180 144 L156 120Z M180 108 L192 120 L180 132 L168 120Z" strokeWidth="2.2"/>
      </g>
      <rect x="240" y="44" width="96" height="160" rx="2" strokeWidth="2"/>
      <circle cx="264" cy="72" r="14" strokeWidth="1.2" opacity=".75"/>
      <circle cx="264" cy="72" r="6" strokeWidth="1.2" opacity=".75"/>
      <circle cx="312" cy="72" r="14" strokeWidth="1.2" opacity=".75"/>
      <circle cx="312" cy="72" r="6" strokeWidth="1.2" opacity=".75"/>
      <circle cx="288" cy="110" r="14" strokeWidth="1.2" opacity=".75"/>
      <circle cx="288" cy="110" r="6" strokeWidth="1.2" opacity=".75"/>
      <circle cx="264" cy="148" r="14" strokeWidth="1.2" opacity=".75"/>
      <circle cx="264" cy="148" r="6" strokeWidth="1.2" opacity=".75"/>
      <circle cx="312" cy="148" r="14" strokeWidth="1.2" opacity=".75"/>
      <circle cx="312" cy="148" r="6" strokeWidth="1.2" opacity=".75"/>
      <circle cx="288" cy="186" r="14" strokeWidth="1.2" opacity=".75"/>
      <circle cx="288" cy="186" r="6" strokeWidth="1.2" opacity=".75"/>
    </svg>
  );
}

/**
 * On corrige au clic, dans l'aperçu : le motif choisi sur l'étoffe, et le
 * métier à tisser où la correction retourne dans le code.
 */
export function VisualEditIllustration({ className = '' }: SceneProps) {
  return (
    <svg viewBox="0 0 360 240" className={scene(className)} {...LINE} role="img" aria-hidden>
      <rect x="16" y="20" width="232" height="168" rx="2" strokeWidth="2"/>
      <path d="M16 34 H248 M16 174 H248" strokeWidth="1" opacity=".55"/>
      <path d="M28 48 L36 56 L44 48 L52 56 L60 48 L68 56 L76 48 L84 56 L92 48 L100 56 L108 48 L116 56 L124 48 L132 56 L140 48 L148 56 L156 48 L164 56 L172 48 L180 56 L188 48 L196 56 L204 48 L212 56 L220 48 L228 56 L236 48" strokeWidth="1.1" opacity=".7"/>
      <path d="M28 150 L36 158 L44 150 L52 158 L60 150 L68 158 L76 150 L84 158 L92 150 L100 158 L108 150 L116 158 L124 150 L132 158 L140 150 L148 158 L156 150 L164 158 L172 150 L180 158 L188 150 L196 158 L204 150 L212 158 L220 150 L228 158 L236 150" strokeWidth="1.1" opacity=".7"/>
      <path d="M58 84 L76 102 L58 120 L40 102Z M58 94 L66 102 L58 110 L50 102Z" strokeWidth="1.3" opacity=".75"/>
      <path d="M206 84 L224 102 L206 120 L188 102Z M206 94 L214 102 L206 110 L198 102Z" strokeWidth="1.3" opacity=".75"/>
      <path d="M132 88 L146 102 L132 116 L118 102Z" strokeWidth="1.5"/>
      <g style={ACCENT}>
        <rect x="104" y="74" width="56" height="56" rx="2" strokeWidth="1.6" strokeDasharray="4 3"/>
        <rect x="101" y="71" width="6" height="6" rx="1" strokeWidth="1.6"/>
        <rect x="157" y="71" width="6" height="6" rx="1" strokeWidth="1.6"/>
        <rect x="101" y="127" width="6" height="6" rx="1" strokeWidth="1.6"/>
        <rect x="157" y="127" width="6" height="6" rx="1" strokeWidth="1.6"/>
      </g>
      <path d="M150 112 L168 132 L161 133.5 L165 143 L160.5 145 L156.5 135.5 L151 140Z" strokeWidth="1.6"/>
      <path d="M170 136 C200 136 232 150 256 170" strokeDasharray="4 4" opacity=".6"/>
      <path d="M251 164 L257 171 L249 173" opacity=".6"/>
      <g transform="translate(238 128) scale(1.15)" strokeWidth="1.3">
        <path d="M26 10 V82 M94 10 V82 M22 12 H98" strokeWidth="1.7"/>
        <path d="M60 12 V18 M52 18 H68"/>
        <path d="M44 30 H76 M44 36 H76" strokeWidth="1.6"/>
        <path d="M46 20 V80 M50 20 V80 M54 20 V80 M58 20 V80 M62 20 V80 M66 20 V80 M70 20 V80 M74 20 V80" strokeWidth="0.8" opacity=".65"/>
        <rect x="43" y="58" width="34" height="22" rx="1" strokeWidth="1.4"/>
        <path d="M44.0 60 h3.2 v3.4 h-3.2z M53.2 60 h3.2 v3.4 h-3.2z M62.4 60 h3.2 v3.4 h-3.2z M71.6 60 h3.2 v3.4 h-3.2z M48.6 65 h3.2 v3.4 h-3.2z M57.8 65 h3.2 v3.4 h-3.2z M67.0 65 h3.2 v3.4 h-3.2z M44.0 70 h3.2 v3.4 h-3.2z M53.2 70 h3.2 v3.4 h-3.2z M62.4 70 h3.2 v3.4 h-3.2z M71.6 70 h3.2 v3.4 h-3.2z M48.6 75 h3.2 v3.4 h-3.2z M57.8 75 h3.2 v3.4 h-3.2z M67.0 75 h3.2 v3.4 h-3.2z" strokeWidth="0.9" opacity=".8"/>
        <path d="M40 82 H80" strokeWidth="1.7"/>
        <g >
          <path d="M34 50 C44 46 76 46 86 50 C76 54 44 54 34 50Z" strokeWidth="1.6"/>
          <path d="M52 50 H68" strokeWidth="2.1"/>
        </g>
      </g>
    </svg>
  );
}

/**
 * Le panier (le code) passe les étapes vérifiées et se range dans le grenier
 * d'iDeploy ; le même panier se range aussi dans n'importe quel autre grenier.
 */
export function SovereignDeployIllustration({ className = '' }: SceneProps) {
  return (
    <svg viewBox="16 56 336 172" className={scene(className)} {...LINE} role="img" aria-hidden>
      <g transform="translate(12 64) scale(0.72)" strokeWidth="2.1">
        <path d="M40 40 C38 16 82 16 80 40" strokeWidth="2.8"/>
        <path d="M44 40 C43 22 77 22 76 40" opacity=".55"/>
        <path d="M36 26 L40 30 M84 26 L80 30" opacity=".6"/>
        <ellipse cx="60" cy="42" rx="34" ry="6" strokeWidth="2.8"/>
        <path d="M26 42 C26 62 34 78 60 78 C86 78 94 62 94 42" strokeWidth="2.8"/>
        <path d="M28 46 L33.3 52 L38.7 46 L44 52 L49.3 46 L54.7 52 L60 46 L65.3 52 L70.7 46 L76 52 L81.3 46 L86.7 52 L92 46 M30 55 L35 61 L40 55 L45 61 L50 55 L55 61 L60 55 L65 61 L70 55 L75 61 L80 55 L85 61 L90 55 M32 64 L36.7 70 L41.3 64 L46 70 L50.7 64 L55.3 70 L60 64 L64.7 70 L69.3 64 L74 70 L78.7 64 L83.3 70 L88 64" strokeWidth="1.4" opacity=".7"/>
        <g >
          <path d="M60 45.5 L64 51 L60 56.5 L56 51Z" strokeWidth="2.5"/>
        </g>
      </g>
      <path d="M104 104 H126 M170 104 H186 M230 104 H246" strokeDasharray="4 4" opacity=".6"/>
      <g style={ACCENT}>
        <path d="M148 86 L166 104 L148 122 L130 104Z" strokeWidth="1.8"/>
        <path d="M141 104 L146 109 L155 99" strokeWidth="2"/>
        <path d="M208 86 L226 104 L208 122 L190 104Z" strokeWidth="1.8"/>
        <path d="M201 104 L206 109 L215 99" strokeWidth="2"/>
      </g>
      <g transform="translate(238 44) scale(1.1)" strokeWidth="1.4">
        <path d="M42 40 L44 74 H76 L78 40" strokeWidth="1.8"/>
        <path d="M46 74 V80 M56 74 V80 M64 74 V80 M74 74 V80 M40 80 H80" opacity=".8"/>
        <path d="M36 42 C44 34 52 18 60 8 C68 18 76 34 84 42 C76 45 44 45 36 42Z" strokeWidth="1.8"/>
        <path d="M60 8 V43 M50 22 L46 42 M70 22 L74 42 M55 15 L52 43 M65 15 L68 43" strokeWidth="0.8" opacity=".6"/>
        <path d="M58 6 L60 2 L62 6" strokeWidth="1.3"/>
        <path d="M46 62 L50 66 L54 62 L58 66 L62 62 L66 66 L70 62 L74 66" strokeWidth="1" opacity=".7"/>
        <rect x="54" y="48" width="12" height="11" rx="1"/>
        <g >
          <path d="M51 53.5 H64" strokeWidth="2"/>
          <path d="M64 51 V56" strokeWidth="1.5"/>
        </g>
      </g>
      <path d="M56 136 V186 C56 194 60 198 68 198 H226" strokeDasharray="4 4" opacity=".6"/>
      <path d="M221 193 L227 198 L221 203" opacity=".6"/>
      <g transform="translate(212 154) scale(0.8)" strokeWidth="1.9">
        <path d="M42 40 L44 74 H76 L78 40" strokeWidth="2.5"/>
        <path d="M46 74 V80 M56 74 V80 M64 74 V80 M74 74 V80 M40 80 H80" opacity=".8"/>
        <path d="M36 42 C44 34 52 18 60 8 C68 18 76 34 84 42 C76 45 44 45 36 42Z" strokeWidth="2.5"/>
        <path d="M60 8 V43 M50 22 L46 42 M70 22 L74 42 M55 15 L52 43 M65 15 L68 43" strokeWidth="1.1" opacity=".6"/>
        <path d="M58 6 L60 2 L62 6" strokeWidth="1.7"/>
        <path d="M46 62 L50 66 L54 62 L58 66 L62 62 L66 66 L70 62 L74 66" strokeWidth="1.4" opacity=".7"/>
        <rect x="54" y="48" width="12" height="11" rx="1"/>
      </g>
    </svg>
  );
}

/**
 * Point d'entrée 1 : une phrase dite au tambour parleur devient une
 * application bâtie, comme une façade en banco.
 */
export function EntryPromptIllustration({ className = '' }: SceneProps) {
  return (
    <svg viewBox="0 0 360 200" className={scene(className)} {...LINE} role="img" aria-hidden>
      <g transform="translate(-4 34) scale(1.5)" strokeWidth="1">
        <ellipse cx="60" cy="20" rx="16" ry="4.5" strokeWidth="1.3"/>
        <ellipse cx="60" cy="68" rx="16" ry="4.5" strokeWidth="1.3"/>
        <path d="M44 20 C51 34 51 54 44 68 M76 20 C69 34 69 54 76 68"/>
        <path d="M46 22.7 L46 66.7 M49.5 24 L49.5 68 M53 25 L53 69 M56.5 25.5 L56.5 69.5 M60 25.5 L60 69.5 M63.5 25 L63.5 69 M67 24 L67 68 M70.5 22.7 L70.5 66.7" strokeWidth="0.7" opacity=".6"/>
        <path d="M44 44 H76" strokeWidth="0.8" opacity=".6"/>
        <path d="M50 34 L54 38 L50 42 M70 34 L66 38 L70 42 M50 46 L54 50 L50 54 M70 46 L66 50 L70 54" strokeWidth="0.8" opacity=".75"/>
        <path d="M78 76 C88 70 94 62 96 52" strokeWidth="1.3"/>
        <g style={ACCENT} strokeWidth="1.2">
          <path d="M88 22 C92 26 92 32 88 36"/>
          <path d="M94 16 C101 23 101 35 94 42"/>
          <path d="M32 22 C28 26 28 32 32 36"/>
          <path d="M26 16 C19 23 19 35 26 42"/>
        </g>
      </g>
      <path d="M170 100 H200" strokeDasharray="4 4" opacity=".6"/>
      <g style={ACCENT}>
        <path d="M196 94 L202 100 L196 106" strokeWidth="1.8"/>
      </g>
      <g transform="translate(190 36) scale(1.45)" strokeWidth="1">
        <path d="M12 80 H108" opacity=".4"/>
        <path d="M20 80 V22 M36 80 V22 M84 80 V22 M100 80 V22" strokeWidth="1.1"/>
        <path d="M20 22 C20 14 28 10 28 4 C28 10 36 14 36 22 M84 22 C84 14 92 10 92 4 C92 10 100 14 100 22" strokeWidth="1.2"/>
        <path d="M52 22 C52 16 56 14 60 8 C64 14 68 16 68 22" strokeWidth="1.2"/>
        <path d="M20 22 H100 V80 H20Z" strokeWidth="1.4"/>
        <path d="M26 26 h8 M42 26 h8 M70 26 h8 M86 26 h8 M26 44 h8 M42 44 h8 M70 44 h8 M86 44 h8 M26 62 h8 M42 62 h8 M70 62 h8 M86 62 h8" strokeWidth="1.5"/>
        <path d="M42 32 L46 36 L50 32 M70 32 L74 36 L78 32" strokeWidth="0.7" opacity=".6"/>
        <g >
          <path d="M52 80 V58 C52 52 56 50 60 50 C64 50 68 52 68 58 V80" strokeWidth="1.4"/>
          <path d="M60 50 V44" strokeWidth="1"/>
        </g>
      </g>
    </svg>
  );
}

/**
 * Point d'entrée 2 : les livrables Idem — le baobab du business plan, le
 * tampon de la charte, le filet des diagrammes — alimentent le métier à
 * tisser où le code prend forme.
 */
export function EntryProjectIllustration({ className = '' }: SceneProps) {
  return (
    <svg viewBox="0 0 360 200" className={scene(className)} {...LINE} role="img" aria-hidden>
      <g transform="translate(-6 -2) scale(0.72)" strokeWidth="2.1">
        <path d="M22 80 H98" opacity=".4"/>
        <path d="M44 80 C40 66 42 50 48 40 M76 80 C80 66 78 50 72 40" strokeWidth="2.8"/>
        <path d="M48 40 C44 34 36 30 28 30 M48 40 C46 32 44 26 40 18 M55 38 C54 30 56 22 58 14 M65 38 C66 30 70 24 76 18 M72 40 C78 34 86 32 94 32" strokeWidth="2.8"/>
        <path d="M28 30 C24 28 21 29 19 31 M28 30 C27 26 28 23 30 21 M40 18 C36 16 34 13 34 10 M40 18 C42 15 45 13 48 13 M58 14 C56 11 56 8 57 6 M58 14 C61 12 63 12 65 13 M76 18 C76 14 78 12 80 11 M76 18 C80 17 83 17 85 19 M94 32 C97 29 100 29 102 30 M94 32 C96 34 97 36 96 39" strokeWidth="1.9"/>
        <path d="M52 50 V60 M57 46 V70 M63 48 V74 M68 52 V64" strokeWidth="1.4" opacity=".45"/>
      </g>
      <g transform="translate(14 58) scale(0.78)" strokeWidth="1.9">
        <path d="M34 12 L26 44 M34 12 L42 44 M34 12 L20 40 M34 12 L48 40" strokeWidth="2.1"/>
        <path d="M30 10 H38" strokeWidth="3.1"/>
        <ellipse cx="34" cy="52" rx="22" ry="9" strokeWidth="2.6"/>
        <path d="M12 52 V56 C12 61 22 65 34 65 C46 65 56 61 56 56 V52" strokeWidth="2.1"/>
        <g transform="translate(34 52) scale(.9 .36)">
          <path d="M0 -9 L9 0 L0 9 L-9 0Z M0 -4 L4 0 L0 4 L-4 0Z M-9 0 H-13 M9 0 H13 M0 -9 V-13 M0 9 V13" strokeWidth="3.1"/>
        </g>
      </g>
      <g transform="translate(-6 134) scale(0.72)" strokeWidth="2.1">
        <path d="M60 12 V4 C60 2 64 2 64 4" strokeWidth="2.2"/>
        <path d="M60 12 L18.2 72.5 M60 12 L24.4 74.7 M60 12 L34.1 76.5 M60 12 L46.4 77.6 M60 12 L60 78 M60 12 L73.6 77.6 M60 12 L85.9 76.5 M60 12 L95.6 74.7 M60 12 L101.8 72.5" strokeWidth="1.5" opacity=".75"/>
        <path d="M45.4 33.2 L47.5 33.9 L50.9 34.6 L55.2 35 L60 35.1 L64.8 35 L69.1 34.6 L72.5 33.9 L74.6 33.2 M34.9 48.3 L38.6 49.6 L44.5 50.7 L51.8 51.4 L60 51.6 L68.2 51.4 L75.5 50.7 L81.4 49.6 L85.1 48.3 M25.7 61.6 L30.8 63.4 L38.8 64.9 L48.9 65.8 L60 66.1 L71.1 65.8 L81.2 64.9 L89.2 63.4 L94.3 61.6" strokeWidth="1.5" opacity=".75"/>
        <path d="M18.2 72.5 L24.4 74.7 L34.1 76.5 L46.4 77.6 L60 78 L73.6 77.6 L85.9 76.5 L95.6 74.7 L101.8 72.5" strokeWidth="2.8"/>
        <path d="M47.5 33.9h0.01 M50.9 34.6h0.01 M55.2 35h0.01 M60 35.1h0.01 M64.8 35h0.01 M69.1 34.6h0.01 M72.5 33.9h0.01 M38.6 49.6h0.01 M44.5 50.7h0.01 M51.8 51.4h0.01 M60 51.6h0.01 M68.2 51.4h0.01 M75.5 50.7h0.01 M81.4 49.6h0.01 M30.8 63.4h0.01 M38.8 64.9h0.01 M48.9 65.8h0.01 M60 66.1h0.01 M71.1 65.8h0.01 M81.2 64.9h0.01 M89.2 63.4h0.01" strokeWidth="4.2" opacity=".8"/>
        <path d="M18.2 75.5h0.01 M24.4 77.7h0.01 M34.1 79.5h0.01 M46.4 80.6h0.01 M60 81h0.01 M73.6 80.6h0.01 M85.9 79.5h0.01 M95.6 77.7h0.01 M101.8 75.5h0.01" strokeWidth="5.6"/>
        <g >
          <circle cx="68.2" cy="51.4" r="4" strokeWidth="2.5"/>
        </g>
      </g>
      <path d="M86 34 C128 34 128 100 170 100 M86 100 H170 M86 164 C128 164 128 100 170 100" strokeDasharray="4 4" opacity=".6"/>
      <g style={ACCENT}>
        <path d="M166 94 L172 100 L166 106" strokeWidth="1.8"/>
      </g>
      <g transform="translate(178 19.5) scale(1.75)" strokeWidth="0.9">
        <path d="M26 10 V82 M94 10 V82 M22 12 H98" strokeWidth="1.1"/>
        <path d="M60 12 V18 M52 18 H68"/>
        <path d="M44 30 H76 M44 36 H76" strokeWidth="1"/>
        <path d="M46 20 V80 M50 20 V80 M54 20 V80 M58 20 V80 M62 20 V80 M66 20 V80 M70 20 V80 M74 20 V80" strokeWidth="0.5" opacity=".65"/>
        <rect x="43" y="58" width="34" height="22" rx="1" strokeWidth="0.9"/>
        <path d="M44.0 60 h3.2 v3.4 h-3.2z M53.2 60 h3.2 v3.4 h-3.2z M62.4 60 h3.2 v3.4 h-3.2z M71.6 60 h3.2 v3.4 h-3.2z M48.6 65 h3.2 v3.4 h-3.2z M57.8 65 h3.2 v3.4 h-3.2z M67.0 65 h3.2 v3.4 h-3.2z M44.0 70 h3.2 v3.4 h-3.2z M53.2 70 h3.2 v3.4 h-3.2z M62.4 70 h3.2 v3.4 h-3.2z M71.6 70 h3.2 v3.4 h-3.2z M48.6 75 h3.2 v3.4 h-3.2z M57.8 75 h3.2 v3.4 h-3.2z M67.0 75 h3.2 v3.4 h-3.2z" strokeWidth="0.6" opacity=".8"/>
        <path d="M40 82 H80" strokeWidth="1.1"/>
        <g >
          <path d="M34 50 C44 46 76 46 86 50 C76 54 44 54 34 50Z" strokeWidth="1"/>
          <path d="M52 50 H68" strokeWidth="1.4"/>
        </g>
      </g>
    </svg>
  );
}

/**
 * Connexion requise : la clé dont l'anneau est le bouclier de la connexion.
 * L'idée est écrite ; il manque le compte qui la garde.
 */
export function SignInIllustration({ className = '', size = 108 }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 160 108"
      style={{ height: size }}
      className={`text-text-tertiary ${className}`}
      {...LINE}
      role="img"
      aria-hidden
    >
      <path d="M40 18 C58 30 66 44 66 54 C66 64 58 78 40 90 C22 78 14 64 14 54 C14 44 22 30 40 18Z" strokeWidth="2"/>
      <path d="M40 26 C54 36 60 46 60 54 C60 62 54 72 40 82 C26 72 20 62 20 54 C20 46 26 36 40 26Z" strokeWidth="1.4"/>
      <path d="M32 36 L40 41 L48 36 M29 42 L40 49 L51 42 M32 72 L40 67 L48 72 M29 66 L40 59 L51 66" strokeWidth="1.3"/>
      <path d="M66 54 H136" strokeWidth="2.2"/>
      <path d="M114 54 V67 H121 V60 H127 V70 H134 V54" strokeWidth="2"/>
      <path d="M72 50 V58 M76 50 V58" strokeWidth="1.4"/>
      <path d="M144 42 L149 37 M147 54 H153 M144 66 L149 71" strokeWidth="1.6" opacity=".6"/>
      <g style={ACCENT}>
        <path d="M40 48 L45 54 L40 60 L35 54Z" strokeWidth="2"/>
      </g>
    </svg>
  );
}

/**
 * Illustrations de la visite guidée.
 *
 * Le moteur `@idem/shared-tour` construit du DOM, pas du React : il attend donc
 * du balisage SVG sérialisé. Ces chaînes partagent le vocabulaire graphique du
 * reste du produit — un objet de la culture africaine par étape (AGENTS.md
 * § 4), au trait en `currentColor`, un seul détail sur la couleur primaire —
 * pour que la visite ne ressemble pas à une pièce rapportée.
 */

const OPEN =
  '<svg viewBox="0 0 200 84" width="200" height="84" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">';

/** Étape 1 — une phrase dite au tambour parleur devient une application bâtie. */
export const TOUR_WELCOME = `${OPEN}
  <g transform="translate(6 6) scale(0.82)" stroke-width="1.8">
    <ellipse cx="60" cy="20" rx="16" ry="4.5" stroke-width="2.4"/>
    <ellipse cx="60" cy="68" rx="16" ry="4.5" stroke-width="2.4"/>
    <path d="M44 20 C51 34 51 54 44 68 M76 20 C69 34 69 54 76 68"/>
    <path d="M46 22.7 L46 66.7 M49.5 24 L49.5 68 M53 25 L53 69 M56.5 25.5 L56.5 69.5 M60 25.5 L60 69.5 M63.5 25 L63.5 69 M67 24 L67 68 M70.5 22.7 L70.5 66.7" stroke-width="1.2" opacity=".6"/>
    <path d="M44 44 H76" stroke-width="1.5" opacity=".6"/>
    <path d="M50 34 L54 38 L50 42 M70 34 L66 38 L70 42 M50 46 L54 50 L50 54 M70 46 L66 50 L70 54" stroke-width="1.5" opacity=".75"/>
    <path d="M78 76 C88 70 94 62 96 52" stroke-width="2.4"/>
    <g style="color: var(--color-primary-500, #1447e6)" stroke-width="2.2">
      <path d="M88 22 C92 26 92 32 88 36"/>
      <path d="M94 16 C101 23 101 35 94 42"/>
      <path d="M32 22 C28 26 28 32 32 36"/>
      <path d="M26 16 C19 23 19 35 26 42"/>
    </g>
  </g>
  <path d="M96 42 H110" stroke-dasharray="3 3" opacity=".6"/>
  <g style="color: var(--color-primary-500, #1447e6)">
    <path d="M107 38 L111 42 L107 46" stroke-width="1.6"/>
  </g>
  <g transform="translate(104 6) scale(0.82)" stroke-width="1.8">
    <path d="M12 80 H108" opacity=".4"/>
    <path d="M20 80 V22 M36 80 V22 M84 80 V22 M100 80 V22" stroke-width="2"/>
    <path d="M20 22 C20 14 28 10 28 4 C28 10 36 14 36 22 M84 22 C84 14 92 10 92 4 C92 10 100 14 100 22" stroke-width="2.2"/>
    <path d="M52 22 C52 16 56 14 60 8 C64 14 68 16 68 22" stroke-width="2.2"/>
    <path d="M20 22 H100 V80 H20Z" stroke-width="2.4"/>
    <path d="M26 26 h8 M42 26 h8 M70 26 h8 M86 26 h8 M26 44 h8 M42 44 h8 M70 44 h8 M86 44 h8 M26 62 h8 M42 62 h8 M70 62 h8 M86 62 h8" stroke-width="2.7"/>
    <path d="M42 32 L46 36 L50 32 M70 32 L74 36 L78 32" stroke-width="1.2" opacity=".6"/>
    <g >
      <path d="M52 80 V58 C52 52 56 50 60 50 C64 50 68 52 68 58 V80" stroke-width="2.4"/>
      <path d="M60 50 V44" stroke-width="1.7"/>
    </g>
  </g>
</svg>`;

/** Étape 2 — le panneau de conversation : le tambour parleur. */
export const TOUR_CHAT = `${OPEN}
  <g transform="translate(43 0.2) scale(0.95)" stroke-width="1.6">
    <ellipse cx="60" cy="20" rx="16" ry="4.5" stroke-width="2.1"/>
    <ellipse cx="60" cy="68" rx="16" ry="4.5" stroke-width="2.1"/>
    <path d="M44 20 C51 34 51 54 44 68 M76 20 C69 34 69 54 76 68"/>
    <path d="M46 22.7 L46 66.7 M49.5 24 L49.5 68 M53 25 L53 69 M56.5 25.5 L56.5 69.5 M60 25.5 L60 69.5 M63.5 25 L63.5 69 M67 24 L67 68 M70.5 22.7 L70.5 66.7" stroke-width="1.1" opacity=".6"/>
    <path d="M44 44 H76" stroke-width="1.3" opacity=".6"/>
    <path d="M50 34 L54 38 L50 42 M70 34 L66 38 L70 42 M50 46 L54 50 L50 54 M70 46 L66 50 L70 54" stroke-width="1.3" opacity=".75"/>
    <path d="M78 76 C88 70 94 62 96 52" stroke-width="2.1"/>
    <g style="color: var(--color-primary-500, #1447e6)" stroke-width="1.9">
      <path d="M88 22 C92 26 92 32 88 36"/>
      <path d="M94 16 C101 23 101 35 94 42"/>
      <path d="M32 22 C28 26 28 32 32 36"/>
      <path d="M26 16 C19 23 19 35 26 42"/>
    </g>
  </g>
</svg>`;

/** Étape 3 — l'aperçu : l'étal du marché, où le résultat se montre. */
export const TOUR_PREVIEW = `${OPEN}
  <g transform="translate(43 0.2) scale(0.95)" stroke-width="1.6">
    <path d="M10 80 H110" opacity=".4"/>
    <path d="M16 22 L60 10 L104 22 Z" stroke-width="2.1"/>
    <path d="M16 22 L24 28 L32 22 L40 28 L48 22 L56 28 L64 22 L72 28 L80 22 L88 28 L96 22 L104 28" stroke-width="1.3"/>
    <path d="M22 24 V80 M98 24 V80" stroke-width="1.9"/>
    <path d="M18 58 H102" stroke-width="2.1"/>
    <path d="M26 58 V80 M94 58 V80" stroke-width="1.3" opacity=".7"/>
    <path d="M30 58 C30 50 42 50 42 58"/>
    <path d="M46 58 C46 46 62 46 62 58"/>
    <path d="M34 50 L38 54 M50 50 L54 54 M58 50 L55 54" stroke-width="1.1" opacity=".6"/>
    <g style="color: var(--color-primary-500, #1447e6)">
      <path d="M68 58 C66 48 70 42 78 42 C86 42 90 48 88 58" stroke-width="1.9"/>
      <path d="M72 46 C74 44 82 44 84 46" stroke-width="1.3"/>
    </g>
    <path d="M34 66 L38 70 L42 66 L46 70 L50 66 M70 66 L74 70 L78 66 L82 70 L86 66" stroke-width="1.1" opacity=".55"/>
  </g>
</svg>`;

/** Étape 4 — vos réglages et votre compte : la clé-bouclier. */
export const TOUR_HEADER = `${OPEN}
  <g transform="translate(32 0) scale(0.84)" stroke-width="1.8">
    <path d="M40 18 C58 30 66 44 66 54 C66 64 58 78 40 90 C22 78 14 64 14 54 C14 44 22 30 40 18Z" stroke-width="2.4"/>
    <path d="M40 26 C54 36 60 46 60 54 C60 62 54 72 40 82 C26 72 20 62 20 54 C20 46 26 36 40 26Z" stroke-width="1.7"/>
    <path d="M32 36 L40 41 L48 36 M29 42 L40 49 L51 42 M32 72 L40 67 L48 72 M29 66 L40 59 L51 66" stroke-width="1.5"/>
    <path d="M66 54 H136" stroke-width="2.6"/>
    <path d="M114 54 V67 H121 V60 H127 V70 H134 V54" stroke-width="2.4"/>
    <path d="M72 50 V58 M76 50 V58" stroke-width="1.7"/>
    <path d="M144 42 L149 37 M147 54 H153 M144 66 L149 71" stroke-width="1.9" opacity=".6"/>
    <g style="color: var(--color-primary-500, #1447e6)">
      <path d="M40 48 L45 54 L40 60 L35 54Z" stroke-width="2.4"/>
    </g>
  </g>
</svg>`;

/** Étape 5 — l'application part en ligne : la pirogue prend la mer. */
export const TOUR_DONE = `${OPEN}
  <g transform="translate(43 0.2) scale(0.95)" stroke-width="1.6">
    <path d="M8 38 C12 44 16 50 24 56 C40 66 82 66 98 56 C104 52 108 44 112 34" stroke-width="2.1"/>
    <path d="M8 38 C18 46 40 50 60 50 C80 50 100 46 112 34" stroke-width="1.7"/>
    <path d="M20 48 L26 55.4 L28.5 50.6 L35.1 57.6 L38.7 52.5 L45.3 59.1 L50 53.5 L56.2 59.7 L61.8 53.8 L67.3 59.6 L73.4 53.1 L78 58.5 L84.4 51.7 L87.8 56.6 L94.1 49.3 L96.4 53.8 L102 46" stroke-width="1.2" opacity=".75"/>
    <path d="M44 50 L36 28 M36 28 L33 22 C32 20 34 19 35 21 L38 27" stroke-width="1.7"/>
    <g style="color: var(--color-primary-500, #1447e6)">
      <path d="M112 34 L116 26 L110 30 Z" stroke-width="1.9"/>
      <path d="M104 44 L107 40 L110 44 L107 48 Z" stroke-width="1.7"/>
    </g>
    <path d="M14 72 C20 68 26 68 32 72 S44 76 50 72 S62 68 68 72 S80 76 86 72 S98 68 104 72" opacity=".5"/>
    <path d="M30 80 C36 77 42 77 48 80 S60 83 66 80 S78 77 84 80" opacity=".3"/>
  </g>
</svg>`;

/** Illustration par clé d'étape, dans l'ordre de la visite. */
export const TOUR_ILLUSTRATIONS: Record<string, string> = {
  welcome: TOUR_WELCOME,
  chat: TOUR_CHAT,
  preview: TOUR_PREVIEW,
  header: TOUR_HEADER,
  done: TOUR_DONE,
};

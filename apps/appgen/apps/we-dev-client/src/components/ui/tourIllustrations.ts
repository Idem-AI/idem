/**
 * Illustrations de la visite guidée.
 *
 * Le moteur `@idem/shared-tour` construit du DOM, pas du React : il attend donc
 * du balisage SVG sérialisé. Ces chaînes partagent le vocabulaire graphique du
 * reste du produit — trait fin en `currentColor`, accents sur la couleur
 * primaire — pour que la visite ne ressemble pas à une pièce rapportée.
 *
 * Chacune montre l'endroit dont l'étape parle, pas une scène décorative.
 */

const OPEN = '<svg viewBox="0 0 200 84" width="200" height="84" fill="none" xmlns="http://www.w3.org/2000/svg">';
const S = 'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
const P = 'stroke="var(--color-primary, #1447e6)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
const FILL_P = 'fill="var(--color-primary, #1447e6)"';

/** Étape 1 — une phrase devient une application. */
export const TOUR_WELCOME = `${OPEN}
  <rect x="16" y="24" width="62" height="36" rx="6" ${S}/>
  <rect x="26" y="36" width="30" height="4" rx="2" fill="currentColor" opacity=".35"/>
  <rect x="26" y="46" width="42" height="4" rx="2" fill="currentColor" opacity=".2"/>
  <path d="M86 42h22" ${P} stroke-dasharray="4 4"/>
  <path d="M102 36l7 6-7 6" ${P}/>
  <rect x="118" y="18" width="66" height="48" rx="6" ${S}/>
  <path d="M118 30h66" ${S}/>
  <circle cx="126" cy="24" r="1.6" fill="currentColor"/>
  <circle cx="132" cy="24" r="1.6" fill="currentColor"/>
  <rect x="128" y="38" width="24" height="16" rx="4" ${P}/>
  <rect x="158" y="38" width="16" height="16" rx="4" fill="currentColor" opacity=".18"/>
</svg>`;

/** Étape 2 — le panneau de conversation. */
export const TOUR_CHAT = `${OPEN}
  <rect x="40" y="10" width="120" height="64" rx="8" ${S}/>
  <rect x="52" y="22" width="46" height="6" rx="3" fill="currentColor" opacity=".3"/>
  <rect x="52" y="34" width="70" height="6" rx="3" fill="currentColor" opacity=".18"/>
  <rect x="106" y="46" width="42" height="6" rx="3" ${FILL_P} opacity=".55"/>
  <rect x="52" y="58" width="96" height="10" rx="5" ${P}/>
  <path d="M138 63h6" ${P}/>
</svg>`;

/** Étape 3 — l'aperçu et sa barre d'outils flottante. */
export const TOUR_PREVIEW = `${OPEN}
  <rect x="26" y="8" width="148" height="56" rx="7" ${S}/>
  <path d="M26 20h148" ${S}/>
  <circle cx="34" cy="14" r="1.6" fill="currentColor"/>
  <circle cx="40" cy="14" r="1.6" fill="currentColor"/>
  <rect x="40" y="30" width="52" height="22" rx="4" fill="currentColor" opacity=".16"/>
  <rect x="102" y="30" width="66" height="6" rx="3" fill="currentColor" opacity=".22"/>
  <rect x="102" y="42" width="44" height="6" rx="3" fill="currentColor" opacity=".16"/>
  <rect x="56" y="60" width="88" height="16" rx="8" fill="var(--idem-surface-1, #fff)" ${P}/>
  <circle cx="70" cy="68" r="3" ${FILL_P}/>
  <path d="M86 64v8M96 64v8M106 64v8" ${S} opacity=".45"/>
  <path d="M118 65l6 6M124 65l-6 6" ${S} opacity=".45"/>
</svg>`;

/** Étape 4 — la barre d'en-tête et ses commandes. */
export const TOUR_HEADER = `${OPEN}
  <rect x="14" y="26" width="172" height="32" rx="8" ${S}/>
  <rect x="24" y="36" width="22" height="12" rx="3" ${P}/>
  <rect x="56" y="39" width="34" height="6" rx="3" fill="currentColor" opacity=".28"/>
  <rect x="100" y="35" width="34" height="14" rx="7" fill="currentColor" opacity=".12"/>
  <rect x="102" y="37" width="15" height="10" rx="5" ${FILL_P} opacity=".7"/>
  <rect x="142" y="35" width="24" height="14" rx="7" ${P}/>
  <circle cx="176" cy="42" r="7" ${S}/>
  <circle cx="176" cy="39.5" r="2.2" ${S}/>
  <path d="M172 47a4.5 4.5 0 018 0" ${S}/>
</svg>`;

/** Étape 5 — l'application part en ligne. */
export const TOUR_DONE = `${OPEN}
  <rect x="24" y="16" width="62" height="44" rx="6" ${S}/>
  <path d="M24 27h62" ${S}/>
  <path d="M38 44l8 8 14-16" ${P}/>
  <path d="M94 40c10-8 20-8 30 0" ${P} stroke-dasharray="4 4"/>
  <path d="M118 33l6 7-8 3" ${P}/>
  <circle cx="152" cy="42" r="20" ${P}/>
  <ellipse cx="152" cy="42" rx="8" ry="20" ${P}/>
  <path d="M132 35h40M132 49h40" ${P}/>
</svg>`;

/** Illustration par clé d'étape, dans l'ordre de la visite. */
export const TOUR_ILLUSTRATIONS: Record<string, string> = {
  welcome: TOUR_WELCOME,
  chat: TOUR_CHAT,
  preview: TOUR_PREVIEW,
  header: TOUR_HEADER,
  done: TOUR_DONE,
};

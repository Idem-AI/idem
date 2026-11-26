/**
 * Feuille de styles du moteur de visite, injectée une seule fois.
 *
 * Elle s'appuie sur les jetons du design system Idem quand ils existent, avec
 * une valeur de repli pour les applications qui ne les chargent pas. Tout est
 * préfixé `idem-tour-` : aucun risque de collision avec les styles de l'hôte.
 */
export const TOUR_STYLES = `
.idem-tour-root {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  /* Aucun voile, aucun flou : la page reste visible et utilisable. */
  pointer-events: none;
  font-family: inherit;
}

/* Un simple liseré autour de l'élément expliqué. Rien n'est assombri. */
.idem-tour-spotlight {
  position: absolute;
  border-radius: 12px;
  box-shadow: 0 0 0 2px var(--color-primary, #1447e6);
  transition:
    top 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    left 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    width 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    height 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
}
.idem-tour-spotlight.is-hidden { display: none; }

/* Le repère qui respire : il attire l'œil sans bloquer quoi que ce soit. */
.idem-tour-halo {
  position: absolute;
  border-radius: 16px;
  border: 2px solid var(--color-primary, #1447e6);
  opacity: 0;
  pointer-events: none;
  animation: idem-tour-breathe 2.2s ease-out infinite;
}

@keyframes idem-tour-breathe {
  0% { transform: scale(0.99); opacity: 0.5; }
  70% { transform: scale(1.05); opacity: 0; }
  100% { transform: scale(1.05); opacity: 0; }
}

.idem-tour-card {
  position: absolute;
  width: min(300px, calc(100vw - 24px));
  box-sizing: border-box;
  padding: 14px 16px 14px;
  border-radius: 14px;
  background: var(--color-surface-1, #ffffff);
  color: var(--color-text-primary, #0f172a);
  border: 1px solid var(--glass-border, rgba(15, 23, 42, 0.12));
  box-shadow: 0 10px 30px rgba(2, 6, 23, 0.14);
  pointer-events: auto;
  animation: idem-tour-pop 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

/* La pointe désigne l'élément ; sa position est fixée par le moteur. */
.idem-tour-arrow {
  position: absolute;
  width: 10px;
  height: 10px;
  background: var(--color-surface-1, #ffffff);
  border: 1px solid var(--glass-border, rgba(15, 23, 42, 0.12));
  transform: rotate(45deg);
}
.idem-tour-card[data-side="bottom"] .idem-tour-arrow { top: -6px; border-right: 0; border-bottom: 0; }
.idem-tour-card[data-side="top"] .idem-tour-arrow { bottom: -6px; border-left: 0; border-top: 0; }
.idem-tour-card[data-side="right"] .idem-tour-arrow { left: -6px; border-right: 0; border-top: 0; }
.idem-tour-card[data-side="left"] .idem-tour-arrow { right: -6px; border-left: 0; border-bottom: 0; }
.idem-tour-card[data-side="dock"] .idem-tour-arrow { display: none; }

@keyframes idem-tour-pop {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.idem-tour-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 0 6px;
}

.idem-tour-counter {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-tertiary, rgba(15, 23, 42, 0.55));
  margin: 0;
}

.idem-tour-close {
  appearance: none;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  margin: -4px -6px -4px 0;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-tertiary, rgba(15, 23, 42, 0.55));
  cursor: pointer;
}
.idem-tour-close:hover { background: var(--glass-bg-subtle, rgba(15, 23, 42, 0.06)); color: inherit; }
.idem-tour-close:focus-visible { outline: 2px solid var(--color-primary, #1447e6); outline-offset: 1px; }

.idem-tour-title {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.3;
  margin: 0 0 4px;
}

.idem-tour-body {
  font-size: 13px;
  line-height: 1.5;
  margin: 0 0 12px;
  opacity: 0.75;
}

/* Illustration : une vignette, jamais une bande qui écrase le texte. */
.idem-tour-illustration {
  display: grid;
  place-items: center;
  height: 64px;
  margin: 0 0 10px;
  color: var(--color-text-tertiary, rgba(15, 23, 42, 0.55));
}
.idem-tour-illustration svg {
  display: block;
  max-width: 100%;
  max-height: 100%;
  height: auto;
  width: auto;
}

.idem-tour-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.idem-tour-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

/* Les boutons portent les classes du design system Idem : ici, seulement la
   disposition. */
.idem-tour-btn { white-space: nowrap; flex-shrink: 0; }

.idem-tour-btn:not(.inner-button):not(.outer-button):not(.button-ghost) {
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  border-radius: 10px;
  padding: 7px 14px;
  cursor: pointer;
  border: 1px solid var(--glass-border, rgba(15, 23, 42, 0.12));
  background: transparent;
  color: inherit;
}

/* Petit écran : la bulle se pose en bas, hors du chemin du contenu. */
@media (max-width: 560px) {
  .idem-tour-card { width: calc(100vw - 24px); }
}

@media (prefers-reduced-motion: reduce) {
  .idem-tour-spotlight,
  .idem-tour-card,
  .idem-tour-halo {
    animation: none !important;
    transition: none !important;
  }
  .idem-tour-halo { opacity: 0; }
}
`;

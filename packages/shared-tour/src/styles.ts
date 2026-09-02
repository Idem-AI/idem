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
  pointer-events: none;
  font-family: inherit;
}

/*
 * Le trou de lumière.
 *
 * La zone visée n'est **pas** filtrée : elle doit s'afficher exactement comme
 * l'application l'a dessinée, sinon le texte perd son contraste et devient
 * moins lisible que le reste — l'inverse du but recherché. C'est le voile
 * alentour, volontairement dense, qui crée la mise en avant.
 */
.idem-tour-spotlight {
  position: absolute;
  border-radius: 14px;
  /* Pas de color-mix() ici : une valeur non comprise invaliderait toute la
     déclaration, et le voile disparaîtrait avec elle. On s'en tient à var()
     avec repli, universellement supporté. */
  box-shadow:
    0 0 0 9999px rgba(2, 6, 23, 0.86),
    0 0 0 2px var(--color-primary, #1447e6),
    0 0 26px 0 var(--color-primary, #1447e6);
  transition:
    top 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    left 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    width 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    height 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
}

/* Sans cible, on assombrit l'écran entier sans découpe. */
.idem-tour-spotlight.is-centered {
  box-shadow: 0 0 0 9999px rgba(2, 6, 23, 0.86);
  border-radius: 0;
}

/* L'anneau qui respire : discret, mais il attire l'œil au bon endroit. */
.idem-tour-halo {
  position: absolute;
  border-radius: 18px;
  border: 2px solid var(--color-primary, #1447e6);
  opacity: 0;
  pointer-events: none;
  animation: idem-tour-breathe 2.2s ease-out infinite;
}

@keyframes idem-tour-breathe {
  0% { transform: scale(0.98); opacity: 0.55; }
  70% { transform: scale(1.06); opacity: 0; }
  100% { transform: scale(1.06); opacity: 0; }
}

.idem-tour-card {
  position: absolute;
  width: min(360px, calc(100vw - 32px));
  box-sizing: border-box;
  padding: 20px;
  border-radius: 18px;
  background: var(--color-surface-1, #ffffff);
  color: var(--color-text-primary, #0f172a);
  border: 1px solid var(--glass-border, rgba(15, 23, 42, 0.12));
  box-shadow: 0 24px 60px rgba(2, 6, 23, 0.35);
  pointer-events: auto;
  /* Pas de fill-mode "both" ici : la carte doit rester visible même si
     l'animation ne tourne pas (capture, extension, moteur exotique). */
  animation: idem-tour-pop 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes idem-tour-pop {
  from { opacity: 0; transform: translateY(10px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.idem-tour-counter {
  position: relative;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-primary, #1447e6);
  margin: 0 0 10px;
}

.idem-tour-title {
  position: relative;
  font-size: 19px;
  font-weight: 700;
  line-height: 1.25;
  margin: 0 0 8px;
}

.idem-tour-body {
  position: relative;
  font-size: 14px;
  line-height: 1.6;
  margin: 0 0 18px;
  opacity: 0.75;
}

.idem-tour-dots {
  display: flex;
  gap: 5px;
  align-items: center;
  flex: 1;
}

.idem-tour-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.22;
  transition: width 0.25s ease, opacity 0.25s ease;
}

.idem-tour-dot.is-active {
  width: 20px;
  opacity: 1;
  background: var(--color-primary, #1447e6);
}

.idem-tour-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.idem-tour-btn {
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  border-radius: 10px;
  padding: 9px 16px;
  cursor: pointer;
  white-space: nowrap;
  border: 1px solid transparent;
  transition: background-color 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
}

.idem-tour-btn--primary {
  background: var(--color-primary, #1447e6);
  color: #ffffff;
}

.idem-tour-btn--primary:hover { opacity: 0.9; }

.idem-tour-btn--ghost {
  background: transparent;
  color: inherit;
  border-color: var(--glass-border, rgba(15, 23, 42, 0.12));
}

.idem-tour-btn--ghost:hover {
  background: var(--glass-bg-subtle, rgba(15, 23, 42, 0.04));
}

.idem-tour-btn--quiet {
  background: transparent;
  color: inherit;
  opacity: 0.55;
  padding: 9px 10px;
}

.idem-tour-btn--quiet:hover { opacity: 1; }

.idem-tour-foot {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
  margin-top: 4px;
}

/* Petite fête de fin : quelques confettis, et rien de plus. */
.idem-tour-confetti {
  position: absolute;
  inset: -10px -10px auto -10px;
  height: 68px;
  overflow: hidden;
  pointer-events: none;
  border-radius: 18px 18px 0 0;
}

.idem-tour-confetti i {
  position: absolute;
  top: -12px;
  width: 7px;
  height: 11px;
  border-radius: 2px;
  opacity: 0;
  animation: idem-tour-fall 1.5s ease-in forwards;
}

@keyframes idem-tour-fall {
  0% { transform: translateY(-14px) rotate(0deg); opacity: 0; }
  15% { opacity: 1; }
  100% { transform: translateY(104px) rotate(220deg); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .idem-tour-spotlight,
  .idem-tour-card,
  .idem-tour-halo,
  .idem-tour-confetti i {
    animation: none !important;
    transition: none !important;
  }
  .idem-tour-halo { opacity: 0; }
}
`;

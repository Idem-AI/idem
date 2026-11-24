/**
 * LES COURBES CINÉMATIQUES (24/11/2026) — des lois de mouvement calculées, enregistrées dans GSAP sous un nom
 * (`gsap.registerEase`) et donc utilisables partout où le catalogue nomme une courbe.
 *
 *   geJerk    la trajectoire à JERK MINIMAL (Flash & Hogan, 1985) : s(u) = 10u³ − 15u⁴ + 6u⁵. Vitesse ET
 *             accélération nulles aux deux bouts, accélération continue au milieu (là où `power2.inOut` change
 *             brusquement d'accélération). Pour les GRANDS déplacements : caméra, traversée d'une coupe, panoramique.
 *   geSettle  arrivée vive qui dépasse à peine sa place (≈ 3 %) puis s'y pose — pour les DA vives.
 *   geKin     anticipation (un léger recul, ≈ 3 %), arrivée, dépassement (≈ 4 %), pose — les lois du dessin animé
 *             (Cachelin, « Kinematic Timing Curves », JCGT 2022 : anticipation, inertie, dépassement par paramètres) —
 *             réservée aux DA joueuses.
 *
 * Toutes sont des fonctions PURES de la progression (même image quel que soit le chemin du rendu, rendu en tronçons
 * parallèles compris) et valent exactement 0 et 1 aux bouts. Jamais sur l'opacité : l'assemblage sépare l'opacité du
 * mouvement avant de poser une courbe qui dépasse (`assemble.ts#kinematicSteps`).
 *
 * Les fonctions ci-dessous sont recopiées TELLES QUELLES dans le runtime de la page (`toString`) : le calcul du serveur
 * (contrôles) et celui de la page sont le même code. Elles ne doivent donc rien lire hors d'elles-mêmes.
 */

/** Le profil à jerk minimal (u ∈ [0, 1]). */
export const minJerk = (u: number): number => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (10 + u * (-15 + 6 * u)));

/**
 * La courbe cinématique : `a` anticipation (profondeur du recul), `o` dépassement, `m` l'instant (0..1) où la trajectoire
 * de base atteint sa place. Base à jerk minimal comprimée sur [0, m] ; le recul est une bosse sin² sur [0, 0,2] (pente
 * nulle aux bords : aucune cassure) ; le dépassement une bosse sin² sur [m − 0,2, 1] (retour à 1, vitesse nulle à la fin).
 */
export const kinematic = (u: number, a: number, o: number, m: number): number => {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const b = (x: number, p: number, q: number) => (x <= p || x >= q ? 0 : Math.pow(Math.sin((Math.PI * (x - p)) / (q - p)), 2));
  const v = Math.min(1, u / m);
  const s = v * v * v * (10 + v * (-15 + 6 * v));
  return s - a * b(u, 0, 0.2) + o * b(u, m - 0.2, 1);
};

/** Les réglages des courbes nommées (bornés : recul ≤ 3 %, dépassement ≤ 4,5 %, vérifiés par `check:motion-math`). */
export const KINEMATIC_EASES: Record<string, { a: number; o: number; m: number } | 'jerk'> = {
  geJerk: 'jerk',
  geSettle: { a: 0, o: 0.035, m: 0.62 },
  geKin: { a: 0.045, o: 0.045, m: 0.7 },
};

export const KINEMATIC_EASE_NAMES = Object.keys(KINEMATIC_EASES);

/** La fonction d'une courbe nommée (contrôles, mesures). */
export function kinematicEase(name: string): ((u: number) => number) | undefined {
  const c = KINEMATIC_EASES[name];
  if (!c) return undefined;
  return c === 'jerk' ? minJerk : (u: number) => kinematic(u, c.a, c.o, c.m);
}

/** Le code de la page : enregistre les courbes dans GSAP (même source que ci-dessus). */
export const KINEMATIC_EASES_JS = `(function () {
  if (!window.gsap || window.__geKinEases) return;
  window.__geKinEases = true;
  var minJerk = ${minJerk.toString()};
  var kinematic = ${kinematic.toString()};
  var cfg = ${JSON.stringify(KINEMATIC_EASES)};
  Object.keys(cfg).forEach(function (name) {
    var c = cfg[name];
    gsap.registerEase(name, c === 'jerk' ? minJerk : function (u) { return kinematic(u, c.a, c.o, c.m); });
  });
})();`;

/**
 * Les DA dont le mouvement « joue » (dépassement, anticipation) : leur rôle principal arrive en `geSettle`, et en
 * `geKin` dans une scène vive (énergie ≥ 4). Toutes les autres gardent les courbes du catalogue (sans rebond).
 */
export const PLAYFUL_DIRECTIONS = new Set(['memphis', 'pop-art', 'clay', 'y2k', 'pixel-art', 'graffiti', 'collage-art', 'maximalism', 'wax-print']);

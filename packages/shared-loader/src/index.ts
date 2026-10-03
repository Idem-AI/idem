/**
 * Point d'entrée neutre : tailles et géométrie du semis, décrites une seule
 * fois pour que chaque rendu (Angular, React, Svelte) dessine exactement les
 * mêmes graines.
 */
export const IDEM_LOADER_SIZES = {
  xs: 16,
  sm: 20,
  md: 32,
  lg: 48,
} as const;

export type IdemLoaderSize = keyof typeof IDEM_LOADER_SIZES;

/** Côté du viewBox, les cases du tour, la distance au centre et la durée d'un tour. */
export const IDEM_LOADER_BOX = 48;
const SEEDS = 8;
const ORBIT = 16;
const SOW_MS = 1200;

/** Demi-longueur et demi-largeur d'une graine selon la taille. */
const SEED_SHAPE: Record<IdemLoaderSize, [number, number]> = {
  xs: [5.8, 4.8],
  sm: [5.4, 4.4],
  md: [4.9, 3.9],
  lg: [4.5, 3.5],
};

export interface IdemLoaderSeed {
  /** Tracé SVG du losange. */
  d: string;
  /** Délai négatif : le semis est déjà en cours au premier affichage. */
  delay: string;
}

/** Les graines d'une taille : un losange à peine allongé vers le centre (plus
 *  effilé, le cercle tournait au flocon), plus gros quand le loader est petit
 *  pour rester lisible dans un bouton. */
export function idemLoaderSeeds(size: IdemLoaderSize): IdemLoaderSeed[] {
  const [long, wide] = SEED_SHAPE[size];
  const c = IDEM_LOADER_BOX / 2;
  return Array.from({ length: SEEDS }, (_, i) => {
    const a = (i / SEEDS) * 2 * Math.PI - Math.PI / 2;
    const [ux, uy] = [Math.cos(a), Math.sin(a)];
    const [cx, cy] = [c + ux * ORBIT, c + uy * ORBIT];
    const pt = (r: number, t: number) =>
      `${(cx + ux * r - uy * t).toFixed(2)} ${(cy + uy * r + ux * t).toFixed(2)}`;
    return {
      d: `M${pt(long, 0)} L${pt(0, wide)} L${pt(-long, 0)} L${pt(0, -wide)}Z`,
      delay: `${((i - SEEDS) * SOW_MS) / SEEDS}ms`,
    };
  });
}

/** Chaque instance a son propre dégradé : deux `id` identiques dans un document
 *  se marchent dessus dès qu'une application en affiche plusieurs. */
let instance = 0;
export function nextIdemLoaderGradientId(): string {
  return `idem-loader-${++instance}`;
}

/**
 * Point d'entrée neutre : tailles et propriétés du loader, décrites une seule
 * fois pour que chaque rendu (Angular, React, Svelte) dessine le même spinner.
 */
export const IDEM_LOADER_SIZES = {
  xs: 16,
  sm: 20,
  md: 32,
  lg: 48,
} as const;

export type IdemLoaderSize = keyof typeof IDEM_LOADER_SIZES;

/** Côté du viewBox. */
export const IDEM_LOADER_BOX = 120;

/** Le path commun à la spirale. */
export const IDEM_LOADER_PATH = `M96 60
         C96 83 79 99 58 99
         C34 99 18 83 18 60
         C18 36 35 20 58 20
         C82 20 99 36 99 59
         C99 80 84 91 66 91
         C48 91 37 80 37 64
         C37 49 47 40 60 40
         C73 40 81 48 81 59
         C81 69 74 75 65 75
         C57 75 52 70 52 63
         C52 57 56 53 62 53`;

/** Chaque instance a son propre identifiant : deux `id` identiques dans un document
 *  se marchent dessus dès qu'une application en affiche plusieurs. */
let instance = 0;
export function nextIdemLoaderId(): string {
  return `idem-loader-${++instance}`;
}

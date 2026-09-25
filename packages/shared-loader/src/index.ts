/**
 * Point d'entrée neutre : les tailles sont décrites ici pour que d'autres
 * rendus (React, Svelte) puissent un jour partager exactement les mêmes.
 */
export const IDEM_LOADER_SIZES = {
  xs: 16,
  sm: 20,
  md: 32,
  lg: 48,
} as const;

export type IdemLoaderSize = keyof typeof IDEM_LOADER_SIZES;

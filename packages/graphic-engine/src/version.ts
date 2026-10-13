/**
 * Versions du moteur. Un document doit pouvoir dire QUI l'a produit : la version du moteur, celle
 * de la bibliothèque de composants et celle de chaque contrat. Modifier un composant ou un motif
 * de composition change `COMPONENT_LIBRARY_VERSION` ; modifier la forme d'un contrat change sa
 * version — et les clés de cache qui en dépendent s'invalident d'elles-mêmes.
 */
export const ENGINE_VERSION = '1.0.0';
export const COMPONENT_LIBRARY_VERSION = '1.0.0';

export const CONTRACT_VERSIONS = {
  contentModel: '1.0',
  designSpec: '1.0',
  renderResult: '1.0',
} as const;

export type ContractName = keyof typeof CONTRACT_VERSIONS;

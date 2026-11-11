/**
 * @idem/shared-promotions — campagnes, coupons et prix barrés.
 *
 *   model    ce qu'est une promotion (portée, audience, remise, limites, affichage, crédits du jour)
 *   items    le catalogue des articles remisables et la traduction d'un débit en article
 *   engine   le calcul de la remise (le même pour l'API et pour les écrans)
 *   format   l'écriture d'un montant (« 0 F CFA », « 0 GHS »)
 *   client   la lecture des promotions en cours depuis l'API IDEM
 *   ./angular, ./react   le prix barré et le bandeau, par framework
 */
export * from './model';
export * from './items';
export * from './engine';
export * from './format';
export * from './client';

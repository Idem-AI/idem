/**
 * @idem/shared-idomain — acheter et brancher un nom de domaine sans quitter iDeploy ni iCode.
 *
 *   createIdomainClient  le client de l'API publique d'iDomain (session IDEM, même portefeuille) ;
 *   DomainPurchaseFlow   le parcours d'achat sans framework (chercher → titulaire → payer → brancher) ;
 *   idomainText          les textes FR/EN du parcours ;
 *   ./angular, ./react   le rendu du parcours et de la gestion, par framework.
 */
export * from './client';
export * from './flow';
export * from './texts';

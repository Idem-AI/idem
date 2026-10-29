/**
 * @idem/shared-journey — la boucle IDEM : recommander l'application suivante au bon moment.
 *
 *   model     événements (ce que l'utilisateur fait), faits (ce que le projet a), destinations (où aller)
 *   rules     les règles et le calcul (`recommend`), la mémoire des refus (`remember`)
 *   facts     les faits lus sur le projet et sur les événements
 *   links     l'adresse de chaque destination, projet déjà sélectionné
 *   texts     les mots, FR/EN
 *   client    l'appel à l'API IDEM (`/journey/*`)
 *   ./react, ./angular   la carte de recommandation, par framework
 */
export * from './model';
export * from './rules';
export * from './facts';
export * from './links';
export * from './texts';
export * from './client';
export * from './card';
export * from './illustrations';

/**
 * Les bundlers des applications (Angular CLI, Vite) savent charger une feuille
 * de style importée depuis un module ; TypeScript, lui, a besoin qu'on le lui
 * dise.
 */
declare module '*.css';

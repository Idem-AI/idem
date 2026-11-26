/**
 * CE QU'iCODE SAIT FAIRE SUR UN PROJET — la liste que lisent les agents pour savoir quel outil sert une demande.
 *
 * Deux agents la reçoivent :
 *
 *   l'agent qui lit la demande (`intent.ts`)     avant toute facturation, il choisit le déroulé qui sert le message ;
 *   l'agent d'aiguillage des retouches (`edit.ts`) en dernier recours : une demande qui n'est pas une modification des
 *                                                fichiers du site (relire le site d'origine, traduire, mettre en ligne…)
 *                                                est nommée telle quelle, au lieu d'être forcée dans une retouche.
 *
 * Une capacité AJOUTÉE à iCode s'écrit ici (et dans `registry.ts` si elle a sa commande « / ») : les deux agents la
 * connaissent aussitôt. Aucune liste de mots : chaque capacité dit ce qu'elle FAIT et QUAND elle s'applique ; c'est
 * l'agent qui juge si la demande en relève.
 */
import type { CommandName } from './registry.js';

export type CapabilityId = 'redesign' | 'rescan' | 'charter' | 'publish' | 'domain' | 'communication' | 'translate' | 'resume' | 'fix';

/** Ce que l'agent sait de l'atelier au moment de la demande. */
export interface CapabilityContext {
  hasProject: boolean;
  hasSite: boolean;
  hasCharter: boolean;
  /** L'adresse du site d'origine, quand le projet est né d'une refonte. */
  siteSource?: string;
  unfinished?: boolean;
}

export interface Capability {
  id: CapabilityId;
  /** La commande « / » qui la lance (affichée à l'utilisateur quand une retouche ne peut pas la faire). */
  command: CommandName;
  /** Ce qu'elle fait et quand elle s'applique, pour un agent (en anglais : les consignes des agents le sont). */
  does: string;
  /** Ce qu'elle n'est pas : les confusions courantes. */
  not?: string;
  /** Disponible dans ce contexte ? (absent : toujours) */
  available?: (ctx: CapabilityContext) => boolean;
}

export const CAPABILITIES: readonly Capability[] = [
  {
    id: 'redesign',
    command: 'redesign',
    does: 'rebuild an EXISTING website of the user as a whole (a new, modern version of their current site), from its address. The address may or may not be given.',
    not: 'copying another site’s style; editing one part of the site being built here; re-reading the site this project already comes from (that is "rescan").',
  },
  {
    id: 'rescan',
    command: 'rescan',
    does: 're-read (crawl again) the original website this project was rebuilt from — its pages, texts, photos, team, logo files — and rebuild the site from that fresh reading. For: "rescan / re-read / re-analyse my site", "take the content again from my site", "my site changed, update", "the photos are wrong, read the site again".',
    not: 'a change to one text or image of the site built here (that is an edit).',
    available: (ctx) => !!ctx.siteSource,
  },
  {
    id: 'charter',
    command: 'charter',
    does: 'create brand guidelines / a visual identity document (charte graphique) for the business.',
    available: (ctx) => ctx.hasProject && !ctx.hasCharter,
  },
  {
    id: 'translate',
    command: 'translate',
    does: 'make the site built here available in one or more other languages ("en anglais aussi", "add Spanish", "make it bilingual").',
    not: 'rewriting one text in another language; a question about languages.',
    available: (ctx) => ctx.hasSite,
  },
  {
    id: 'resume',
    command: 'continue',
    does: 'go on with a generation that was interrupted before the end ("continue", "vas-y", "termine", "reprends").',
    available: (ctx) => !!ctx.unfinished,
  },
  { id: 'publish', command: 'publish', does: 'put the site or app online / deploy it now, with an address to share.' },
  { id: 'domain', command: 'domain', does: 'buy or connect the user’s own domain name (example.com).' },
  { id: 'communication', command: 'communication', does: 'promote the site on social networks: posts, a calendar, marketing.' },
  {
    id: 'fix',
    command: 'fix',
    does: 'fix the errors shown by the preview (the site does not display, a red error screen).',
    not: 'a change of content or design.',
    available: (ctx) => ctx.hasSite,
  },
];

/** Les capacités disponibles dans ce contexte. */
export function capabilitiesFor(ctx: CapabilityContext): Capability[] {
  return CAPABILITIES.filter((capability) => !capability.available || capability.available(ctx));
}

/** Une ligne par capacité, telle qu'un agent la lit. */
export function describeCapabilities(list: readonly Capability[]): string {
  return list.map((c) => `- "${c.id}": ${c.does}${c.not ? ` Not: ${c.not}` : ''}`).join('\n');
}

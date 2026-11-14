/**
 * PLACEMENT D'UN CONTENU : le support exact, décidé par le code.
 *
 * Le format d'un visuel (carré, portrait, story, bannière) et celui d'une vidéo
 * se déduisent du RÉSEAU et du TYPE de publication — c'est une table, pas un
 * jugement. Ils sont donc posés à la génération du calendrier : à l'ouverture
 * d'une publication tout est déjà réglé, et l'utilisateur ne choisit plus ce qui
 * conditionne le minutage (durée) ou la plateforme (cadrage).
 *
 * Le même fichier porte le calcul de la NARRATION d'une vidéo : le nombre de mots
 * qu'il faut dire pour couvrir sa durée. Une voix off trop courte laisse la fin
 * du film muette (sous-titres arrêtés, musique seule) ; la contrainte est
 * arithmétique, elle se vérifie ici et non dans un prompt.
 */
import type { ContentChannel, ContentFormat, ContentIdea, ContentVideoPlan, FlyerFormat } from '../../../models/communication.model';

export type PlacedVideoFormat = 'story' | 'square' | 'portrait' | 'landscape';

/** Format du visuel d'une publication : réseau × type de contenu. */
export function visualFormatFor(channel: ContentChannel, format: ContentFormat): FlyerFormat {
  if (format === 'story' || format === 'reel') return 'story';
  if (format === 'article' || format === 'newsletter') return 'banner';
  switch (channel) {
    case 'instagram':
      // Un carrousel et une publication Instagram gagnent à occuper le fil en portrait (4:5).
      return 'post';
    case 'tiktok':
      return 'story';
    case 'facebook':
    case 'linkedin':
      // Un carrousel LinkedIn est un document portrait ; le reste est un carré lisible sur mobile.
      return format === 'carousel' ? 'post' : 'square';
    case 'x':
    case 'youtube':
    case 'blog':
    case 'email':
      return 'banner';
    default:
      return 'square';
  }
}

/** Cadrage de la vidéo d'un contenu : le réseau décide. */
export function videoFormatFor(channel: ContentChannel): PlacedVideoFormat {
  switch (channel) {
    case 'tiktok':
    case 'instagram':
    case 'facebook':
      return 'story';
    case 'youtube':
    case 'blog':
    case 'email':
      return 'landscape';
    default:
      return 'square';
  }
}

/** Pose sur un contenu tout ce qui se déduit de son réseau et de son type. */
export function placeItem(item: ContentIdea, isVideo: boolean): ContentIdea {
  return isVideo
    ? { ...item, visualFormat: undefined, videoFormat: videoFormatFor(item.channel), formatLocked: true }
    : { ...item, visualFormat: visualFormatFor(item.channel, item.format), videoFormat: undefined, formatLocked: true };
}

// ─── Narration ──────────────────────────────────────────────────────────────

/** Mots dits par seconde, par langue (voix posée, jamais précipitée). */
const WORDS_PER_SEC: Record<string, number> = { fr: 2.6, en: 2.7, es: 2.8, pt: 2.7, de: 2.3, it: 2.7, ar: 2.3, sw: 2.4 };

export const wordsPerSecondOf = (language: string): number => WORDS_PER_SEC[(language || 'fr').slice(0, 2).toLowerCase()] ?? 2.5;

/**
 * Le nombre de mots de narration pour couvrir une vidéo : 88 % de sa durée parlée
 * (on garde l'entrée de la première phrase, les souffles et le final porté par la
 * marque). Sous 70 % de ce nombre, la fin de la vidéo reste muette.
 */
export function narrationTarget(durationSec: number, language: string): { target: number; min: number } {
  const target = Math.round(durationSec * 0.88 * wordsPerSecondOf(language));
  return { target, min: Math.round(target * 0.7) };
}

export const wordCount = (text: string | undefined): number => (text || '').split(/\s+/).filter(Boolean).length;

/** Mots de narration d'un plan de vidéo. */
export function planNarrationWords(plan: ContentVideoPlan | undefined): number {
  return (plan?.beats || []).reduce((sum, beat) => sum + wordCount(beat.voice), 0);
}

/** Un plan avec voix off couvre-t-il la durée de sa vidéo ? Sans voix off, la question ne se pose pas. */
export function narrationCovers(plan: ContentVideoPlan | undefined, durationSec: number, language: string): boolean {
  if (!plan || !plan.voiceover) return true;
  return planNarrationWords(plan) >= narrationTarget(durationSec, language).min;
}

/** Nombre de temps du déroulé qui convient à une durée : un temps toutes les 15 à 20 secondes. */
export function beatCountFor(durationSec: number): { min: number; max: number } {
  return { min: Math.max(4, Math.round(durationSec / 22)), max: Math.max(5, Math.round(durationSec / 14)) };
}

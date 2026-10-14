/**
 * Paramètres de mouvement du projet, pour Motion for React — posé par IDEM.
 *
 * Ce sont des valeurs, pas des animations imposées : chaque composant choisit
 * ce qu'il anime, et comment. Exemple :
 *
 *   import { motion } from 'motion/react';
 *   import { motionTokens as m } from '@/design-system';
 *
 *   <motion.li
 *     initial={{ opacity: 0, y: m.distance }}
 *     whileInView={{ opacity: 1, y: 0 }}
 *     viewport={{ once: true, margin: '-10% 0px' }}
 *     transition={{ duration: m.duration, ease: m.ease, delay: index * m.stagger }}
 *   />
 */
import { componentConfig } from './config';

const m = componentConfig.motion;

export const motionTokens = {
  /** Durée de référence, en secondes. */
  duration: m.durationMs / 1000,
  /** Décalage entre deux éléments successifs, en secondes. */
  stagger: m.staggerMs / 1000,
  /** Courbe cubic-bezier du projet. */
  ease: m.ease,
  /** Distance d'un déplacement d'entrée, en pixels (0 si le projet ne veut pas de mouvement). */
  distance: m.distance,
  /** Échelle de départ d'un élément qui grandit en entrant (1 = pas d'effet). */
  scale: m.scale,
  intensity: m.intensity,
  /** Ressort du projet, pour les gestes et les changements de disposition. */
  spring: { type: 'spring' as const, stiffness: m.spring.stiffness, damping: m.spring.damping },
  respectReducedMotion: m.respectReducedMotion,
};

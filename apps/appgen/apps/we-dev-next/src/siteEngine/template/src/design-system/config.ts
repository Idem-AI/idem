/**
 * Réglages des composants, compilés depuis design-system.json — posé par IDEM.
 * Les composants de `@/components/ui` les lisent : leurs variantes par défaut
 * sont celles du projet.
 */
import generated from './component-config.generated.json';

export interface ComponentConfig {
  button: { variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'accent'; size: 'sm' | 'md' | 'lg' };
  input: { style: 'outline' | 'filled' | 'underline' };
  card: { variant: 'outline' | 'flat' | 'elevated' | 'filled' };
  badge: { variant: 'soft' | 'solid' | 'outline' };
  motion: {
    durationMs: number;
    staggerMs: number;
    ease: [number, number, number, number];
    intensity: 'none' | 'subtle' | 'moderate' | 'expressive';
    distance: number;
    scale: number;
    spring: { stiffness: number; damping: number };
    respectReducedMotion: boolean;
  };
}

export const componentConfig = generated as ComponentConfig;

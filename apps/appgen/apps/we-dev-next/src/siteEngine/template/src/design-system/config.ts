/**
 * Réglages des composants, compilés depuis design-system.json — posé par IDEM.
 * Les composants de `@/components/ui` les lisent : leurs variantes par défaut
 * sont celles du projet.
 */
import generated from './component-config.generated.json';

export interface ComponentConfig {
  button: {
    variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'accent';
    size: 'sm' | 'md' | 'lg';
    shape: 'uniform' | 'square' | 'pill' | 'leaf' | 'leaf-reverse' | 'tab';
    hover: 'darken' | 'lift' | 'invert' | 'slide' | 'glow' | 'grow' | 'shift' | 'underline' | 'arrow' | 'ring' | 'tilt';
    press: 'none' | 'sink' | 'shrink';
  };
  input: { style: 'outline' | 'filled' | 'underline' };
  card: {
    variant: 'outline' | 'flat' | 'elevated' | 'filled';
    shape: 'uniform' | 'square' | 'leaf' | 'leaf-reverse' | 'tab' | 'arch' | 'blob';
    hover: 'none' | 'lift' | 'border' | 'tint' | 'zoom' | 'shadow' | 'shift' | 'bar' | 'glow' | 'rise' | 'tilt';
    accent: 'none' | 'top' | 'left' | 'bottom';
  };
  badge: { variant: 'soft' | 'solid' | 'outline'; shape: 'uniform' | 'square' | 'pill' };
  link: { hover: 'none' | 'underline' | 'bar' };
  borders: { tone: 'hairline' | 'soft' | 'normal' | 'strong' | 'ink' | 'brand'; style: 'solid' | 'dashed' | 'dotted' | 'double'; width: string };
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

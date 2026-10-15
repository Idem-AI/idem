import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Les noms du design system déclarés à tailwind-merge : sans cela, `text-h1`
 * (une taille) et `text-primary` (une couleur) se remplaceraient l'un l'autre.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['small', 'body', 'lead', 'h4', 'h3', 'h2', 'h1', 'display'] }],
      shadow: [{ shadow: ['card', 'button'] }],
      rounded: [{ rounded: ['button', 'input', 'card', 'badge'] }],
      'font-family': [{ font: ['heading', 'body'] }],
    },
  },
});

/** Compose des classes Tailwind ; en cas de conflit, la dernière gagne. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

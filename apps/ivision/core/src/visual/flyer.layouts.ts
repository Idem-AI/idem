/**
 * CE QU'IL RESTE DE L'ANCIEN MOTEUR DE VISUELS : une encre lisible sur un fond.
 *
 * ── CE QUI A ÉTÉ RETIRÉ, ET POURQUOI ─────────────────────────────────────────
 *
 * Ce module portait DOUZE compositions de visuel dessinées par le code, leur menu, leurs
 * affinités de direction artistique et leurs rendus (~430 lignes), et `flyer.agents.ts` portait
 * les agents qui choisissaient dedans (structure, directeur artistique, rédacteur).
 *
 * Plus rien de tout cela n'était exécuté : le compositeur de visuels (`poster/poster.compose.ts`)
 * a remplacé cet ensemble par ses gabarits, ses palettes, sa boucle de conception et ses propres
 * agents. Seul le script de contrôle appelait encore ces fonctions — ce qui les faisait passer
 * pour vivantes, et laissait croire qu'un visuel pouvait encore retomber sur elles.
 *
 * Un second moteur de mise en page que personne n'appelle n'est pas un filet : c'est une piste
 * fausse quand on cherche pourquoi deux visuels se ressemblent. La composition d'un visuel vit
 * désormais dans un seul endroit :
 *
 *   `visual/poster/poster.compose.ts`    la méthode de chaque cran de la jauge
 *   `visual/poster/poster.templates.ts`  les gabarits des crans Low → High
 *   `visual/poster/poster.layout.ts`     la mise en page écrite par l'IA (Max)
 *   `visual/poster/poster.author.ts`     le visuel d'auteur écrit par l'IA (Ultra)
 *   `visual/flyer.render.ts`             le rendu mesuré, commun à tous
 */
import { contrastRatio } from '../design/color';

export interface FlyerPalette {
  primary: string;
  secondary: string;
  accent?: string;
  background?: string;
  text?: string;
}

/**
 * La couleur de texte la plus lisible sur ce fond, parmi celles de la charte puis le noir et le
 * blanc. Employée par les faces de carte de visite dessinées par le code
 * (`BandIdentity/businessCardLayouts.ts`) : la charte décide, le contraste arbitre.
 */
export function textOn(bg: string, palette: FlyerPalette): string {
  const candidates = [palette.text, palette.background, '#111111', '#ffffff'].filter((c): c is string => !!c && /^#[0-9a-f]{6}$/i.test(c));
  return (
    candidates
      .map((c) => ({ c, r: contrastRatio(c, bg) }))
      .sort((a, b) => b.r - a.r)
      .find((x) => x.r >= 4.5)?.c ||
    candidates.sort((a, b) => contrastRatio(b, bg) - contrastRatio(a, bg))[0] ||
    '#111111'
  );
}

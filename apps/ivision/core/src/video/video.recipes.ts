/**
 * LES RECETTES — quel enchaînement de scènes pour quel objectif.
 *
 * Décidé par le CODE, jamais par le modèle : un petit modèle à qui l'on demande
 * « choisis tes scènes » fait des vidéos décousues. Ici la structure est celle
 * d'une publicité qui fonctionne (accroche → preuve → offre → appel à l'action
 * → signature), et la durée choisie décide seulement combien de scènes
 * facultatives on peut se permettre.
 *
 * Les scènes FACTUELLES (prix, chiffre, date, témoignage) ne sont retenues que
 * si le brief contient le fait correspondant : on ne laisse jamais le modèle
 * inventer un prix pour remplir une case.
 */
import { VideoObjective } from './video.model';
import { SCENES } from './video.scenes';
import { BriefFacts } from './video.copy';

interface RecipeStep {
  scene: string;
  /** 1 = toujours ; plus le nombre est grand, plus la scène est facultative. */
  priority: number;
}

export const RECIPES: Record<VideoObjective, RecipeStep[]> = {
  promotion: [
    { scene: 'hook', priority: 1 },
    { scene: 'statement', priority: 5 },
    { scene: 'product', priority: 2 },
    { scene: 'benefits', priority: 4 },
    { scene: 'stat', priority: 6 },
    { scene: 'gallery', priority: 5 },
    { scene: 'offer', priority: 1 },
    { scene: 'quote', priority: 7 },
    { scene: 'cta', priority: 2 },
    { scene: 'logo', priority: 1 },
  ],
  product: [
    { scene: 'hook', priority: 1 },
    { scene: 'product', priority: 1 },
    { scene: 'benefits', priority: 2 },
    { scene: 'gallery', priority: 4 },
    { scene: 'stat', priority: 5 },
    { scene: 'statement', priority: 6 },
    { scene: 'quote', priority: 6 },
    { scene: 'offer', priority: 3 },
    { scene: 'cta', priority: 2 },
    { scene: 'logo', priority: 1 },
  ],
  announce: [
    { scene: 'hook', priority: 1 },
    { scene: 'statement', priority: 1 },
    { scene: 'wordswap', priority: 4 },
    { scene: 'product', priority: 5 },
    { scene: 'benefits', priority: 3 },
    { scene: 'stat', priority: 5 },
    { scene: 'cta', priority: 2 },
    { scene: 'logo', priority: 1 },
  ],
  event: [
    { scene: 'hook', priority: 1 },
    { scene: 'event', priority: 1 },
    { scene: 'statement', priority: 3 },
    { scene: 'gallery', priority: 4 },
    { scene: 'benefits', priority: 5 },
    { scene: 'offer', priority: 6 },
    { scene: 'cta', priority: 2 },
    { scene: 'logo', priority: 1 },
  ],
  opening: [
    { scene: 'hook', priority: 1 },
    { scene: 'wordswap', priority: 3 },
    { scene: 'event', priority: 1 },
    { scene: 'product', priority: 4 },
    { scene: 'benefits', priority: 3 },
    { scene: 'gallery', priority: 4 },
    { scene: 'offer', priority: 5 },
    { scene: 'cta', priority: 2 },
    { scene: 'logo', priority: 1 },
  ],
  testimonial: [
    { scene: 'hook', priority: 1 },
    { scene: 'quote', priority: 1 },
    { scene: 'stat', priority: 3 },
    { scene: 'product', priority: 4 },
    { scene: 'benefits', priority: 4 },
    { scene: 'cta', priority: 2 },
    { scene: 'logo', priority: 1 },
  ],
  recruitment: [
    { scene: 'hook', priority: 1 },
    { scene: 'statement', priority: 2 },
    { scene: 'benefits', priority: 1 },
    { scene: 'stat', priority: 4 },
    { scene: 'wordswap', priority: 4 },
    { scene: 'gallery', priority: 5 },
    { scene: 'cta', priority: 1 },
    { scene: 'logo', priority: 1 },
  ],
};

/** Scènes « de repli » quand une scène factuelle saute : elles ne demandent aucun fait. */
const FILLERS: Record<VideoObjective, string[]> = {
  promotion: ['benefits', 'wordswap'],
  product: ['statement', 'wordswap'],
  announce: ['benefits', 'wordswap'],
  event: ['statement', 'wordswap'],
  opening: ['wordswap', 'benefits'],
  testimonial: ['statement', 'benefits'],
  recruitment: ['wordswap', 'statement'],
};

/** Vrai si le brief porte de quoi remplir la scène sans rien inventer. */
export function sceneAvailable(scene: string, facts: BriefFacts, imageCount: number): boolean {
  switch (scene) {
    case 'offer':
      return facts.prices.length > 0 || facts.percents.length > 0;
    case 'stat':
      return facts.stats.length > 0;
    case 'event':
      return facts.dates.length > 0 || facts.times.length > 0;
    case 'quote':
      return facts.quotes.length > 0;
    case 'gallery':
      return imageCount >= (SCENES.gallery.minImages || 2);
    default:
      return true;
  }
}

/** Nombre de scènes maximal par durée : au-delà, plus rien ne se lit. */
const MAX_SCENES: Record<number, number> = { 6: 3, 15: 6, 30: 9, 60: 16 };

/**
 * Les scènes de la vidéo, dans l'ordre de la recette.
 *
 * On part des scènes obligatoires, puis on ajoute les facultatives par
 * priorité croissante tant que la somme des durées confortables tient dans la
 * durée choisie. Une vidéo de 60 s peut répéter les scènes « bénéfices » et
 * « produit » : la recette est alors parcourue une seconde fois.
 */
export function planScenes(
  objective: VideoObjective,
  durationSec: number,
  facts: BriefFacts,
  imageCount: number
): string[] {
  const recipe = (RECIPES[objective] || RECIPES.promotion).filter((step) =>
    sceneAvailable(step.scene, facts, imageCount)
  );
  const maxScenes = MAX_SCENES[durationSec] ?? Math.max(3, Math.round(durationSec / 4.5));
  const budget = durationSec * 1.06;

  const chosen = new Set<number>();
  let used = 0;
  const byPriority = recipe
    .map((step, index) => ({ ...step, index }))
    .sort((a, b) => a.priority - b.priority || a.index - b.index);

  for (const step of byPriority) {
    const def = SCENES[step.scene];
    const cost = step.priority === 1 ? def.min : def.nominal;
    if (step.priority === 1 || (used + cost <= budget && chosen.size < maxScenes)) {
      chosen.add(step.index);
      used += cost;
    }
  }

  let scenes = recipe.filter((_, index) => chosen.has(index)).map((step) => step.scene);

  // Très courte : on garde l'accroche, la scène la plus porteuse et la signature.
  if (scenes.length > maxScenes) {
    const core = scenes.filter((id) => id !== 'hook' && id !== 'logo');
    scenes = ['hook', ...core.slice(0, maxScenes - 2), 'logo'];
  }

  const insertBeforeEnd = (scene: string) => {
    // Avant l'appel à l'action et la signature.
    const at = Math.max(1, scenes.length - (scenes.includes('cta') ? 2 : 1));
    scenes.splice(at, 0, scene);
    used += SCENES[scene].nominal;
  };

  // Des photos fournies doivent apparaître : sans scène « produit » ni
  // « galerie » dans la recette, on en ajoute une (sauf en 6 s).
  if (imageCount >= 1 && durationSec >= 15 && !scenes.some((id) => id === 'product' || id === 'gallery')) {
    if (scenes.length >= maxScenes) {
      const removable = ['wordswap', 'statement', 'stat'].find((id) => scenes.includes(id));
      if (removable) {
        used -= SCENES[removable].nominal;
        scenes.splice(scenes.indexOf(removable), 1);
      }
    }
    if (scenes.length < maxScenes) insertBeforeEnd(imageCount >= 2 ? 'gallery' : 'product');
  }

  // Remplissage : des scènes qui ne demandent aucun fait, sans répétition.
  const fillers = [...(FILLERS[objective] || []), 'statement', 'wordswap', 'benefits', 'product'];
  for (const filler of fillers) {
    if (used >= durationSec * 0.85 || scenes.length >= maxScenes) break;
    if (!scenes.includes(filler)) insertBeforeEnd(filler);
  }

  // Vidéo d'une minute : on reprend les scènes de contenu (autre variante,
  // autres textes). En dessous, une scène ne revient jamais deux fois.
  if (durationSec >= 60) {
    const repeatable = ['product', 'benefits', 'statement', 'wordswap'];
    let guard = 0;
    while (used < durationSec * 0.85 && scenes.length < maxScenes && guard < 8) {
      insertBeforeEnd(repeatable[guard % repeatable.length]);
      guard++;
    }
  }

  if (scenes[0] !== 'hook') scenes.unshift('hook');
  if (scenes[scenes.length - 1] !== 'logo') scenes.push('logo');
  return scenes;
}

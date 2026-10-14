/**
 * Les PROFILS DE CRÉATIVITÉ : la jauge d'IDEM (Low → Ultra) traduite en POLITIQUE de composition.
 *
 * Le réglage ne rallonge pas les prompts : il change ce que le moteur explore, qui décide, et ce qui est
 * permis. Les quatre profils du plan (guidée, équilibrée, créative, libre) sont portés par les cinq crans
 * déjà vendus et tarifés par IDEM :
 *
 *   low     guidée     — le code compose : compositions éprouvées, exploration minimale, aucun appel ;
 *   medium  équilibrée — le code classe, tire parmi les trois meilleures (variété semée par le projet) ;
 *   high    créative   — un AUTEUR compose un arbre inédit (les compositions éprouvées ne sont que des
 *                        références) ; un directeur artistique choisit le repli dans un menu de six ;
 *   max     créative+  — idem, le repli réglé ; la critique visuelle renvoie ses notes à l'auteur (1 révision) ;
 *   ultra   libre      — idem, exploration la plus large et deux révisions sur la critique.
 *
 * Aux crans de l'auteur, un rendu jugé faible n'est JAMAIS remplacé en silence par un gabarit : il est révisé
 * par son auteur ; le repli sur une composition éprouvée n'arrive que si l'arbre est invalide ou bloquant, et
 * la trace le dit (`author_fallback`).
 *
 * La validation reste STRICTE à tous les crans pour ce qui rend une page fausse (contenu perdu, chiffre
 * inventé, texte hors page, référence inexistante) ; au-dessus de Medium, les contrôles de JUGEMENT
 * deviennent des conseils qui ne coûtent jamais sa page à l'IA (leçon « réparer au lieu de refuser »).
 * La créativité n'autorise JAMAIS l'invention d'une donnée ni la modification d'un chiffre.
 */
import type { CreativityLevel } from '../contracts/common';

export type ProfileName = 'guided' | 'balanced' | 'creative' | 'free';

export interface CreativityPolicy {
  level: CreativityLevel;
  profile: ProfileName;
  /** Combinaisons de paramètres essayées par motif. */
  paramSamples: number;
  /** Seuil d'adéquation d'un motif pour entrer dans les candidats. */
  minFit: number;
  /** Dispersion du classement (0 = déterministe) : la direction artistique penche, elle n'élimine pas. */
  noise: number;
  /** Les agents qui prennent une décision à ce cran. */
  agents: { pick: boolean; tune: boolean; author: boolean; critic: boolean; repair: boolean };
  /** Taille du menu proposé à l'agent. */
  menu: number;
  /** Révisions de l'arbre d'auteur sur la critique visuelle (0 : la première version est gardée). */
  authorRevisions: number;
  allowNovelCompositions: boolean;
  reuseValidatedComponents: boolean;
  allowCustomCss: false;
  diversityPolicy: 'within_document' | 'avoid_recent_similar';
  validationPolicy: 'strict';
  /** Au-dessus de Medium, un constat de jugement est un conseil, jamais un refus. */
  judgementBlocks: boolean;
  aiRepairPolicy: 'never' | 'on_failure';
}

const BASE = { allowCustomCss: false as const, validationPolicy: 'strict' as const, reuseValidatedComponents: true };

export const POLICIES: Record<CreativityLevel, CreativityPolicy> = {
  low: { ...BASE, level: 'low', profile: 'guided', paramSamples: 3, minFit: 0.5, noise: 0, agents: { pick: false, tune: false, author: false, critic: false, repair: false }, menu: 1, authorRevisions: 0, allowNovelCompositions: false, diversityPolicy: 'within_document', judgementBlocks: true, aiRepairPolicy: 'never' },
  medium: { ...BASE, level: 'medium', profile: 'balanced', paramSamples: 6, minFit: 0.35, noise: 0.35, agents: { pick: false, tune: false, author: false, critic: false, repair: false }, menu: 3, authorRevisions: 0, allowNovelCompositions: false, diversityPolicy: 'avoid_recent_similar', judgementBlocks: true, aiRepairPolicy: 'never' },
  high: { ...BASE, level: 'high', profile: 'creative', paramSamples: 10, minFit: 0.25, noise: 0.5, agents: { pick: true, tune: false, author: true, critic: true, repair: true }, menu: 6, authorRevisions: 0, allowNovelCompositions: true, diversityPolicy: 'avoid_recent_similar', judgementBlocks: false, aiRepairPolicy: 'on_failure' },
  max: { ...BASE, level: 'max', profile: 'creative', paramSamples: 16, minFit: 0.2, noise: 0.65, agents: { pick: true, tune: true, author: true, critic: true, repair: true }, menu: 6, authorRevisions: 1, allowNovelCompositions: true, diversityPolicy: 'avoid_recent_similar', judgementBlocks: false, aiRepairPolicy: 'on_failure' },
  ultra: { ...BASE, level: 'ultra', profile: 'free', paramSamples: 24, minFit: 0.15, noise: 0.8, agents: { pick: true, tune: true, author: true, critic: true, repair: true }, menu: 8, authorRevisions: 2, allowNovelCompositions: true, diversityPolicy: 'avoid_recent_similar', judgementBlocks: false, aiRepairPolicy: 'on_failure' },
};

export const policyFor = (level?: CreativityLevel | null): CreativityPolicy => POLICIES[level ?? 'medium'] ?? POLICIES.medium;

/** Ce que chaque style favorise (les étiquettes des motifs) : une affinité, jamais une exclusion. */
export const STYLE_TAGS: Record<string, string[]> = {
  minimalism: ['minimal', 'calm', 'elegant', 'swiss'],
  maximalism: ['bold', 'colorful', 'playful', 'impact', 'layered'],
  futuristic: ['bold', 'structured', 'dynamic'],
  'vector-art': ['playful', 'colorful', 'friendly', 'bauhaus'],
  'collage-art': ['layered', 'playful', 'editorial', 'unexpected'],
  retro: ['bold', 'playful', 'warm', 'colorful'],
  cyberpunk: ['bold', 'dynamic', 'structured'],
  'pop-art': ['bold', 'colorful', 'playful', 'impact'],
  glassmorphism: ['calm', 'soft', 'elegant'],
  clay: ['soft', 'friendly', 'playful'],
  'pixel-art': ['structured', 'playful', 'bauhaus'],
  editorial: ['editorial', 'elegant', 'structured', 'classic'],
  y2k: ['playful', 'bold', 'colorful'],
  swiss: ['swiss', 'structured', 'minimal', 'calm'],
  surreal: ['unexpected', 'bold', 'layered'],
  bohemian: ['warm', 'soft', 'elegant'],
  victorian: ['classic', 'elegant', 'framed'],
  graffiti: ['bold', 'dynamic', 'impact'],
  aurora: ['soft', 'calm', 'colorful'],
  handwritten: ['warm', 'friendly', 'calm'],
};

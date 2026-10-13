/**
 * Les CONTRAINTES d'identité tirées par le code avant le modèle : la région chromatique de la palette
 * et le registre typographique d'un projet. Déterministes (la même marque regénérée retrouve les
 * siennes), elles empêchent deux marques d'un même secteur de recevoir la même palette ou le même
 * appariement de polices simplement parce que c'est la réponse la plus fréquente.
 */
import crypto from 'crypto';

/** Un tirage reproductible : la même clé donne le même choix. */
function makePicker(entropyKey: string): <T>(arr: T[], salt: string) => T {
  return <T>(arr: T[], salt: string): T => {
    const digest = crypto.createHash('sha256').update(`${entropyKey}:${salt}`).digest();
    return arr[digest.readUInt32BE(0) % arr.length];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Contrainte chromatique et typographique — l'unicité AVANT le modèle.
//
// La palette est la décision la plus structurante d'un projet : elle se propage
// à la charte, au plan, au deck, aux visuels et au site. Elle était laissée
// entièrement au modèle, avec la température comme seul anti-convergence.
//
// C'est un remède qui ne tient pas sur un petit modèle. Sa distribution est plus
// piquée : à température égale il retombe plus souvent sur la réponse moyenne —
// « le bleu de confiance, le vert de croissance, le violet d'innovation »,
// c'est-à-dire la palette de tous les concurrents du secteur. Et monter la
// température l'éloigne du mode en même temps que de la justesse.
//
// On tire donc la RÉGION, et le modèle décide DEDANS. Le jugement lui reste
// entier — teinte exacte, rampes, affectation des rôles — mais deux marques du
// même secteur ne peuvent plus atterrir sur le même bleu, parce qu'elles ne
// tirent pas la même région.
// ─────────────────────────────────────────────────────────────────────────────

/** Douze secteurs de teinte de 30°, couvrant le cercle chromatique. */
const HUE_SECTORS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

const COLOR_SCHEMES = [
  'analogous',
  'complementary',
  'split-complementary',
  'triadic',
  'monochromatic-warm',
  'monochromatic-cool',
];

const SATURATION_REGIMES = ['muted', 'balanced', 'vivid'];

const GROUND_REGIMES = ['light', 'dark', 'tinted'];

export interface PaletteConstraint {
  baseHue: number;
  scheme: string;
  saturation: string;
  ground: string;
}

/**
 * Région chromatique de CE projet. Déterministe : la même marque regénérée
 * retrouve sa région, une autre marque en obtient une différente.
 *
 * `12 × 6 × 3 × 3 = 648` régions distinctes, avant même le choix du modèle à
 * l'intérieur de la sienne.
 */
export function buildPaletteConstraint(projectId: string): PaletteConstraint {
  const pick = makePicker(`palette:${projectId}`);
  return {
    baseHue: pick(HUE_SECTORS, 'hue'),
    scheme: pick(COLOR_SCHEMES, 'scheme'),
    saturation: pick(SATURATION_REGIMES, 'saturation'),
    ground: pick(GROUND_REGIMES, 'ground'),
  };
}

/** Bloc à injecter dans le prompt de génération de palette. */
export function describePaletteConstraint(constraint: PaletteConstraint): string {
  return `<palette_constraint>
Base hue: between ${constraint.baseHue}° and ${constraint.baseHue + 30}° on the HSL wheel. This range is IMPOSED and non-negotiable.
Harmony: ${constraint.scheme}.
Saturation regime: ${constraint.saturation}.
Ground: ${constraint.ground}.

Inside that range you decide everything — the exact hue, the ramps, which colour takes which role, and how the WCAG contrasts are met. Do not step outside it.

This constraint exists for one reason: two companies in the same sector must not end up with the same palette. The "obvious" colour for a sector is, by definition, the colour of every competitor.
</palette_constraint>`;
}

/**
 * Registres typographiques. Même principe que la palette : le prompt bannit déjà
 * les familles les plus vues du web, mais un petit modèle rappelé à l'ordre
 * propose simplement la famille suivante dans son classement interne. Tirer le
 * REGISTRE déplace le problème hors de sa portée.
 */
const TYPE_REGISTERS = [
  'a grotesque display paired with an editorial serif for running text',
  'a slab serif display paired with a humanist sans for running text',
  'a geometric sans display paired with a transitional serif for running text',
  'a high-contrast didone display paired with a neo-grotesque for running text',
  'a condensed display paired with a wide humanist sans for running text',
  'a monospace-derived display paired with a classical serif for running text',
  'a rounded sans display paired with a low-contrast slab for running text',
  'an old-style serif display paired with a neutral grotesque for running text',
];

/** Registre typographique de CE projet, déterministe. */
export function buildTypographyConstraint(projectId: string): string {
  const pick = makePicker(`typography:${projectId}`);
  const register = pick(TYPE_REGISTERS, 'register');
  return `<typography_constraint>
Register for this brand: ${register}. This pairing REGISTER is imposed.

You choose the actual families inside it — that is where your judgement applies. The register exists so that two brands do not receive the same pairing simply because it is the most common answer for their sector.
</typography_constraint>`;
}

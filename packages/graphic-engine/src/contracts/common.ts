/**
 * Briques communes des contrats : identifiants, couleurs, formats, vocabulaire de livrables.
 *
 * Les contrats sont STRICTS (aucune clé inconnue) et BORNÉS (chaque texte, chaque liste a une
 * limite) : un petit modèle qui se trompe de clé ou déborde est refusé avec une phrase qui dit
 * quoi corriger, jamais accepté à moitié. Les valeurs de style sont des JETONS nommés (`md`,
 * `brand`, `ink`) — jamais du CSS libre : c'est ce qui rend un DesignSpec validable sans HTML.
 */
import { z } from 'zod/v4';

export const Hex = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'couleur hexadécimale attendue (#rrggbb)');

/** Identifiant stable : référencé par le DesignSpec à la place d'une copie du texte. */
export const Id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/, 'identifiant attendu (lettres, chiffres, . _ : -)');

/** Une adresse d'image : http(s), chemin relatif ou data-URI d'image. Jamais `javascript:`. */
export const Url = z
  .string()
  .min(1)
  .max(2_000_000)
  .refine((v) => /^(https?:\/\/|\/|\.\/|\.\.\/|data:image\/(png|jpe?g|gif|webp|svg\+xml|avif);)/i.test(v), 'adresse d’image admissible attendue');

export const text = (max: number) => z.string().min(1).max(max);

export const Locale = z.string().regex(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/, 'langue attendue (fr, en, fr-CM…)');

/** Le livrable que le moteur compose. */
export const DocumentType = z.enum(['business-plan', 'pitch-deck', 'brand-charter', 'business-card', 'flyer', 'chart', 'report']);
export type DocumentType = z.infer<typeof DocumentType>;

/** Les toiles : pages de document, diapositives, cartes, visuels, couvertures de réseaux. */
export const FormatId = z.enum([
  'a4-portrait',
  'slide-16x9',
  'page-a4',
  'page-a4-landscape',
  'card-landscape',
  'card-portrait',
  'flyer-square',
  'flyer-story',
  'flyer-banner',
  'flyer-post',
  'flyer-a4',
  'cover-facebook',
  'cover-linkedin',
  'cover-x',
  'cover-youtube',
  'avatar-square',
  'chart-free',
]);
export type FormatId = z.infer<typeof FormatId>;

export const CreativityLevel = z.enum(['low', 'medium', 'high', 'ultra']);
export type CreativityLevel = z.infer<typeof CreativityLevel>;

/** Gravité d'un constat : `blocking` rend la page fausse, `advisory` la rend perfectible. */
export const Severity = z.enum(['blocking', 'advisory']);
export type Severity = z.infer<typeof Severity>;

/** Un constat de validation : où, quoi, et — quand le code sait le dire — comment le corriger. */
export const Issue = z.strictObject({
  code: z.string().max(64),
  severity: Severity,
  path: z.string().max(240).optional(),
  message: z.string().max(400),
  /** Une correction que le code (ou un agent) peut appliquer telle quelle. */
  fix: z.string().max(240).optional(),
});
export type Issue = z.infer<typeof Issue>;

/** Valeur d'un paramètre de composition : jamais un objet libre. */
export const ParamValue = z.union([z.string().max(64), z.number(), z.boolean()]);
export type ParamValue = z.infer<typeof ParamValue>;
export const Params = z.record(z.string().max(48), ParamValue);
export type Params = z.infer<typeof Params>;

/**
 * Direction artistique de la marque.
 *
 * La charte définissait jusqu'ici les ATOMES (logo, palette, typographie) mais
 * jamais la GRAMMAIRE qui les assemble. Résultat : chaque générateur (charte,
 * visuels, business plan, deck, site) réinventait un parti pris visuel, et deux
 * livrables de la même marque ne se ressemblaient pas.
 *
 * La direction artistique est ce parti pris, décidé UNE fois à partir du projet
 * et de son identité, puis imposé à toutes les générations. Elle s'ancre sur un
 * DA du catalogue (`idem-templates/catalog/directions`) que le modèle CHOISIT, avec une déclinaison par champ
 * rédigée d'avance : il n'invente aucun élément de direction (décision du 11/11/2026).
 */

/**
 * Identifiant d'une DA du catalogue (`idem-templates/catalog/directions`) : une chaîne, validée contre le catalogue
 * chargé (il évolue sans redéploiement). Les 20 d'origine restent valables, 10 nouvelles s'y ajoutent.
 */
export type ArtDirectionStyleId = string;

/**
 * Traitement de l'imagerie : ce que montrent les photos/illustrations et
 * comment elles sont traitées. C'est le réglage qui rend deux visuels de la
 * même marque reconnaissables entre mille.
 */
export interface ArtDirectionImagery {
  /** 'photography' | 'illustration' | 'render-3d' | 'collage' | 'abstract' | 'mixed' */
  medium: string;
  /** Sujets à photographier/illustrer, en une phrase. */
  subjects: string;
  /** Traitement appliqué (duotone, grain, contraste, découpe, halo…). */
  treatment: string;
  /** Direction lumière (studio doux, contre-jour, néon, lumière naturelle…). */
  lighting: string;
  /** Cadrage/point de vue dominant. */
  framing: string;
}

/** Grammaire de composition : la façon dont l'espace est occupé. */
export interface ArtDirectionLayout {
  /** Système de grille (colonnes, modulaire, diagonale, libre…). */
  grid: string;
  /** Densité visée : 'airy' | 'balanced' | 'dense'. */
  density: string;
  /** Traitement des marges et de l'espace négatif. */
  whitespace: string;
  /** Le geste de composition signature (bleed, décalage, superposition…). */
  signatureMove: string;
  /** Trois mises en page types de la marque (post, flyer, slide…), décrites en zones : la grammaire appliquée. */
  recipes?: Array<{ name: string; use: string; zones: string }>;
}

export interface ArtDirectionTypography {
  /** Amplitude de contraste typographique attendue (ex: "8x entre titre et légende"). */
  scaleContrast: string;
  /** Casse dominante et interlettrage. */
  caseAndTracking: string;
  /** Traitement particulier (outline, souligné, surimpression, rotation…). */
  treatment: string;
}

export interface ArtDirectionColor {
  /** Répartition indicative des couleurs de la charte (ex: "60/30/10"). */
  distribution: string;
  /** Comment les couleurs de marque s'appliquent aux aplats et aux textes. */
  application: string;
  /** Le contraste recherché (doux, brutal, monochrome + accent…). */
  contrast: string;
}

/**
 * @openapi
 * components:
 *   schemas:
 *     ArtDirectionModel:
 *       type: object
 *       properties:
 *         styleId:
 *           type: string
 *         styleName:
 *           type: string
 *         tagline:
 *           type: string
 *         rationale:
 *           type: string
 *         keywords:
 *           type: array
 *           items:
 *             type: string
 *         layout:
 *           type: object
 *         color:
 *           type: object
 *         typography:
 *           type: object
 *         imagery:
 *           type: object
 *         graphicDevices:
 *           type: array
 *           items:
 *             type: string
 *         dos:
 *           type: array
 *           items:
 *             type: string
 *         donts:
 *           type: array
 *           items:
 *             type: string
 *         imagePromptModifier:
 *           type: string
 *       required:
 *         - styleId
 *         - styleName
 */
export interface ArtDirectionModel {
  id?: string;
  /** Style du catalogue sur lequel la direction s'ancre. */
  styleId: ArtDirectionStyleId;
  /** Nom lisible du style (repris du catalogue). */
  styleName: string;
  /** Formule courte de la direction, propre à CETTE marque. */
  tagline: string;
  /** Pourquoi ce style pour ce projet (2-3 phrases, en français). */
  rationale: string;
  /** 5 à 8 mots-clés de moodboard. */
  keywords: string[];

  layout: ArtDirectionLayout;
  color: ArtDirectionColor;
  typography: ArtDirectionTypography;
  imagery: ArtDirectionImagery;

  /** Éléments graphiques récurrents (formes, motifs, filets, textures). */
  graphicDevices: string[];
  /** Règles à respecter, formulées à l'impératif. */
  dos: string[];
  /** Pièges à éviter, formulés à l'impératif. */
  donts: string[];

  /**
   * Fragment à concaténer à TOUT prompt de génération d'image (mockups, visuels
   * sourcés/générés). Décrit le rendu, pas le sujet.
   */
  imagePromptModifier: string;

  /** Les déclinaisons du catalogue retenues pour cette marque, par champ (`grid: 'g2'`…) : la direction se recompose d'elles. */
  variants?: Record<string, string>;
  /** La version du catalogue des DA au moment du choix. */
  catalogVersion?: string;
  /** Les sources d'inspiration de la DA (catalogue), montrées dans la charte. */
  inspirations?: Array<{ title: string; author: string; year?: number; note: string; url?: string }>;

  createdAt?: Date;
  updatedAt?: Date;
}

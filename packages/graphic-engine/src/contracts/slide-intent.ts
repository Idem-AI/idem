/**
 * L'INTENTION d'une page et le PLAN DE SES MÉDIAS — ce que la page doit faire COMPRENDRE et ce qu'elle doit
 * MONTRER, avant de savoir comment elle sera composée.
 *
 * Une diapositive part de l'idée à faire comprendre, pas du gabarit à remplir : trois difficultés ne sont pas
 * forcément trois cartes de paragraphes — ce peut être trois illustrations reliées, un schéma rayonnant, une
 * image forte et trois annotations. `SlideIntent` porte cette décision (la stratégie visuelle, le budget de
 * texte, l'image voulue) ; le moteur s'en sert pour CLASSER les compositions, planifier les médias et
 * mesurer la charge de texte. Il ne remplace jamais le contenu : il dit comment le montrer.
 *
 * `AssetRequirement` est un besoin de média (une photo plein cadre, une capture du produit, une icône par
 * point) ; `ResolvedAsset` est ce qu'un fournisseur a trouvé, avec sa PROVENANCE. Les sources sont essayées
 * dans un ordre fixe — utilisateur, projet, capture réelle, génération, banque, composition native — et une
 * capture de produit n'est JAMAIS générée : on ne fabrique pas une fausse interface pour faire joli.
 */
import { z } from 'zod/v4';
import { Id, text, Url } from './common';

/** Comment la page démontre son message. Une référence de composition, jamais un gabarit imposé. */
export const VisualStrategy = z.enum(['illustration', 'full-bleed', 'product-capture', 'diagram', 'data-visualization', 'collage', 'editorial', 'free-composition']);
export type VisualStrategy = z.infer<typeof VisualStrategy>;
export const VISUAL_STRATEGIES = VisualStrategy.options;

/** Le texte que la page peut porter : au-delà, elle se lit comme un document, pas comme une diapositive. */
export const TextBudget = z.strictObject({
  headlineWords: z.number().int().min(2).max(40),
  bodyWords: z.number().int().min(0).max(400),
  maxBullets: z.number().int().min(0).max(12),
});
export type TextBudget = z.infer<typeof TextBudget>;

/** Ce qu'une image GÉNÉRÉE ou cherchée doit montrer — jamais de texte dedans : les mots sont posés par le moteur. */
export const ImageSpec = z.strictObject({
  /** Le sujet et son action (« une torréfactrice verse des grains dans un brûloir »). */
  subject: text(240),
  /** Le cadrage (« plan large », « gros plan sur les mains »). */
  framing: text(80).optional(),
  /** L'ambiance (« lumière du matin, chaleureuse »). */
  mood: text(80).optional(),
});
export type ImageSpec = z.infer<typeof ImageSpec>;

export const SlideIntent = z.strictObject({
  /** Le message à retenir, en une phrase. */
  keyMessage: text(200).optional(),
  visualStrategy: VisualStrategy,
  textBudget: TextBudget.optional(),
  /** Les blocs qui portent la preuve (chiffres, graphique, citation). */
  evidenceRefs: z.array(Id).max(8).optional(),
  /** L'image que la page appelle, si elle en appelle une. */
  image: ImageSpec.optional(),
});
export type SlideIntent = z.infer<typeof SlideIntent>;

// ── Les médias ──────────────────────────────────────────────────────────────────────────────

export const AssetRole = z.enum(['photo', 'illustration', 'product-capture', 'clip', 'icon', 'logo', 'chart', 'texture']);
export type AssetRole = z.infer<typeof AssetRole>;

/** D'où vient un média — dans l'ordre où on les essaie. */
export const AssetSource = z.enum(['user', 'project', 'capture', 'generated', 'stock', 'native']);
export type AssetSource = z.infer<typeof AssetSource>;
export const ASSET_SOURCE_ORDER: readonly AssetSource[] = AssetSource.options;

export const AssetRequirement = z.strictObject({
  assetId: Id,
  role: AssetRole,
  /** Ce que le média doit expliquer ou renforcer. */
  purpose: text(240),
  /** Ce qu'il montre (une image) ou le mot qui le nomme (une icône). */
  subject: text(240),
  framing: text(80).optional(),
  mood: text(80).optional(),
  /** Largeur / hauteur. */
  aspectRatio: z.number().min(0.2).max(6),
  /** Où le texte se posera sur l'image : la zone à laisser calme. */
  safeArea: z.enum(['left', 'right', 'top', 'bottom', 'none']),
  /** Les sources admises, dans l'ordre d'essai. */
  sources: z.array(AssetSource).min(1).max(6),
  /** Sans média : `downgrade` change la stratégie de la page, `skip` laisse la page sans lui. */
  fallback: z.enum(['downgrade', 'skip']),
  /** Où le poser : une figure ajoutée à la section, ou l'élément `item` du bloc `blockId`. */
  target: z.strictObject({ blockId: Id.optional(), item: z.number().int().min(0).max(11).optional() }),
});
export type AssetRequirement = z.infer<typeof AssetRequirement>;

export const ResolvedAsset = z.strictObject({
  assetId: Id,
  source: AssetSource,
  /** Une image (photo, illustration, capture)… */
  url: Url.optional(),
  alt: text(200).optional(),
  focal: z.strictObject({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
  /** … ou une icône des jeux locaux. */
  icon: z.string().regex(/^[a-z0-9-]{1,64}$/).optional(),
  provenance: z.strictObject({
    provider: text(60),
    license: text(80).optional(),
    attribution: text(160).optional(),
    sourceUrl: z.string().max(2048).optional(),
    model: text(120).optional(),
  }),
});
export type ResolvedAsset = z.infer<typeof ResolvedAsset>;

/**
 * Une ressource du REGISTRE du projet : une image ou un clip déjà obtenu (fourni, capturé, généré, trouvé en
 * banque) par n'importe quel livrable — deck, visuel, vidéo. Le registre est commun aux documents et aux
 * vidéos : un média payé une fois se réutilise au lieu d'être régénéré.
 */
export const AssetRecord = z.strictObject({
  id: z.string().min(1).max(120),
  url: Url,
  kind: z.enum(['image', 'video']),
  role: AssetRole,
  source: AssetSource,
  /** Ce qu'il montre, en une ligne (anglais ou langue du projet) : c'est sur elle que se fait l'appariement. */
  subject: text(240),
  tags: z.array(text(40)).max(12).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  /** Le livrable qui l'a obtenu. */
  origin: z.enum(['deck', 'document', 'visual', 'video', 'upload', 'capture', 'other']),
  provenance: ResolvedAsset.shape.provenance,
  createdAt: z.string().max(40).optional(),
});
export type AssetRecord = z.infer<typeof AssetRecord>;

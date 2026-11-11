/**
 * LE CATALOGUE DE GABARITS — ses contrats.
 *
 * Le catalogue vit HORS du dépôt (dépôt `idem-templates`, publié sur un CDN avec un manifeste) : on y ajoute des
 * nœuds sans rebuild ni redéploiement. Quatre sortes de nœuds, reliés en GRAPHE :
 *
 *   layout     le squelette d'une page : une grille et des ZONES qui acceptent des unités de contenu (en-tête,
 *              principal, côté, média). Aucun style.
 *   skin       l'HABILLAGE : les classes Tailwind de chaque rôle typographique (titre, chapô, valeur…), le fond, le
 *              décor discret (le logo, un filet). Les couleurs sont des RÔLES (`[[ink]]`, `[[accent]]`) que le code
 *              résout selon la surface de la zone : la charte de la marque s'applique toujours.
 *   component  le rendu d'UNE unité (un bloc d'un type donné, ou l'en-tête) : un fragment HTML Tailwind dont les
 *              textes sont des CLÉS (`{{.label}}`), jamais des mots. Le code déroule les listes.
 *   gabarit    une combinaison documentée (layout + habillage + composants + réglages par défaut) : le point de
 *              départ que le modèle choisit et dont il met à jour la configuration (`config.json`).
 *
 * Arêtes du graphe : `fits` (ce qui va avec), `follows` (ce qui enchaîne bien après), `contrasts` (ce qui casse la
 * monotonie), `avoidAfter` (jamais juste après), `variantOf`.
 *
 * Rien de ce qui vient du catalogue n'est de confiance : le contenu est validé ici, puis assaini comme le HTML d'un
 * modèle (aucun script, aucune adresse étrangère, aucun mot écrit en dur).
 */
import { z } from 'zod/v4';
import type { DocumentType, FormatId } from '../contracts/common';
import type { FormatDef } from '../design-system/formats';

export const CATALOG_SCHEMA_VERSION = 1;

/** Les éléments que le moteur graphique produit (un catalogue par élément, des nœuds partagés). */
export const CatalogElement = z.enum(['business-plan', 'pitch-deck', 'brand-charter', 'business-card', 'social-visual', 'social-cover']);
export type CatalogElement = z.infer<typeof CatalogElement>;

/** L'élément d'une génération : le type de document et la toile. `null` : rien au catalogue (graphique seul). */
export function elementOf(documentType: DocumentType, format: Pick<FormatDef, 'family' | 'id'>): CatalogElement | null {
  // La TOILE d'abord : une bannière ou un visuel de réseau reste une bannière ou un visuel, même produit pour la charte.
  if (format.family === 'cover') return 'social-cover';
  if (format.family === 'visual') return 'social-visual';
  if (format.family === 'card') return 'business-card';
  switch (documentType) {
    case 'business-plan':
    case 'report':
      return 'business-plan';
    case 'pitch-deck':
      return 'pitch-deck';
    case 'brand-charter':
      return 'brand-charter';
    case 'business-card':
      return 'business-card';
    case 'flyer':
      return 'social-visual';
    default:
      return null;
  }
}

const Id = z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/, 'identifiant attendu : minuscules, chiffres, . _ -');
const Short = (n: number) => z.string().min(1).max(n);

/** La documentation d'un nœud : ce que le modèle lit pour choisir (courte : chaque mot coûte). */
export const NodeDoc = z.strictObject({
  title: Short(80),
  summary: Short(320),
  use: Short(240).optional(),
  avoid: Short(240).optional(),
});

/** Les traits d'un nœud, comparés à ceux de la marque (direction artistique) par le code. */
export const NodeTags = z.strictObject({
  /** Humeurs (`sober`, `editorial`, `bold`, `warm`, `playful`, `tech`, `luxury`, `organic`, `institutional`, `vibrant`…). */
  mood: z.array(Short(24)).max(8).optional(),
  density: z.enum(['airy', 'balanced', 'dense']).optional(),
  /** Le rapport à l'image : la page a besoin d'une photo (`photo`), s'en passe (`none`) ou les deux (`any`). */
  imagery: z.enum(['photo', 'illustration', 'none', 'any']).optional(),
  /** Énergie visuelle, de 1 (calme) à 5 (percutant). */
  energy: z.number().int().min(1).max(5).optional(),
});

export const NodeEdges = z.strictObject({
  fits: z.array(Id).max(40).optional(),
  follows: z.array(Id).max(40).optional(),
  contrasts: z.array(Id).max(40).optional(),
  avoidAfter: z.array(Id).max(40).optional(),
  variantOf: Id.optional(),
});

/** La toile qu'un nœud accepte : nature (flux, fixe), orientations, ou formats exacts. */
export const NodeShape = z.strictObject({
  kind: z.enum(['flow', 'fixed']).optional(),
  orientations: z.array(z.enum(['portrait', 'landscape', 'square'])).max(3).optional(),
  formats: z.array(Short(32)).max(20).optional(),
  /** Bornes du rapport largeur / hauteur (une bannière LinkedIn est à 5,9). */
  minAspect: z.number().min(0.1).max(10).optional(),
  maxAspect: z.number().min(0.1).max(10).optional(),
});

const SectionRoles = z.array(z.enum(['cover', 'opening', 'narrative', 'data', 'comparison', 'process', 'closing', 'appendix', 'specimen', 'showcase', 'visual', 'card-face', '*'])).min(1).max(13);

/** Un réglage DISCRET (choisi dans une liste) : chaque option remplace des classes d'habillage ou de zone. */
export const NodeVar = z.strictObject({
  name: z.string().regex(/^[a-zA-Z][\w-]{0,31}$/),
  doc: Short(160).optional(),
  options: z
    .array(
      z.strictObject({
        id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,31}$/),
        /** Les classes ajoutées ou remplacées, par rôle d'habillage (`title`, `page`…) ou par zone (`zone:main`). */
        classes: z.record(z.string().max(48), z.string().max(400)).optional(),
      })
    )
    .min(2)
    .max(8),
  default: z.string().max(32).optional(),
});
export type NodeVar = z.infer<typeof NodeVar>;

/** Un réglage CONTINU borné (Ultra seulement) : le code le lit, jamais hors de ses bornes. */
export const NodeParam = z.strictObject({
  name: z.enum(['split', 'titleScale', 'gapScale']),
  min: z.number(),
  max: z.number(),
  default: z.number(),
  doc: Short(160).optional(),
});
export type NodeParam = z.infer<typeof NodeParam>;

const common = {
  id: Id,
  /** Version du nœud (entier) : un changement de rendu l'augmente. */
  version: z.number().int().min(1).max(10_000).default(1),
  doc: NodeDoc,
  tags: NodeTags.optional(),
  edges: NodeEdges.optional(),
  /** Auteurs (pseudonymes GitHub) : l'attribution des contributions. */
  authors: z.array(Short(60)).max(10).optional(),
  /**
   * Les DIRECTIONS ARTISTIQUES servies (catalogue `directions` du dépôt) : un nœud n'appartient qu'à des DA existantes,
   * et le moteur ne sert à une marque que les nœuds de sa DA (ou de ses voisines). Absent : vieux catalogue sans DA.
   */
  directions: z.array(z.string().regex(/^[a-z][a-z0-9-]{1,39}$/)).min(1).max(60).optional(),
};

// ── layout ──────────────────────────────────────────────────────────────────────────────────

export const ZoneAccept = z.enum(['header', 'main', 'side', 'media', 'any']);
export type ZoneAccept = z.infer<typeof ZoneAccept>;

export const LayoutZone = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,23}$/),
  accepts: z.array(ZoneAccept).min(1).max(5),
  col: z.number().int().min(1).max(24),
  span: z.number().int().min(1).max(24),
  row: z.number().int().min(1).max(40),
  rows: z.number().int().min(1).max(40).default(1),
  align: z.enum(['start', 'center', 'end']).default('start'),
  /** Le nombre d'unités au plus (au-delà, elles vont à la zone principale). */
  max: z.number().int().min(1).max(20).optional(),
  /** Une zone vide est retirée (sinon la page ne convient pas à ce contenu). */
  optional: z.boolean().optional(),
  /** Une zone DÉCOR : gardée même vide (aplat de marque, bande), avec `optional`. */
  keep: z.boolean().optional(),
  /** La surface de la zone : son fond et, pour `brand`/`deep`, l'encre qui va dessus. */
  surface: z.enum(['none', 'soft', 'raised', 'brand', 'deep']).optional(),
  /** La zone touche le bord de la page (photo à fond perdu) : elle ignore la marge du côté où elle la touche. */
  bleed: z.boolean().optional(),
  /** Marge intérieure de la zone (en unités de gouttière : 0 à 3). */
  inset: z.number().min(0).max(3).optional(),
});
export type LayoutZone = z.infer<typeof LayoutZone>;

export const LayoutNode = z.strictObject({
  ...common,
  kind: z.literal('layout'),
  elements: z.array(CatalogElement).min(1).max(6),
  shape: NodeShape,
  roles: SectionRoles,
  /** La grille : colonnes, et lignes sur une toile fixe (une page de flux grandit). */
  grid: z.strictObject({ columns: z.number().int().min(1).max(24), rows: z.number().int().min(1).max(40).default(1) }),
  zones: z.array(LayoutZone).min(1).max(8),
  /**
   * Bornes du contenu : nombre de blocs (l'en-tête n'est pas un bloc), types de blocs admis, nombre total d'éléments de
   * liste (une page « affirmation » ne porte pas une grille de douze cartes).
   */
  capacity: z
    .strictObject({
      minBlocks: z.number().int().min(0).max(40).default(0),
      maxBlocks: z.number().int().min(0).max(40).default(40),
      kinds: z.array(z.string().max(32)).max(40).optional(),
      /** Types de blocs qui ne vont pas avec ce squelette (un bandeau de couleur à côté d'un nuancier). */
      avoidKinds: z.array(z.string().max(32)).max(40).optional(),
      maxItems: z.number().int().min(1).max(200).optional(),
    })
    .default({ minBlocks: 0, maxBlocks: 40 }),
  /** Le squelette peint toute la page d'une couleur pleine : servi seulement quand la marque admet un fond sombre. */
  darkGround: z.boolean().optional(),
  /** Les réglages continus que ce squelette admet (Ultra). `split` déplace la frontière des zones `head`/`main`. */
  params: z.array(NodeParam).max(4).optional(),
  /** Le squelette se lit en miroir (gauche ↔ droite) sans perdre son sens. */
  mirrorable: z.boolean().default(true),
});
export type LayoutNode = z.infer<typeof LayoutNode>;

// ── skin (habillage) ────────────────────────────────────────────────────────────────────────

/** Les rôles d'habillage : chaque composant les nomme (`[[s.title]]`), l'habillage les remplit. */
export const SKIN_ROLES = ['page', 'kicker', 'title', 'lede', 'heading', 'body', 'caption', 'value', 'label', 'quote', 'card', 'cardEmph', 'panel', 'rule', 'figure', 'chip', 'index', 'list'] as const;
export type SkinRole = (typeof SKIN_ROLES)[number];
/** Les degrés de taille qu'un rôle peut prendre (l'échelle typographique de la marque, à la taille de la toile). */
export const SizeStep = z.enum(['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl']);

export const SkinNode = z.strictObject({
  ...common,
  kind: z.literal('skin'),
  /** Les éléments servis (vide : tous). */
  elements: z.array(CatalogElement).max(6).optional(),
  classes: z.partialRecord(z.enum(SKIN_ROLES), z.string().max(400)),
  sizes: z.partialRecord(z.enum(['kicker', 'title', 'lede', 'heading', 'body', 'caption', 'value', 'label', 'quote', 'index']), SizeStep).optional(),
  /**
   * Le DÉCOR posé par l'habillage, par famille de toile (`document`, `slide`, `card`, `visual`, `cover`) : un
   * fragment en position absolue sur une toile fixe (le logo dans un coin, un filet), un en-tête sur une page de
   * flux. Ni mot ni clé de contenu.
   */
  chrome: z.partialRecord(z.enum(['document', 'slide', 'card', 'visual', 'cover']), z.string().max(4000)).optional(),
  /** Un fond sombre de page : servi seulement quand la marque l'admet (politique de surface claire). */
  dark: z.boolean().optional(),
  vars: z.array(NodeVar).max(6).optional(),
});
export type SkinNode = z.infer<typeof SkinNode>;

// ── component ───────────────────────────────────────────────────────────────────────────────

export const ComponentNode = z.strictObject({
  ...common,
  kind: z.literal('component'),
  /** Ce qu'il rend : `header` (titre, sur-titre, chapô) ou un type de bloc (`metrics`, `cards`…). */
  accepts: z.array(z.string().regex(/^[a-zA-Z]{2,32}$/)).min(1).max(6),
  /** Bornes du nombre d'éléments d'une liste (`items`, `steps`…) qu'il sait poser. */
  items: z.strictObject({ min: z.number().int().min(0).max(60).default(0), max: z.number().int().min(1).max(60).default(60) }).optional(),
  /** Les zones où il a sa place (vide : toutes). */
  zones: z.array(ZoneAccept).max(5).optional(),
  /** La largeur minimale de sa zone, en part de la page (une rangée de trois chiffres ne tient pas dans une marge). */
  minWidth: z.number().min(0).max(1).optional(),
  /** Le fragment (fichier `template.html` dans le dépôt), chargé à la demande et vérifié par son empreinte. */
  html: z.string().max(20_000).optional(),
  vars: z.array(NodeVar).max(4).optional(),
});
export type ComponentNode = z.infer<typeof ComponentNode>;

// ── gabarit ─────────────────────────────────────────────────────────────────────────────────

/** LA CONFIGURATION d'une page : ce que le modèle met à jour (et rien d'autre). */
export const PageConfig = z.strictObject({
  gabarit: Id.optional(),
  layout: Id,
  skin: Id,
  /** Un composant par type d'unité (`header`, `metrics`…) ; un type absent prend le meilleur composant compatible. */
  components: z.record(z.string().max(32), Id).default({}),
  /** Les réglages discrets choisis (nom → option). */
  vars: z.record(z.string().max(32), z.string().max(32)).default({}),
  /** Les réglages continus (Ultra), ramenés dans leurs bornes par le code. */
  params: z.record(z.string().max(32), z.number()).default({}),
  mirror: z.boolean().default(false),
});
export type PageConfig = z.infer<typeof PageConfig>;

export const GabaritNode = z.strictObject({
  ...common,
  kind: z.literal('gabarit'),
  elements: z.array(CatalogElement).min(1).max(6),
  roles: SectionRoles,
  /** La configuration par défaut (`config.json` dans le dépôt). */
  config: PageConfig,
});
export type GabaritNode = z.infer<typeof GabaritNode>;

export const CatalogNode = z.discriminatedUnion('kind', [LayoutNode, SkinNode, ComponentNode, GabaritNode]);
export type CatalogNode = z.infer<typeof CatalogNode>;
export type NodeKind = CatalogNode['kind'];

// ── manifeste ───────────────────────────────────────────────────────────────────────────────

/** Une entrée du manifeste : le nœud sans son HTML (chargé à la demande), et l'empreinte de ce HTML. */
export const ManifestEntry = z.strictObject({
  node: z.record(z.string(), z.unknown()),
  html: z.strictObject({ file: z.string().max(200), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).optional(),
});

export const Manifest = z.strictObject({
  schema: z.literal(CATALOG_SCHEMA_VERSION),
  /** Version du catalogue (date + compteur), affichée dans les traces. */
  version: z.string().max(40),
  builtAt: z.string().max(40),
  /** La version minimale du moteur qui sait lire ce catalogue (`2.6.0`). */
  engine: z.string().max(20),
  license: z.string().max(80).optional(),
  /** La liste des DA du dépôt (version légère) : les `directions` de chaque nœud y sont vérifiées. */
  directions: z.array(z.record(z.string(), z.unknown())).max(200).optional(),
  entries: z.array(ManifestEntry).max(20_000),
  /** Signature ed25519 (base64) du manifeste sans ce champ, JSON canonique. */
  signature: z.string().max(200).optional(),
});
export type Manifest = z.infer<typeof Manifest>;

/** Les surcharges d'exploitation, sans republier le catalogue (panneau d'administration). */
export interface CatalogOverrides {
  /** Nœuds retirés immédiatement. */
  disabled?: string[];
  /** Poids multiplicatifs (0 à 3) appliqués au score d'un nœud. */
  weights?: Record<string, number>;
}

/** Le catalogue chargé : les nœuds valides, indexés, et d'où ils viennent. */
export interface LoadedCatalog {
  version: string;
  source: 'dir' | 'url' | 'cache' | 'snapshot' | 'builtin';
  nodes: Map<string, CatalogNode>;
  /** Empreintes du HTML à charger (nœuds dont le HTML n'est pas encore là). */
  htmlRefs: Map<string, { file: string; sha256: string }>;
  /** Ce qui a été écarté au chargement, et pourquoi (journalisé, montré par `check:catalog`). */
  rejected: Array<{ id: string; reason: string }>;
  /** Les DA du dépôt (vide : catalogue sans DA, aucun filtre). */
  directions: Map<string, DirectionInfo>;
}

export type { FormatId };
import type { DirectionInfo } from '../directions';

/**
 * Communication feature models.
 *
 * Trois objets, trois usages — c'est tout le module :
 *
 *   LA BOUSSOLE                LES PÉRIODES                  L'ATELIER
 *   CommunicationStrategy      CommunicationPlan[]           StudioConversation
 *   une par marque             autant qu'on veut,            un fil de chat
 *   positionnement, ton,       elles s'empilent et se        « je veux un visuel
 *   piliers, canaux            chevauchent : dates           pour dire que… »
 *   lue une fois               réelles, brief, contenus      → visuel à la charte
 *          │                            │                            │
 *          │ hérite                     │ génère                     │ compose
 *          └──────────────▶ PlanBrief   └──▶ ContentIdea[] ──────┬────┘
 *                                                               │
 *                                                               ▼
 *                                                        Flyer (= visuel)
 *                                                    composé par composeFlyer :
 *                                                    graine de design, direction
 *                                                    artistique, lint de charte
 *                                                               │
 *                                                               ▼
 *                                                     Publication (assistée)
 *
 * Pourquoi les périodes : jusqu'à la V2 il n'existait qu'UN `EditorialCalendar`,
 * qui repartait toujours d'aujourd'hui sur N semaines et que toute régénération
 * écrasait — impossible de préparer décembre en novembre, et les visuels déjà
 * payés devenaient inatteignables dès que le calendrier changeait.
 *
 * Pourquoi l'atelier : `generateFlyer` exigeait un `ContentIdea` existant, donc
 * une stratégie (40 crédits) puis un calendrier (15) avant le premier visuel (2).
 * L'atelier compose depuis une simple phrase, par le MÊME pipeline.
 *
 * Stocké sous `analysisResultModel.communication` sur le document projet. Les
 * champs V1 (`calendar`, `moments`, `flyers`, `trends`) restent lisibles et sont
 * convertis une fois par `migrateLegacyCommunication` — aucune perte.
 */
import { ArtDirectionModel } from './art-direction.model';

export interface CommunicationContext {
  brandName: string;
  businessType: string;
  valueProposition: string;
  targetAudience: string;
  objectives: string[];
  tone: string;
  keywords: string[];
  channels: string[];
  language: string;
  /** Branding summary (colors + primary font) used by the flyer step */
  branding: {
    primary: string;
    secondary: string;
    accent?: string;
    background?: string;
    text?: string;
    primaryFont?: string;
    secondaryFont?: string;
    fontUrl?: string;
    logoSvg?: string;
    logoUrls?: {
      primary: string;
      withText?: {
        light?: string;
        dark?: string;
        mono?: string;
      };
      iconOnly?: {
        light?: string;
        dark?: string;
        mono?: string;
      };
    };
  };
  /**
   * Direction artistique de la marque, recopiée ici pour que la composition des
   * visuels n'ait pas à recharger le projet. C'est elle qui borne l'espace de
   * tirage de la graine de design : sans elle, deux visuels de la même marque
   * pouvaient sortir dans deux univers graphiques sans rapport.
   */
  artDirection?: ArtDirectionModel;
  extractedAt: Date;
}

/** Light-weight trend signal. Sourced from cached external APIs / periodic jobs. */
export interface TrendSignal {
  id: string;
  label: string;
  description?: string;
  relevance: number; // 0..1
  source?: string;
  capturedAt: Date;
}

/** Actionable block inside the strategy. User can edit each block. */
export interface StrategyBlock {
  id: string;
  title: string;
  body: string;
  /** Canonical slug used by the UI to pin block types (positioning, pillars, kpis...) */
  kind:
    | 'positioning'
    | 'pillars'
    | 'messaging'
    | 'channels'
    | 'cadence'
    | 'kpis'
    | 'tone'
    | 'custom';
}

export interface CommunicationStrategy {
  summary: string;
  blocks: StrategyBlock[];
  createdAt: Date;
  updatedAt: Date;
}

export type ContentFormat =
  | 'post'
  | 'carousel'
  | 'short-video'
  | 'article'
  | 'newsletter'
  | 'story'
  | 'reel';

export type ContentChannel =
  | 'instagram'
  | 'linkedin'
  | 'facebook'
  | 'tiktok'
  | 'x'
  | 'youtube'
  | 'blog'
  | 'email'
  | 'other';

export type ContentStatus = 'idea' | 'approved' | 'scheduled' | 'published';

/**
 * Communication purpose of a visual. Drives the TONE and the message of the
 * composition (atmospheric for awareness, factual for an announcement, the
 * offer as a headline for a promotion) — never the presence of a button: a
 * generated visual never carries a CTA, whatever the intent.
 */
export type VisualIntent =
  | 'awareness'
  | 'celebration'
  | 'promotion'
  | 'recruitment'
  | 'announcement';

export interface ContentIdea {
  id: string;
  title: string;
  hook: string;
  description: string;
  format: ContentFormat;
  channel: ContentChannel;
  /** ISO date string (YYYY-MM-DD). C'est la DATE qui fait foi, pas `week`. */
  scheduledFor: string;
  /**
   * Rang de semaine DANS la période, calculé depuis `scheduledFor` et
   * `plan.period.start`. Conservé pour le regroupement de l'affichage ; il ne
   * décide plus de rien (avant la V2, il était la seule notion de temps, ce qui
   * interdisait de planifier autre chose que « les 4 prochaines semaines »).
   */
  week: number;
  hashtags: string[];
  /** Appel à l'action de la LÉGENDE du post — jamais dessiné sur le visuel. */
  callToAction: string;
  /** Communication purpose — drives the tone of the visual. */
  intent?: VisualIntent;
  status: ContentStatus;
  /** Set after a flyer is generated on-demand for this content. */
  flyerIds?: string[];
  /**
   * Période propriétaire. Absent = contenu libre, né dans l'atelier et pas
   * encore rattaché à une période.
   */
  planId?: string;
  /**
   * Occasion qui a motivé ce contenu (fête, journée mondiale, anniversaire de
   * la marque). Absorbe `MomentIdea.occasion` : un « moment » n'est plus un type
   * à part, c'est un contenu qui porte une occasion.
   */
  occasion?: string;
  /** ISO date de l'occasion, quand elle est connue. */
  occasionDate?: string;
  /**
   * Légende prête à publier. Absorbe `MomentIdea.caption` — tout contenu peut
   * en porter une, plus seulement les moments.
   */
  caption?: string;
}

/**
 * @deprecated Remplacé par `CommunicationPlan`. Encore LU à la migration (voir
 * `migrateLegacyCommunication`), plus jamais écrit. Un calendrier unique ne
 * pouvait couvrir qu'« à partir d'aujourd'hui, sur N semaines » et son
 * remplacement effaçait le précédent.
 */
export interface EditorialCalendar {
  rhythm: 'weekly' | 'monthly' | 'biweekly';
  horizonWeeks: number;
  items: ContentIdea[];
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// PÉRIODES — le cœur de la V2
// ---------------------------------------------------------------------------

/**
 * La ligne éditoriale d'UNE période. Cinq champs, pas sept blocs de prose : le
 * brief d'une période se lit d'un coup d'œil, contrairement à la stratégie
 * globale (`CommunicationStrategy`) dont il DÉRIVE.
 */
export interface PlanBrief {
  /** L'angle de la période, 1 à 2 phrases. */
  angle: string;
  /** Le message clé : une phrase, celle qu'on doit retenir. */
  keyMessage: string;
  /** 2 à 4 thèmes qui structurent les contenus de la période. */
  themes: { label: string; why: string }[];
  /** Ce qu'on mesure à la fin — 1 à 3 indicateurs concrets. */
  successSignals: string[];
  /** Occasions du calendrier retenues pour cette période. */
  occasions?: { label: string; date: string }[];
}

export type PlanStatus = 'draft' | 'active' | 'done' | 'archived';

/**
 * Une PÉRIODE de communication : un objectif, des dates réelles, un brief et
 * des contenus datés.
 *
 * Les périodes s'EMPILENT et peuvent se chevaucher — « Novembre » et « Lancement
 * boutique » coexistent. Rien n'est jamais écrasé : régénérer une période ne
 * touche pas les autres, et archiver vaut mieux que supprimer (les visuels déjà
 * produits gardent leur rattachement).
 */
export interface CommunicationPlan {
  id: string;
  /** Nom donné par l'utilisateur : « Novembre 2026 », « Lancement boutique ». */
  name: string;
  /** Ce qu'on veut obtenir, en une phrase, écrit par l'utilisateur. */
  objective: string;
  /** Bornes réelles de la période (ISO YYYY-MM-DD). C'est ce qui manquait. */
  period: { start: string; end: string };
  /** `regular` = rythme de croisière · `campaign` = temps fort borné. */
  kind: 'regular' | 'campaign';
  /** Cadence souhaitée, en posts par semaine (1 à 7) — plus parlant qu'un rythme. */
  postsPerWeek: number;
  channels: ContentChannel[];
  /** Le mini-brief de CETTE période, dérivé de la boussole. */
  brief?: PlanBrief;
  items: ContentIdea[];
  status: PlanStatus;
  /** Renseigné une fois la période générée par l'IA. */
  generatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A timely / one-off communication opportunity ("moment"): national holidays,
 * hiring, company anniversary, seasonal promos… Sits OUTSIDE the weekly calendar
 * and carries a ready-to-publish caption. A MomentIdea is a ContentIdea (so it
 * reuses the whole visual-generation pipeline) enriched with occasion metadata.
 */
/**
 * @deprecated Fusionné dans `ContentIdea` (champs `occasion`, `occasionDate`,
 * `caption`). Encore LU à la migration, plus jamais écrit : « Moment » était un
 * type à part pour ce qui n'est qu'un contenu porteur d'une occasion — d'où un
 * onglet entier de vocabulaire interne exposé à l'utilisateur.
 */
export interface MomentIdea extends ContentIdea {
  /** Human label of the occasion, e.g. "Fête nationale", "Nous recrutons". */
  occasion: string;
  /** ISO date of the occasion when known. */
  occasionDate?: string;
  /** Where this moment came from. */
  source: 'suggestion' | 'custom';
  /** Ready-to-publish social caption (post body). */
  caption?: string;
}

/** A suggested occasion surfaced to the user (before it becomes a MomentIdea). */
export interface MomentSuggestion {
  id: string;
  occasion: string;
  /** ISO date of the occasion. */
  date?: string;
  intent: VisualIntent;
  /** One-line angle proposal for the brand. */
  angle: string;
  /** Why this occasion is relevant for this brand. */
  why?: string;
  /** Emoji/icon hint for the UI. */
  emoji?: string;
}

export type FlyerFormat = 'square' | 'story' | 'banner' | 'post' | 'a4';

export type FlyerImageSource = 'stock' | 'generated';

/**
 * Quick vision scan of the chosen image. Used to make the marketing copy
 * and layout coherent with the picture (no brand / tone / content mismatch).
 */
export interface FlyerImageAnalysis {
  subject: string;
  mood: string;
  /** Dominant hex colors picked from the image, primary first. */
  dominantColors: string[];
  /** 'dark' | 'light' | 'mixed' — decides text-on-image contrast. */
  luminance: 'dark' | 'light' | 'mixed';
  /** Composition hint: where is the subject / where is there empty space. */
  composition?: string;
  /** Any text detected inside the image (avoid overlaying near it). */
  detectedText?: string;
}

export interface FlyerImageAttribution {
  /** Photographer or AI model. */
  author?: string;
  sourceUrl?: string;
  provider: 'pexels' | 'unsplash' | 'gemini' | 'glm' | 'openai' | 'other';
}

/** D'où vient un visuel — pilote son classement dans la bibliothèque. */
export type VisualOrigin = 'plan' | 'studio' | 'occasion' | 'brandbook';

export interface Flyer {
  id: string;
  /**
   * Contenu propriétaire. OPTIONNEL depuis la V2 : un visuel né dans l'atelier
   * n'appartient à aucun contenu planifié. C'est cette contrainte qui obligeait
   * à générer une stratégie puis un calendrier avant d'obtenir le premier visuel.
   */
  contentId?: string;
  /** Période propriétaire, quand le contenu en a une. */
  planId?: string;
  /** D'où il vient. Absent sur les visuels d'avant la V2 (lus comme 'plan'). */
  origin?: VisualOrigin;
  /**
   * La demande d'origine en langage naturel (« un visuel pour dire qu'on ouvre
   * le samedi »). Sert à régénérer, à décliner et à retrouver le visuel.
   */
  brief?: string;
  /** Visuels frères issus du même brief : variantes et déclinaisons de format. */
  siblingIds?: string[];
  format: FlyerFormat;
  concept: string;
  layoutNotes: string;
  marketingText: {
    headline: string;
    subheadline?: string;
    body: string;
    /**
     * @deprecated Legacy — plus jamais renseigné. Un visuel ne porte aucun
     * appel à l'action (cf. `CommunicationService.generateFlyer`) : le CTA vit
     * dans la légende du post (`ContentIdea.callToAction`). Le champ subsiste
     * pour les visuels déjà persistés avant ce changement.
     */
    cta?: string;
  };
  /** Communication purpose used to compose this visual. */
  intent?: VisualIntent;
  /** The exact logo declension URL the AI placed inside the visual. */
  logoUsed?: string;
  /** Single-line Tailwind HTML used internally to render the PNG. */
  html: string;
  /** Public URL of the rendered flyer PNG (served from MinIO). */
  imageUrl?: string;
  /** Public URL of the background image used inside the flyer. */
  backgroundImageUrl?: string;
  imageSource?: FlyerImageSource;
  imageAnalysis?: FlyerImageAnalysis;
  imageAttribution?: FlyerImageAttribution;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Social networks Idem can publish to. Phase 1 ships assisted publishing (no
 * OAuth): Idem prepares the caption + visual and deep-links the user to the
 * network composer. The connector abstraction (services/Connectors) is built so
 * real API publishing can be dropped in later without touching callers.
 */
export type SocialNetwork = 'linkedin' | 'x';

export type PublicationStatus = 'draft' | 'scheduled' | 'published';

export interface Publication {
  id: string;
  /** Id of the owning ContentIdea or MomentIdea. */
  contentId: string;
  network: SocialNetwork;
  status: PublicationStatus;
  /** Ready-to-post caption (already includes hashtags). */
  caption: string;
  hashtags: string[];
  /** Rendered visual image URL, when a flyer exists. */
  imageUrl?: string;
  flyerId?: string;
  /** Deep link that opens the network composer (assisted publishing). */
  shareUrl?: string;
  /** ISO date the user scheduled the post for. */
  scheduledFor?: string;
  /** Set once the user confirms the post is live. */
  publishedAt?: string;
  /** Optional URL of the live post (entered by the user). */
  externalUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// L'ATELIER — création conversationnelle de visuels
// ---------------------------------------------------------------------------

/** Ce que l'atelier propose de faire ensuite, en attente d'un clic. */
export interface StudioPendingAction {
  kind: 'schedule' | 'declinate' | 'publish';
  visualId?: string;
  planId?: string;
  /** ISO date proposée pour la programmation. */
  date?: string;
  channel?: ContentChannel;
  formats?: FlyerFormat[];
}

export interface StudioMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Visuels produits par ce tour de conversation (cartes affichées dans le fil). */
  visualIds?: string[];
  /** Légende proposée, copiable en un clic. */
  caption?: string;
  hashtags?: string[];
  /** Action proposée à l'utilisateur à la suite de ce message. */
  pendingAction?: StudioPendingAction;
  /** Crédits réellement débités par ce tour (0 pour une simple conversation). */
  creditsSpent?: number;
  createdAt: Date;
}

/**
 * La conversation de l'atelier. Même forme que `AdvisorConversationModel` : un
 * fil persistant sur le projet, relu à chaque tour pour que l'utilisateur puisse
 * dire « plutôt en story » sans réexpliquer ce qu'il voulait.
 */
export interface StudioConversation {
  messages: StudioMessage[];
  updatedAt?: Date;
}

export interface CommunicationModel {
  context?: CommunicationContext;
  /** LA BOUSSOLE — la stratégie de marque. Inchangée dans sa forme. */
  strategy?: CommunicationStrategy;
  /** LES PÉRIODES — remplacent le calendrier unique. */
  plans?: CommunicationPlan[];
  /** L'ATELIER — la conversation de création de visuels. */
  studio?: StudioConversation;
  /** Tous les visuels du projet, quelle que soit leur origine. */
  visuals?: Flyer[];
  /** Assisted/queued social publications. */
  publications?: Publication[];
  /** Occasions suggérées, en cache. Alimentent les périodes (plus un onglet). */
  occasionSuggestions?: MomentSuggestion[];
  /** Version du schéma appliquée par la migration. Absent = pré-V2. */
  schemaVersion?: number;

  // ── Champs V1, lus une fois par la migration puis plus jamais écrits ──────
  /** @deprecated → `plans[]`. */
  calendar?: EditorialCalendar;
  /** @deprecated → contenus porteurs d'une `occasion` dans un plan. */
  moments?: MomentIdea[];
  /** @deprecated → `occasionSuggestions`. */
  momentSuggestions?: MomentSuggestion[];
  /** @deprecated → `visuals[]`. */
  flyers?: Flyer[];
  /**
   * @deprecated Plus affiché. Ce sont des connaissances générales du modèle
   * présentées comme des signaux frais ; elles nourrissent encore le prompt de
   * la boussole, elles ne sont plus une section de l'interface.
   */
  trends?: TrendSignal[];
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Version courante du schéma `CommunicationModel`.
 *
 * 2 → les périodes remplacent le calendrier unique.
 * 3 → les canaux sont ramenés vers `ContentChannel`. La montée de version fait
 *     repasser les projets déjà convertis dans la migration, qui nettoie leurs
 *     valeurs héritées (« Instagram », « Réseaux sociaux ») : sans elle, seul
 *     l'affichage les rattraperait, et la donnée resterait fausse en base.
 */
export const COMMUNICATION_SCHEMA_VERSION = 3;

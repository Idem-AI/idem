/**
 * Protocole partagé entre l'agent d'édition (injecté dans l'iframe du preview,
 * origine WebContainer) et le pont côté parent (client React).
 *
 * L'iframe étant cross-origin, toute communication passe par postMessage.
 * Chaque message porte `source: "idem-edit"` pour éviter les collisions avec
 * les autres messages (ex. REQUEST_BLOB_ACCESS déjà utilisé par PreviewIframe).
 */

export const IDEM_SOURCE = 'idem-edit' as const;

/** Séparateur utilisé dans data-idem-id : `<cheminRelatif>|<offsetDébutJSX>` */
export const IDEM_ID_SEP = '|';
export const IDEM_ID_ATTR = 'data-idem-id';

export interface IdemNodeRef {
  /** Chemin relatif du fichier source (ex. "src/App.tsx"). */
  filePath: string;
  /** Offset (index de caractère) du `<` de la balise ouvrante dans le source PROPRE. */
  start: number;
}

/** Encode une référence de nœud en valeur d'attribut data-idem-id. */
export function encodeIdemId(filePath: string, start: number): string {
  return `${filePath}${IDEM_ID_SEP}${start}`;
}

/** Décode un data-idem-id. Retourne null si invalide. */
export function decodeIdemId(id: string | null | undefined): IdemNodeRef | null {
  if (!id) return null;
  const idx = id.lastIndexOf(IDEM_ID_SEP);
  if (idx === -1) return null;
  const filePath = id.slice(0, idx);
  const start = Number(id.slice(idx + 1));
  if (!filePath || Number.isNaN(start)) return null;
  return { filePath, start };
}

/* ------------------------------------------------------------------ */
/* Messages parent -> agent (iframe)                                   */
/* ------------------------------------------------------------------ */

export interface MsgEnableEdit {
  source: typeof IDEM_SOURCE;
  type: 'ENABLE_EDIT';
  enabled: boolean;
}

/** Le parent demande à l'agent de sélectionner par programme (tableau vide = désélection). */
export interface MsgSetSelection {
  source: typeof IDEM_SOURCE;
  type: 'SET_SELECTION';
  ids: string[];
}

export type ParentToAgentMessage = MsgEnableEdit | MsgSetSelection;

/* ------------------------------------------------------------------ */
/* Messages agent (iframe) -> parent                                   */
/* ------------------------------------------------------------------ */

/** L'agent est chargé et prêt à recevoir ENABLE_EDIT. */
export interface MsgAgentReady {
  source: typeof IDEM_SOURCE;
  type: 'AGENT_READY';
}

/**
 * Type d'élément reconnu automatiquement (pilote les contrôles affichés dans le
 * panneau, façon Elementor).
 */
export type ElementKind =
  | 'image'
  | 'link'
  | 'button'
  | 'heading'
  | 'text'
  | 'icon'
  | 'input'
  | 'list'
  | 'container'
  | 'generic';

/** Informations de l'élément survolé/sélectionné, remontées pour l'UI parent. */
export interface SelectedElementInfo {
  id: string;
  tag: string;
  /** Type reconnu (image, lien, bouton, titre, conteneur…). */
  kind: ElementKind;
  /** true si l'élément ne contient que du texte (édition en place possible). */
  textEditable: boolean;
  text: string;
  /** src si c'est une image. */
  src?: string;
  className: string;
  /** Attributs HTML pertinents (href, target, alt, placeholder, type…). */
  attrs: Record<string, string>;
  /** true si l'élément porte une image de fond CSS (background-image: url(...)). */
  hasBackgroundImage: boolean;
  /** Styles calculés (clés camelCase = propriétés CSS), pour préremplir les contrôles. */
  computed: Record<string, string>;
  /** Rectangle dans le repère de l'iframe (pour positionner la barre d'outils). */
  rect: { top: number; left: number; width: number; height: number };
}

export interface MsgSelected {
  source: typeof IDEM_SOURCE;
  type: 'SELECTED';
  /** Éléments actuellement sélectionnés (0, 1 ou plusieurs). */
  elements: SelectedElementInfo[];
}

/** Édition de texte en place validée. */
export interface MsgTextEdit {
  source: typeof IDEM_SOURCE;
  type: 'TEXT_EDIT';
  id: string;
  text: string;
}

/** Réordonnancement : déplacer `id` juste avant `beforeId` (ou en fin si null). */
export interface MsgReorder {
  source: typeof IDEM_SOURCE;
  type: 'REORDER';
  id: string;
  /** id du frère devant lequel insérer, ou null pour placer en dernier. */
  beforeId: string | null;
}

/** L'utilisateur a demandé le remplacement d'une image (clic sur l'icône). */
export interface MsgRequestImage {
  source: typeof IDEM_SOURCE;
  type: 'REQUEST_IMAGE';
  id: string;
}

/** L'utilisateur a demandé la suppression des éléments sélectionnés (touche Suppr). */
export interface MsgDeleteElements {
  source: typeof IDEM_SOURCE;
  type: 'DELETE_ELEMENTS';
  ids: string[];
}

export type AgentToParentMessage =
  | MsgAgentReady
  | MsgSelected
  | MsgTextEdit
  | MsgReorder
  | MsgRequestImage
  | MsgDeleteElements;

/* ------------------------------------------------------------------ */
/* Type guards                                                         */
/* ------------------------------------------------------------------ */

export function isAgentMessage(data: unknown): data is AgentToParentMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { source?: unknown }).source === IDEM_SOURCE
  );
}

/* ------------------------------------------------------------------ */
/* Édition de propriété de style (parent -> astEdit)                   */
/* ------------------------------------------------------------------ */

/**
 * Nom de propriété CSS en camelCase (ex. "color", "fontSize", "borderRadius",
 * "flexDirection", "objectFit", "backgroundImage"…). Écrit tel quel dans l'objet
 * `style` inline du JSX, donc n'importe quelle propriété CSS est acceptée.
 */
export type StyleProperty = string;

export interface StyleEdit {
  id: string;
  property: StyleProperty;
  /** Valeur brute : ex. "#ff0000", "18px", "bold", "center", "url(\"…\")". */
  value: string;
}

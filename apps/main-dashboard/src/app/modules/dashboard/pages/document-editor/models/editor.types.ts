/**
 * Types partagés de l'éditeur WYSIWYG « façon Figma » des documents générés
 * (business plan, pitch deck, charte graphique). Le contenu de chaque document
 * est une liste de sections dont `data` est du HTML+Tailwind (une ligne), avec
 * des graphiques Chart.js inline (<canvas> + <script>new Chart(...)</script>).
 */

import { Observable } from 'rxjs';

/** Type de document éditable. */
export type EditorDocumentType = 'business-plan' | 'pitch-deck' | 'branding';

/** Une section éditable (page/slide). `html` est la source de vérité. */
export interface EditableSection {
  id: string;
  name: string;
  type: string;
  html: string;
}

/** Dimensions de page d'un type de document (pour le calage écran = PDF). */
export interface PageFormat {
  /** Largeur CSS (ex: '210mm'). */
  width: string;
  /** Hauteur CSS (ex: '297mm'). */
  height: string;
}

/** Style inline éditable d'un élément sélectionné. */
export interface ElementStyle {
  color?: string;
  backgroundColor?: string;
  fontSize?: string;
  fontWeight?: string;
  textAlign?: string;
  opacity?: string;
}

/** Un jeu de données Chart.js simplifié pour l'édition. */
export interface ChartDatasetLite {
  label?: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
}

/** Config Chart.js réduite aux champs éditables dans le panneau. */
export interface ChartConfigLite {
  type: string;
  labels: string[];
  datasets: ChartDatasetLite[];
  title?: string;
  legend?: boolean;
}

/** Infos de l'élément actuellement sélectionné dans l'iframe. */
export interface EditorSelection {
  sectionId: string;
  /** Chemin d'index d'éléments relatif au conteneur de section (ex: "0.2.1"). */
  path: string;
  tag: string;
  /** true si l'élément ne contient que du texte (éditable au double-clic). */
  isTextLeaf: boolean;
  /** true si l'élément (ou son enfant direct) est un <canvas> Chart.js. */
  isChart: boolean;
  /** Index de l'élément parmi ses frères + nombre de frères (réordonnancement). */
  index: number;
  siblingCount: number;
  textContent: string;
  style: ElementStyle;
  chart?: ChartConfigLite;
}

/* ------------------------------------------------------------------ */
/* Protocole postMessage iframe <-> hôte                               */
/* ------------------------------------------------------------------ */

export const IFRAME_TO_HOST = 'idem-editor';
export const HOST_TO_IFRAME = 'idem-editor-host';

/** Messages émis par le runtime de l'iframe vers l'hôte Angular. */
export type IframeMessage =
  | { source: typeof IFRAME_TO_HOST; type: 'ready' }
  | { source: typeof IFRAME_TO_HOST; type: 'height'; height: number }
  | { source: typeof IFRAME_TO_HOST; type: 'select'; selection: EditorSelection }
  | { source: typeof IFRAME_TO_HOST; type: 'deselect' }
  | { source: typeof IFRAME_TO_HOST; type: 'text-change'; sectionId: string; path: string; html: string }
  | {
      source: typeof IFRAME_TO_HOST;
      type: 'reorder';
      sectionId: string;
      parentPath: string;
      fromIndex: number;
      toIndex: number;
    };

/** Messages émis par l'hôte Angular vers le runtime de l'iframe. */
export type HostMessage =
  | { source: typeof HOST_TO_IFRAME; type: 'apply-style'; sectionId: string; path: string; style: ElementStyle }
  | { source: typeof HOST_TO_IFRAME; type: 'apply-chart'; sectionId: string; path: string; config: ChartConfigLite }
  | { source: typeof HOST_TO_IFRAME; type: 'select-path'; sectionId: string; path: string }
  | { source: typeof HOST_TO_IFRAME; type: 'clear-selection' }
  | { source: typeof HOST_TO_IFRAME; type: 'set-theme'; dark: boolean };

/** État de sauvegarde affiché dans la barre d'outils. */
export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

/** Contexte de rendu (branding) passé au document iframe. */
export interface RenderContext {
  primaryFont?: string;
  secondaryFont?: string;
  fontUrl?: string;
  dark: boolean;
}

/** Polices de marque utilisées pour un rendu iframe fidèle au PDF. */
export interface FontHints {
  primaryFont?: string;
  secondaryFont?: string;
  fontUrl?: string;
}

/** Résultat de chargement d'un document éditable. */
export interface LoadedDocument {
  title: string;
  sections: EditableSection[];
  fonts: FontHints;
}

/**
 * Adaptateur par type de document : découple le moteur d'édition générique de
 * la source de données / persistance / IA propre à chaque document.
 */
export interface DocumentTypeAdapter {
  readonly type: EditorDocumentType;
  readonly pageFormat: PageFormat;
  /** Préfixe des clés i18n (ex: 'dashboard.documentEditor'). */
  readonly i18nTitleKey: string;
  /** Charge le document éditable du projet (sections + polices + titre). */
  load(projectId: string): Observable<LoadedDocument>;
  /** Persiste l'ensemble des sections éditées. */
  save(projectId: string, sections: EditableSection[]): Observable<unknown>;
  /** Édition IA d'une section : renvoie le nouveau HTML. */
  aiEdit(projectId: string, sectionId: string, instruction: string): Observable<{ html: string }>;
  /** Route de retour vers la page d'affichage. */
  readonly backRoute: string;
}

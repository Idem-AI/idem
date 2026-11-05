/**
 * Une page du CORPUS D'EXEMPLES, écrite à la main (par Claude, sans clé d'API ni appel payant) : le HTML Tailwind que
 * l'auteur du moteur aurait écrit, ses textes en clés `{{clé}}`, et les textes de démonstration qui servent seulement
 * au rendu (ils sont retirés de la bibliothèque : seule la STRUCTURE reste). Les marques sont celles, fictives, des
 * échantillons du plan qualité (`apps/api/api/scripts/quality/samples.ts`).
 */
import type { FormatId } from '../src/contracts/common';

export type CorpusDoc = 'business-plan' | 'pitch-deck' | 'brand-charter' | 'business-card' | 'flyer' | 'cover' | 'profile-cover';

export interface CorpusChart {
  chartType: 'bar' | 'groupedBar' | 'stacked' | 'horizontalBar' | 'line' | 'area' | 'pie' | 'doughnut' | 'radar';
  title?: string;
  labels: string[];
  series: Array<{ name: string; data: number[] }>;
  readingKey: string;
  unit?: string;
}

export interface CorpusTable {
  headers: string[];
  rows: string[][];
  caption?: string;
}

export interface CorpusPage {
  id: string;
  doc: CorpusDoc;
  format: FormatId;
  /** Le rôle de la page dans son document (cover, data, process, specimen, closing, card-face…). */
  role?: string;
  /** Ce que la page fait, en une phrase (clé de la recherche d'exemples). */
  intent: string;
  /** Le rang de l'échantillon de marque (`GRAPHIC_SAMPLES`), 0 à 11. */
  brand: number;
  /** Le style de direction artistique (`STYLE_DATA`), pour varier les surfaces et les rayons. */
  style?: string;
  /** Les textes de démonstration, par clé. */
  texts: Record<string, string>;
  /** Les images de démonstration, par clé (`photo:<a>,<b>,<c>` ou une adresse data:). */
  images?: Record<string, string>;
  charts?: Record<string, CorpusChart>;
  tables?: Record<string, CorpusTable>;
  /** Le HTML Tailwind de la page. */
  html: string;
}

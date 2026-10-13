/**
 * Les livrables graphiques d'IDEM passent tous par ICI pour atteindre le moteur (@idem/graphic-engine) :
 * la marque du projet lue une fois (couleurs, polices, déclinaisons du logo, motifs, direction
 * artistique), le document ouvert avec sa graine et sa jauge, chaque page composée et mesurée, puis
 * rendue en fragment autonome (polices puis racine) — la forme que stockent les sections, que l'éditeur
 * affiche et que le service PDF imprime.
 */
import './engine.host';
import {
  brandFromIdem,
  BrandInput,
  createDocument,
  DirectionInput,
  DocumentOptions,
  DocumentType,
  FormatId,
  GraphicDocument,
  SectionContent,
  sectionHtml,
  SectionOutput,
  SectionRole,
} from '@idem/graphic-engine';
import logger from '../../config/logger';
import { normalizeCreativity } from '../../models/creativity.model';
import type { ProjectModel } from '../../models/project.model';
import { resolveLogoDeclensions } from '../../utils/brand-context.util';
import { getRequestLanguage } from '../../utils/request-language';
import { ensureProjectArtDirection } from '../brand/artDirection.provider';
import type { PromptService } from '../prompt.service';

/** La marque d'un projet telle que le moteur la lit. Rien n'est inventé : ce qui manque, le moteur le dérive. */
export function projectBrand(project: Pick<ProjectModel, 'name' | 'analysisResultModel'>): { brand: BrandInput; direction: DirectionInput } {
  const branding = project.analysisResultModel?.branding;
  return brandFromIdem({ name: project.name || 'Marque', branding: branding as never, logos: resolveLogoDeclensions(branding?.logo) });
}

/**
 * Le projet, avec sa direction artistique provisionnée si la charte n'a pas encore été générée : un
 * livrable peut être le premier produit, et le moteur a besoin d'un style pour composer ses pages. Un
 * échec n'arrête rien — le moteur retombe sur son style éditorial.
 */
export async function withProjectArtDirection(promptService: PromptService, userId: string, projectId: string, project: ProjectModel): Promise<ProjectModel> {
  const artDirection = await ensureProjectArtDirection(promptService, userId, projectId, project);
  const branding = project.analysisResultModel?.branding;
  if (!artDirection || !branding || branding.artDirection?.styleId) return project;
  return { ...project, analysisResultModel: { ...project.analysisResultModel, branding: { ...branding, artDirection } } } as ProjectModel;
}

export interface OpenGraphicDocumentOptions {
  project: Pick<ProjectModel, 'id' | 'name' | 'analysisResultModel'>;
  documentType: DocumentType;
  format: FormatId;
  /** La clé du livrable (`documentDesignKey`) : elle sème les compositions — deux plans, deux suites. */
  seed: string;
  /** Le cran de la jauge de créativité (Medium par défaut). */
  creativity?: unknown;
  /** Les pages attendues, dans l'ordre : le plan leur réserve des compositions distinctes. */
  sections?: Array<{ id: string; role?: SectionRole }>;
  documentLabel?: string;
  userId?: string;
  bindings?: DocumentOptions['bindings'];
  footer?: DocumentOptions['footer'];
  imageColors?: string[];
  png?: boolean;
  /** Fond sombre : seulement sur demande explicite (politique de surface claire). */
  allowDark?: boolean;
  /** Toile imposée (px), quand le format de page n'est pas l'un des formats du moteur (Letter). */
  size?: { width: number; height: number };
  /** Mots de direction saisis par l'utilisateur, ajoutés à ceux de la direction artistique (agents High+). */
  keywords?: string[];
}

/** Un document graphique : la charte, le plan et la mémoire de diversité communs à ses pages. */
export function openGraphicDocument(o: OpenGraphicDocumentOptions): Promise<GraphicDocument> {
  const { brand, direction } = projectBrand(o.project);
  const keywords = [...(o.keywords ?? []), ...(direction.keywords ?? [])].slice(0, 10);
  return createDocument({
    documentType: o.documentType,
    format: o.format,
    brand,
    direction: { ...direction, ...(keywords.length ? { keywords } : {}) },
    creativity: normalizeCreativity(o.creativity),
    seed: o.seed,
    sections: o.sections,
    documentLabel: o.documentLabel,
    locale: getRequestLanguage() === 'fr' ? 'fr' : 'en',
    user: { userId: o.userId, projectId: o.project.id },
    memoryScope: o.project.id ? { documentType: o.documentType, key: o.project.id } : undefined,
    bindings: o.bindings,
    footer: o.footer,
    imageColors: o.imageColors,
    png: o.png,
    allowDark: o.allowDark,
    size: o.size,
  });
}

/**
 * La toile d'un document à pages FIXES (une section = exactement une page), d'après le format PDF choisi
 * pour la charte : diapositive 16:9 par défaut, page A4 portrait ou paysage, Letter à ses cotes exactes.
 */
export function pageCanvasOf(pdfFormat?: string | null): { format: FormatId; size?: { width: number; height: number } } {
  const inch = 96;
  switch (pdfFormat) {
    case 'A4_PORTRAIT':
      return { format: 'page-a4' };
    case 'A4_LANDSCAPE':
      return { format: 'page-a4-landscape' };
    case 'LETTER_PORTRAIT':
      return { format: 'page-a4', size: { width: 8.5 * inch, height: 11 * inch } };
    case 'LETTER_LANDSCAPE':
      return { format: 'page-a4-landscape', size: { width: 11 * inch, height: 8.5 * inch } };
    default:
      return { format: 'slide-16x9' };
  }
}

/** Une page composée, mesurée et réparée par le moteur ; ses constats bloquants restants sont journalisés. */
export async function composeGraphicPage(doc: GraphicDocument, section: SectionContent, position: { index?: number; total?: number } = {}): Promise<SectionOutput> {
  const out = await doc.composeSection(section, position);
  const blocking = out.result.issues.filter((issue) => issue.severity === 'blocking');
  if (blocking.length) {
    logger.warn('graphic.page_blocking', { event: 'graphic.page_blocking', documentType: doc.options.documentType, section: section.id, pattern: out.spec.pattern.id, issues: blocking.map((i) => i.code) });
  }
  return out;
}

/** Une page rendue en fragment autonome (polices puis racine), tel que les livrables le stockent. */
export async function renderGraphicPage(doc: GraphicDocument, section: SectionContent, position: { index?: number; total?: number } = {}): Promise<string> {
  return sectionHtml(await composeGraphicPage(doc, section, position));
}

/** Un identifiant de page stable, tiré de son nom (« Company Summary » → `company-summary`). */
export function pageId(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'page'
  );
}

/** La date de la couverture, dans la langue de la requête (« Octobre 2026 »). */
export function coverDateLabel(date: Date = new Date()): string {
  const locale = getRequestLanguage() === 'fr' ? 'fr-FR' : 'en-US';
  const label = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

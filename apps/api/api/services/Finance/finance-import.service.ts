/**
 * Import d'un fichier financier dans le prévisionnel.
 *
 * L'entrepreneur arrive souvent avec ses chiffres déjà posés ailleurs : un
 * tableau Excel, un budget en PDF, le plan financier d'un dossier bancaire.
 * Lui demander de tout ressaisir case par case est la première raison
 * d'abandon du module. Ici, le document est lu, recopié par l'IA dans le
 * schéma IDEM, puis MONTRÉ à l'utilisateur avant d'être enregistré.
 *
 * Deux temps, donc deux appels :
 *   1. `analyze` — extrait le texte, refuse sans dépenser de jeton ce qui n'a
 *      rien de financier, fait recopier le reste par le modèle et rend un
 *      brouillon normalisé. RIEN n'est enregistré.
 *   2. `apply` — enregistre le brouillon validé, en remplaçant les listes
 *      concernées ou en complétant l'existant. Le brouillon est re-normalisé :
 *      il revient du navigateur et n'est pas digne de confiance.
 */

import JSZip from 'jszip';

import logger from '../../config/logger';
import { AI_CONFIG } from '../../config/ai.config';
import { IRepository } from '../../repository/IRepository';
import { RepositoryFactory } from '../../repository/RepositoryFactory';
import { ProjectModel } from '../../models/project.model';
import {
  AISuggestion,
  createEmptyFinanceModel,
  FinanceModel,
  FinancingPlan,
  FixedChargeLine,
  InvestmentLine,
  ProductPricing,
  SalaryLine,
  SalesObjective,
  VariableChargeLine,
} from '../../models/finance.model';
import { AIChatMessage, PromptConfig, PromptService } from '../prompt.service';
import { condenseDocument, UnusableDocumentError } from '../Simulation/document-intake';
import { extractDocumentText } from '../Simulation/document-text';
import { financeService } from './finance.service';
import {
  normalizeFinancing,
  normalizeFixedCharges,
  normalizeInvestments,
  normalizeProducts,
  normalizeRate,
  normalizeSalesObjectives,
  normalizeVariableCharges,
} from './finance-normalize';
import {
  buildFinanceImportUserMessage,
  FINANCE_IMPORT_SYSTEM_PROMPT,
} from './prompts/finance-import.prompt';

// ---------------------------------------------------------------------------
// Formats
// ---------------------------------------------------------------------------

/**
 * Les formats dans lesquels un entrepreneur tient réellement ses chiffres :
 * le tableur d'abord, puis le document. Le vieux `.xls` binaire n'est pas lu :
 * il se ré-enregistre en `.xlsx` en un clic, et le message le dit.
 */
export const FINANCE_IMPORT_EXTENSIONS = [
  '.xlsx',
  '.csv',
  '.pdf',
  '.docx',
  '.md',
  '.markdown',
  '.txt',
] as const;

type ImportFormat = 'xlsx' | 'csv' | 'text' | 'document';

function detectImportFormat(fileName: string, mimeType?: string): ImportFormat | null {
  const lower = (fileName || '').toLowerCase();
  if (lower.endsWith('.xlsx')) return 'xlsx';
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.txt')) return 'text';
  if (/\.(pdf|docx|md|markdown)$/.test(lower)) return 'document';
  switch (mimeType) {
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return 'xlsx';
    case 'text/csv':
      return 'csv';
    case 'text/plain':
      return 'text';
    case 'application/pdf':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'text/markdown':
      return 'document';
    default:
      return null;
  }
}

export function isAcceptedFinanceDocument(fileName: string, mimeType?: string): boolean {
  return detectImportFormat(fileName, mimeType) !== null;
}

export const UNSUPPORTED_FINANCE_FORMAT_MESSAGE =
  'Format non pris en charge. Importez un fichier Excel (.xlsx), CSV, PDF, Word (.docx) ou texte. ' +
  'Un ancien fichier Excel (.xls) se ré-enregistre en .xlsx depuis Excel : Fichier › Enregistrer sous.';

// ---------------------------------------------------------------------------
// Types échangés avec le tableau de bord
// ---------------------------------------------------------------------------

/** Ce que l'import propose d'ajouter — déjà au format IDEM. */
export interface FinanceImportDraft {
  products: ProductPricing[];
  salesObjectives: SalesObjective[];
  variableChargeLines: VariableChargeLine[];
  fixedChargeLines: FixedChargeLine[];
  salaries: SalaryLine[];
  investments: InvestmentLine[];
  /** Absent quand le document ne dit rien du financement. */
  financing: FinancingPlan | null;
  /** Taux donnés explicitement par le document, et seulement ceux-là. */
  params: {
    socialChargesRatePct?: number;
    clientReceivablesRatePct?: number;
    isRatePct?: number;
  };
}

export interface FinanceImportReport {
  documentKind: string;
  summary: string;
  /** Devise du document (code ISO), telle que lue. */
  currency: string;
  /** Devise du prévisionnel. */
  planCurrency: string;
  missing: string[];
  warnings: string[];
}

export interface FinanceImportPreview {
  documentName: string;
  draft: FinanceImportDraft;
  suggestions: AISuggestion[];
  report: FinanceImportReport;
}

/**
 * - `merge`   : les lignes s'ajoutent à l'existant ;
 * - `replace` : chaque liste fournie remplace la liste en place ;
 * - `sync`    : le tableur fait foi — TOUTES les listes deviennent celles du
 *               brouillon, vides comprises. Une ligne effacée dans le tableur
 *               disparaît du prévisionnel.
 */
export type FinanceImportMode = 'replace' | 'merge' | 'sync';

// ---------------------------------------------------------------------------
// Admission du document — sans IA
// ---------------------------------------------------------------------------

/** En deçà, il n'y a pas de quoi bâtir un prévisionnel. */
const MIN_READABLE_CHARS = 60;
/** Un document financier contient des chiffres ; une lettre n'en a que trois. */
const MIN_NUMBERS = 6;
/** Ce qui part au modèle. Un budget sur 3 ans tient largement là-dedans. */
const BRIEF_BUDGET_CHARS = 36_000;

const FINANCE_WORDS =
  /\b(prix|co[ûu]ts?|charges?|salaires?|loyers?|ventes?|chiffre d'affaires|ca\b|budget|investissements?|emprunts?|pr[êe]ts?|capital|apport|subvention|tr[ée]sorerie|marge|total|montant|d[ée]penses?|recettes?|revenus?|b[ée]n[ée]fice|r[ée]sultat|price|costs?|salar(y|ies)|rent|sales|revenue|expenses?|loan|equity|profit|cash|fcfa|xaf|xof|ngn|kes|mad|eur|usd)\b|[€$₦]/gi;

export interface FinanceDocumentBrief {
  text: string;
  truncated: boolean;
  originalChars: number;
}

/**
 * Prépare le texte pour le modèle, ou refuse.
 *
 * @throws UnusableDocumentError quand le document est vide ou n'a rien de
 * financier — avant toute dépense.
 */
export function prepareFinanceDocument(raw: string, documentName: string): FinanceDocumentBrief {
  const compact = raw.replace(/\s+/g, ' ').trim();
  if (compact.length < MIN_READABLE_CHARS) {
    throw new UnusableDocumentError(
      `« ${documentName} » est vide ou illisible. Vérifiez le fichier, puis réessayez.`
    );
  }

  // Les cellules d'un tableur sont séparées par des blancs : un nombre ne
  // doit pas en avaler un autre, donc pas d'espace dans le motif.
  const numbers = (compact.match(/\d[\d.,]*/g) ?? []).filter((n) => n.length >= 2).length;
  const words = (compact.slice(0, 80_000).match(FINANCE_WORDS) ?? []).length;
  if (numbers < MIN_NUMBERS || words < 2) {
    throw new UnusableDocumentError(
      `« ${documentName} » ne contient pas de chiffres financiers : ni prix, ni charges, ni budget. ` +
        'Importez le tableau ou le document où figurent vos chiffres.'
    );
  }

  if (raw.length <= BRIEF_BUDGET_CHARS) {
    return { text: raw.trim(), truncated: false, originalChars: raw.length };
  }

  // Les feuilles d'un tableur sont déjà découpées : on garde le début de
  // chacune — c'est là que sont les en-têtes et les lignes principales.
  const sheets = raw.split(/\n(?=### Feuille )/);
  if (sheets.length > 1) {
    const share = Math.floor(BRIEF_BUDGET_CHARS / sheets.length);
    const text = sheets
      .map((sheet) => (sheet.length <= share ? sheet : `${cutAtLine(sheet, share)}\n[…]`))
      .join('\n');
    return { text, truncated: true, originalChars: raw.length };
  }

  const condensed = condenseDocument(raw, BRIEF_BUDGET_CHARS);
  return {
    text: condensed.length > BRIEF_BUDGET_CHARS ? cutAtLine(condensed, BRIEF_BUDGET_CHARS) : condensed,
    truncated: true,
    originalChars: raw.length,
  };
}

function cutAtLine(text: string, budget: number): string {
  const slice = text.slice(0, budget);
  const lastBreak = slice.lastIndexOf('\n');
  return lastBreak > budget * 0.6 ? slice.slice(0, lastBreak) : slice;
}

/** Texte du fichier, quel que soit son format. */
export async function extractFinanceDocumentText(
  buffer: Buffer,
  fileName: string,
  mimeType?: string
): Promise<string> {
  const format = detectImportFormat(fileName, mimeType);
  switch (format) {
    case 'xlsx':
      return extractFromXlsx(buffer, fileName);
    case 'csv':
    case 'text':
      return buffer.toString('utf8').replace(/^﻿/, '');
    case 'document':
      return extractDocumentText(buffer, fileName, mimeType);
    default:
      throw new UnusableDocumentError(UNSUPPORTED_FINANCE_FORMAT_MESSAGE);
  }
}

// ---------------------------------------------------------------------------
// Lecture d'un classeur .xlsx
// ---------------------------------------------------------------------------

const MAX_SHEETS = 12;
const MAX_COLUMNS = 40;

/**
 * Un `.xlsx` est une archive de fichiers XML. On en tire, feuille par feuille,
 * un tableau en texte séparé par des tabulations : le modèle y lit les lignes
 * et les colonnes comme l'utilisateur les voit. Les formules ne sont pas
 * recalculées : Excel enregistre leur dernier résultat, c'est celui-là qu'on lit.
 */
async function extractFromXlsx(buffer: Buffer, fileName: string): Promise<string> {
  let archive: JSZip;
  try {
    archive = await JSZip.loadAsync(buffer);
  } catch {
    throw new UnusableDocumentError(
      `« ${fileName} » n'a pas pu être ouvert. Vérifiez qu'il s'agit bien d'un fichier Excel .xlsx, sans mot de passe.`
    );
  }

  const workbook = await archive.file('xl/workbook.xml')?.async('string');
  if (!workbook) {
    throw new UnusableDocumentError(`« ${fileName} » n'est pas un classeur Excel valide.`);
  }

  const rels = (await archive.file('xl/_rels/workbook.xml.rels')?.async('string')) ?? '';
  const targets = new Map<string, string>();
  for (const match of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = attr(match[1], 'Id');
    const target = attr(match[1], 'Target');
    if (id && target) {
      targets.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target}`);
    }
  }

  const shared: string[] = [];
  const sharedXml = (await archive.file('xl/sharedStrings.xml')?.async('string')) ?? '';
  for (const si of sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    shared.push(textRuns(si[1]));
  }

  const parts: string[] = [];
  const sheets = [...workbook.matchAll(/<sheet\b([^>]*)\/?>/g)].slice(0, MAX_SHEETS);
  for (const sheet of sheets) {
    if (attr(sheet[1], 'state') === 'hidden' || attr(sheet[1], 'state') === 'veryHidden') continue;
    const name = decodeXml(attr(sheet[1], 'name') ?? 'Feuille');
    const path = targets.get(attr(sheet[1], 'r:id') ?? '');
    const xml = path ? await archive.file(path)?.async('string') : undefined;
    if (!xml) continue;
    const rows = readSheetRows(xml, shared);
    if (rows.length) parts.push(`### Feuille « ${name} »\n${rows.join('\n')}`);
  }

  logger.info(`Finance import: ${parts.length} sheets read from "${fileName}"`);
  return parts.join('\n\n');
}

function readSheetRows(xml: string, shared: string[]): string[] {
  const rows: string[] = [];
  for (const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const cell of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attr(cell[1], 'r') ?? '';
      const column = columnIndex(ref.replace(/\d+$/, ''));
      if (column < 0 || column >= MAX_COLUMNS) continue;
      const value = cellValue(attr(cell[1], 't'), cell[2] ?? '', shared);
      if (value !== '') cells[column] = value;
    }
    if (cells.some((c) => c)) {
      rows.push(Array.from(cells, (c) => c ?? '').join('\t').replace(/\t+$/, ''));
    }
  }
  return rows;
}

function cellValue(type: string | undefined, inner: string, shared: string[]): string {
  if (type === 'inlineStr') return textRuns(inner);
  const raw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
  if (raw === undefined || raw === '') {
    // Formule jamais calculée (fichier produit par un script) : on la montre
    // telle quelle, le modèle sait faire « =B2*12 ».
    const formula = /<f\b[^>]*>([\s\S]*?)<\/f>/.exec(inner)?.[1];
    return formula ? `=${decodeXml(formula)}` : '';
  }
  if (type === 's') return shared[Number(raw)] ?? '';
  if (type === 'str' || type === 'e') return decodeXml(raw);
  if (type === 'b') return raw === '1' ? 'VRAI' : 'FAUX';
  const n = Number(raw);
  // 150000.00000000003 : un artefact de virgule flottante, pas une donnée.
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : decodeXml(raw);
}

function textRuns(xml: string): string {
  return [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => decodeXml(t[1])).join('').trim();
}

function columnIndex(letters: string): number {
  let index = 0;
  for (const ch of letters.toUpperCase()) {
    const code = ch.charCodeAt(0) - 64;
    if (code < 1 || code > 26) return -1;
    index = index * 26 + code;
  }
  return index - 1;
}

function attr(source: string, name: string): string | undefined {
  const escaped = name.replace(':', '\\:');
  return new RegExp(`(?:^|\\s)${escaped}="([^"]*)"`).exec(source)?.[1];
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&');
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const IMPORT_PROMPT_CONFIG: PromptConfig = {
  provider: AI_CONFIG.finance.import.provider,
  modelName: AI_CONFIG.finance.import.modelName,
  promptType: AI_CONFIG.finance.import.promptType,
  llmOptions: { ...AI_CONFIG.finance.import.llmOptions },
};

const asStrings = (value: unknown, max = 8): string[] =>
  Array.isArray(value)
    ? value
        .filter((v) => typeof v === 'string' && v.trim())
        .map((v: string) => v.trim().slice(0, 240))
        .slice(0, max)
    : [];

export class FinanceImportService {
  private readonly projectRepository: IRepository<ProjectModel>;

  constructor(private readonly promptService: PromptService) {
    this.projectRepository = RepositoryFactory.getRepository<ProjectModel>();
  }

  /** Lit le document et rend un brouillon au format IDEM. N'enregistre rien. */
  async analyze(
    userId: string,
    projectId: string,
    rawText: string,
    documentName: string
  ): Promise<FinanceImportPreview> {
    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const brief = prepareFinanceDocument(rawText, documentName);
    const finance =
      (await financeService.getFinance(userId, projectId)) || createEmptyFinanceModel(projectId);

    logger.info(
      `FinanceImport.analyze projectId=${projectId} doc="${documentName}" ` +
        `chars=${brief.originalChars} brief=${brief.text.length} truncated=${brief.truncated}`
    );

    const messages: AIChatMessage[] = [
      { role: 'system', content: FINANCE_IMPORT_SYSTEM_PROMPT },
      {
        role: 'user',
        content: buildFinanceImportUserMessage({
          documentName,
          documentText: brief.text,
          projectName: project.name,
          projectDescription: (project.longDescription || project.description || '').slice(0, 600),
          country: project.additionalInfos?.country || '',
          currency: finance.meta.currency,
          firstFiscalYear: finance.fiscalCalendar.firstYear,
          truncated: brief.truncated,
        }),
      },
    ];

    const raw = await this.promptService.runPrompt({ ...IMPORT_PROMPT_CONFIG, userId }, messages);
    const parsed = this.parseJSON(raw);
    const draft = this.buildDraft(parsed, finance);

    const report = (parsed.report && typeof parsed.report === 'object' ? parsed.report : {}) as any;
    const currency = String(report.currency || finance.meta.currency).toUpperCase().slice(0, 3);
    const warnings = asStrings(report.warnings);
    if (currency !== finance.meta.currency) {
      warnings.unshift(
        `Les montants du document sont en ${currency}, votre prévisionnel est en ${finance.meta.currency}. ` +
          "Ils sont repris tels quels, sans conversion : vérifiez-les avant d'enregistrer."
      );
    }

    if (isEmptyDraft(draft)) {
      throw new UnusableDocumentError(
        `Aucun chiffre de « ${documentName} » n'a pu être rattaché à votre prévisionnel. ` +
          'Le document décrit peut-être autre chose qu’un budget ou un plan financier.'
      );
    }

    return {
      documentName,
      draft,
      suggestions: this.extractSuggestions(parsed, documentName),
      report: {
        documentKind: String(report.documentKind || '').slice(0, 160),
        summary: String(report.summary || '').slice(0, 600),
        currency,
        planCurrency: finance.meta.currency,
        missing: asStrings(report.missing),
        warnings,
      },
    };
  }

  /** Enregistre un brouillon validé par l'utilisateur. */
  async apply(
    userId: string,
    projectId: string,
    rawDraft: unknown,
    mode: FinanceImportMode,
    rawSuggestions: unknown
  ): Promise<FinanceModel | null> {
    const current = await financeService.getFinance(userId, projectId);
    if (!current) return null;

    // Le brouillon revient du navigateur : il repasse par la même mise en forme.
    const draft = this.buildDraft(this.draftToSchema(rawDraft), current);
    const next =
      mode === 'sync'
        ? syncWith(current, draft)
        : mode === 'replace'
          ? replaceWith(current, draft)
          : mergeInto(current, draft);

    const suggestions: AISuggestion[] = (Array.isArray(rawSuggestions) ? rawSuggestions : [])
      .filter((s: any) => s && typeof s.fieldPath === 'string')
      .slice(0, 200)
      .map((s: any) => ({
        fieldPath: String(s.fieldPath).slice(0, 120),
        value: typeof s.value === 'number' ? s.value : String(s.value ?? '').slice(0, 120),
        justification: String(s.justification || '').slice(0, 400),
        generatedAt: new Date(),
        model: IMPORT_PROMPT_CONFIG.modelName,
      }));

    logger.info(
      `FinanceImport.apply projectId=${projectId} mode=${mode} products=${draft.products.length} ` +
        `charges=${draft.variableChargeLines.length + draft.fixedChargeLines.length} ` +
        `salaries=${draft.salaries.length} investments=${draft.investments.length}`
    );
    return financeService.applyImport(userId, projectId, next, suggestions);
  }

  // -------------------------------------------------------------------

  /** JSON du modèle → brouillon IDEM. Une section absente reste vide. */
  private buildDraft(parsed: any, finance: FinanceModel): FinanceImportDraft {
    const empty = createEmptyFinanceModel(finance.projectId);
    const { products, refs } = normalizeProducts(parsed.products, finance.projectionYears);
    const variable = normalizeVariableCharges(parsed.variableCharges, empty.variableCharges);
    const fixed = normalizeFixedCharges(parsed.fixedCharges, empty.fixedCharges);
    const financing = normalizeFinancing(parsed.financing, empty.financing);
    const hasFinancing =
      financing.apportCapital +
        financing.compteCourantAssocies.amount +
        financing.cmt.amount +
        financing.creditBail.amount +
        financing.subvention +
        financing.creditFournisseurs +
        financing.autofinancement >
      0;

    const params: FinanceImportDraft['params'] = {};
    const social = parsed.fixedCharges?.socialChargesRatePct;
    if (social !== undefined && social !== null) {
      params.socialChargesRatePct = normalizeRate(social, finance.fixedCharges.socialChargesRatePct);
    }
    const receivables = parsed.revenueParams?.clientReceivablesRatePct;
    if (receivables !== undefined && receivables !== null) {
      params.clientReceivablesRatePct = normalizeRate(
        receivables,
        finance.revenueParams.clientReceivablesRatePct
      );
    }
    const isRate = parsed.taxesParams?.isRatePct;
    if (isRate !== undefined && isRate !== null) {
      params.isRatePct = normalizeRate(isRate, finance.taxesParams.isRatePct);
    }

    return {
      products,
      salesObjectives: normalizeSalesObjectives(parsed.salesObjectives, refs),
      variableChargeLines: variable.lines.filter(hasAmount),
      fixedChargeLines: fixed.lines.filter(hasAmount),
      salaries: fixed.salaries.filter(hasAmount),
      investments: normalizeInvestments(parsed.investments),
      financing: hasFinancing ? financing : null,
      params,
    };
  }

  /** Brouillon IDEM → forme attendue par `buildDraft`. */
  private draftToSchema(raw: unknown): any {
    const d = (raw && typeof raw === 'object' ? raw : {}) as Partial<FinanceImportDraft>;
    return {
      products: d.products,
      salesObjectives: d.salesObjectives,
      variableCharges: { lines: d.variableChargeLines },
      fixedCharges: {
        lines: d.fixedChargeLines,
        salaries: d.salaries,
        socialChargesRatePct: d.params?.socialChargesRatePct,
      },
      investments: d.investments,
      financing: d.financing ?? undefined,
      revenueParams: { clientReceivablesRatePct: d.params?.clientReceivablesRatePct },
      taxesParams: { isRatePct: d.params?.isRatePct },
    };
  }

  private extractSuggestions(parsed: any, documentName: string): AISuggestion[] {
    if (!Array.isArray(parsed?.aiSuggestions)) return [];
    return parsed.aiSuggestions
      .filter((s: any) => s && typeof s === 'object' && s.fieldPath)
      .slice(0, 200)
      .map((s: any) => ({
        fieldPath: String(s.fieldPath),
        value: s.value,
        justification: `Importé de « ${documentName} » — ${String(s.justification || '')}`.trim(),
        generatedAt: new Date(),
        model: IMPORT_PROMPT_CONFIG.modelName,
      }));
  }

  private parseJSON(raw: string): any {
    const stripped = this.promptService
      .getCleanAIText(raw)
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    try {
      return JSON.parse(stripped);
    } catch {
      const match = stripped.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {
          /* plus bas */
        }
      }
      logger.error('FinanceImport.parseJSON failed', { snippet: stripped.slice(0, 300) });
      throw new Error('Invalid JSON returned by LLM');
    }
  }
}

// ---------------------------------------------------------------------------
// Fusion
// ---------------------------------------------------------------------------

const hasAmount = (line: { monthlyValues: number[] }) => line.monthlyValues.some((v) => v !== 0);

function isEmptyDraft(d: FinanceImportDraft): boolean {
  return (
    d.products.length +
      d.variableChargeLines.length +
      d.fixedChargeLines.length +
      d.salaries.length +
      d.investments.length ===
      0 && !d.financing
  );
}

/**
 * Remplacer : chaque liste que le document fournit remplace la liste
 * existante. Une liste qu'il ne fournit pas est laissée intacte — un import
 * partiel ne doit jamais effacer ce que l'utilisateur a saisi ailleurs.
 */
function replaceWith(current: FinanceModel, d: FinanceImportDraft): Partial<FinanceModel> {
  const products = d.products.length ? d.products : current.products;
  const productIds = new Set(products.map((p) => p.id));
  const salesObjectives = d.products.length
    ? d.salesObjectives
    : current.salesObjectives.filter((s) => productIds.has(s.productId));

  return withParams(current, d, {
    products,
    salesObjectives,
    variableCharges: {
      ...current.variableCharges,
      lines: d.variableChargeLines.length ? d.variableChargeLines : current.variableCharges.lines,
    },
    fixedCharges: {
      ...current.fixedCharges,
      lines: d.fixedChargeLines.length ? d.fixedChargeLines : current.fixedCharges.lines,
      salaries: d.salaries.length ? d.salaries : current.fixedCharges.salaries,
    },
    investments: d.investments.length ? d.investments : current.investments,
    financing: d.financing ?? current.financing,
  });
}

/**
 * Compléter : les lignes du document s'ajoutent aux lignes existantes. Un
 * produit du même nom est mis à jour plutôt que dupliqué, et ses ventes
 * suivent. Dans le financement, seuls les montants fournis l'emportent.
 */
function mergeInto(current: FinanceModel, d: FinanceImportDraft): Partial<FinanceModel> {
  const products = [...current.products];
  const salesObjectives = [...current.salesObjectives];
  const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

  for (const incoming of d.products) {
    const existing = products.findIndex((p) => sameName(p.name, incoming.name));
    const id = existing >= 0 ? products[existing].id : incoming.id;
    if (existing >= 0) {
      products[existing] = { ...products[existing], prices: incoming.prices, unitCosts: incoming.unitCosts };
    } else {
      products.push(incoming);
    }
    const sales = d.salesObjectives.find((s) => s.productId === incoming.id);
    if (sales) {
      const at = salesObjectives.findIndex((s) => s.productId === id);
      const objective = { ...sales, productId: id };
      if (at >= 0) salesObjectives[at] = objective;
      else salesObjectives.push(objective);
    }
  }

  let financing = current.financing;
  if (d.financing) {
    const f = d.financing;
    const loan = (key: 'compteCourantAssocies' | 'cmt' | 'creditBail') =>
      f[key].amount > 0 ? f[key] : current.financing[key];
    const amount = (key: 'apportCapital' | 'subvention' | 'creditFournisseurs' | 'autofinancement') =>
      f[key] > 0 ? f[key] : current.financing[key];
    financing = {
      apportCapital: amount('apportCapital'),
      compteCourantAssocies: loan('compteCourantAssocies'),
      cmt: loan('cmt'),
      creditBail: loan('creditBail'),
      creditFournisseurs: amount('creditFournisseurs'),
      autofinancement: amount('autofinancement'),
      subvention: amount('subvention'),
    };
  }

  return withParams(current, d, {
    products,
    salesObjectives,
    variableCharges: {
      ...current.variableCharges,
      lines: [...current.variableCharges.lines, ...d.variableChargeLines],
    },
    fixedCharges: {
      ...current.fixedCharges,
      lines: [...current.fixedCharges.lines, ...d.fixedChargeLines],
      salaries: [...current.fixedCharges.salaries, ...d.salaries],
    },
    investments: [...current.investments, ...d.investments],
    financing,
  });
}

/** Le tableur fait foi : chaque liste est remplacée, même vide. */
function syncWith(current: FinanceModel, d: FinanceImportDraft): Partial<FinanceModel> {
  // Plus aucune ligne de financement dans le tableur : les montants tombent à
  // zéro, mais taux et durées déjà réglés sont gardés.
  const financing: FinancingPlan = d.financing ?? {
    ...current.financing,
    apportCapital: 0,
    subvention: 0,
    creditFournisseurs: 0,
    autofinancement: 0,
    cmt: { ...current.financing.cmt, amount: 0 },
    compteCourantAssocies: { ...current.financing.compteCourantAssocies, amount: 0 },
    creditBail: { ...current.financing.creditBail, amount: 0 },
  };
  return withParams(current, d, {
    products: d.products,
    salesObjectives: d.salesObjectives,
    variableCharges: { ...current.variableCharges, lines: d.variableChargeLines },
    fixedCharges: { ...current.fixedCharges, lines: d.fixedChargeLines, salaries: d.salaries },
    investments: d.investments,
    financing,
  });
}

/** Les taux que le document énonce l'emportent, dans tous les modes. */
function withParams(
  current: FinanceModel,
  d: FinanceImportDraft,
  next: Partial<FinanceModel>
): Partial<FinanceModel> {
  if (d.params.socialChargesRatePct !== undefined && next.fixedCharges) {
    next.fixedCharges.socialChargesRatePct = d.params.socialChargesRatePct;
  }
  if (d.params.clientReceivablesRatePct !== undefined) {
    next.revenueParams = {
      ...current.revenueParams,
      clientReceivablesRatePct: d.params.clientReceivablesRatePct,
    };
  }
  if (d.params.isRatePct !== undefined) {
    next.taxesParams = { ...current.taxesParams, isRatePct: d.params.isRatePct };
  }
  return next;
}

export const financeImportService = new FinanceImportService(new PromptService());

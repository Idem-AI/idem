/**
 * LIVRABLES MULTIPLES D'UN PROJET — plusieurs business plans, plusieurs decks.
 *
 * Un projet ne remet pas un seul dossier : un plan bancaire et un plan
 * investisseur coexistent, comme un deck de levée et une présentation
 * commerciale. Chaque livrable vit donc dans une COLLECTION
 * (`analysisResultModel.businessPlans[]`, `analysisResultModel.pitchDecks[]`),
 * chaque document portant son identifiant.
 *
 * Les projets générés avant cette évolution gardent leur document dans
 * l'ancien emplacement unique (`businessPlan`, `pitchDeck`). Il est LU comme le
 * premier document de la collection, sous l'identifiant `LEGACY_DOCUMENT_ID`,
 * et déplacé dans la collection à la première écriture : aucune migration à
 * lancer, aucun lien existant cassé, et jamais deux copies du même document.
 *
 * MODULE PUR, sans accès base : les scripts de contrôle et le front le lisent
 * sans ouvrir Mongo. Les écritures passent par `deliverable-document.store.ts`.
 */

import crypto from 'crypto';
import type { AnalysisResultModel } from '../../models/analysisResult.model';
import type { BusinessPlanDocument } from '../../models/businessPlan.model';
import type { PitchDeckDocument } from '../../models/pitchDeck.model';
import type { SectionModel } from '../../models/section.model';

export type DeliverableKind = 'businessPlan' | 'pitchDeck';

export interface DeliverableDocumentMap {
  businessPlan: BusinessPlanDocument;
  pitchDeck: PitchDeckDocument;
}

/** Clé de la collection dans `analysisResultModel`, par livrable. */
export const DELIVERABLE_COLLECTION: Record<DeliverableKind, 'businessPlans' | 'pitchDecks'> = {
  businessPlan: 'businessPlans',
  pitchDeck: 'pitchDecks',
};

/**
 * Identifiant du document repris de l'ancien emplacement unique. Stable : il
 * figure dans les URLs du tableau de bord dès le premier affichage, avant même
 * que le document ait été déplacé dans la collection.
 */
export const LEGACY_DOCUMENT_ID = 'initial';

/** Longueur maximale d'un nom de document saisi par l'utilisateur. */
export const MAX_DOCUMENT_NAME_LENGTH = 120;

/** Résumé d'un document, pour la liste : aucune section HTML ne voyage. */
export interface DeliverableDocumentSummary {
  id: string;
  /** Nom donné par l'utilisateur ; `null` : l'interface affiche le libellé du modèle. */
  name: string | null;
  /** Modèle de structure (business plan) ou type de deck. */
  variant: string;
  /** Destinataire du document (banque, investisseur, client…). */
  audience: string;
  /** Sections attendues, dans l'ordre du document. */
  expectedSectionNames: string[];
  /** Sections attendues qui ont un contenu. */
  completedSectionCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

type AnalysisLike = Partial<AnalysisResultModel> | null | undefined;

/** Forme commune aux deux emplacements, ancien et nouveau. */
interface StoredDocument {
  id?: string;
  sections?: SectionModel[];
  structure?: unknown;
  createdAt?: Date;
  updatedAt?: Date;
  generatedAt?: Date;
}

export const isDeliverableKind = (key: string): key is DeliverableKind =>
  key === 'businessPlan' || key === 'pitchDeck';

export const newDocumentId = (): string => crypto.randomUUID();

const toTime = (value: unknown): number => {
  if (!value) return 0;
  const time = new Date(value as string | number | Date).getTime();
  return Number.isNaN(time) ? 0 : time;
};

/** Date de dernière activité d'un document. */
export const documentTime = (document: StoredDocument): number =>
  Math.max(toTime(document.updatedAt), toTime(document.generatedAt), toTime(document.createdAt));

export const hasSectionContent = (section: Pick<SectionModel, 'data'> | undefined): boolean =>
  !!section &&
  (typeof section.data === 'string' ? section.data.trim().length > 0 : section.data != null);

/**
 * Un ancien emplacement vide n'est pas un document. Une structure seule en est
 * un : l'utilisateur a choisi son sommaire, la génération n'a pas encore eu lieu.
 */
const isLegacyDocument = (stored: StoredDocument): boolean =>
  (stored.sections?.length ?? 0) > 0 || !!stored.structure;

/** Documents du livrable, ancien emplacement compris. */
export function listDocuments<K extends DeliverableKind>(
  analysis: AnalysisLike,
  kind: K
): DeliverableDocumentMap[K][] {
  const collection = analysis?.[DELIVERABLE_COLLECTION[kind]];
  if (Array.isArray(collection)) return collection as DeliverableDocumentMap[K][];

  const legacy = analysis?.[kind] as StoredDocument | undefined;
  if (!legacy || !isLegacyDocument(legacy)) return [];
  return [
    {
      ...legacy,
      sections: legacy.sections ?? [],
      id: LEGACY_DOCUMENT_ID,
      createdAt: legacy.createdAt ?? legacy.generatedAt,
      updatedAt: legacy.updatedAt ?? legacy.generatedAt,
    } as unknown as DeliverableDocumentMap[K],
  ];
}

/**
 * Document le plus récemment modifié. C'est lui qui répond quand un appelant ne
 * précise pas de document : l'assistant, le module Finance, les anciens liens.
 */
export function primaryDocument<T extends StoredDocument>(documents: readonly T[]): T | null {
  return documents.reduce<T | null>(
    (best, document) => (!best || documentTime(document) > documentTime(best) ? document : best),
    null
  );
}

/** Document désigné, ou le document principal quand aucun identifiant n'est fourni. */
export function findDocument<K extends DeliverableKind>(
  analysis: AnalysisLike,
  kind: K,
  documentId?: string | null
): DeliverableDocumentMap[K] | null {
  const documents = listDocuments(analysis, kind);
  if (documentId) return documents.find((document) => document.id === documentId) ?? null;
  return primaryDocument(documents);
}

/**
 * `analysisResultModel` avec la collection remplacée.
 *
 * L'ancien emplacement est retiré dans la même écriture : le garder ferait
 * coexister deux versions du même document, dont une ne serait plus jamais
 * mise à jour.
 */
function withCollection<K extends DeliverableKind>(
  analysis: AnalysisLike,
  kind: K,
  documents: DeliverableDocumentMap[K][]
): AnalysisResultModel {
  const { [kind]: _legacy, ...rest } = (analysis ?? {}) as Record<string, unknown>;
  return { ...rest, [DELIVERABLE_COLLECTION[kind]]: documents } as unknown as AnalysisResultModel;
}

/** Ajoute le document, ou remplace celui qui porte le même identifiant. */
export function withDocument<K extends DeliverableKind>(
  analysis: AnalysisLike,
  kind: K,
  document: DeliverableDocumentMap[K]
): AnalysisResultModel {
  const documents = listDocuments(analysis, kind);
  const index = documents.findIndex((current) => current.id === document.id);
  const next =
    index === -1
      ? [...documents, document]
      : documents.map((current, i) => (i === index ? document : current));
  return withCollection(analysis, kind, next);
}

export function withoutDocument<K extends DeliverableKind>(
  analysis: AnalysisLike,
  kind: K,
  documentId: string
): AnalysisResultModel {
  return withCollection(
    analysis,
    kind,
    listDocuments(analysis, kind).filter((document) => document.id !== documentId)
  );
}

/**
 * Clé de la graine de composition d'un document.
 *
 * Le document repris de l'ancien emplacement garde la clé du projet : le
 * régénérer redonne la mise en page qu'il avait. Les suivants ont la leur, pour
 * qu'un plan bancaire et un plan investisseur du même projet ne sortent pas
 * page pour page avec la même disposition.
 */
export const documentDesignKey = (prefix: string, projectId: string, documentId: string): string =>
  documentId === LEGACY_DOCUMENT_ID ? `${prefix}:${projectId}` : `${prefix}:${projectId}:${documentId}`;

/** Nom saisi, nettoyé ; `undefined` quand il ne reste rien. */
export function normalizeDocumentName(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const name = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_DOCUMENT_NAME_LENGTH);
  return name || undefined;
}

/** Identifiant de document lu dans la requête (`?documentId=`). */
export function readDocumentId(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Nombre de sections attendues effectivement remplies. */
export function countCompletedSections(
  expectedNames: readonly string[],
  sections: readonly SectionModel[] | undefined
): number {
  const byName = new Map((sections ?? []).map((section) => [section.name, section]));
  return expectedNames.filter((name) => hasSectionContent(byName.get(name))).length;
}

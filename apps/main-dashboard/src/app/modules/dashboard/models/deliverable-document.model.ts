/**
 * Livrables multiples d'un projet : plusieurs business plans, plusieurs pitch decks.
 *
 * Même contrat que l'API (`services/common/deliverable-documents.ts`) : les
 * documents vivent dans `analysisResultModel.businessPlans[]` et
 * `analysisResultModel.pitchDecks[]`. Un projet d'avant cette évolution garde
 * son document dans l'ancien emplacement unique (`businessPlan`, `pitchDeck`) :
 * il est lu ici comme le premier document de la liste, sous l'identifiant
 * `LEGACY_DOCUMENT_ID`, jusqu'à ce que l'API le déplace à la première écriture.
 */

import { SectionModel } from './section.model';

export type DeliverableKind = 'businessPlan' | 'pitchDeck';

/** Identifiant du document repris de l'ancien emplacement unique (idem API). */
export const LEGACY_DOCUMENT_ID = 'initial';

const COLLECTION: Record<DeliverableKind, 'businessPlans' | 'pitchDecks'> = {
  businessPlan: 'businessPlans',
  pitchDeck: 'pitchDecks',
};

/** Résumé d'un document, tel que la liste le reçoit (`GET …/:projectId/documents`). */
export interface DeliverableDocumentSummary {
  id: string;
  /** Nom donné par l'utilisateur ; `null` : afficher le libellé du modèle. */
  name: string | null;
  /** Modèle de structure (business plan) ou type de deck. */
  variant: string;
  /** Destinataire (banque, investisseur, client…). */
  audience: string;
  /** Sections attendues, dans l'ordre du document. */
  expectedSectionNames: string[];
  /** Sections attendues qui ont un contenu. */
  completedSectionCount: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Forme commune d'un document stocké sur le projet. */
export interface StoredDeliverableDocument {
  id: string;
  name?: string | null;
  sections: SectionModel[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
  generatedAt?: string | Date;
}

/** `?documentId=…` à ajouter aux routes par projet ; vide sans document. */
export const documentIdQuery = (documentId?: string | null): string =>
  documentId ? `?documentId=${encodeURIComponent(documentId)}` : '';

const toTime = (value: unknown): number => {
  if (!value) return 0;
  const time = new Date(value as string | Date).getTime();
  return Number.isNaN(time) ? 0 : time;
};

/** Date de dernière activité d'un document. */
export const documentActivityTime = (document: {
  createdAt?: string | Date;
  updatedAt?: string | Date;
  generatedAt?: string | Date;
}): number =>
  Math.max(toTime(document.updatedAt), toTime(document.generatedAt), toTime(document.createdAt));

/** Documents du livrable lus sur le projet, ancien emplacement compris. */
export function listDeliverableDocuments<T extends StoredDeliverableDocument = StoredDeliverableDocument>(
  analysis: unknown,
  kind: DeliverableKind,
): T[] {
  const record = analysis as Record<string, unknown> | null | undefined;
  const collection = record?.[COLLECTION[kind]];
  if (Array.isArray(collection)) return collection as T[];

  const legacy = record?.[kind] as { sections?: SectionModel[]; structure?: unknown } | undefined;
  if (!legacy || (!legacy.sections?.length && !legacy.structure)) return [];
  return [{ ...legacy, sections: legacy.sections ?? [], id: LEGACY_DOCUMENT_ID } as unknown as T];
}

/**
 * Document désigné ; sans identifiant, le plus récemment modifié — celui que
 * l'API retient elle aussi quand aucun document n'est précisé.
 */
export function findDeliverableDocument<T extends StoredDeliverableDocument = StoredDeliverableDocument>(
  analysis: unknown,
  kind: DeliverableKind,
  documentId?: string | null,
): T | null {
  const documents = listDeliverableDocuments<T>(analysis, kind);
  if (documentId) return documents.find((document) => document.id === documentId) ?? null;
  return documents.reduce<T | null>(
    (best, document) =>
      !best || documentActivityTime(document) > documentActivityTime(best) ? document : best,
    null,
  );
}

/** Au moins un document du livrable porte du contenu généré. */
export function hasGeneratedDeliverable(analysis: unknown, kind: DeliverableKind): boolean {
  return listDeliverableDocuments(analysis, kind).some((document) =>
    (document.sections ?? []).some((section) => !!section?.data || !!section?.summary),
  );
}

import { inject, Injectable } from '@angular/core';
import { map, Observable, throwError } from 'rxjs';
import { LegalDocsService } from '../../../services/ai-agents/legal-docs.service';
import { LegalDocumentModel } from '../../../models/legalDocs.model';
import {
  DocumentTypeAdapter,
  EditableSection,
  LoadedDocument,
  PageFormat,
} from '../models/editor.types';
import { sanitizeSectionHtml } from '../utils/sanitize-section';

/**
 * Adaptateur d'un document juridique (statuts, CGU, NDA…), A4 portrait.
 *
 * Un projet garde plusieurs documents juridiques, chacun d'un seul bloc HTML :
 * le document devient une section unique qui s'étend sur autant de pages A4
 * qu'il en faut, comme un business plan. `documentId` le désigne.
 */
@Injectable({ providedIn: 'root' })
export class LegalDocEditorAdapter implements DocumentTypeAdapter {
  readonly type = 'legal-doc' as const;
  readonly pageFormat: PageFormat = { width: '210mm', height: '297mm' };
  readonly multiPage = true;
  readonly i18nTitleKey = 'dashboard.documentEditor.legalDoc.title';
  /** Espace juridique ; un document précis s'affiche sous `backRoute/<documentId>`. */
  readonly backRoute = '/project/legal-docs';
  readonly editRoute = '/project/legal-docs/edit';
  readonly pdfFileName = 'document-juridique.pdf';

  private readonly legalDocsService = inject(LegalDocsService);

  load(projectId: string, documentId?: string | null): Observable<LoadedDocument> {
    return this.legalDocsService.getLegalDocs(projectId).pipe(
      map((legal) => {
        const doc = this.find(legal?.documents ?? [], documentId);
        return {
          title: doc?.name ?? '',
          sections: doc ? [this.toSection(doc)] : [],
          // Un acte juridique s'imprime en noir sur blanc, sans police de marque.
          fonts: {},
        };
      }),
    );
  }

  save(projectId: string, sections: EditableSection[], documentId?: string | null): Observable<unknown> {
    const section = sections[0];
    const id = documentId ?? section?.id;
    if (!section || !id) return throwError(() => new Error('No legal document to save'));
    return this.legalDocsService.updateDocument(projectId, id, section.html);
  }

  aiEdit(
    projectId: string,
    sectionId: string,
    instruction: string,
    documentId?: string | null,
  ): Observable<{ html: string }> {
    return this.legalDocsService
      .aiEditDocument(projectId, documentId ?? sectionId, instruction)
      .pipe(map((res) => ({ html: sanitizeSectionHtml(res.document?.data ?? '') })));
  }

  downloadPdf(projectId: string, documentId?: string | null): Observable<Blob> {
    if (!documentId) return throwError(() => new Error('A legal document id is required'));
    return this.legalDocsService.downloadDocumentPdf(projectId, documentId);
  }

  private find(documents: LegalDocumentModel[], documentId?: string | null): LegalDocumentModel | undefined {
    return documentId ? documents.find((d) => d.id === documentId) : documents[0];
  }

  private toSection(doc: LegalDocumentModel): EditableSection {
    return {
      id: doc.id ?? doc.type,
      name: doc.name,
      type: 'legal_document',
      html: sanitizeSectionHtml(doc.data),
    };
  }
}

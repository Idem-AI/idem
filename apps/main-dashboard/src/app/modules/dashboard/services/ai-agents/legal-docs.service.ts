import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';
import {
  LegalDocsContext,
  LegalDocsModel,
  LegalDocumentCatalogEntry,
  LegalDocumentModel,
  LegalDocumentType,
  LegalFormEntry,
  LegalRecommendations,
} from '../../models/legalDocs.model';
import { SSEService } from '../../../../shared/services/sse.service';
import { SSEStepEvent, SSEConnectionConfig } from '../../../../shared/models/sse-step.model';

@Injectable({ providedIn: 'root' })
export class LegalDocsService {
  private readonly apiUrl = `${environment.services.api.url}/project/legalDocs`;
  private readonly http = inject(HttpClient);
  private readonly sseService = inject(SSEService);

  closeSSEConnection(): void {
    this.sseService.closeConnection('legal-docs');
  }

  cancelGeneration(): void {
    this.sseService.cancelGeneration('legal-docs');
  }

  getCatalog(): Observable<{ catalog: LegalDocumentCatalogEntry[]; forms: LegalFormEntry[] }> {
    return this.http.get<{ catalog: LegalDocumentCatalogEntry[]; forms: LegalFormEntry[] }>(
      `${this.apiUrl}/catalog`,
    );
  }

  /** Forme juridique et documents recommandés, contexte pré-rempli depuis le projet. */
  getRecommendations(projectId: string): Observable<LegalRecommendations> {
    return this.http.get<LegalRecommendations>(`${this.apiUrl}/${projectId}/recommendations`);
  }

  /** Enregistre le contexte (dont la forme retenue) ; renvoie les recommandations recalculées. */
  saveContext(projectId: string, context: LegalDocsContext): Observable<LegalRecommendations> {
    return this.http.put<LegalRecommendations>(`${this.apiUrl}/${projectId}/context`, { context });
  }

  getRequiredFields(types: LegalDocumentType[]): Observable<{ requiredFields: string[] }> {
    return this.http.get<{ requiredFields: string[] }>(
      `${this.apiUrl}/requirements?types=${types.join(',')}`,
    );
  }

  getLegalDocs(projectId: string): Observable<LegalDocsModel> {
    return this.http.get<LegalDocsModel>(`${this.apiUrl}/${projectId}`);
  }

  deleteDocument(projectId: string, documentId: string): Observable<LegalDocsModel> {
    return this.http.delete<LegalDocsModel>(
      `${this.apiUrl}/${projectId}/documents/${documentId}`,
    );
  }

  clearAll(projectId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${projectId}`);
  }

  generate(
    projectId: string,
    types: LegalDocumentType[],
    context: LegalDocsContext,
    replaceExisting = false,
  ): Observable<SSEStepEvent> {
    this.closeSSEConnection();
    const base64Context = btoa(
      unescape(encodeURIComponent(JSON.stringify(context || {}))),
    );
    const url =
      `${this.apiUrl}/generate/${projectId}` +
      `?types=${types.join(',')}` +
      `&context=${encodeURIComponent(base64Context)}` +
      `&replaceExisting=${replaceExisting ? 'true' : 'false'}`;

    const config: SSEConnectionConfig = {
      url,
      keepAlive: true,
      reconnectionDelay: 1000,
    };
    return this.sseService.createConnection(config, 'legal-docs');
  }

  /** Enregistre le HTML d'un document édité (éditeur WYSIWYG). */
  updateDocument(projectId: string, documentId: string, data: string): Observable<{ document: LegalDocumentModel }> {
    return this.http.put<{ document: LegalDocumentModel }>(
      `${this.apiUrl}/${projectId}/documents/${documentId}`,
      { data },
    );
  }

  /** Édition IA d'un document : renvoie le document réécrit. */
  aiEditDocument(
    projectId: string,
    documentId: string,
    instruction: string,
  ): Observable<{ document: LegalDocumentModel }> {
    return this.http.post<{ document: LegalDocumentModel }>(
      `${this.apiUrl}/${projectId}/documents/${documentId}/ai-edit`,
      { instruction },
    );
  }

  downloadDocumentPdf(projectId: string, documentId: string): Observable<Blob> {
    return this.http
      .get(`${this.apiUrl}/${projectId}/documents/${documentId}/pdf`, {
        responseType: 'blob',
        headers: { Accept: 'application/pdf' },
      })
      .pipe(
        catchError((error) => {
          console.error(
            `Error downloading legal doc ${documentId} for project ${projectId}:`,
            error,
          );
          return throwError(() => error);
        }),
      );
  }
}

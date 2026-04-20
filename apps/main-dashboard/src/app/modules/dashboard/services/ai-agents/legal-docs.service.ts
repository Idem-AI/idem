import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';
import {
  LegalDocsContext,
  LegalDocsModel,
  LegalDocumentCatalogEntry,
  LegalDocumentType,
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

  getCatalog(): Observable<{ catalog: LegalDocumentCatalogEntry[] }> {
    return this.http.get<{ catalog: LegalDocumentCatalogEntry[] }>(`${this.apiUrl}/catalog`);
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

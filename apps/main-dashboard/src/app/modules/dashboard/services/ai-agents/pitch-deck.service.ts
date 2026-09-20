import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';
import { PitchDeckModel, PitchDeckTypeCatalog } from '../../models/pitchDeck.model';
import {
  DeliverableDocumentSummary,
  documentIdQuery,
} from '../../models/deliverable-document.model';
import { SSEService } from '../../../../shared/services/sse.service';
import { SSEStepEvent, SSEConnectionConfig } from '../../../../shared/models/sse-step.model';

/**
 * Pitch decks d'un projet. Un projet en garde plusieurs (levée de fonds, banque,
 * présentation commerciale…) : les appels par deck portent son `documentId`, et
 * l'API retient le deck le plus récent quand il est omis.
 */
@Injectable({ providedIn: 'root' })
export class PitchDeckService {
  private readonly apiUrl = `${environment.services.api.url}/project/pitchDecks`;
  private readonly http = inject(HttpClient);
  private readonly sseService = inject(SSEService);

  closeSSEConnection(): void {
    this.sseService.closeConnection('pitch-deck');
  }

  cancelGeneration(): void {
    this.sseService.cancelGeneration('pitch-deck');
  }

  generatePitchDeck(
    projectId: string,
    force = false,
    sections: string[] = [],
    documentId?: string | null,
  ): Observable<SSEStepEvent> {
    this.closeSSEConnection();
    const params = new URLSearchParams();
    if (documentId) params.set('documentId', documentId);
    if (force) params.set('force', 'true');
    if (sections.length > 0) params.set('sections', sections.join(','));
    const query = params.toString();
    const config: SSEConnectionConfig = {
      url: `${this.apiUrl}/generate/${projectId}${query ? `?${query}` : ''}`,
      keepAlive: true,
      reconnectionDelay: 1000,
    };
    return this.sseService.createConnection(config, 'pitch-deck');
  }

  /** Un deck, avec son type et ses slides attendues. */
  getPitchDeck(projectId: string, documentId?: string | null): Observable<PitchDeckModel> {
    return this.http
      .get<PitchDeckModel>(`${this.apiUrl}/${projectId}${documentIdQuery(documentId)}`)
      .pipe(
        catchError((error) => {
          console.error(`Error fetching pitch deck for ${projectId}:`, error);
          return throwError(() => error);
        }),
      );
  }

  /**
   * Types de deck proposés à la création. Le catalogue est le même pour tous et
   * ne change qu'avec un déploiement : il est mémorisé pour la session.
   */
  private typeCatalog$?: Observable<PitchDeckTypeCatalog>;

  getPitchDeckTypes(): Observable<PitchDeckTypeCatalog> {
    this.typeCatalog$ ??= this.http.get<PitchDeckTypeCatalog>(`${this.apiUrl}/types`).pipe(
      shareReplay({ bufferSize: 1, refCount: false }),
      catchError((error) => {
        // Un échec ne doit pas geler le cache : la tentative suivante repart
        // sur une vraie requête.
        this.typeCatalog$ = undefined;
        return throwError(() => error);
      }),
    );
    return this.typeCatalog$;
  }

  /** Decks du projet, en résumé (sans le HTML des slides). */
  listPitchDecks(projectId: string): Observable<DeliverableDocumentSummary[]> {
    return this.http.get<DeliverableDocumentSummary[]>(`${this.apiUrl}/${projectId}/documents`);
  }

  /** Crée un deck vide du type choisi ; la génération se lance ensuite avec son id. */
  createPitchDeck(
    projectId: string,
    body: { type: string; name?: string },
  ): Observable<DeliverableDocumentSummary> {
    return this.http.post<DeliverableDocumentSummary>(`${this.apiUrl}/${projectId}/documents`, body);
  }

  renamePitchDeck(
    projectId: string,
    documentId: string,
    name: string,
  ): Observable<DeliverableDocumentSummary> {
    return this.http.patch<DeliverableDocumentSummary>(
      `${this.apiUrl}/${projectId}/documents/${encodeURIComponent(documentId)}`,
      { name },
    );
  }

  deletePitchDeck(projectId: string, documentId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${projectId}/documents/${encodeURIComponent(documentId)}`,
    );
  }

  downloadPitchDeckPdf(projectId: string, documentId?: string | null): Observable<Blob> {
    return this.http
      .get(`${this.apiUrl}/pdf/${projectId}${documentIdQuery(documentId)}`, {
        responseType: 'blob',
        headers: { Accept: 'application/pdf' },
      })
      .pipe(
        tap(() => console.log(`Downloading pitch deck PDF for project: ${projectId}`)),
        catchError((error) => {
          if (error.status === 401) return throwError(() => new Error('User not authenticated'));
          if (error.status === 400) return throwError(() => new Error('Project ID is required'));
          if (error.status === 404) {
            const e = new Error('PDF_NOT_FOUND');
            (e as any).isRetryable = false;
            return throwError(() => e);
          }
          const generic = new Error('DOWNLOAD_ERROR');
          (generic as any).isRetryable = true;
          return throwError(() => generic);
        }),
      );
  }
}

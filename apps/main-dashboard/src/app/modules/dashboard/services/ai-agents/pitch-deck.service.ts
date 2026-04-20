import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';
import { PitchDeckModel } from '../../models/pitchDeck.model';
import { SSEService } from '../../../../shared/services/sse.service';
import { SSEStepEvent, SSEConnectionConfig } from '../../../../shared/models/sse-step.model';

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

  generatePitchDeck(projectId: string): Observable<SSEStepEvent> {
    this.closeSSEConnection();
    const config: SSEConnectionConfig = {
      url: `${this.apiUrl}/generate/${projectId}`,
      keepAlive: true,
      reconnectionDelay: 1000,
    };
    return this.sseService.createConnection(config, 'pitch-deck');
  }

  getPitchDeck(projectId: string): Observable<PitchDeckModel> {
    return this.http.get<PitchDeckModel>(`${this.apiUrl}/${projectId}`).pipe(
      catchError((error) => {
        console.error(`Error fetching pitch deck for ${projectId}:`, error);
        return throwError(() => error);
      }),
    );
  }

  deletePitchDeck(projectId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${projectId}`);
  }

  downloadPitchDeckPdf(projectId: string): Observable<Blob> {
    return this.http
      .get(`${this.apiUrl}/pdf/${projectId}`, {
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

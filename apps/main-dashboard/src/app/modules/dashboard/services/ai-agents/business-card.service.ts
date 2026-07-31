import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {
  BusinessCardExport,
  BusinessCardHolder,
  BusinessCardModel,
  BusinessCardOrientation,
  BusinessCardSide,
} from '../../models/business-card.model';

/** Client HTTP du module « cartes de visite » (`/project/business-cards`). */
@Injectable({ providedIn: 'root' })
export class BusinessCardService {
  private readonly apiUrl = `${environment.services.api.url}/project/business-cards`;
  private readonly http = inject(HttpClient);

  /** GET — template + personnes. */
  getBusinessCard(projectId: string): Observable<BusinessCardModel> {
    return this.http
      .get<BusinessCardModel>(`${this.apiUrl}/${projectId}`)
      .pipe(catchError((err) => throwError(() => err)));
  }

  /** POST — (re)génère le template IA depuis la charte graphique. */
  generateTemplate(
    projectId: string,
    options: { orientation?: BusinessCardOrientation; styleBrief?: string } = {},
  ): Observable<BusinessCardModel> {
    return this.http
      .post<BusinessCardModel>(`${this.apiUrl}/${projectId}/generate`, options)
      .pipe(catchError((err) => throwError(() => err)));
  }

  /** POST — ajoute une personne. */
  addHolder(
    projectId: string,
    holder: Omit<BusinessCardHolder, 'id'>,
  ): Observable<BusinessCardHolder> {
    return this.http
      .post<BusinessCardHolder>(`${this.apiUrl}/${projectId}/holders`, holder)
      .pipe(catchError((err) => throwError(() => err)));
  }

  /** PUT — met à jour les informations d'une personne. */
  updateHolder(
    projectId: string,
    holderId: string,
    updates: Partial<BusinessCardHolder>,
  ): Observable<BusinessCardHolder> {
    return this.http
      .put<BusinessCardHolder>(`${this.apiUrl}/${projectId}/holders/${holderId}`, updates)
      .pipe(catchError((err) => throwError(() => err)));
  }

  /** DELETE — retire une personne. */
  deleteHolder(projectId: string, holderId: string): Observable<{ message: string }> {
    return this.http
      .delete<{ message: string }>(`${this.apiUrl}/${projectId}/holders/${holderId}`)
      .pipe(catchError((err) => throwError(() => err)));
  }

  /**
   * GET — rend une face de la carte d'une personne. Le rendu est fait côté
   * serveur (Chromium) pour garantir 300 dpi, polices de marque chargées et
   * logos hébergés résolus : l'aperçu client sert l'écran, pas l'impression.
   */
  downloadCard(
    projectId: string,
    holderId: string,
    side: BusinessCardSide,
    format: BusinessCardExport,
  ): Observable<Blob> {
    return this.http
      .get(`${this.apiUrl}/${projectId}/holders/${holderId}/render`, {
        params: { side, format },
        responseType: 'blob',
        headers: { Accept: format === 'pdf' ? 'application/pdf' : 'image/png' },
      })
      .pipe(catchError((err) => throwError(() => err)));
  }
}

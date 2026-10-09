import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/** Les livrables dont le prix suit la jauge de créativité (la vidéo calcule le sien elle-même). */
export type CreativityAction = 'flyer' | 'carousel' | 'business_card' | 'pitch_deck' | 'business_plan' | 'logo_brand';

/**
 * Le prix d'un livrable au cran Low / Medium POUR CE PROJET (plein tarif la première fois,
 * révision ensuite), lu sur l'API : la jauge en déduit le prix de chaque cran avec la même
 * règle que l'API (`@idem/shared-models`), donc le prix affiché est celui qui sera débité.
 */
@Injectable({ providedIn: 'root' })
export class CreativityService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.services.api.url}/billing/creativity`;

  baseCost(projectId: string, action: CreativityAction): Observable<number | null> {
    return this.http.get<{ baseCost: number }>(`${this.apiUrl}/${projectId}`, { params: { action } }).pipe(
      map((r) => (typeof r?.baseCost === 'number' ? r.baseCost : null)),
      // Sans prix (hors ligne, ancienne API), la jauge reste utilisable, sans affichage de prix.
      catchError(() => of(null)),
    );
  }
}

import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Auth, authState } from '@angular/fire/auth';
import { Observable, throwError, from } from 'rxjs';
import { switchMap, map, take, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';
import { LandingModel } from '../../models/landing.model';

@Injectable({
  providedIn: 'root',
})
export class LandingService {
  private apiUrl = `${environment.services.api.url}/project/landings`; // Adjusted to match your backend routes

  private http = inject(HttpClient);

  constructor() {}
  /**
   * Authentication headers are now handled by the centralized auth.interceptor
   * No need for manual token management in each service
   */

  // Create a new landing item
  createLandingModel(item: LandingModel): Observable<LandingModel> {
    return this.http.post<LandingModel>(this.apiUrl, item).pipe(
      tap((response) => console.log('createLandingModel response:', response)),
      catchError((error) => {
        console.error('Error in createLandingModel:', error);
        throw error;
      })
    );
  }

  // Get all landing items
  getLandingModels(): Observable<LandingModel[]> {
    return this.http.get<LandingModel[]>(this.apiUrl).pipe(
      tap((response) => console.log('getLandingModels response:', response)),
      catchError((error) => {
        console.error('Error in getLandingModels:', error);
        throw error;
      })
    );
  }

  // Get a specific landing item by ID
  getLandingModelById(id: string): Observable<LandingModel> {
    return this.http.get<LandingModel>(`${this.apiUrl}/${id}`).pipe(
      tap((response) => console.log('getLandingModelById response:', response)),
      catchError((error) => {
        console.error(`Error in getLandingModelById for ID ${id}:`, error);
        throw error;
      })
    );
  }

  // Update a specific landing item
  updateLandingModel(
    id: string,
    item: Partial<LandingModel>
  ): Observable<LandingModel> {
    return this.http.put<LandingModel>(`${this.apiUrl}/${id}`, item).pipe(
      tap((response) => console.log('updateLandingModel response:', response)),
      catchError((error) => {
        console.error(`Error in updateLandingModel for ID ${id}:`, error);
        throw error;
      })
    );
  }

  // Delete a specific landing item
  deleteLandingModel(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap((response) =>
        console.log(`deleteLandingModel response for ID ${id}:`, response)
      ),
      catchError((error) => {
        console.error(`Error in deleteLandingModel for ID ${id}:`, error);
        throw error;
      })
    );
  }
}

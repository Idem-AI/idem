import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';

// Define a basic interface for Test items
export interface TestItem {
  id?: string;
  name: string;
  status?: string; // e.g., 'pending', 'running', 'passed', 'failed'
  // Add other properties as needed
}

@Injectable({
  providedIn: 'root',
})
export class TestingService {
  private apiUrl = `${environment.services.api.url}/project/tests`; // Placeholder API URL

  private http = inject(HttpClient);

  constructor() {}


  // Create a new test item
  createTestItem(item: TestItem): Observable<TestItem> {
    return this.http.post<TestItem>(this.apiUrl, item).pipe(
      tap(response => console.log('createTestItem response:', response)),
      catchError(error => {
        console.error('Error in createTestItem:', error);
        return throwError(() => error); // Ensure error is re-thrown
      })
    );
  }

  // Get all test items
  getTestItems(): Observable<TestItem[]> {
    return this.http.get<TestItem[]>(this.apiUrl).pipe(
      tap(response => console.log('getTestItems response:', response)),
      catchError(error => {
        console.error('Error in getTestItems:', error);
        return throwError(() => error);
      })
    );
  }

  // Get a specific test item by ID
  getTestItemById(id: string): Observable<TestItem> {
    return this.http.get<TestItem>(`${this.apiUrl}/${id}`).pipe(
      tap(response => console.log('getTestItemById response:', response)),
      catchError(error => {
        console.error(`Error in getTestItemById for ID ${id}:`, error);
        return throwError(() => error);
      })
    );
  }

  // Update a specific test item
  updateTestItem(id: string, item: Partial<TestItem>): Observable<TestItem> {
    return this.http.put<TestItem>(`${this.apiUrl}/${id}`, item).pipe(
      tap(response => console.log('updateTestItem response:', response)),
      catchError(error => {
        console.error(`Error in updateTestItem for ID ${id}:`, error);
        return throwError(() => error);
      })
    );
  }

  // Delete a specific test item
  deleteTestItem(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(response => console.log(`deleteTestItem response for ID ${id}:`, response)),
      catchError(error => {
        console.error(`Error in deleteTestItem for ID ${id}:`, error);
        return throwError(() => error);
      })
    );
  }
}

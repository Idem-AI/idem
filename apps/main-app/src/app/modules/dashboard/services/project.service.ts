import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { ProjectModel } from '../models/project.model';

@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  private apiUrl = `${environment.services.api.url}/projects`;

  private http = inject(HttpClient);

  constructor() {}

  /**
   * All authentication headers are now handled by the centralized auth.interceptor
   * No need for manual token management in each service
   */

  /**
   * Creates a new project
   * @param projectData Project data to create
   * @returns Observable of the created project ID
   */
  createProject(projectData: ProjectModel): Observable<string> {
    return this.http
      .post<{ message: string; projectId: string }>(`${this.apiUrl}/create`, projectData)
      .pipe(
        map((response) => response.projectId),
        tap((projectId) => console.log('createProject response:', projectId)),
        catchError((error) => {
          console.error('Error in createProject:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Finalize project creation - called at the end of the project creation flow
   * @param projectId Project ID
   * @param acceptanceData User acceptance flags for policies
   * @returns Observable with the finalized project
   */
  finalizeProjectCreation(
    projectId: string,
    acceptanceData: {
      privacyPolicyAccepted: boolean;
      termsOfServiceAccepted: boolean;
      betaPolicyAccepted: boolean;
      marketingAccepted: boolean;
    }
  ): Observable<any> {
    console.log('Finalizing project creation...');
    console.log('Project ID:', projectId);
    console.log('Acceptance Data:', acceptanceData);

    const finalizeUrl = `${environment.services.api.url}/project/finalize/${projectId}`;

    return this.http.post<any>(finalizeUrl, acceptanceData).pipe(
      tap((response) => console.log('finalizeProjectCreation response:', response)),
      catchError((error) => {
        console.error('Error in finalizeProjectCreation:', error);
        throw error;
      })
    );
  }

  /**
   * Gets all projects for the authenticated user
   * @returns Observable of project array
   */
  getProjects(): Observable<ProjectModel[]> {
    return this.http.get<ProjectModel[]>(`${this.apiUrl}`).pipe(
      tap((response) => console.log('getProjects response:', response)),
      catchError((error) => {
        console.error('Error in getProjects:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Gets a project by ID
   * @param projectId ID of the project to retrieve
   * @returns Observable of the project or null
   */
  getProjectById(projectId: string): Observable<ProjectModel | null> {
    return this.http.get<ProjectModel>(`${this.apiUrl}/${projectId}`).pipe(
      tap((response) => console.log(`getProjectById response for ${projectId}:`, response)),
      catchError((error) => {
        console.error(`Error in getProjectById for ${projectId}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Updates a project
   * @param projectId ID of the project to update
   * @param updatedData Partial project data to update
   * @returns Observable of the updated project
   */
  updateProject(projectId: string, updatedData: Partial<ProjectModel>): Observable<ProjectModel> {
    return this.http.put<ProjectModel>(`${this.apiUrl}/update/${projectId}`, updatedData).pipe(
      tap((response) => console.log(`updateProject response for ${projectId}:`, response)),
      catchError((error) => {
        console.error(`Error in updateProject for ${projectId}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Deletes a project by ID
   * @param projectId ID of the project to delete
   * @returns Observable of void (completed operation)
   */
  deleteProject(projectId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/delete/${projectId}`).pipe(
      tap((response) => console.log(`deleteProject response for ${projectId}:`, response)),
      catchError((error) => {
        console.error(`Error in deleteProject for ${projectId}:`, error);
        return throwError(() => error);
      })
    );
  }

  getProjectDescriptionForPrompt(project: ProjectModel) {
    const projectDescription = `
        Projet à analyser :
        - Nom du projet: ${project.name}
        - Description du projet : ${project.description}
        - Type d'application : ${project.type}
        - Contraintes techniques principales : ${project.constraints.join(', ')}
        - Composition de l'équipe : ${project.teamSize} développeurs
        - Périmètre fonctionnel couvert : ${project.scope}
        - Fourchette budgétaire prévue : ${project.budgetIntervals}
        - Publics cibles concernés : ${project.targets}
`;

    return projectDescription;
  }
}

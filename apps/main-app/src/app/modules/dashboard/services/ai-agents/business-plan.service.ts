import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';
import { BusinessPlanModel } from '../../models/businessPlan.model';
import { SSEService } from '../../../../shared/services/sse.service';
import {
  SSEStepEvent,
  SSEConnectionConfig,
} from '../../../../shared/models/sse-step.model';

@Injectable({
  providedIn: 'root',
})
export class BusinessPlanService {
  private readonly apiUrl = `${environment.services.api.url}/project/businessPlans`;
  private readonly http = inject(HttpClient);
  private readonly sseService = inject(SSEService);

  constructor() {}

  /**
   * Authentication headers are now handled by the centralized auth.interceptor
   * No need for manual token management in each service
   */

  closeSSEConnection(): void {
    this.sseService.closeConnection('business-plan');
  }

  createBusinessplanItem(
    projectId: string,
    additionalInfos?: any
  ): Observable<SSEStepEvent> {
    console.log('Starting business plan generation with SSE...', {
      projectId,
      hasAdditionalInfos: !!additionalInfos,
    });

    // Close any existing SSE connection
    this.closeSSEConnection();

    // If additional infos are provided, send them first then start SSE
    if (additionalInfos) {
      return new Observable<SSEStepEvent>((observer) => {
        // Create FormData for multipart/form-data request
        const formData = new FormData();

        // Create a copy of additionalInfos without file references for JSON
        const cleanAdditionalInfos = {
          ...additionalInfos,
          teamMembers:
            additionalInfos.teamMembers?.map((member: any) => ({
              name: member.name,
              position: member.position,
              bio: member.bio,
              email: member.email,
              socialLinks: member.socialLinks || {},
              // Don't include pictureFile and pictureUrl in JSON
            })) || [],
        };

        // Add the JSON data as a string
        formData.append(
          'additionalInfos',
          JSON.stringify(cleanAdditionalInfos)
        );

        // Add team member images
        if (additionalInfos.teamMembers) {
          additionalInfos.teamMembers.forEach((member: any, index: number) => {
            if (member.pictureFile && member.pictureFile instanceof File) {
              formData.append(
                `teamMemberImage_${index}`,
                member.pictureFile,
                member.pictureFile.name
              );
            }
          });
        }

        console.log('Sending multipart data:', {
          additionalInfosJson: cleanAdditionalInfos,
          imageCount:
            additionalInfos.teamMembers?.filter((m: any) => m.pictureFile)
              .length || 0,
        });

        // Send multipart data to backend
        this.http
          .post(`${this.apiUrl}/set-additional-info/${projectId}`, formData)
          .subscribe({
            next: () => {
              console.log(
                'Additional info sent successfully, starting SSE generation...'
              );

              // Now start the SSE generation with additional info flag
              const config: SSEConnectionConfig = {
                url: `${this.apiUrl}/generate/${projectId}?withAdditionalInfo=true`,
                keepAlive: true,
                reconnectionDelay: 1000,
              };

              this.sseService
                .createConnection(config, 'business-plan')
                .subscribe({
                  next: (event) => observer.next(event),
                  error: (error) => observer.error(error),
                  complete: () => observer.complete(),
                });
            },
            error: (error) => {
              console.error('Error sending additional info:', error);
              observer.error(error);
            },
          });
      });
    } else {
      // Standard generation without additional info
      const config: SSEConnectionConfig = {
        url: `${this.apiUrl}/generate/${projectId}`,
        keepAlive: true,
        reconnectionDelay: 1000,
      };

      return this.sseService.createConnection(config, 'business-plan');
    }
  }

  cancelGeneration(): void {
    this.sseService.cancelGeneration('business-plan');
  }
  getBusinessplanItems(projectId?: string): Observable<BusinessPlanModel> {
    return this.http.get<BusinessPlanModel>(`${this.apiUrl}/${projectId}`).pipe(
      tap((response) =>
        console.log('getBusinessplanItems response:', response)
      ),
      catchError((error) => {
        console.error('Error in getBusinessplanItems:', error);
        throw error;
      })
    );
  }

  getBusinessplanItemById(id: string): Observable<BusinessPlanModel> {
    return this.http.get<BusinessPlanModel>(`${this.apiUrl}/${id}`).pipe(
      tap((response) =>
        console.log('getBusinessplanItemById response:', response)
      ),
      catchError((error) => {
        console.error(`Error in getBusinessplanItemById for ID ${id}:`, error);
        throw error;
      })
    );
  }

  getBusinessplanItem(
    projectId: string,
    businessplanId: string
  ): Observable<BusinessPlanModel> {
    return this.http
      .get<BusinessPlanModel>(`${this.apiUrl}/${projectId}/${businessplanId}`)
      .pipe(
        tap((response) =>
          console.log('getBusinessplanItem response:', response)
        ),
        catchError((error) => {
          console.error(
            `Error in getBusinessplanItem for ID ${businessplanId}:`,
            error
          );
          throw error;
        })
      );
  }

  updateBusinessplanItem(
    id: string,
    item: Partial<BusinessPlanModel>
  ): Observable<BusinessPlanModel> {
    return this.http.put<BusinessPlanModel>(`${this.apiUrl}/${id}`, item).pipe(
      tap((response) =>
        console.log('updateBusinessplanItem response:', response)
      ),
      catchError((error) => {
        console.error(`Error in updateBusinessplanItem for ID ${id}:`, error);
        throw error;
      })
    );
  }

  // Delete a specific project businessplan item
  deleteBusinessplanItem(
    projectId: string,
    businessplanId: string
  ): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/${projectId}/${businessplanId}`)
      .pipe(
        tap((response) =>
          console.log(
            `deleteBusinessplanItem response for ID ${businessplanId}:`,
            response
          )
        ),
        catchError((error) => {
          console.error(
            `Error in deleteBusinessplanItem for ID ${businessplanId}:`,
            error
          );
          throw error;
        })
      );
  }

  /**
   * Download business plan PDF from backend
   * @param projectId Project ID
   * @returns Observable with blob data for PDF download
   */
  downloadBusinessPlanPdf(projectId: string): Observable<Blob> {
    const pdfUrl = `${this.apiUrl}/pdf/${projectId}`;

    return this.http
      .get(pdfUrl, {
        responseType: 'blob',
        headers: {
          Accept: 'application/pdf',
        },
      })
      .pipe(
        tap(() =>
          console.log(`Downloading business plan PDF for project: ${projectId}`)
        ),
        catchError((error) => {
          console.error(
            `Error downloading business plan PDF for project ${projectId}:`,
            error
          );

          // Handle specific error cases
          if (error.status === 401) {
            return throwError(() => new Error('User not authenticated'));
          } else if (error.status === 400) {
            return throwError(() => new Error('Project ID is required'));
          } else if (error.status === 404) {
            return throwError(() => {
              const notFoundError = new Error('PDF_NOT_FOUND');
              (notFoundError as any).isRetryable = false;
              return notFoundError;
            });
          } else if (error.status === 500) {
            return throwError(
              () =>
                new Error(
                  'Error generating business plan PDF - project not found or no business plan sections available'
                )
            );
          }

          // Generic error - also retryable
          return throwError(() => {
            const genericError = new Error('DOWNLOAD_ERROR');
            (genericError as any).isRetryable = true;
            return genericError;
          });
        })
      );
  }
}

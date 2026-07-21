import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap, timeout, retry } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';
import { BrandIdentityModel, ColorModel, TypographyModel } from '../../models/brand-identity.model';
import { ProjectModel } from '@idem/shared-models';
import { LogoModel, LogoPreferencesModel } from '../../models/logo.model';
import { SSEService } from '../../../../shared/services/sse.service';
import { SSEStepEvent, SSEConnectionConfig } from '../../../../shared/models/sse-step.model';

@Injectable({
  providedIn: 'root',
})
export class BrandingService {
  private readonly apiUrl = `${environment.services.api.url}/project/brandings`;
  private readonly http = inject(HttpClient);
  private readonly sseService = inject(SSEService);

  constructor() {}

  /**
   * Authentication headers are now handled by the centralized auth.interceptor
   * No need for manual token management in each service
   */

  /**
   * Close SSE connection
   */
  closeSSEConnection(): void {
    this.sseService.closeConnection('branding');
  }

  /**
   * Create a new branding item using Server-Sent Events for real-time updates
   * @param projectId Project ID
   * @param pdfFormat PDF format (A4_PORTRAIT or SLIDE_16_9)
   * @returns Observable with SSE events
   */
  createBrandIdentityModel(
    projectId: string,
    pdfFormat: string = 'SLIDE_16_9',
    force = false,
    sections: string[] = [],
  ): Observable<SSEStepEvent> {
    console.log('Starting branding generation with SSE and format:', pdfFormat);

    // Close any existing SSE connection
    this.closeSSEConnection();

    const params = new URLSearchParams();
    params.set('format', pdfFormat);
    if (force) params.set('force', 'true');
    if (sections.length > 0) params.set('sections', sections.join(','));

    const config: SSEConnectionConfig = {
      url: `${this.apiUrl}/generate/${projectId}?${params.toString()}`,
      keepAlive: true,
      reconnectionDelay: 1000,
    };

    return this.sseService.createConnection(config, 'branding');
  }

  /**
   * Cancel ongoing SSE connection
   */
  cancelGeneration(): void {
    this.sseService.cancelGeneration('branding');
  }

  /**
   * Génération streamée des concepts de logo (SSE) avec boucle qualité :
   * l'API pousse chaque étape en temps réel — concept généré, remarques de
   * l'agent critique, révision, finalisation.
   * stepName des événements : concept_started, concept_generated,
   * critique_started, critique_result, revision_started, concept_updated,
   * concept_finalized, concept_cancelled, concept_error.
   */
  generateLogoConceptsStream(
    projectId: string,
    force = false,
    preferences?: LogoPreferencesModel | null,
  ): Observable<SSEStepEvent> {
    this.sseService.closeConnection('logo');

    // Les préférences voyagent en query : le formulaire local peut ne pas être
    // encore persisté côté projet au moment où le flux démarre.
    const params = new URLSearchParams();
    if (force) params.set('force', 'true');
    if (preferences?.type) {
      params.set('prefType', preferences.type);
      if (preferences.customDescription) {
        params.set('prefDesc', preferences.customDescription.slice(0, 800));
      }
    }
    const query = params.toString();

    const config: SSEConnectionConfig = {
      url: `${this.apiUrl}/generate/logo-concepts-stream/${projectId}${query ? `?${query}` : ''}`,
      keepAlive: true,
      reconnectionDelay: 1000,
    };

    return this.sseService.createConnection(config, 'logo');
  }

  /**
   * Annule la génération de logos en cours côté serveur (économie de tokens
   * quand l'utilisateur a déjà sélectionné un logo) et ferme le flux SSE.
   */
  cancelLogoConceptsGeneration(projectId: string): Observable<{ success: boolean; cancelled: boolean }> {
    this.sseService.closeConnection('logo');
    return this.http
      .post<{ success: boolean; cancelled: boolean }>(
        `${this.apiUrl}/generate/logo-concepts-cancel/${projectId}`,
        {},
      )
      .pipe(
        catchError((error) => {
          console.error('Error cancelling logo generation:', error);
          return throwError(() => error);
        }),
      );
  }

  /** Ferme le flux SSE de génération de logos sans annuler côté serveur */
  closeLogoConceptsStream(): void {
    this.sseService.closeConnection('logo');
  }

  /**
   * Génération streamée des déclinaisons du logo sélectionné (SSE) avec boucle
   * qualité. stepName des événements : variation_started, variation_generated,
   * critique_started, critique_result, revision_started, variation_updated,
   * variation_finalized, variation_cancelled, variation_error.
   * Le logo sélectionné est lu depuis le projet côté API.
   */
  generateLogoVariationsStream(projectId: string, force = false): Observable<SSEStepEvent> {
    this.sseService.closeConnection('logo-variations');

    const config: SSEConnectionConfig = {
      url: `${this.apiUrl}/generate/logo-variations-stream/${projectId}${force ? '?force=true' : ''}`,
      keepAlive: true,
      reconnectionDelay: 1000,
    };

    return this.sseService.createConnection(config, 'logo-variations');
  }

  /** Ferme le flux SSE des déclinaisons ; le serveur annule à la déconnexion */
  closeLogoVariationsStream(): void {
    this.sseService.closeConnection('logo-variations');
  }

  generateColorsAndTypography(project: ProjectModel): Observable<{
    colors: ColorModel[];
    typography: TypographyModel[];
    project: ProjectModel;
  }> {
    console.log('Generating colors and typography...');
    console.log('Project:', project);
    return this.http
      .post<{
        colors: ColorModel[];
        typography: TypographyModel[];
        project: ProjectModel;
      }>(`${this.apiUrl}/generate/colors-typography`, { project })
      .pipe(
        tap((response) => console.log('generateColorsAndTypography response:', response)),
        catchError((error) => {
          console.error('Error in generateColorsAndTypography:', error);
          throw error;
        }),
      );
  }

  /**
   * Generate colors and typography based on an imported logo's extracted colors.
   * Primary colors come from the logo; AI proposes complementary secondary/accent/background/text.
   */
  generateColorsAndTypographyFromLogo(
    project: ProjectModel,
    logoSvg: string,
    logoColors: string[],
  ): Observable<{
    colors: ColorModel[];
    typography: TypographyModel[];
    project: ProjectModel;
  }> {
    console.log('Generating colors and typography from imported logo...');
    return this.http
      .post<{
        colors: ColorModel[];
        typography: TypographyModel[];
        project: ProjectModel;
      }>(`${this.apiUrl}/generate/colors-typography-from-logo`, {
        project,
        logoSvg,
        logoColors,
      })
      .pipe(
        tap((response) => console.log('generateColorsAndTypographyFromLogo response:', response)),
        catchError((error) => {
          console.error('Error in generateColorsAndTypographyFromLogo:', error);
          throw error;
        }),
      );
  }

  /**
   * Generate logos with user preferences (type and custom description)
   */
  generateLogosWithPreferences(
    projectId: string,
    selectedColor: ColorModel,
    selectedTypography: TypographyModel,
    preferences: LogoPreferencesModel,
    force = false,
  ): Observable<{
    logos: LogoModel[];
  }> {
    console.log('Generating logo concepts with preferences...');
    console.log('Project ID:', projectId);
    console.log('Selected Color:', selectedColor);
    console.log('Selected Typography:', selectedTypography);
    console.log('Preferences:', preferences);
    return this.http
      .post<{
        logos: LogoModel[];
      }>(`${this.apiUrl}/generate/logo-concepts/${projectId}${force ? '?force=true' : ''}`, {})
      .pipe(
        timeout(180000), // 3 minutes timeout
        retry(1), // retry once on transient network or CORS error
        tap((response) => console.log('generateLogosWithPreferences response:', response)),
        catchError((error) => {
          console.error('Error in generateLogosWithPreferences:', error);
          throw error;
        }),
      );
  }

  /**
   * Step 2: Generate variations (without text, light/dark/mono) for selected logo
   * Called only when user selects a specific logo concept
   */
  generateLogoVariations(
    selectedLogo: LogoModel,
    project: ProjectModel,
    force = false,
  ): Observable<{
    variations: {
      withText?: {
        lightBackground?: string;
        darkBackground?: string;
        monochrome?: string;
      };
      iconOnly?: {
        lightBackground?: string;
        darkBackground?: string;
        monochrome?: string;
      };
    };
  }> {
    console.log('Generating logo variations for selected logo...');
    console.log('Selected Logo:', selectedLogo.id);
    console.log('Project:', project);
    return this.http
      .post<{
        variations: {
          withText?: {
            lightBackground?: string;
            darkBackground?: string;
            monochrome?: string;
          };
          iconOnly?: {
            lightBackground?: string;
            darkBackground?: string;
            monochrome?: string;
          };
        };
      }>(`${this.apiUrl}/generate/logo-variations/${project.id}${force ? '?force=true' : ''}`, {
        selectedLogo: selectedLogo,
      })
      .pipe(
        timeout(180000), // 3 minutes timeout
        retry(1), // retry once
        tap((response) => console.log('generateLogoVariations response:', response)),
        catchError((error) => {
          console.error('Error in generateLogoVariations:', error);
          throw error;
        }),
      );
  }

  /**
   * Edit selected logo with modification prompt
   */
  editLogo(
    projectId: string,
    logosvg: string,
    modificationPrompt: string,
  ): Observable<{ logo: LogoModel }> {
    console.log('Editing logo with prompt...');
    console.log('Project ID:', projectId);

    console.log('Modification Prompt:', modificationPrompt);
    return this.http
      .post<{ logo: LogoModel }>(`${this.apiUrl}/edit-logo/${projectId}`, {
        logosvg: logosvg,
        modificationPrompt: modificationPrompt,
      })
      .pipe(
        timeout(180000), // 3 minutes timeout
        retry(1), // retry once
        tap((response) => console.log('editLogo response:', response)),
        catchError((error) => {
          console.error('Error in editLogo:', error);
          throw error;
        }),
      );
  }

  /**
   * Download branding PDF from backend
   * @param projectId Project ID
   * @returns Observable with blob data for PDF download
   */
  downloadBrandingPdf(projectId: string): Observable<Blob> {
    const pdfUrl = `${this.apiUrl}/pdf/${projectId}`;

    return this.http
      .get(pdfUrl, {
        responseType: 'blob',
        headers: {
          Accept: 'application/pdf',
        },
      })
      .pipe(
        tap(() => console.log(`Downloading branding PDF for project: ${projectId}`)),
        catchError((error) => {
          console.error(`Error downloading branding PDF for project ${projectId}:`, error);

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
                  'Error generating branding PDF - project not found or no branding sections available',
                ),
            );
          }

          // Generic error - also retryable
          return throwError(() => {
            const genericError = new Error('DOWNLOAD_ERROR');
            (genericError as any).isRetryable = true;
            return genericError;
          });
        }),
      );
  }

  /**
   * Download all logo variations as a ZIP file
   * @param projectId Project ID
   * @param extension File extension (svg, png, psd)
   * @returns Observable with blob data for ZIP download
   */
  downloadLogosZip(projectId: string, extension: string): Observable<Blob> {
    const zipUrl = `${this.apiUrl}/logos-zip/${projectId}/${extension}`;

    return this.http
      .get(zipUrl, {
        responseType: 'blob',
        headers: {
          Accept: 'application/zip',
        },
      })
      .pipe(
        tap(() => console.log(`Downloading logos ZIP for project: ${projectId}`)),
        catchError((error) => {
          console.error(`Error downloading logos ZIP for project ${projectId}:`, error);

          // Handle specific error cases
          if (error.status === 401) {
            return throwError(() => new Error('User not authenticated'));
          } else if (error.status === 400) {
            return throwError(() => new Error('Project ID is required'));
          } else if (error.status === 404) {
            return throwError(() => {
              const notFoundError = new Error('LOGOS_NOT_FOUND');
              (notFoundError as any).isRetryable = false;
              return notFoundError;
            });
          } else if (error.status === 500) {
            return throwError(
              () =>
                new Error(
                  'Error generating logos ZIP - project not found or no logo variations available',
                ),
            );
          }

          // Generic error - also retryable
          return throwError(() => {
            const genericError = new Error('DOWNLOAD_ERROR');
            (genericError as any).isRetryable = true;
            return genericError;
          });
        }),
      );
  }
}

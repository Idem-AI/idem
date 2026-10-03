import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';
import {
  DevelopmentConfigsModel,
  QuickGenerationPreset,
  GenerationType,
  LandingPageConfig,
  AppPlatform,
} from '../../models/development.model';
import { ProjectModel } from '@idem/shared-models';

// Define a basic interface for Development items
export interface DevelopmentItem {
  id?: string;
  taskName: string;
  status?: string;
  // Add other properties as needed
}

@Injectable({
  providedIn: 'root',
})
export class DevelopmentService {
  private apiUrl = `${environment.services.api.url}/project/developments`;

  private http = inject(HttpClient);

  constructor() {}

  /**
   * La pile unique d'une application complète.
   *
   * IDEM la choisit pour l'utilisateur : c'est exactement ce que le guide
   * « application 3 tiers » d'iDeploy sait mettre en ligne et relier tout seul
   * (PostgreSQL → `DATABASE_URL` du serveur → `VITE_API_URL` de l'interface).
   * Une autre pile obligerait l'utilisateur à câbler lui-même ce que le guide
   * fait pour lui.
   */
  getQuickGenerationPresets(): QuickGenerationPreset[] {
    return [
      {
        name: 'React + Express + PostgreSQL',
        description:
          'React (Vite) interface, Express API with plain SQL, PostgreSQL database (PGlite in the preview, created and connected by iDeploy online)',
        frontend: {
          framework: 'React',
          styling: ['Tailwind CSS'],
          features: ['Routing', 'State Management', 'Component Library'],
        },
        backend: {
          language: 'Node.js',
          framework: 'Express',
          apiType: 'REST API',
          features: ['Authentication', 'Authorization', 'Documentation'],
        },
        database: {
          type: 'PostgreSQL',
          provider: 'PostgreSQL',
          features: ['Migrations', 'Seeders'],
        },
      },
    ];
  }

  /**
   * Configuration d'un site vitrine, d'une application complète, ou des deux.
   *
   * `landing` est un site seul ; `app` une application (interface + serveur +
   * base de données) ; `both` les deux, construits séparément. Le plan de
   * l'application est recommandé, pas obligatoire.
   */
  generateQuickConfig(
    generationType: GenerationType,
    appPlatform: AppPlatform = 'web',
  ): DevelopmentConfigsModel {
    const preset = this.getQuickGenerationPresets()[0];
    const isLanding = generationType === 'landing';
    // `both` : un site vitrine ET une application, chacun dans son atelier iCode.
    const landingPageConfig = isLanding
      ? LandingPageConfig.ONLY_LANDING
      : generationType === 'both'
        ? LandingPageConfig.SEPARATE
        : LandingPageConfig.NONE;

    return {
      mode: 'quick',
      generationType,
      appPlatform,
      preset: preset.name,
      constraints: isLanding
        ? ['Generate a landing page', 'Implement responsive design']
        : appPlatform === 'mobile'
          ? [
              'Generate a mobile application laid out for a phone (bottom tab bar)',
              'Installable as a PWA; packaged for Android and iOS with Capacitor',
            ]
          : [
              'Generate a complete web application: frontend, backend and database',
              'The backend reads DATABASE_URL and PORT; the frontend reads VITE_API_URL',
            ],
      frontend: {
        framework: preset.frontend.framework,
        styling: preset.frontend.styling,
        stateManagement: 'Zustand',
        features: {
          routing: true,
          componentLibrary: false,
          testing: false,
          pwa: false,
          seo: true,
        },
      },
      backend: {
        language: preset.backend.language,
        framework: preset.backend.framework,
        apiType: preset.backend.apiType,
        // SQL direct (pg en ligne, PGlite dans l'aperçu) : un ORM à moteur natif ne
        // tourne pas dans l'aperçu d'iCode.
        orm: 'SQL (pg / PGlite)',
        features: {
          authentication: !isLanding,
          authorization: !isLanding,
          documentation: false,
          testing: false,
          logging: true,
        },
      },
      database: {
        type: preset.database.type,
        provider: preset.database.provider,
        // SQL direct (pg en ligne, PGlite dans l'aperçu) : un ORM à moteur natif ne
        // tourne pas dans l'aperçu d'iCode.
        orm: 'SQL (pg / PGlite)',
        features: {
          migrations: !isLanding,
          seeders: !isLanding,
          caching: false,
          replication: false,
        },
      },
      landingPageConfig,
      projectConfig: {
        seoEnabled: true,
        contactFormEnabled: isLanding,
        analyticsEnabled: true,
        i18nEnabled: false,
        performanceOptimized: true,
        authentication: !isLanding,
        authorization: !isLanding,
        paymentIntegration: false,
        customOptions: {
          generationType,
          preset: preset.name,
        },
      },
    };
  }

  /**
   * Authentication headers are now handled by the centralized auth.interceptor
   * No need for manual token management in each service
   */

  // Save development configurations
  saveDevelopmentConfigs(
    developmentConfigs: DevelopmentConfigsModel,
    projectId: string,
    generationType?: GenerationType,
  ): Observable<ProjectModel> {
    const payload = {
      developmentConfigs,
      projectId,
      ...(generationType && { generation: generationType }),
    };

    return this.http.post<ProjectModel>(`${this.apiUrl}/configs`, payload);
  }

  // Create a new development item
  createDevelopmentItem(item: DevelopmentItem): Observable<DevelopmentItem> {
    return this.http.post<DevelopmentItem>(this.apiUrl, item).pipe(
      tap((response) => console.log('createDevelopmentItem response:', response)),
      catchError((error) => {
        console.error('Error in saveDevelopmentConfigs:', error);
        throw error;
      }),
    );
  }

  // Get the development configurations for a specific project
  getDevelopmentConfigs(projectId: string): Observable<DevelopmentConfigsModel | null> {
    return this.http.get<DevelopmentConfigsModel>(`${this.apiUrl}/configs/${projectId}`).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Error in getDevelopmentConfigs:', error);
        throw error;
      }),
    );
  }

  // Get a specific development item by ID
  getDevelopmentItemById(id: string): Observable<DevelopmentItem> {
    return this.http.get<DevelopmentItem>(`${this.apiUrl}/${id}`).pipe(
      tap((response) => console.log('getDevelopmentItemById response:', response)),
      catchError((error) => {
        console.error(`Error in getDevelopmentItemById for ID ${id}:`, error);
        throw error;
      }),
    );
  }

  // Update a specific development item
  updateDevelopmentItem(id: string, item: Partial<DevelopmentItem>): Observable<DevelopmentItem> {
    return this.http.put<DevelopmentItem>(`${this.apiUrl}/${id}`, item).pipe(
      tap((response) => console.log('updateDevelopmentItem response:', response)),
      catchError((error) => {
        console.error(`Error in updateDevelopmentItem for ID ${id}:`, error);
        throw error;
      }),
    );
  }

  // Delete a specific development item
  deleteDevelopmentItem(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap((response) => console.log(`deleteDevelopmentItem response for ID ${id}:`, response)),
      catchError((error) => {
        console.error(`Error in deleteDevelopmentItem for ID ${id}:`, error);
        throw error;
      }),
    );
  }
}

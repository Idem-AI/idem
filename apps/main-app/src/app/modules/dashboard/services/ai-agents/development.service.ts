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
} from '../../models/development.model';
import { ProjectModel } from '../../models/project.model';

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
   * Get quick generation presets
   */
  getQuickGenerationPresets(): QuickGenerationPreset[] {
    return [
      {
        name: 'React + Express + Supabase',
        description:
          'Modern full-stack setup with React frontend, Express.js backend, and Supabase database',
        frontend: {
          framework: 'React',
          styling: ['Tailwind CSS', 'CSS Modules'],
          features: ['Routing', 'State Management', 'Component Library'],
        },
        backend: {
          language: 'JavaScript',
          framework: 'Express.js',
          apiType: 'REST API',
          features: ['Authentication', 'Authorization', 'Documentation'],
        },
        database: {
          type: 'PostgreSQL',
          provider: 'Supabase',
          features: ['Real-time subscriptions', 'Authentication', 'Storage'],
        },
      },
    ];
  }

  /**
   * Generate quick development configuration based on preset and generation type
   */
  generateQuickConfig(generationType: GenerationType): DevelopmentConfigsModel {
    const preset = this.getQuickGenerationPresets()[0]; // React + Express + Supabase

    // Set landing page configuration based on generation type
    let landingPageConfig: LandingPageConfig;
    switch (generationType) {
      case 'landing':
        landingPageConfig = LandingPageConfig.ONLY_LANDING;
        break;
      case 'integrated':
        landingPageConfig = LandingPageConfig.INTEGRATED;
        break;
      case 'both':
        landingPageConfig = LandingPageConfig.SEPARATE;
        break;
      case 'app':
      default:
        landingPageConfig = LandingPageConfig.NONE;
        break;
    }

    const hasLandingPage = landingPageConfig !== LandingPageConfig.NONE;

    return {
      mode: 'quick',
      generationType,
      preset: preset.name,
      constraints: [
        `Generate a ${
          generationType === 'landing'
            ? 'landing page'
            : generationType === 'app'
              ? 'web application'
              : 'landing page with web application'
        }`,
        'Use modern development practices',
        'Implement responsive design',
        'Include proper error handling',
      ],
      frontend: {
        framework: preset.frontend.framework,
        frameworkVersion: '18.0.0',
        frameworkIconUrl: '/assets/icons/react.svg',
        styling: preset.frontend.styling,
        stateManagement: 'Redux Toolkit',
        features: {
          routing: true,
          componentLibrary: true,
          testing: true,
          pwa: generationType !== 'landing',
          seo: true,
        },
      },
      backend: {
        language: preset.backend.language,
        languageVersion: '18.0.0',
        languageIconUrl: '/assets/icons/nodejs.svg',
        framework: preset.backend.framework,
        frameworkVersion: '4.18.0',
        frameworkIconUrl: '/assets/icons/express.svg',
        apiType: preset.backend.apiType,
        apiVersion: '1.0.0',
        apiIconUrl: '/assets/icons/rest.svg',
        orm: 'Prisma',
        ormVersion: '5.0.0',
        ormIconUrl: '/assets/icons/prisma.svg',
        features: {
          authentication: true,
          authorization: true,
          documentation: true,
          testing: true,
          logging: true,
        },
      },
      database: {
        type: preset.database.type,
        typeVersion: '15.0',
        typeIconUrl: '/assets/icons/postgresql.svg',
        provider: preset.database.provider,
        providerVersion: '2.0.0',
        providerIconUrl: '/assets/icons/supabase.svg',
        features: {
          realTimeSubscriptions: true,
          authentication: true,
          storage: true,
          edgeFunctions: true,
          vectorSearch: false,
        },
      },
      landingPageConfig,
      landingPage: hasLandingPage
        ? {
            url: '',
            codeUrl: '',
          }
        : undefined,
      projectConfig: {
        seoEnabled: true,
        contactFormEnabled: generationType !== 'app',
        analyticsEnabled: true,
        i18nEnabled: false,
        performanceOptimized: true,
        authentication: true,
        authorization: true,
        paymentIntegration: generationType === 'app',
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
    generationType?: GenerationType
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
      })
    );
  }

  // Get the development configurations for a specific project
  getDevelopmentConfigs(projectId: string): Observable<DevelopmentConfigsModel | null> {
    return this.http.get<DevelopmentConfigsModel>(`${this.apiUrl}/configs/${projectId}`).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Error in getDevelopmentConfigs:', error);
        throw error;
      })
    );
  }

  // Get a specific development item by ID
  getDevelopmentItemById(id: string): Observable<DevelopmentItem> {
    return this.http.get<DevelopmentItem>(`${this.apiUrl}/${id}`).pipe(
      tap((response) => console.log('getDevelopmentItemById response:', response)),
      catchError((error) => {
        console.error(`Error in getDevelopmentItemById for ID ${id}:`, error);
        throw error;
      })
    );
  }

  // Update a specific development item
  updateDevelopmentItem(id: string, item: Partial<DevelopmentItem>): Observable<DevelopmentItem> {
    return this.http.put<DevelopmentItem>(`${this.apiUrl}/${id}`, item).pipe(
      tap((response) => console.log('updateDevelopmentItem response:', response)),
      catchError((error) => {
        console.error(`Error in updateDevelopmentItem for ID ${id}:`, error);
        throw error;
      })
    );
  }

  // Delete a specific development item
  deleteDevelopmentItem(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap((response) => console.log(`deleteDevelopmentItem response for ID ${id}:`, response)),
      catchError((error) => {
        console.error(`Error in deleteDevelopmentItem for ID ${id}:`, error);
        throw error;
      })
    );
  }
}

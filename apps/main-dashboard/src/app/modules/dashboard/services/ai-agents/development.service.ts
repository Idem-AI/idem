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
          'React (Vite) interface, Node.js Express API with Prisma, PostgreSQL database hosted on iDeploy',
        frontend: {
          framework: 'React',
          styling: ['Tailwind CSS'],
          features: ['Routing', 'State Management', 'Component Library'],
        },
        backend: {
          language: 'TypeScript',
          framework: 'Express.js',
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
   * Configuration d'un site vitrine ou d'une application complète.
   *
   * `landing` reste un site seul ; tout le reste est une application complète
   * (interface + serveur + base de données) dont le plan doit exister avant la
   * génération.
   */
  generateQuickConfig(generationType: GenerationType): DevelopmentConfigsModel {
    const preset = this.getQuickGenerationPresets()[0];
    const isLanding = generationType === 'landing';
    const landingPageConfig = isLanding ? LandingPageConfig.ONLY_LANDING : LandingPageConfig.NONE;

    return {
      mode: 'quick',
      generationType,
      preset: preset.name,
      constraints: isLanding
        ? ['Generate a landing page', 'Implement responsive design']
        : [
            'Generate a complete web application: frontend, backend and database',
            'Follow the application plan (diagrams) generated for this project',
            'frontend/ and backend/ live side by side in one repository',
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
        orm: 'Prisma',
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
        orm: 'Prisma',
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

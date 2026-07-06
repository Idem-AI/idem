import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { DevelopmentService } from '../../../services/ai-agents/development.service';
import { DevelopmentConfigsModel, LandingPageConfig } from '../../../models/development.model';
import { CookieService } from '../../../../../shared/services/cookie.service';
import { catchError, finalize, of, tap } from 'rxjs';
import { Loader } from 'apps/main-dashboard/src/app/shared/components/loader/loader';
import { BrandingValidationService } from '../../../services/branding-validation.service';
import { IncompleteProjectBannerComponent } from '../../../components/incomplete-project-banner/incomplete-project-banner';
import { ProjectService } from '../../../services/project.service';
import { ProjectModel } from '@idem/shared-models';

import { environment } from '../../../../../../environments/environment';

@Component({
  selector: 'app-show-development',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, Loader, IncompleteProjectBannerComponent],
  templateUrl: './show-development.html',
  styleUrls: ['./show-development.css'],
})
export class ShowDevelopment implements OnInit {
  // Services
  private readonly developmentService = inject(DevelopmentService);
  private readonly cookieService = inject(CookieService);
  private readonly brandingValidation = inject(BrandingValidationService);
  private readonly projectService = inject(ProjectService);

  // State management using signals
  protected readonly developmentConfigs = signal<DevelopmentConfigsModel | null>(null);
  protected readonly loading = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);
  protected readonly projectId = signal<string>('');

  // Branding validation
  protected readonly isBrandingComplete = signal<boolean>(false);
  protected readonly brandingMissingElements = signal<string[]>([]);
  protected readonly project = signal<ProjectModel | null>(null);
  protected readonly router = inject(Router);
  protected readonly webgenUrl = environment.services.webgen.url;

  // Computed signals to optimize template access
  protected readonly configs = computed(() => this.developmentConfigs());
  protected readonly hasConfigs = computed(() => this.developmentConfigs() !== null);
  protected readonly frontend = computed(() => this.developmentConfigs()?.frontend);
  protected readonly backend = computed(() => this.developmentConfigs()?.backend);
  protected readonly database = computed(() => this.developmentConfigs()?.database);
  protected readonly projectConfig = computed(() => this.developmentConfigs()?.projectConfig);
  protected readonly constraints = computed(() => this.developmentConfigs()?.constraints);
  protected readonly isLandingPageOnly = computed(
    () => this.developmentConfigs()?.landingPageConfig === LandingPageConfig.ONLY_LANDING,
  );

  /**
   * Redirects to the web generator application with the project ID
   * @param projectId The ID of the project to generate
   */
  protected redirectToWebGenerator(projectId: string): void {
    const generatorUrl = `${this.webgenUrl}?projectId=${projectId}`;
    window.location.href = generatorUrl;
  }
  ngOnInit(): void {
    const storedProjectId = this.cookieService.get('projectId');
    if (storedProjectId) {
      this.projectId.set(storedProjectId);
      this.checkBrandingCompletion(storedProjectId);
    } else {
      this.error.set('No project ID found. Please select a project first.');
    }
  }

  /**
   * Check if project branding is complete before loading content
   */
  private checkBrandingCompletion(projectId: string): void {
    this.loading.set(true);
    this.projectService.getProjectById(projectId).subscribe({
      next: (project) => {
        this.project.set(project);
        const { isComplete, missingElements } =
          this.brandingValidation.checkBrandingCompletion(project);

        this.isBrandingComplete.set(isComplete);
        this.brandingMissingElements.set(missingElements);

        // Only load development configs if branding is complete
        if (isComplete) {
          this.fetchDevelopmentConfigs(projectId);
        } else {
          this.loading.set(false);
        }
      },
      error: (error) => {
        console.error('Error checking branding completion:', error);
        this.loading.set(false);
        this.error.set('Erreur lors de la vérification du projet');
      },
    });
  }

  private fetchDevelopmentConfigs(projectId: string): void {
    this.loading.set(true);
    this.error.set(null);

    console.log('Fetching development configs for project:', projectId);

    this.developmentService
      .getDevelopmentConfigs(projectId)
      .pipe(
        tap((configs: DevelopmentConfigsModel | null) => {
          console.log('Development configs received:', configs);
          if (configs !== null) {
            this.developmentConfigs.set(configs);
          } else {
            this.error.set('No development configurations found for this project.');
            this.router.navigate(['/project/development/create']);
          }
        }),
        catchError((err) => {
          console.error('Error fetching development configs:', err);
          this.error.set('Failed to load development configurations. Please try again.');
          return of(null);
        }),
        finalize(() => {
          this.loading.set(false);
          console.log('Development configs fetch completed');
        }),
      )
      .subscribe();
  }

  protected openApplication(): void {
    // This would typically open the application in a new tab
    // For now, we'll just redirect to a placeholder URL
    const appUrl = `/preview/app/${this.projectId()}`;
    window.open(appUrl, '_blank');
  }

  protected getFeaturesList(
    features: string[] | string | Record<string, boolean | undefined>,
  ): string {
    if (!features) return 'None';

    if (typeof features === 'string') {
      return features;
    } else if (Array.isArray(features)) {
      return features.length > 0 ? features.join(', ') : 'None';
    } else {
      const enabledFeatures = Object.entries(features)
        .filter(([_, enabled]) => enabled)
        .map(([name, _]) => name);
      return enabledFeatures.length > 0 ? enabledFeatures.join(', ') : 'None';
    }
  }

  /**
   * Safely gets object keys from a features object
   */
  protected getObjectKeys(features: any): string[] {
    if (features && typeof features === 'object' && !Array.isArray(features)) {
      return Object.keys(features);
    }
    return [];
  }

  /**
   * Checks if a specific feature is enabled in a features object
   */
  protected isFeatureEnabled(features: any, featureName: string): boolean {
    if (features && typeof features === 'object' && !Array.isArray(features)) {
      return !!features[featureName];
    }
    return false;
  }

  /**
   * Checks if features is an array
   */
  protected isFeatureArray(features: any): boolean {
    return Array.isArray(features);
  }

  /**
   * Safely gets features array
   */
  protected getFeatureArray(features: any): string[] {
    if (Array.isArray(features)) {
      return features as string[];
    }
    return [];
  }

  /**
   * Formats custom options as a pretty-printed string
   */
  protected formatCustomOptions(options: any): string {
    return options ? JSON.stringify(options, null, 2) : '';
  }
}

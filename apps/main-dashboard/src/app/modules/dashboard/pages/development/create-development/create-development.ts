import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FrontendConfigComponent } from './components/frontend-config/frontend-config';
import { BackendConfigComponent } from './components/backend-config/backend-config';
import { DatabaseConfigComponent } from './components/database-config/database-config';
import { environment } from '../../../../../../environments/environment';
import { initEmptyObject } from '../../../../../utils/init-empty-object';
import { AuthService } from '../../../../auth/services/auth.service';
import { ProjectModel } from '../../../models/project.model';
import { ProjectService } from '../../../services/project.service';
import { Loader } from 'apps/main-dashboard/src/app/shared/components/loader/loader';

import {
  DevelopmentConfigsModel,
  GenerationType,
  DevelopmentMode,
  QuickGenerationPreset,
  LandingPageConfig,
} from '../../../models/development.model';
import { CookieService } from '../../../../../shared/services/cookie.service';
import { User } from '@angular/fire/auth';
import { first } from 'rxjs/operators';
import { DevelopmentService } from '../../../services/ai-agents/development.service';
import { Router } from '@angular/router';
import { DeploymentConfigComponent } from './components/deployment-config/deployment-config';

@Component({
  selector: 'app-show-development',
  standalone: true,
  imports: [
    Loader,
    CommonModule,
    ReactiveFormsModule,
    FrontendConfigComponent,
    BackendConfigComponent,
    DatabaseConfigComponent,
    DeploymentConfigComponent,
  ],
  templateUrl: './create-development.html',
  styleUrl: './create-development.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateDevelopmentComponent implements OnInit {
  protected readonly tabs = ['frontend', 'backend', 'database', 'deployment'] as const;

  // Injectable services - suivant le style guide Angular
  protected readonly auth = inject(AuthService);
  protected readonly user$ = this.auth.user$;
  protected readonly projectService = inject(ProjectService);
  protected readonly developmentService = inject(DevelopmentService);
  protected readonly cookieService = inject(CookieService);
  protected readonly fb = inject(FormBuilder);

  // State signals - groupés par fonctionnalité
  // - Project state
  protected readonly isLoaded = signal(true);
  protected readonly projectId = signal('');
  protected readonly project = signal<ProjectModel>(initEmptyObject<ProjectModel>());

  // - UI state
  protected readonly selectedTab = signal<'frontend' | 'backend' | 'database' | 'deployment'>(
    'frontend',
  );
  protected readonly showAdvancedOptions = signal<boolean>(false);
  protected readonly selectedStylingPreferences = signal<string[]>([]);

  // - New generation mode state
  protected readonly currentStep = signal<'mode-selection' | 'generation-type' | 'configuration'>(
    'mode-selection',
  );
  protected readonly selectedMode = signal<DevelopmentMode | null>(null);
  protected readonly selectedGenerationType = signal<GenerationType | null>(null);
  protected readonly quickPresets = signal<QuickGenerationPreset[]>([]);

  /**
   * Select a tab in the form
   * @param tab The tab to select
   */
  protected selectTab(tab: 'frontend' | 'backend' | 'database' | 'deployment'): void {
    this.selectedTab.set(tab);
  }

  /**
   * Select development mode (quick or advanced)
   */
  protected selectMode(mode: DevelopmentMode): void {
    this.selectedMode.set(mode);
    if (mode === 'quick') {
      this.currentStep.set('generation-type');
    } else {
      this.currentStep.set('configuration');
    }
  }

  /**
   * Select generation type (landing, app, or both)
   */
  protected selectGenerationType(type: GenerationType): void {
    this.selectedGenerationType.set(type);
    this.currentStep.set('configuration');
  }

  /**
   * Select Landing Page and redirect to show-development
   */
  protected async selectLandingPage(): Promise<void> {
    try {
      // Set quick mode and landing generation type
      this.selectedMode.set('quick');
      this.selectedGenerationType.set('landing');

      // Use the existing save configuration process
      await this.onSaveConfiguration();

      // The redirection to show-development is handled in onSaveConfiguration()
    } catch (error) {
      console.error('Error selecting landing page:', error);
      this.errorMessages.set(['Failed to save landing page configuration']);
    }
  }

  /**
   * Go back to previous step
   */
  protected back(): void {
    const current = this.currentStep();
    if (current === 'generation-type') {
      this.currentStep.set('mode-selection');
      this.selectedMode.set(null);
    } else if (current === 'configuration') {
      if (this.selectedMode() === 'quick') {
        this.currentStep.set('generation-type');
        this.selectedGenerationType.set(null);
      } else {
        this.currentStep.set('mode-selection');
        this.selectedMode.set(null);
      }
    }
  }
  protected readonly formSubmitted = signal(false);
  protected readonly formHasErrors = signal(false);
  protected readonly errorMessages = signal<string[]>([]);

  // UI state
  protected readonly currentUser = signal<User | null>(null);
  protected readonly webgenUrl = environment.services.webgen.url;

  // Form groups for the different configuration sections
  protected readonly developmentForm: FormGroup;
  protected readonly frontendForm: FormGroup;
  protected readonly backendForm: FormGroup;
  protected readonly databaseForm: FormGroup;
  protected readonly projectConfigForm: FormGroup;
  protected readonly router = inject(Router);
  protected readonly versionOptions = signal<{
    [key: string]: { [key: string]: string[] };
  }>({});

  /**
   * Redirects to the web generator application with the project ID
   * @param projectId The ID of the project to generate
   */
  protected goToShowDevelopment(): void {
    this.router.navigate(['/project/development']);
  }

  /**
   * Validate the form before submission
   */
  private validateForm(): boolean {
    const mode = this.selectedMode();
    if (mode === 'quick') {
      return this.selectedGenerationType() !== null;
    }

    // For advanced mode, validate the form groups
    return this.frontendForm.valid && this.backendForm.valid && this.databaseForm.valid;
  }

  /**
   * Build development configuration from form data
   */
  private buildDevelopmentConfigs(): DevelopmentConfigsModel {
    const mode = this.selectedMode() || 'advanced';
    const generationType = this.selectedGenerationType() || 'app';

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
      mode,
      generationType,
      constraints: [],
      frontend: {
        framework: this.frontendForm.get('framework')?.value || '',
        frameworkVersion: this.frontendForm.get('frameworkVersion')?.value,
        frameworkIconUrl: this.frontendForm.get('frameworkIconUrl')?.value,
        styling: this.frontendForm.get('styling')?.value || [],
        stateManagement: this.frontendForm.get('stateManagement')?.value,
        features: {
          routing: this.frontendForm.get('routing')?.value || false,
          componentLibrary: this.frontendForm.get('componentLibrary')?.value || false,
          testing: this.frontendForm.get('testing')?.value || false,
          pwa: this.frontendForm.get('pwa')?.value || false,
          seo: this.frontendForm.get('seo')?.value || false,
        },
      },
      backend: {
        language: this.backendForm.get('language')?.value,
        languageVersion: this.backendForm.get('languageVersion')?.value,
        languageIconUrl: this.backendForm.get('languageIconUrl')?.value,
        framework: this.backendForm.get('framework')?.value || '',
        frameworkVersion: this.backendForm.get('frameworkVersion')?.value,
        frameworkIconUrl: this.backendForm.get('frameworkIconUrl')?.value,
        apiType: this.backendForm.get('apiType')?.value || '',
        apiVersion: this.backendForm.get('apiVersion')?.value,
        apiIconUrl: this.backendForm.get('apiIconUrl')?.value,
        orm: this.backendForm.get('orm')?.value,
        ormVersion: this.backendForm.get('ormVersion')?.value,
        ormIconUrl: this.backendForm.get('ormIconUrl')?.value,
        features: {
          authentication: this.backendForm.get('authentication')?.value || false,
          authorization: this.backendForm.get('authorization')?.value || false,
          documentation: this.backendForm.get('documentation')?.value || false,
          testing: this.backendForm.get('testing')?.value || false,
          logging: this.backendForm.get('logging')?.value || false,
        },
      },
      database: {
        type: this.databaseForm.get('type')?.value,
        typeVersion: this.databaseForm.get('typeVersion')?.value,
        typeIconUrl: this.databaseForm.get('typeIconUrl')?.value,
        provider: this.databaseForm.get('provider')?.value || '',
        providerVersion: this.databaseForm.get('providerVersion')?.value,
        providerIconUrl: this.databaseForm.get('providerIconUrl')?.value,
        orm: this.databaseForm.get('orm')?.value,
        ormVersion: this.databaseForm.get('ormVersion')?.value,
        ormIconUrl: this.databaseForm.get('ormIconUrl')?.value,
        features: {
          migrations: this.databaseForm.get('migrations')?.value || false,
          seeders: this.databaseForm.get('seeders')?.value || false,
          caching: this.databaseForm.get('caching')?.value || false,
          replication: this.databaseForm.get('replication')?.value || false,
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
      },
    };
  }

  /**
   * Initialize all form groups
   */
  private initializeForms(): void {
    // Forms are already initialized in constructor
    // This method can be used for additional form setup if needed
  }

  constructor() {
    // Initialize all form groups
    this.frontendForm = this.fb.group({
      framework: ['angular', Validators.required],
      frameworkVersion: ['latest', Validators.required],
      styling: [['tailwind'], Validators.required],
      features: this.fb.group({
        routing: [true],
        componentLibrary: [false],
        testing: [true],
        pwa: [false],
        seo: [true],
      }),
    });

    // Backend form with language first, then framework
    this.backendForm = this.fb.group({
      language: ['typescript', Validators.required],
      languageVersion: ['latest', Validators.required],
      languageIconUrl: [''],
      framework: ['express', Validators.required],
      frameworkVersion: ['latest', Validators.required],
      frameworkIconUrl: [''],
      apiType: ['rest', Validators.required],
      apiVersion: ['latest', Validators.required],
      apiIconUrl: [''],
      orm: ['sequelize'],
      ormVersion: ['latest'],
      ormIconUrl: [''],
      features: this.fb.group({
        authentication: [true],
        authorization: [true],
        documentation: [true],
        testing: [true],
        logging: [true],
      }),
    });

    this.databaseForm = this.fb.group({
      provider: ['firebase', Validators.required],
      version: ['latest', Validators.required],
      providerIconUrl: [''],
      orm: ['prisma', Validators.required],
      ormVersion: ['latest', Validators.required],
      ormIconUrl: [''],
      features: this.fb.group({
        migrations: [true],
        seeders: [true],
        caching: [false],
        replication: [false],
      }),
    });

    this.projectConfigForm = this.fb.group({
      seoEnabled: [true],
      contactFormEnabled: [false],
      analyticsEnabled: [true],
      i18nEnabled: [false],
      performanceOptimized: [true],
      authentication: [true],
      authorization: [false],
      paymentIntegration: [false],
    });

    this.developmentForm = this.fb.group({
      additionalStacks: [[]],
      constraints: [[]],
      frontend: this.frontendForm,
      backend: this.backendForm,
      database: this.databaseForm,
      projectConfig: this.projectConfigForm,
    });
  }

  selectedStackId: string | null = null;

  /**
   * Toggle advanced options visibility
   */
  protected toggleAdvancedOptions(): void {
    this.showAdvancedOptions.update((value) => !value);
  }

  /**
   * Toggle a styling preference in multi-select mode
   */
  protected toggleStylingPreference(style: string): void {
    const currentStyles = [...this.selectedStylingPreferences()];
    const index = currentStyles.indexOf(style);

    if (index === -1) {
      currentStyles.push(style);
    } else {
      currentStyles.splice(index, 1);
    }

    this.selectedStylingPreferences.set(currentStyles);
    this.frontendForm.get('styling')?.setValue(currentStyles);
  }

  /**
   * Update styling preferences from child component
   */
  protected updateStylingPreferences(styles: string[]): void {
    this.selectedStylingPreferences.set(styles);
  }

  /**
   * Check if a styling preference is selected
   */
  protected isStylingSelected(style: string): boolean {
    return this.selectedStylingPreferences().includes(style);
  }

  selectStack(id: string) {
    this.selectedStackId = this.selectedStackId === id ? null : id;
  }

  /**
   * Toggle a configuration option in the form
   */
  protected toggleOption(id: string): void {
    const control = this.projectConfigForm.get(id);
    if (control) {
      control.setValue(!control.value);
    }
  }

  /**
   * Get the current value of a configuration option
   */
  protected getOptionValue(id: string): boolean {
    return this.projectConfigForm.get(id)?.value || false;
  }

  /**
   * Save the development configurations and generate the application
   */
  protected async onSaveConfiguration(): Promise<void> {
    try {
      this.formSubmitted.set(true);
      this.errorMessages.set([]);

      const mode = this.selectedMode();
      const generationType = this.selectedGenerationType();

      let developmentConfigs: DevelopmentConfigsModel;

      if (mode === 'quick' && generationType) {
        // Generate quick configuration
        developmentConfigs = this.developmentService.generateQuickConfig(generationType);
      } else {
        // Use advanced configuration
        if (!this.validateForm()) {
          return;
        }
        developmentConfigs = this.buildDevelopmentConfigs();
      }

      this.isLoaded.set(true);
      const projectId = this.projectId();

      console.log('Saving development configs:', developmentConfigs);

      await this.developmentService
        .saveDevelopmentConfigs(developmentConfigs, projectId, generationType || undefined)
        .pipe(first())
        .toPromise();

      console.log('Development configuration saved successfully');

      // Navigate to show-development page
      this.router.navigate(['/project/development']);
    } catch (error) {
      console.error('Error saving development configuration:', error);
      this.errorMessages.set(['Failed to save development configuration']);
    } finally {
      this.isLoaded.set(false);
    }
  }

  async ngOnInit(): Promise<void> {
    try {
      this.isLoaded.set(true);
      const projectId = this.cookieService.get('projectId');
      if (!projectId) {
        console.error('No project ID found');
        return;
      }
      this.projectId.set(projectId);

      const project = await this.projectService.getProjectById(projectId).pipe(first()).toPromise();
      if (project) {
        this.project.set(project);

        // If the project already has development configuration, populate the form
        if (project.analysisResultModel?.development) {
          const developmentConfig = project.analysisResultModel.development;
          this.developmentForm.patchValue(developmentConfig);
          console.log('Loaded existing development configuration:', developmentConfig);
        }
      }

      // Load quick generation presets
      const presets = this.developmentService.getQuickGenerationPresets();
      this.quickPresets.set(presets);

      this.initializeForms();
    } catch (error) {
      console.error('Error loading project:', error);
      this.errorMessages.set(['Failed to load project data']);
    } finally {
      this.isLoaded.set(false);
    }
  }
}

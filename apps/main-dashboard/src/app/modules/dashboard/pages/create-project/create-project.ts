import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  computed,
  effect,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ProjectModel } from '@idem/shared-models';
import { ProjectService } from '../../services/project.service';
import { CookieService } from '../../../../shared/services/cookie.service';
import { UiModeService } from '../../../../shared/services/ui-mode.service';
import { initEmptyObject } from '../../../../utils/init-empty-object';
import CreateProjectDatas, { SelectElement } from './datas';

// Import components
import { ProjectDescriptionComponent } from './components/project-description/project-description';
import { DynamicDetailsFormComponent } from './components/dynamic-details-form/dynamic-details-form';
import { ColorSelectionComponent } from './components/color-selection/color-selection';
import { TypographySelectionComponent } from './components/typography-selection/typography-selection';
import { LogoSelectionComponent } from './components/logo-selection/logo-selection';
import { LogoVariationsComponent } from './components/logo-variations/logo-variations';
import { ProjectSummaryComponent } from './components/project-summary/project-summary';
import { LogoChoiceComponent } from './components/logo-choice/logo-choice';
import { FoundationsCardComponent } from './components/foundations-card/foundations-card';
import { Loader } from '../../../../shared/components/loader/loader';
import { SkeletonModule } from 'primeng/skeleton';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  OnboardingChatComponent,
  OnboardingFoundations,
} from '../../../chat/components/onboarding-chat/onboarding-chat';
import { AuthService } from '../../../auth/services/auth.service';
import { LoginCardComponent } from '../../../auth/components/login-card/login-card';
import { DialogModule } from 'primeng/dialog';

// Simple step configuration
interface Step {
  id: string;
  title: string;
  component: string;
}

/** Mode d'affichage de la création de projet */
type CreateMode = 'chat' | 'form';
const CREATE_MODE_KEY = 'idem_create_project_mode';

@Component({
  selector: 'app-create-project',
  standalone: true,
  imports: [
    CommonModule,
    SkeletonModule,
    ProjectDescriptionComponent,
    DynamicDetailsFormComponent,
    ProjectSummaryComponent,
    TranslateModule,
    Loader,
    FoundationsCardComponent,
    OnboardingChatComponent,
    DialogModule,
    LoginCardComponent,
  ],
  templateUrl: './create-project.html',
  styleUrl: './create-project.css',
})
export class CreateProjectComponent implements OnInit, OnDestroy {
  // Services
  private readonly projectService = inject(ProjectService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cookieService = inject(CookieService);
  private readonly uiModeService = inject(UiModeService);
  private readonly translate = inject(TranslateService);
  private readonly authService = inject(AuthService);

  // Authentication Modal State
  protected readonly showLoginModal = signal<boolean>(false);
  private pendingAction: 'nextStep' | 'foundations' | null = null;

  // AppGen handoff
  protected readonly fromAppGen = signal<boolean>(false);
  protected readonly appgenHandoff = signal<any>(null);

  // Core state
  protected readonly currentStepIndex = signal<number>(0);
  protected readonly project = signal<ProjectModel>(initEmptyObject<ProjectModel>());
  protected readonly isLoading = signal<boolean>(false);

  // Dual-mode : conversation (défaut) ⇄ formulaire classique
  protected readonly mode = signal<CreateMode>(this.readMode());

  /** Vue conversationnelle active (chat + au-delà de l'étape description). */
  protected readonly isChatConversation = computed(
    () => this.mode() === 'chat' && this.currentStepIndex() !== 0,
  );

  constructor() {
    // En vue conversationnelle, on verrouille le scroll global de la page :
    // seul le fil de messages défile (comportement type Claude).
    effect(() => {
      const lock = this.isChatConversation();
      if (typeof document !== 'undefined') {
        document.body.style.overflow = lock ? 'hidden' : '';
      }
    });
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  }

  /** En mode chat : Fondations tant que description/nom/type ou projet manquent. */
  protected readonly chatReadyForConversation = computed(() => {
    const p = this.project();
    return !!p.id && !!p.description?.trim() && !!p.name?.trim() && !!p.type;
  });

  /** Données passées au composant conversationnel. */
  protected readonly conversationFoundations = computed<OnboardingFoundations>(() => {
    const p = this.project();
    const t = p.type as unknown as { name?: string; code?: string } | string | undefined;
    const typeLabel = typeof t === 'string' ? t : (t?.name ?? '');
    const typeCode = typeof t === 'string' ? t : (t?.code ?? '');
    return {
      description: p.description ?? '',
      name: p.name ?? '',
      type: typeCode,
      typeLabel,
      projectId: p.id ?? null,
    };
  });

  private readMode(): CreateMode {
    try {
      return localStorage.getItem(CREATE_MODE_KEY) === 'chat' ? 'chat' : 'form';
    } catch {
      return 'form';
    }
  }

  protected setMode(mode: CreateMode): void {
    if (mode === this.mode()) return;
    this.mode.set(mode);
    try {
      localStorage.setItem(CREATE_MODE_KEY, mode);
    } catch {
      // ignore
    }
  }

  // Step configuration
  protected get steps(): Step[] {
    return [
      {
        id: 'description',
        title: this.translate.instant('dashboard.createProject.steps.description'),
        component: 'description',
      },
      {
        id: 'details',
        title: this.translate.instant('dashboard.createProject.steps.details'),
        component: 'details',
      },
      {
        id: 'summary',
        title: this.translate.instant('dashboard.createProject.steps.summary'),
        component: 'summary',
      },
    ];
  }

  // Computed properties
  protected readonly currentStep = computed(() => this.steps[this.currentStepIndex()]);
  protected readonly canGoNext = computed(() => this.isStepValid(this.currentStepIndex()));
  protected readonly canGoPrevious = computed(() => this.currentStepIndex() > 0);
  protected readonly isLastStep = computed(() => this.currentStepIndex() === this.steps.length - 1);

  // Form validation state
  protected readonly acceptances = signal({
    privacy: false,
    terms: false,
    beta: false,
    marketing: false,
  });

  // Step-specific validation state
  protected readonly typographySelectionValid = signal(false);
  protected readonly logoImportComplete = signal(false);

  // Logo choice: 'import' means user imported a logo, 'ai' means generate with AI
  protected readonly logoChoice = signal<'import' | 'ai' | null>(null);

  // ViewChild to access typography component
  @ViewChild(TypographySelectionComponent) typographyComponent?: TypographySelectionComponent;

  // ViewChild to access logo-choice component
  @ViewChild(LogoChoiceComponent) logoChoiceComponent?: LogoChoiceComponent;

  // Static data
  protected readonly projectTypes = CreateProjectDatas.groupedProjectTypes;
  protected readonly targets = CreateProjectDatas.groupedTargets;
  protected readonly scopes = CreateProjectDatas.groupedScopes;

  ngOnInit(): void {
    this.loadDraftProject();
    this.loadAppGenHandoff();
  }

  /**
   * Load AppGen handoff context from URL params or sessionStorage
   */
  private loadAppGenHandoff(): void {
    const params = this.route.snapshot.queryParams;
    if (params['from'] !== 'appgen') return;

    this.fromAppGen.set(true);

    // Pre-fill name and description from URL
    const name = params['name'] ? decodeURIComponent(params['name']) : null;
    const description = params['description'] ? decodeURIComponent(params['description']) : null;

    // Read full handoff payload from sessionStorage
    let handoff: any = null;
    try {
      const raw = sessionStorage.getItem('appgen_handoff');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.expiresAt && new Date(parsed.expiresAt) > new Date()) {
          handoff = parsed;
          sessionStorage.removeItem('appgen_handoff');
        }
      }
    } catch (e) {
      console.warn('Could not read AppGen handoff:', e);
    }

    this.appgenHandoff.set(handoff);

    // Pre-fill project from handoff data
    this.project.update((current) => ({
      ...current,
      name: name || handoff?.appName || current.name,
      description: description || handoff?.description || current.description,
    }));
  }

  /**
   * Load draft project from cookies if exists
   */
  private loadDraftProject(): void {
    try {
      const draft = this.cookieService.get('draftProject');
      if (draft) {
        const projectData = JSON.parse(draft);
        this.project.set(projectData);

        const draftStep = this.cookieService.get('draftProjectStep');
        if (draftStep) {
          const stepIndex = parseInt(draftStep, 10);
          if (stepIndex >= 0 && stepIndex < this.steps.length) {
            this.currentStepIndex.set(stepIndex);
          }
        }
      }
    } catch (error) {
      console.warn('Could not load draft project:', error);
    }
  }

  /**
   * Save project draft to cookies
   */
  private saveDraftProject(): void {
    try {
      this.cookieService.set('draftProject', JSON.stringify(this.project()));
      this.cookieService.set('draftProjectStep', this.currentStepIndex().toString());
    } catch (error) {
      console.error('Could not save draft project:', error);
    }
  }

  /**
   * Validate if a step is complete
   */
  private isStepValid(stepIndex: number): boolean {
    const step = this.steps[stepIndex];
    const project = this.project();

    switch (step.id) {
      case 'description':
        return !!project.description?.trim();
      case 'details':
        return !!project.name?.trim() && !!project.type && !!project.targets?.trim();
      case 'summary':
        const acceptances = this.acceptances();
        return acceptances.privacy && acceptances.terms && acceptances.beta;
      default:
        return true;
    }
  }

  /**
   * Navigate to a specific step
   */
  protected navigateToStep(index: number): void {
    if (index >= 0 && index < this.steps.length) {
      this.currentStepIndex.set(index);
      this.saveDraftProject();
      // Scroll to top of page
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  /**
   * Handle typography selection change
   */
  protected onTypographySelectionChanged(isValid: boolean): void {
    this.typographySelectionValid.set(isValid);
  }

  /**
   * Navigate to next step
   */
  protected async goToNextStep(): Promise<void> {
    // After completing the "details" step (index 1), create the project in the database
    if (this.currentStepIndex() === 1 && !this.project().id) {
      const user = this.authService.getCurrentUser();
      if (!user) {
        this.pendingAction = 'nextStep';
        this.showLoginModal.set(true);
        return;
      }
      
      await this.createProjectInDatabase();
      if (!this.project().id) {
        // Project creation failed, block navigation
        return;
      }
    }

    if (this.canGoNext()) {
      const nextIndex = this.currentStepIndex() + 1;

      if (nextIndex < this.steps.length) {
        this.navigateToStep(nextIndex);
      } else {
        this.finalizeProject();
      }
    }
  }

  /**
   * Handle successful login from modal and resume the pending action
   */
  protected async onLoginSuccess(): Promise<void> {
    this.showLoginModal.set(false);
    const action = this.pendingAction;
    this.pendingAction = null;

    if (action === 'nextStep') {
      await this.createProjectInDatabase();
      if (this.project().id && this.canGoNext()) {
        const nextIndex = this.currentStepIndex() + 1;
        if (nextIndex < this.steps.length) {
          this.navigateToStep(nextIndex);
        } else {
          this.finalizeProject();
        }
      }
    } else if (action === 'foundations') {
      await this.createProjectInDatabase();
    }
  }

  /**
   * Close login modal and cancel pending action
   */
  protected closeLoginModal(): void {
    this.showLoginModal.set(false);
    this.pendingAction = null;
  }

  /**
   * Create project in database after details step
   */
  private async createProjectInDatabase(): Promise<void> {
    if (this.project().id || this.isLoading()) return;
    try {
      this.isLoading.set(true);
      const currentProject = this.project();

      const projectId = await this.projectService.createProject(currentProject).toPromise();

      if (projectId) {
        this.project.update((p: ProjectModel) => ({ ...p, id: projectId }));
        this.cookieService.set('projectId', projectId);
        this.saveDraftProject();
      }
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Navigate to previous step
   */
  protected goToPreviousStep(): void {
    if (this.canGoPrevious()) {
      let prevIndex = this.currentStepIndex() - 1;

      // If user imported a logo and we're at summary, skip back over logo/variations steps
      if (this.logoChoice() === 'import') {
        const prevStep = this.steps[prevIndex];
        if (prevStep?.id === 'variations' || prevStep?.id === 'logo') {
          const typographyIndex = this.steps.findIndex((s) => s.id === 'typography');
          if (typographyIndex !== -1) {
            prevIndex = typographyIndex;
          }
        }
      }

      this.navigateToStep(prevIndex);
    }
  }

  /**
   * Handle acceptance changes
   */
  protected onAcceptanceChange(
    type: 'privacy' | 'terms' | 'beta' | 'marketing',
    accepted: boolean,
  ): void {
    this.acceptances.update((current) => ({ ...current, [type]: accepted }));
  }

  /**
   * Finalize project creation
   */
  protected async finalizeProject(): Promise<void> {
    this.cookieService.set('projectId', this.project().id!);
    this.router.navigate(['/project/dashboard']);
  }

  // ─────────────────────────────────────────────── Mode conversation (chat)

  /** Phase A → crée le projet en base (si nécessaire) puis lance la conversation. */
  protected async onFoundationsContinue(): Promise<void> {
    if (!this.project().id) {
      const user = this.authService.getCurrentUser();
      if (!user) {
        this.pendingAction = 'foundations';
        this.showLoginModal.set(true);
        return;
      }
      await this.createProjectInDatabase();
    } else {
      this.saveDraftProject();
    }
    // chatReadyForConversation devient vrai → le composant conversationnel s'affiche
  }

  /** Le composant conversationnel a créé/finalisé le projet. */
  protected onConversationCreated(projectId: string): void {
    this.cookieService.set('projectId', projectId);
    this.cookieService.remove('draftProject');
    // Retour dans le contexte d'origine : chat si l'utilisateur est en mode chat
    if (this.uiModeService.mode() === 'chat') {
      this.router.navigate(['/chat']);
    } else {
      this.router.navigate(['/project/dashboard']);
    }
  }

  /**
   * Handle project updates from child components
   */
  protected onProjectUpdate(updates: Partial<ProjectModel>): void {
    console.log('🟢 onProjectUpdate received:', updates);
    console.log('🟢 Logo in update:', updates.analysisResultModel?.branding?.logo);
    console.log(
      '🟢 Imported colors in update:',
      updates.analysisResultModel?.branding?.importedLogoColors,
    );

    this.project.update((current) => ({
      ...current,
      ...updates,
      analysisResultModel: {
        ...current.analysisResultModel,
        ...updates.analysisResultModel,
        branding: {
          ...current.analysisResultModel?.branding,
          ...updates.analysisResultModel?.branding,
        },
      },
    }));
    this.saveDraftProject();
  }

  /**
   * Handle logo selection from logo-selection component
   */
  protected onLogoSelected(logoId: string): void {
    console.log('Logo selected:', logoId);
  }

  /**
   * Handle logo choice (import vs AI) from logo-choice step
   */
  protected onLogoChoiceMade(choice: 'import' | 'ai'): void {
    this.logoChoice.set(choice);

    if (choice === 'ai') {
      // Skip directly to colors step — logo generation happens later
      // The logo-choice component already emits nextStep for AI
    }
    // For 'import', the logo-choice component handles the flow internally
  }

  /**
   * Handle logo import completion status
   */
  protected onLogoImportComplete(isComplete: boolean): void {
    this.logoImportComplete.set(isComplete);
  }

  /**
   * Check if step is currently active
   */
  protected isStepActive(index: number): boolean {
    return this.currentStepIndex() === index;
  }
}

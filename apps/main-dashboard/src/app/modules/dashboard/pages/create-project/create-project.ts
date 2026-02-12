import { Component, inject, OnInit, signal, computed, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProjectModel } from '../../models/project.model';
import { ProjectService } from '../../services/project.service';
import { CookieService } from '../../../../shared/services/cookie.service';
import { initEmptyObject } from '../../../../utils/init-empty-object';
import CreateProjectDatas, { SelectElement } from './datas';

// Import components
import { ProjectDescriptionComponent } from './components/project-description/project-description';
import { ProjectDetailsComponent } from './components/project-details/project-details';
import { ColorSelectionComponent } from './components/color-selection/color-selection';
import { TypographySelectionComponent } from './components/typography-selection/typography-selection';
import { LogoSelectionComponent } from './components/logo-selection/logo-selection';
import { LogoVariationsComponent } from './components/logo-variations/logo-variations';
import { ProjectSummaryComponent } from './components/project-summary/project-summary';
import { LogoChoiceComponent } from './components/logo-choice/logo-choice';
import { Loader } from '../../../../shared/components/loader/loader';
import { SkeletonModule } from 'primeng/skeleton';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

// Simple step configuration
interface Step {
  id: string;
  title: string;
  component: string;
}

@Component({
  selector: 'app-create-project',
  standalone: true,
  imports: [
    CommonModule,
    SkeletonModule,
    ProjectDescriptionComponent,
    ProjectDetailsComponent,
    LogoSelectionComponent,
    LogoChoiceComponent,
    ColorSelectionComponent,
    TypographySelectionComponent,
    LogoVariationsComponent,
    ProjectSummaryComponent,
    TranslateModule,
    Loader,
  ],
  templateUrl: './create-project.html',
  styleUrl: './create-project.css',
})
export class CreateProjectComponent implements OnInit {
  // Services
  private readonly projectService = inject(ProjectService);
  private readonly router = inject(Router);
  private readonly cookieService = inject(CookieService);
  private readonly translate = inject(TranslateService);

  // Core state
  protected readonly currentStepIndex = signal<number>(0);
  protected readonly project = signal<ProjectModel>(initEmptyObject<ProjectModel>());
  protected readonly isLoading = signal<boolean>(false);

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
        id: 'logo-choice',
        title: this.translate.instant('dashboard.createProject.steps.logoChoice'),
        component: 'logo-choice',
      },
      {
        id: 'colors',
        title: this.translate.instant('dashboard.createProject.steps.colors'),
        component: 'colors',
      },
      {
        id: 'typography',
        title: this.translate.instant('dashboard.createProject.steps.typography'),
        component: 'typography',
      },
      {
        id: 'logo',
        title: this.translate.instant('dashboard.createProject.steps.logo'),
        component: 'logo',
      },
      {
        id: 'variations',
        title: this.translate.instant('dashboard.createProject.steps.variations'),
        component: 'variations',
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

  // Logo choice: 'import' means user imported a logo, 'ai' means generate with AI
  protected readonly logoChoice = signal<'import' | 'ai' | null>(null);

  // ViewChild to access typography component
  @ViewChild(TypographySelectionComponent) typographyComponent?: TypographySelectionComponent;

  // Static data
  protected readonly projectTypes = CreateProjectDatas.groupedProjectTypes;
  protected readonly targets = CreateProjectDatas.groupedTargets;
  protected readonly scopes = CreateProjectDatas.groupedScopes;

  ngOnInit(): void {
    this.loadDraftProject();
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
        return !!project.name?.trim() && !!project.type;
      case 'colors':
        return !!project.analysisResultModel?.branding?.generatedColors?.length;
      case 'typography':
        return this.typographySelectionValid();
      case 'logo-choice':
        return this.logoChoice() !== null;
      case 'logo':
        return !!project.analysisResultModel?.branding?.logo;
      case 'variations':
        return !!project.analysisResultModel?.branding?.logo?.variations;
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
  protected goToNextStep(): void {
    // For typography step, prepare and save typography data before proceeding
    if (this.currentStepIndex() === 4 && this.typographyComponent) {
      // Typography step (index shifted by logo-choice step)
      const typographyData = this.typographyComponent.prepareTypographyData();
      if (typographyData) {
        this.onProjectUpdate(typographyData);
      }
    }

    if (this.canGoNext()) {
      let nextIndex = this.currentStepIndex() + 1;

      // If user imported a logo, skip the AI logo generation step (index 5)
      // and the logo variations step (index 6) — go straight to summary
      if (this.logoChoice() === 'import') {
        const nextStep = this.steps[nextIndex];
        if (nextStep?.id === 'logo' || nextStep?.id === 'variations') {
          // Skip to the step after variations (summary)
          const summaryIndex = this.steps.findIndex((s) => s.id === 'summary');
          if (summaryIndex !== -1) {
            nextIndex = summaryIndex;
          }
        }
      }

      if (nextIndex < this.steps.length) {
        this.navigateToStep(nextIndex);
      } else {
        this.finalizeProject();
      }
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

  /**
   * Handle project updates from child components
   */
  protected onProjectUpdate(updates: Partial<ProjectModel>): void {
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
   * Check if step is currently active
   */
  protected isStepActive(index: number): boolean {
    return this.currentStepIndex() === index;
  }
}

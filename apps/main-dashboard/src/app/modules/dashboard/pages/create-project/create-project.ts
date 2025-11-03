import { Component, inject, OnInit, signal, computed } from '@angular/core';
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
import { SkeletonModule } from 'primeng/skeleton';

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
    ColorSelectionComponent,
    TypographySelectionComponent,
    LogoVariationsComponent,
    ProjectSummaryComponent,
  ],
  templateUrl: './create-project.html',
  styleUrl: './create-project.css',
})
export class CreateProjectComponent implements OnInit {
  // Services
  private readonly projectService = inject(ProjectService);
  private readonly router = inject(Router);
  private readonly cookieService = inject(CookieService);

  // Core state
  protected readonly currentStepIndex = signal<number>(0);
  protected readonly project = signal<ProjectModel>(initEmptyObject<ProjectModel>());
  protected readonly isLoading = signal<boolean>(false);

  // Step configuration
  protected readonly steps: Step[] = [
    {
      id: 'description',
      title: 'Project Description',
      component: 'description',
    },
    { id: 'details', title: 'Project Details', component: 'details' },
    { id: 'colors', title: 'Color Selection', component: 'colors' },
    {
      id: 'typography',
      title: 'Typography Selection',
      component: 'typography',
    },
    { id: 'logo', title: 'Logo Selection', component: 'logo' },
    { id: 'variations', title: 'Logo Variations', component: 'variations' },
    { id: 'summary', title: 'Summary', component: 'summary' },
  ];

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
        return !!project.analysisResultModel?.branding?.typography;
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
   * Navigate to next step
   */
  protected goToNextStep(): void {
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
   * Navigate to previous step
   */
  protected goToPreviousStep(): void {
    if (this.canGoPrevious()) {
      this.navigateToStep(this.currentStepIndex() - 1);
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
    this.router.navigate(['/console/project/dashboard']);
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
   * Check if step is currently active
   */
  protected isStepActive(index: number): boolean {
    return this.currentStepIndex() === index;
  }
}

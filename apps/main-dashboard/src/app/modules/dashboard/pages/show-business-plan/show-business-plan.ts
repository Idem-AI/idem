import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CookieService } from '../../../../shared/services/cookie.service';
import { BusinessPlanService } from '../../services/ai-agents/business-plan.service';
import { BusinessPlanModel } from '../../models/businessPlan.model';
import { BusinessPlanDisplayComponent } from './components/business-plan-display/business-plan-display';
import { Loader } from 'apps/main-dashboard/src/app/shared/components/loader/loader';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BrandingValidationService } from '../../services/branding-validation.service';
import { IncompleteProjectBannerComponent } from '../../components/incomplete-project-banner/incomplete-project-banner';
import { ProjectService } from '../../services/project.service';
import { ProjectModel } from '@idem/shared-models';

@Component({
  selector: 'app-show-business-plan',
  standalone: true,
  imports: [
    CommonModule,
    BusinessPlanDisplayComponent,
    Loader,
    TranslateModule,
    IncompleteProjectBannerComponent,
  ],
  templateUrl: './show-business-plan.html',
  styleUrls: ['./show-business-plan.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowBusinessPlan implements OnInit {
  // Injected services
  private readonly businessPlanService = inject(BusinessPlanService);
  private readonly cookieService = inject(CookieService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly brandingValidation = inject(BrandingValidationService);
  private readonly projectService = inject(ProjectService);

  // Signals for state management
  protected readonly isLoading = signal<boolean>(true);
  protected readonly existingBusinessPlan = signal<BusinessPlanModel | null>(null);
  protected readonly projectIdFromCookie = signal<string | null>(null);
  protected readonly hasError = signal<boolean>(false);
  protected readonly errorMessage = signal<string>('');
  protected readonly isRetryable = signal<boolean>(false);

  // Branding validation
  protected readonly isBrandingComplete = signal<boolean>(false);
  protected readonly brandingMissingElements = signal<string[]>([]);
  protected readonly project = signal<ProjectModel | null>(null);

  ngOnInit(): void {
    // Get project ID from cookies
    const projectId = this.cookieService.get('projectId');
    this.projectIdFromCookie.set(projectId);

    if (projectId) {
      // First check branding completion
      this.checkBrandingCompletion(projectId);
    } else {
      this.isLoading.set(false);
    }
  }

  /**
   * Check if project branding is complete before loading content
   */
  private checkBrandingCompletion(projectId: string): void {
    this.projectService.getProjectById(projectId).subscribe({
      next: (project) => {
        this.project.set(project);
        const { isComplete, missingElements } =
          this.brandingValidation.checkBrandingCompletion(project);

        this.isBrandingComplete.set(isComplete);
        this.brandingMissingElements.set(missingElements);

        // Only load business plan if branding is complete
        if (isComplete) {
          this.loadExistingBusinessPlan(projectId);
        } else {
          this.isLoading.set(false);
        }
      },
      error: (error) => {
        console.error('Error checking branding completion:', error);
        this.isLoading.set(false);
        this.hasError.set(true);
        this.errorMessage.set('Erreur lors de la vérification du projet');
      },
    });
  }

  /**
   * Load existing business plan PDF for the project
   * If PDF exists, show display component, otherwise show generation component
   */
  private loadExistingBusinessPlan(projectId: string): void {
    this.businessPlanService.downloadBusinessPlanPdf(projectId).subscribe({
      next: (pdfBlob: Blob) => {
        if (pdfBlob && pdfBlob.size > 0) {
          // PDF exists - create a mock BusinessPlanModel to pass to display component
          const businessPlanWithPdf: BusinessPlanModel = {
            id: `business-plan-${projectId}`,
            projectId: projectId,
            sections: [
              {
                name: this.translate.instant('dashboard.showBusinessPlan.businessPlan.name'),
                type: 'pdf',
                data: this.translate.instant('dashboard.showBusinessPlan.businessPlan.data'),
                summary: this.translate.instant('dashboard.showBusinessPlan.businessPlan.summary'),
              },
            ],
            createdAt: new Date(),
            updatedAt: new Date(),
            pdfBlob: pdfBlob, // Add the PDF blob to the model
          };
          this.existingBusinessPlan.set(businessPlanWithPdf);
          console.log('Business plan PDF found, showing display component');
        } else {
          // Empty PDF - show generate button
          console.log('Empty PDF found, showing generate button');
          this.existingBusinessPlan.set(null);
        }
        this.isLoading.set(false);
      },
      error: (err: any) => {
        console.error(this.translate.instant('dashboard.showBusinessPlan.errorLoadingPdf'), err);

        // Check if this is a retryable error (other errors except 404)
        if (err.message === 'DOWNLOAD_ERROR' || err.isRetryable === true) {
          this.hasError.set(true);
          this.isRetryable.set(true);
          this.errorMessage.set(
            this.translate.instant('dashboard.showBusinessPlan.errors.download'),
          );
          console.log(this.translate.instant('dashboard.showBusinessPlan.retryableErrorOccurred'));
        } else {
          // 404 or other non-retryable errors - show generate button
          console.log(this.translate.instant('dashboard.showBusinessPlan.pdfNotFound'));
          this.hasError.set(false);
        }

        this.existingBusinessPlan.set(null);
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Navigate to business plan generation page
   */
  protected generateBusinessPlan(): void {
    console.log('Navigating to business plan generation page');
    this.router.navigate(['/project/business-plan/generate']);
  }

  /**
   * Retry loading the business plan PDF
   */
  protected retryLoadBusinessPlan(): void {
    console.log('Retrying business plan PDF load');
    const projectId = this.projectIdFromCookie();
    if (projectId) {
      this.hasError.set(false);
      this.isLoading.set(true);
      this.loadExistingBusinessPlan(projectId);
    }
  }

  /**
   * Navigate to projects page
   */
  protected goToProjects(): void {
    console.log('Navigating to projects page');
    this.router.navigate(['/projects']);
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { CookieService } from '../../../../shared/services/cookie.service';
import { ProjectService } from '../../services/project.service';
import { ProjectModel } from '@idem/shared-models';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { Loader } from 'apps/main-dashboard/src/app/shared/components/loader/loader';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IncompleteProjectBannerComponent } from '../../components/incomplete-project-banner/incomplete-project-banner';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    RouterLink,
    DatePipe,
    Loader,
    TranslateModule,
    IncompleteProjectBannerComponent,
    SafeHtmlPipe,
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  protected readonly cookieService = inject(CookieService);
  protected readonly projectService = inject(ProjectService);
  protected readonly router = inject(Router);
  protected readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);

  readonly project = signal<ProjectModel | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  /** Track if the logo image has failed to load */
  readonly logoLoadError = signal(false);

  /** Monogram for visual placeholder logo */
  readonly monogram = computed(() => {
    const proj = this.project();
    if (!proj) return '';
    return proj.name.substring(0, 2).toUpperCase();
  });

  /** Dynamic professional gradient background style based on name/id hash */
  readonly placeholderBgStyle = computed(() => {
    const proj = this.project();
    if (!proj) return '';
    const stringToHash = proj.id || proj.name;
    let hash = 0;
    for (let i = 0; i < stringToHash.length; i++) {
      hash = stringToHash.charCodeAt(i) + ((hash << 5) - hash);
    }
    const gradients = [
      'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', // Blue - Indigo
      'linear-gradient(135deg, #10b981 0%, #047857 100%)', // Emerald - Teal
      'linear-gradient(135deg, #ec4899 0%, #be185d 100%)', // Rose - Pink
      'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)', // Amber - Orange
      'linear-gradient(135deg, #8b5cf6 0%, #5b21b6 100%)', // Violet - Purple
      'linear-gradient(135deg, #64748b 0%, #334155 100%)', // Slate - Dark gray
    ];
    const index = Math.abs(hash) % gradients.length;
    return `background: ${gradients[index]}`;
  });

  /** SVG of the logo - detects if inline SVG string */
  readonly logoIsInline = computed(() => {
    const svg = this.project()?.analysisResultModel?.branding?.logo?.svg;
    return !!svg && svg.trimStart().startsWith('<');
  });

  /** Handles image loading errors */
  handleImageError() {
    this.logoLoadError.set(true);
  }

  ngOnInit(): void {
    this.isLoading.set(true);

    // Get project ID from cookie (set by navigation from projects list)
    const projectId = this.cookieService.get('projectId');
    console.log('projectId from cookie:', projectId);

    if (!projectId) {
      this.error.set(this.translate.instant('dashboard.dashboard.errors.noProjectSelected'));
      this.isLoading.set(false);
      this.router.navigate(['/projects']);
      return;
    }

    this.projectService.getProjectById(projectId).subscribe({
      next: (projectData) => {
        if (projectData) {
          this.project.set(projectData);
        } else {
          this.error.set(
            this.translate.instant('dashboard.dashboard.errors.projectNotFound', { projectId }),
          );
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error fetching project data for dashboard:', err);
        this.error.set(this.translate.instant('dashboard.dashboard.errors.failedToLoad'));
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Calculate number of completed steps
   */
  protected getCompletedSteps(): number {
    const proj = this.project();
    if (!proj?.analysisResultModel) return 0;

    let completed = 0;
    const analysis = proj.analysisResultModel;

    if (analysis.branding?.sections?.length > 0) completed++;
    if (analysis.businessPlan) completed++;
    if (analysis.pitchDeck) completed++;
    if (analysis.finance) completed++;
    if (analysis.design?.createdAt || analysis.design?.updatedAt || analysis.design?.content || (analysis.design?.sections && analysis.design.sections.length > 0)) completed++;
    if (analysis.development?.configs?.mode || analysis.development?.configs?.generationType) completed++;

    return completed;
  }

  protected readonly circumference = 2 * Math.PI * 36; // radius = 36 for circular progress

  /**
   * Calculate progress ring offset for SVG animation
   */
  protected getProgressOffset(): number {
    const progress = this.getCompletedSteps() / 6;
    return this.circumference * (1 - progress);
  }

  /**
   * Get completion state of a step: 'completed', 'in-progress', or 'upcoming'
   */
  protected getStepState(index: number): 'completed' | 'in-progress' | 'upcoming' {
    const proj = this.project();
    if (!proj?.analysisResultModel) return 'upcoming';

    const analysis = proj.analysisResultModel;
    const states = [
      !!(analysis.branding?.sections?.length > 0),
      !!analysis.businessPlan,
      !!analysis.pitchDeck,
      !!analysis.finance,
      !!(analysis.design?.createdAt || analysis.design?.updatedAt || analysis.design?.content || (analysis.design?.sections && analysis.design.sections.length > 0)),
      !!(analysis.development?.configs?.mode || analysis.development?.configs?.generationType)
    ];

    if (states[index]) {
      return 'completed';
    }

    // Pitch deck (index 2) and Diagrams (index 4) are always active (never locked as upcoming)
    if (index === 2 || index === 4) {
      return 'in-progress';
    }

    const firstIncompleteIndex = states.findIndex(s => !s);
    if (index === firstIncompleteIndex) {
      return 'in-progress';
    }

    return 'upcoming';
  }

  /**
   * Navigate to branding completion workflow
   */
  protected onCompleteProject(): void {
    const projectId = this.project()?.id;
    if (projectId) {
      this.router.navigate(['/console/project/branding/generate']);
    }
  }
}

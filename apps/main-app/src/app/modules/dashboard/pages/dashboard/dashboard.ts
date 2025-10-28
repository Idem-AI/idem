import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { CookieService } from '../../../../shared/services/cookie.service';
import { ProjectService } from '../../services/project.service';
import { ProjectModel } from '../../models/project.model';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { Loader } from '../../../../components/loader/loader';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, Loader],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  protected readonly cookieService = inject(CookieService);
  protected readonly projectService = inject(ProjectService);
  protected readonly router = inject(Router);
  protected readonly route = inject(ActivatedRoute);

  readonly project = signal<ProjectModel | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.isLoading.set(true);

    // Get project ID from cookie (set by navigation from projects list)
    const projectId = this.cookieService.get('projectId');
    console.log('projectId from cookie:', projectId);

    if (!projectId) {
      this.error.set('No project selected. Please select a project to view the dashboard.');
      this.isLoading.set(false);
      this.router.navigate(['/console/projects']);
      return;
    }

    this.projectService.getProjectById(projectId).subscribe({
      next: (projectData) => {
        if (projectData) {
          this.project.set(projectData);
        } else {
          this.error.set(`Project with ID ${projectId} not found.`);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error fetching project data for dashboard:', err);
        this.error.set('Failed to load project data. Please try again later.');
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
    if (analysis.design) completed++;
    if (analysis.development) completed++;
    // Deployment is always pending for now

    return completed;
  }

  /**
   * Calculate progress ring offset for SVG animation
   */
  protected getProgressOffset(): number {
    const circumference = 2 * Math.PI * 85; // radius = 85 for new circular progress
    const progress = this.getCompletedSteps() / 5;
    return circumference * (1 - progress);
  }

  /**
   * Get step card CSS class based on completion status
   */
  protected getStepStatus(isCompleted: boolean): string {
    return isCompleted ? 'step-card completed' : 'step-card';
  }
}

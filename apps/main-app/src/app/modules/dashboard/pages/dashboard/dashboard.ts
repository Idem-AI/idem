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

    // Get project ID from route params
    const projectId = this.route.snapshot.paramMap.get('projectId');
    console.log('projectId from route:', projectId);

    if (!projectId) {
      this.error.set('No project selected. Please select a project to view the dashboard.');
      this.isLoading.set(false);
      this.router.navigate(['/console']);
      return;
    }

    // Save to cookie for other components
    this.cookieService.set('projectId', projectId);

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
}

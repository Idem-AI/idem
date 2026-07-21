import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ProjectModel } from '@idem/shared-models';
import { ProjectService } from '../../services/project.service';
import { AuthService } from '../../../auth/services/auth.service';
import { Loader } from 'apps/main-dashboard/src/app/shared/components/loader/loader';

import { ProjectCard } from '../../components/project-card/project-card';
import { CookieService } from '../../../../shared/services/cookie.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-global-dashboard',
  imports: [CommonModule, RouterModule, Loader, ProjectCard, TranslateModule],
  templateUrl: './global-dashboard.html',
  styleUrl: './global-dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlobalDashboard implements OnInit {
  // Services
  private readonly projectService = inject(ProjectService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cookieService = inject(CookieService);
  private readonly translate = inject(TranslateService);

  // Signals
  protected readonly projects = signal<ProjectModel[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly user$ = this.auth.user$;

  // Computed
  protected readonly recentProjects = computed(() => {
    return this.projects()
      .slice()
      .sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
        const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 3);
  });

  ngOnInit() {
    this.loadDashboardData();
  }

  /**
   * Loads projects data
   */
  private loadDashboardData(): void {
    this.isLoading.set(true);

    this.projectService.getProjects().subscribe({
      next: (projects) => {
        this.projects.set(projects);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading dashboard data:', error);
        this.isLoading.set(false);
        // If there's an auth error, redirect to login
        if (error.status === 401 || error.status === 403) {
          this.router.navigate(['/login']);
        }
      },
    });
  }

  /**
   * Navigate to create project page
   */
  protected openCreateProject(): void {
    this.router.navigate(['/create-project']);
  }

  /**
   * Navigate to project dashboard
   */
  protected openProjectDashboard(projectId: string): void {
    this.cookieService.set('projectId', projectId);
    this.router.navigate(['/project/dashboard']);
  }
}

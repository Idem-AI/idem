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

import { NotificationService } from '../../../../shared/services/notification.service';
import { AnalyticsService } from '../../../../shared/services/analytics.service';

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
  private readonly notificationService = inject(NotificationService);
  private readonly analyticsService = inject(AnalyticsService);

  // Signals
  protected readonly projects = signal<ProjectModel[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly user$ = this.auth.user$;

  // Deletion modal state
  protected readonly projectToDelete = signal<ProjectModel | null>(null);
  protected readonly isDeleting = signal(false);

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

  protected openDeleteModal(project: ProjectModel): void {
    this.projectToDelete.set(project);
  }

  protected closeDeleteModal(): void {
    if (this.isDeleting()) return;
    this.projectToDelete.set(null);
  }

  protected confirmDeleteProject(): void {
    const project = this.projectToDelete();
    if (!project || !project.id || this.isDeleting()) return;
    const deletedId = project.id;

    this.isDeleting.set(true);
    this.projectService.deleteProject(deletedId).subscribe({
      next: () => {
        this.projects.update((projs) => projs.filter((p) => p.id !== deletedId));

        if (this.cookieService.get('projectId') === deletedId) {
          this.cookieService.remove('projectId');
        }

        this.analyticsService.trackProjectDeleted({ project_id: deletedId });

        this.notificationService.showSuccess({
          title: 'Projet supprimé',
          message: `Le projet "${project.name}" a été supprimé avec succès.`,
        });

        this.isDeleting.set(false);
        this.projectToDelete.set(null);
      },
      error: (error) => {
        console.error('Error deleting project:', error);
        this.notificationService.showError({
          title: 'Erreur',
          message: `Impossible de supprimer le projet. Veuillez réessayer.`,
        });
        this.isDeleting.set(false);
      },
    });
  }
}

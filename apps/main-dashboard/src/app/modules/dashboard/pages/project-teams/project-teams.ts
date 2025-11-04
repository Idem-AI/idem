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
import { ProjectTeamModel, TeamModel } from '../../models/team.model';
import { TeamService } from '../../services/team.service';
import { CookieService } from '../../../../shared/services/cookie.service';
import { Loader } from 'apps/main-dashboard/src/app/shared/components/loader/loader';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AddTeamToProjectModalComponent } from '../../components/add-team-to-project-modal/add-team-to-project-modal';

@Component({
  selector: 'app-project-teams',
  standalone: true,
  imports: [CommonModule, RouterModule, Loader, AddTeamToProjectModalComponent, TranslateModule],
  templateUrl: './project-teams.html',
  styleUrl: './project-teams.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTeams implements OnInit {
  // Services
  private readonly teamService = inject(TeamService);
  private readonly router = inject(Router);
  private readonly cookieService = inject(CookieService);
  private readonly translate = inject(TranslateService);

  // Signals
  protected readonly projectTeams = signal<ProjectTeamModel[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly projectId = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  // Computed
  protected readonly hasTeams = computed(() => this.projectTeams().length > 0);

  // Modal state
  protected readonly showAddTeamModal = signal(false);

  ngOnInit() {
    const projectId = this.cookieService.get('projectId');
    if (!projectId) {
      this.errorMessage.set(
        this.translate.instant('dashboard.projectTeams.errors.noProjectSelected'),
      );
      this.isLoading.set(false);
      this.router.navigate(['/console/projects']);
      return;
    }

    this.projectId.set(projectId);
    this.loadProjectTeams(projectId);
  }

  /**
   * Loads teams for the current project
   */
  private loadProjectTeams(projectId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.teamService.getProjectTeams(projectId).subscribe({
      next: (teams) => {
        this.projectTeams.set(teams);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading project teams:', error);
        this.errorMessage.set(this.translate.instant('dashboard.projectTeams.errors.failedToLoad'));
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Navigate to team details
   */
  protected openTeamDetails(teamId: string): void {
    this.router.navigate(['/console/teams', teamId]);
  }

  /**
   * Open add team modal
   */
  protected addTeamToProject(): void {
    this.showAddTeamModal.set(true);
  }

  /**
   * Close add team modal
   */
  protected closeAddTeamModal(): void {
    this.showAddTeamModal.set(false);
  }

  /**
   * Handle team added event
   */
  protected onTeamAdded(): void {
    // Reload teams after adding
    if (this.projectId()) {
      this.loadProjectTeams(this.projectId()!);
    }
  }

  /**
   * Get member count for a team
   */
  protected getMemberCount(team: TeamModel): number {
    return team.members?.length || 0;
  }

  /**
   * Get role badges as string
   */
  protected getRolesString(roles: string[]): string {
    return roles.join(', ');
  }

  /**
   * Get role badge color
   */
  protected getRoleBadgeColor(role: string): string {
    switch (role) {
      case 'project-owner':
        return 'bg-primary/20 text-primary';
      case 'project-admin':
        return 'bg-secondary/20 text-secondary';
      case 'developer':
        return 'bg-accent/20 text-accent';
      case 'designer':
        return 'bg-purple-500/20 text-purple-400';
      case 'viewer':
        return 'bg-gray-500/20 text-gray-400';
      case 'contributor':
        return 'bg-green-500/20 text-green-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  }

  /**
   * Remove team from project
   */
  protected removeTeam(teamId: string): void {
    if (!this.projectId()) return;

    if (confirm(this.translate.instant('dashboard.projectTeams.confirm.removeTeam'))) {
      this.teamService.removeTeamFromProject(this.projectId()!, teamId).subscribe({
        next: () => {
          // Reload teams
          this.loadProjectTeams(this.projectId()!);
        },
        error: (error) => {
          console.error('Error removing team:', error);
          alert(this.translate.instant('dashboard.projectTeams.errors.failedToRemove'));
        },
      });
    }
  }
}

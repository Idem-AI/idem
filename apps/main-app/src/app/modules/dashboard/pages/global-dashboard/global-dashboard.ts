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
import { ProjectModel } from '../../models/project.model';
import { TeamModel } from '../../models/team.model';
import { ProjectService } from '../../services/project.service';
import { TeamService } from '../../services/team.service';
import { AuthService } from '../../../auth/services/auth.service';
import { Loader } from '../../../../components/loader/loader';
import { ProjectCard } from '../../components/project-card/project-card';
import { CookieService } from '../../../../shared/services/cookie.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-global-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, Loader, ProjectCard],
  templateUrl: './global-dashboard.html',
  styleUrl: './global-dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlobalDashboard implements OnInit {
  // Services
  private readonly projectService = inject(ProjectService);
  private readonly teamService = inject(TeamService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cookieService = inject(CookieService);

  // Signals
  protected readonly projects = signal<ProjectModel[]>([]);
  protected readonly teams = signal<TeamModel[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly user$ = this.auth.user$;
  protected readonly activeTab = signal<'projects' | 'teams'>('projects');

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

  protected readonly recentTeams = computed(() => {
    return this.teams()
      .slice()
      .sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt!);
        const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt!);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 3);
  });

  ngOnInit() {
    this.loadDashboardData();
  }

  /**
   * Loads both projects and teams data
   */
  private loadDashboardData(): void {
    this.isLoading.set(true);

    forkJoin({
      projects: this.projectService.getProjects(),
      teams: this.teamService.getUserTeams(),
    }).subscribe({
      next: ({ projects, teams }) => {
        this.projects.set(projects);
        this.teams.set(teams);
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
   * Switch between projects and teams tabs
   */
  protected switchTab(tab: 'projects' | 'teams'): void {
    this.activeTab.set(tab);
  }

  /**
   * Navigate to create project page
   */
  protected openCreateProject(): void {
    this.router.navigate(['/console/create-project']);
  }

  /**
   * Navigate to create team page
   */
  protected openCreateTeam(): void {
    this.router.navigate(['/console/teams/create']);
  }

  /**
   * Navigate to project dashboard
   */
  protected openProjectDashboard(projectId: string): void {
    this.cookieService.set('projectId', projectId);
    this.router.navigate(['/console/project', projectId]);
  }

  /**
   * Navigate to team details
   */
  protected openTeamDetails(teamId: string): void {
    this.router.navigate(['/console/teams', teamId]);
  }

  /**
   * Get member count for a team
   */
  protected getMemberCount(team: TeamModel): number {
    return team.members?.length || 0;
  }

  /**
   * Get role badge color
   */
  protected getRoleBadgeColor(role: string): string {
    switch (role) {
      case 'owner':
        return 'bg-primary/20 text-primary';
      case 'admin':
        return 'bg-secondary/20 text-secondary';
      case 'member':
        return 'bg-accent/20 text-accent';
      case 'viewer':
        return 'bg-gray-500/20 text-gray-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  }
}

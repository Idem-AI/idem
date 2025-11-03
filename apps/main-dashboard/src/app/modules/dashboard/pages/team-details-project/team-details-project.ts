import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { TeamModel, TeamMemberModel, ProjectRole } from '../../models/team.model';
import { TeamService } from '../../services/team.service';
import { Loader } from 'apps/main-dashboard/src/app/shared/components/loader/loader';

@Component({
  selector: 'app-team-details-project',
  standalone: true,
  imports: [CommonModule, RouterModule, Loader],
  templateUrl: './team-details-project.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamDetailsProject implements OnInit {
  // Services
  private readonly teamService = inject(TeamService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Signals
  protected readonly team = signal<TeamModel | null>(null);
  protected readonly projectRoles = signal<ProjectRole[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly teamId = signal<string | null>(null);
  protected readonly projectId = signal<string | null>(null);

  // Computed
  protected readonly hasMembers = computed(() => (this.team()?.members?.length || 0) > 0);

  ngOnInit() {
    const teamId = this.route.snapshot.paramMap.get('teamId');
    const projectId = this.route.snapshot.queryParamMap.get('projectId');

    if (!teamId) {
      this.errorMessage.set('Team ID not found');
      this.isLoading.set(false);
      return;
    }

    this.teamId.set(teamId);
    this.projectId.set(projectId);
    this.loadTeamDetails(teamId);
  }

  /**
   * Loads team details
   */
  private loadTeamDetails(teamId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.teamService.getTeam(teamId).subscribe({
      next: (team) => {
        this.team.set(team);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading team details:', error);
        this.errorMessage.set('Failed to load team details');
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Navigate back
   */
  protected goBack(): void {
    if (this.projectId()) {
      this.router.navigate(['/console/project/teams'], {
        queryParams: { projectId: this.projectId() },
      });
    } else {
      this.router.navigate(['/console/project/teams']);
    }
  }

  /**
   * Get role badge color
   */
  protected getRoleBadgeColor(role: string): string {
    switch (role) {
      case 'owner':
        return 'bg-primary/20 text-primary border-primary/30';
      case 'admin':
        return 'bg-secondary/20 text-secondary border-secondary/30';
      case 'member':
        return 'bg-accent/20 text-accent border-accent/30';
      case 'viewer':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  }

  /**
   * Get initials from name
   */
  protected getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  /**
   * Remove member from team
   */
  protected removeMember(memberId: string): void {
    if (!this.teamId()) return;

    if (confirm('Are you sure you want to remove this member from the team?')) {
      this.teamService.removeMember(this.teamId()!, memberId).subscribe({
        next: () => {
          // Reload team details
          this.loadTeamDetails(this.teamId()!);
        },
        error: (error) => {
          console.error('Error removing member:', error);
          alert('Failed to remove member from team');
        },
      });
    }
  }
}

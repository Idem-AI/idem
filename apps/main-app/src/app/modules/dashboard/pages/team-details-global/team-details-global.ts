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
import { TeamModel, TeamMemberModel, ProjectTeamModel } from '../../models/team.model';
import { ProjectModel } from '../../models/project.model';
import { TeamService } from '../../services/team.service';
import { ProjectService } from '../../services/project.service';
import { Loader } from '../../../../components/loader/loader';
import { AddTeamMemberModal } from '../../components/add-team-member-modal/add-team-member-modal';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-team-details-global',
  standalone: true,
  imports: [CommonModule, RouterModule, Loader, AddTeamMemberModal],
  templateUrl: './team-details-global.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamDetailsGlobal implements OnInit {
  // Services
  private readonly teamService = inject(TeamService);
  private readonly projectService = inject(ProjectService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Signals
  protected readonly team = signal<TeamModel | null>(null);
  protected readonly assignedProjects = signal<{ project: ProjectModel; roles: string[] }[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly teamId = signal<string | null>(null);
  protected readonly isAddMemberModalOpen = signal(false);

  // Computed
  protected readonly hasMembers = computed(() => (this.team()?.members?.length || 0) > 0);
  protected readonly hasProjects = computed(() => this.assignedProjects().length > 0);

  ngOnInit() {
    const teamId = this.route.snapshot.paramMap.get('teamId');

    if (!teamId) {
      this.errorMessage.set('Team ID not found');
      this.isLoading.set(false);
      return;
    }

    this.teamId.set(teamId);
    this.loadTeamDetails(teamId);
  }

  /**
   * Loads team details and assigned projects
   */
  private loadTeamDetails(teamId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    // Load team details
    this.teamService.getTeam(teamId).subscribe({
      next: (team) => {
        this.team.set(team);
        // TODO: Implement backend route to get projects by teamId
        // For now, just finish loading
        this.assignedProjects.set([]);
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
    this.router.navigate(['/console/teams']);
  }

  /**
   * Navigate to project
   */
  protected goToProject(projectId: string): void {
    this.router.navigate(['/console/project', projectId]);
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
      case 'project-owner':
        return 'bg-primary/20 text-primary border-primary/30';
      case 'project-admin':
        return 'bg-secondary/20 text-secondary border-secondary/30';
      case 'developer':
        return 'bg-accent/20 text-accent border-accent/30';
      case 'designer':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'contributor':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
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

  /**
   * Open add member modal
   */
  protected addMember(): void {
    this.isAddMemberModalOpen.set(true);
  }

  /**
   * Close add member modal
   */
  protected closeAddMemberModal(): void {
    this.isAddMemberModalOpen.set(false);
  }

  /**
   * Handle member added event
   */
  protected onMemberAdded(): void {
    // Reload team details to show new member
    if (this.teamId()) {
      this.loadTeamDetails(this.teamId()!);
    }
  }
}

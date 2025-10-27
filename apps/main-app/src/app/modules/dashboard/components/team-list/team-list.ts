import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TeamModel } from '../../models/team.model';

@Component({
  selector: 'app-team-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './team-list.html',
  styleUrl: './team-list.css',
})
export class TeamList {
  // Inputs
  readonly teams = input.required<TeamModel[]>();
  readonly showCreateButton = input<boolean>(false);
  readonly emptyMessage = input<string>('No teams available');
  readonly createButtonLabel = input<string>('Create Team');

  // Outputs
  readonly teamClick = output<string>();
  readonly createClick = output<void>();

  // Computed
  protected readonly hasTeams = computed(() => this.teams().length > 0);

  /**
   * Handle team card click
   */
  protected onTeamClick(teamId: string): void {
    this.teamClick.emit(teamId);
  }

  /**
   * Handle create button click
   */
  protected onCreateClick(): void {
    this.createClick.emit();
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

  /**
   * Get user role in team (first member for now, should be current user)
   */
  protected getUserRole(team: TeamModel): string {
    return team.members[0]?.role || 'member';
  }
}

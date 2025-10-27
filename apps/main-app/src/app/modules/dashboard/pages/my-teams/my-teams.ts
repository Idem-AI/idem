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
import { TeamModel } from '../../models/team.model';
import { TeamService } from '../../services/team.service';
import { Loader } from '../../../../components/loader/loader';
import { TeamList } from '../../components/team-list/team-list';
import { CreateTeamModal } from '../../components/create-team-modal/create-team-modal';

@Component({
  selector: 'app-my-teams',
  standalone: true,
  imports: [CommonModule, RouterModule, Loader, TeamList, CreateTeamModal],
  templateUrl: './my-teams.html',
  styleUrl: './my-teams.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyTeams implements OnInit {
  // Services
  private readonly teamService = inject(TeamService);
  private readonly router = inject(Router);

  // Signals
  protected readonly teams = signal<TeamModel[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly showCreateModal = signal(false);

  // Computed
  protected readonly recentTeams = computed(() => {
    return this.teams()
      .slice()
      .sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt!);
        const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt!);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 4);
  });

  ngOnInit() {
    this.loadTeams();
  }

  /**
   * Loads user teams
   */
  private loadTeams(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.teamService.getUserTeams().subscribe({
      next: (teams) => {
        this.teams.set(teams);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading teams:', error);
        this.errorMessage.set('Failed to load teams');
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Navigate to team details
   */
  protected onTeamClick(teamId: string): void {
    this.router.navigate(['/console/teams', teamId]);
  }

  /**
   * Open create team modal
   */
  protected onCreateTeam(): void {
    this.showCreateModal.set(true);
  }

  /**
   * Handle team created
   */
  protected onTeamCreated(): void {
    this.showCreateModal.set(false);
    this.loadTeams();
  }

  /**
   * Close create modal
   */
  protected onCloseCreateModal(): void {
    this.showCreateModal.set(false);
  }
}

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
import { Loader } from 'apps/main-dashboard/src/app/shared/components/loader/loader';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-my-teams',
  standalone: true,
  imports: [CommonModule, RouterModule, Loader, TranslateModule],
  templateUrl: './my-teams.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyTeams implements OnInit {
  // Services
  private readonly teamService = inject(TeamService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  // Signals
  protected readonly teams = signal<TeamModel[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

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

    this.teamService.getUserTeams().subscribe({
      next: (teams) => {
        this.teams.set(teams);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading teams:', error);
        this.error.set(this.translate.instant('dashboard.myTeams.errors.failedToLoad'));
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
   * Navigate to create team
   */
  protected onCreateTeam(): void {
    this.router.navigate(['/console/teams/create']);
  }
}

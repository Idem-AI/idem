import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormsModule,
} from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { CheckboxModule } from 'primeng/checkbox';
import { TeamService } from '../../services/team.service';
import { TeamModel, AddTeamToProjectDTO } from '../../models/team.model';
import { CookieService } from '../../../../shared/services/cookie.service';
import { Loader } from '../../../../components/loader/loader';

@Component({
  selector: 'app-add-team-to-project',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, CheckboxModule, Loader],
  templateUrl: './add-team-to-project.html',
  styleUrl: './add-team-to-project.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTeamToProject implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly teamService = inject(TeamService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cookieService = inject(CookieService);

  // Signals
  protected readonly teams = signal<TeamModel[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly projectId = signal<string | null>(null);
  protected readonly selectedTeamId = signal<string | null>(null);

  // Available project roles
  protected readonly projectRoles = [
    {
      value: 'project-owner',
      label: 'Project Owner',
      description: 'Full control over the project',
      checked: false,
    },
    {
      value: 'project-admin',
      label: 'Project Admin',
      description: 'Can manage project settings',
      checked: false,
    },
    {
      value: 'developer',
      label: 'Developer',
      description: 'Can write and deploy code',
      checked: true,
    },
    {
      value: 'designer',
      label: 'Designer',
      description: 'Can manage design assets',
      checked: false,
    },
    {
      value: 'contributor',
      label: 'Contributor',
      description: 'Can contribute to the project',
      checked: false,
    },
    { value: 'viewer', label: 'Viewer', description: 'Can only view the project', checked: false },
  ];

  protected readonly assignForm: FormGroup = this.fb.group({
    teamId: ['', [Validators.required]],
    roles: [['developer'], [Validators.required, Validators.minLength(1)]],
  });

  // Computed
  protected readonly selectedTeam = computed(() => {
    const teamId = this.selectedTeamId();
    return this.teams().find((t) => t.id === teamId) || null;
  });

  ngOnInit() {
    // Get project ID from query params or cookie
    const projectId =
      this.route.snapshot.queryParamMap.get('projectId') || this.cookieService.get('projectId');

    if (!projectId) {
      this.errorMessage.set('No project selected');
      this.isLoading.set(false);
      return;
    }

    this.projectId.set(projectId);
    this.loadUserTeams();
  }

  /**
   * Load user teams
   */
  private loadUserTeams(): void {
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
   * Select a team
   */
  protected selectTeam(teamId: string): void {
    this.selectedTeamId.set(teamId);
    this.assignForm.patchValue({ teamId });
  }

  /**
   * Toggle role selection
   */
  protected toggleRole(roleValue: string): void {
    const role = this.projectRoles.find((r) => r.value === roleValue);
    if (!role) return;

    const currentRoles = this.assignForm.get('roles')?.value || [];
    const index = currentRoles.indexOf(roleValue);

    if (role.checked && index === -1) {
      // Add role
      currentRoles.push(roleValue);
    } else if (!role.checked && index > -1) {
      // Remove role
      currentRoles.splice(index, 1);
    }

    this.assignForm.patchValue({ roles: currentRoles });
  }

  /**
   * Check if role is selected
   */
  protected isRoleSelected(roleValue: string): boolean {
    const roles = this.assignForm.get('roles')?.value || [];
    return roles.includes(roleValue);
  }

  /**
   * Submit form to add team to project
   */
  protected onSubmit(): void {
    if (this.assignForm.invalid || !this.projectId()) {
      this.assignForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const formData = this.assignForm.value;

    this.teamService
      .addTeamToProject(this.projectId()!, formData.teamId, formData.roles)
      .subscribe({
        next: () => {
          console.log('Team added to project successfully');
          this.isSubmitting.set(false);
          // Navigate back to project teams
          this.router.navigate(['/console/project/teams']);
        },
        error: (error) => {
          console.error('Error adding team to project:', error);
          this.errorMessage.set(error.error?.error?.message || 'Failed to add team to project');
          this.isSubmitting.set(false);
        },
      });
  }

  /**
   * Cancel and go back
   */
  protected onCancel(): void {
    this.router.navigate(['/console/project/teams']);
  }
}

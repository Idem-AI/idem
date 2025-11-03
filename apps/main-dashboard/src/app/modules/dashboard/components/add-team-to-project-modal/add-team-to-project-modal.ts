import { Component, EventEmitter, Input, Output, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TeamService } from '../../services/team.service';
import { TeamModel, ProjectRole, CreateTeamDTO } from '../../models/team.model';

type SelectionMode = 'existing' | 'new';

@Component({
  selector: 'app-add-team-to-project-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DialogModule, InputTextModule, TextareaModule],
  templateUrl: './add-team-to-project-modal.html',
  styleUrl: './add-team-to-project-modal.css',
})
export class AddTeamToProjectModalComponent {
  private fb = inject(FormBuilder);
  private teamService = inject(TeamService);

  @Input() projectId!: string;
  @Output() close = new EventEmitter<void>();
  @Output() teamAdded = new EventEmitter<void>();

  // State
  protected visible = signal(true);
  protected selectionMode = signal<SelectionMode>('existing');
  protected isSubmitting = signal(false);
  protected errorMessage = signal<string | null>(null);
  protected availableTeams = signal<TeamModel[]>([]);
  protected isLoadingTeams = signal(true);

  // Forms
  protected existingTeamForm: FormGroup;
  protected newTeamForm: FormGroup;

  // Available roles
  protected readonly availableRoles: ProjectRole[] = [
    'project-owner',
    'project-admin',
    'developer',
    'designer',
    'viewer',
    'contributor',
  ];

  protected readonly roleLabels: Record<ProjectRole, string> = {
    'project-owner': 'Project Owner',
    'project-admin': 'Project Admin',
    developer: 'Developer',
    designer: 'Designer',
    viewer: 'Viewer',
    contributor: 'Contributor',
  };

  constructor() {
    // Initialize existing team form
    this.existingTeamForm = this.fb.group({
      teamId: ['', Validators.required],
      roles: [[], Validators.required],
    });

    // Initialize new team form
    this.newTeamForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      roles: [[], Validators.required],
    });

    // Load available teams
    this.loadAvailableTeams();
  }

  /**
   * Load teams that can be added to the project
   */
  private loadAvailableTeams(): void {
    this.isLoadingTeams.set(true);
    this.teamService.getUserTeams().subscribe({
      next: (teams: TeamModel[]) => {
        this.availableTeams.set(teams);
        this.isLoadingTeams.set(false);
      },
      error: (error: any) => {
        console.error('Error loading teams:', error);
        this.errorMessage.set('Failed to load teams');
        this.isLoadingTeams.set(false);
      },
    });
  }

  /**
   * Switch between existing and new team mode
   */
  protected setSelectionMode(mode: SelectionMode): void {
    this.selectionMode.set(mode);
    this.errorMessage.set(null);
  }

  /**
   * Toggle role selection
   */
  protected toggleRole(role: ProjectRole, formGroup: FormGroup): void {
    const currentRoles = formGroup.get('roles')?.value || [];
    const index = currentRoles.indexOf(role);

    if (index > -1) {
      currentRoles.splice(index, 1);
    } else {
      currentRoles.push(role);
    }

    formGroup.patchValue({ roles: [...currentRoles] });
  }

  /**
   * Check if a role is selected
   */
  protected isRoleSelected(role: ProjectRole, formGroup: FormGroup): boolean {
    const roles = formGroup.get('roles')?.value || [];
    return roles.includes(role);
  }

  /**
   * Submit existing team
   */
  protected onSubmitExistingTeam(): void {
    if (this.existingTeamForm.invalid) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const { teamId, roles } = this.existingTeamForm.value;

    this.teamService.addTeamToProject(this.projectId, teamId, roles).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.teamAdded.emit();
        this.onClose();
      },
      error: (error) => {
        console.error('Error adding team to project:', error);
        this.errorMessage.set(error.error?.error?.message || 'Failed to add team to project');
        this.isSubmitting.set(false);
      },
    });
  }

  /**
   * Submit new team and add to project
   */
  protected onSubmitNewTeam(): void {
    if (this.newTeamForm.invalid) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const { name, description, roles } = this.newTeamForm.value;

    const createTeamDTO: CreateTeamDTO = {
      name,
      description,
    };

    // First create the team
    this.teamService.createTeam(createTeamDTO).subscribe({
      next: (createdTeam) => {
        // Then add it to the project
        this.teamService.addTeamToProject(this.projectId, createdTeam.id!, roles).subscribe({
          next: () => {
            this.isSubmitting.set(false);
            this.teamAdded.emit();
            this.onClose();
          },
          error: (error) => {
            console.error('Error adding new team to project:', error);
            this.errorMessage.set(
              error.error?.error?.message || 'Team created but failed to add to project',
            );
            this.isSubmitting.set(false);
          },
        });
      },
      error: (error) => {
        console.error('Error creating team:', error);
        this.errorMessage.set(error.error?.error?.message || 'Failed to create team');
        this.isSubmitting.set(false);
      },
    });
  }

  /**
   * Close modal
   */
  protected onClose(): void {
    this.close.emit();
  }
}

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TeamService } from '../../services/team.service';
import { CreateTeamDTO } from '../../models/team.model';

@Component({
  selector: 'app-create-team',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './create-team.html',
  styleUrl: './create-team.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateTeam {
  private readonly fb = inject(FormBuilder);
  private readonly teamService = inject(TeamService);
  private readonly router = inject(Router);

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly teamForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    description: ['', [Validators.maxLength(500)]],
  });

  /**
   * Submit form to create team
   */
  protected onSubmit(): void {
    if (this.teamForm.invalid) {
      this.teamForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const formData = this.teamForm.value;
    const createTeamData: CreateTeamDTO = {
      name: formData.name,
      description: formData.description || undefined,
      members: [], // Pas de membres initiaux, on les ajoutera après
    };

    this.teamService.createTeam(createTeamData).subscribe({
      next: (team) => {
        console.log('Team created successfully:', team);
        this.isSubmitting.set(false);
        // Navigate to team details
        this.router.navigate(['/console/teams', team.id]);
      },
      error: (error) => {
        console.error('Error creating team:', error);
        this.errorMessage.set(error.error?.error?.message || 'Failed to create team');
        this.isSubmitting.set(false);
      },
    });
  }

  /**
   * Cancel and go back
   */
  protected onCancel(): void {
    this.router.navigate(['/console/teams']);
  }

  /**
   * Check if field has error
   */
  protected hasError(fieldName: string, errorType: string): boolean {
    const field = this.teamForm.get(fieldName);
    return !!(field?.hasError(errorType) && (field?.dirty || field?.touched));
  }

  /**
   * Get error message for field
   */
  protected getErrorMessage(fieldName: string): string {
    const field = this.teamForm.get(fieldName);
    if (!field) return '';

    if (field.hasError('required')) {
      return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
    }
    if (field.hasError('minlength')) {
      const minLength = field.getError('minlength').requiredLength;
      return `Minimum ${minLength} characters required`;
    }
    if (field.hasError('maxlength')) {
      const maxLength = field.getError('maxlength').requiredLength;
      return `Maximum ${maxLength} characters allowed`;
    }
    return '';
  }
}

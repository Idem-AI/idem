import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TeamService } from '../../services/team.service';
import { CreateTeamDTO } from '../../models/team.model';

@Component({
  selector: 'app-create-team',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    InputTextModule,
    TextareaModule,
    TranslateModule,
  ],
  templateUrl: './create-team.html',
  styleUrl: './create-team.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateTeam {
  private readonly fb = inject(FormBuilder);
  private readonly teamService = inject(TeamService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

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
        this.errorMessage.set(
          error.error?.error?.message ||
            this.translate.instant('dashboard.createTeam.errors.failedToCreate'),
        );
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

    const fieldNameKey = `dashboard.createTeam.fields.${fieldName}`;

    if (field.hasError('required')) {
      return this.translate.instant('validation.required', {
        fieldName: this.translate.instant(fieldNameKey),
      });
    }
    if (field.hasError('minlength')) {
      const minLength = field.getError('minlength').requiredLength;
      return this.translate.instant('validation.minLength', { min: minLength });
    }
    if (field.hasError('maxlength')) {
      const maxLength = field.getError('maxlength').requiredLength;
      return this.translate.instant('validation.maxLength', { max: maxLength });
    }
    return '';
  }
}

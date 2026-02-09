import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { RadioButtonModule } from 'primeng/radiobutton';
import { TranslateModule } from '@ngx-translate/core';
import { TeamService } from '../../services/team.service';
import { AddTeamMemberDTO } from '../../models/team.model';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-add-team-member-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    InputTextModule,
    RadioButtonModule,
    TranslateModule,
  ],
  templateUrl: './add-team-member-modal.html',
  styleUrl: './add-team-member-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTeamMemberModal {
  private readonly fb = inject(FormBuilder);
  private readonly teamService = inject(TeamService);
  private readonly translate = inject(TranslateService);

  // Inputs
  readonly isOpen = input.required<boolean>();
  readonly teamId = input.required<string>();

  // Outputs
  readonly close = output<void>();
  readonly memberAdded = output<void>();

  // Signals
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  // Available roles
  protected readonly roles = [
    {
      value: 'admin',
      labelKey: 'dashboard.addMemberModal.roles.admin.label',
      descriptionKey: 'dashboard.addMemberModal.roles.admin.description',
    },
    {
      value: 'member',
      labelKey: 'dashboard.addMemberModal.roles.member.label',
      descriptionKey: 'dashboard.addMemberModal.roles.member.description',
    },
    {
      value: 'viewer',
      labelKey: 'dashboard.addMemberModal.roles.viewer.label',
      descriptionKey: 'dashboard.addMemberModal.roles.viewer.description',
    },
  ];

  protected readonly memberForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    displayName: ['', [Validators.required, Validators.minLength(2)]],
    role: ['member', [Validators.required]],
  });

  /**
   * Submit form to add member
   */
  protected onSubmit(): void {
    if (this.memberForm.invalid) {
      this.memberForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const formData = this.memberForm.value;
    const addMemberData: AddTeamMemberDTO = {
      email: formData.email,
      displayName: formData.displayName,
      role: formData.role,
    };

    this.teamService.addTeamMember(this.teamId(), addMemberData).subscribe({
      next: () => {
        console.log('Member added successfully');
        this.isSubmitting.set(false);
        this.memberForm.reset({ role: 'member' });
        this.memberAdded.emit();
        this.onClose();
      },
      error: (error) => {
        console.error('Error adding member:', error);
        this.errorMessage.set(
          error.error?.error?.message ||
            this.translate.instant('dashboard.addMemberModal.errors.failedToAddMember'),
        );
        this.isSubmitting.set(false);
      },
    });
  }

  /**
   * Close modal
   */
  protected onClose(): void {
    this.memberForm.reset({ role: 'member' });
    this.errorMessage.set(null);
    this.close.emit();
  }

  /**
   * Check if field has error
   */
  protected hasError(fieldName: string, errorType: string): boolean {
    const field = this.memberForm.get(fieldName);
    return !!(field?.hasError(errorType) && (field?.dirty || field?.touched));
  }

  /**
   * Get error message for field
   */
  protected getErrorMessage(fieldName: string): string {
    const field = this.memberForm.get(fieldName);
    if (!field) return '';

    if (field.hasError('required')) {
      const fieldNameKey = `dashboard.addMemberModal.fields.${fieldName}`;
      return this.translate.instant('validation.required', {
        fieldName: this.translate.instant(fieldNameKey),
      });
    }
    if (field.hasError('email')) {
      return this.translate.instant('validation.email');
    }
    if (field.hasError('minlength')) {
      const minLength = field.getError('minlength').requiredLength;
      return this.translate.instant('validation.minLength', { min: minLength });
    }
    return '';
  }
}

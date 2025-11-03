import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { RadioButtonModule } from 'primeng/radiobutton';
import { TeamService } from '../../services/team.service';
import { AddTeamMemberDTO } from '../../models/team.model';

@Component({
  selector: 'app-add-team-member-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DialogModule, InputTextModule, RadioButtonModule],
  templateUrl: './add-team-member-modal.html',
  styleUrl: './add-team-member-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTeamMemberModal {
  private readonly fb = inject(FormBuilder);
  private readonly teamService = inject(TeamService);

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
    { value: 'admin', label: 'Admin', description: 'Can manage team and members' },
    { value: 'member', label: 'Member', description: 'Can view and contribute' },
    { value: 'viewer', label: 'Viewer', description: 'Can only view' },
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
        this.errorMessage.set(error.error?.error?.message || 'Failed to add member');
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
      return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
    }
    if (field.hasError('email')) {
      return 'Please enter a valid email address';
    }
    if (field.hasError('minlength')) {
      const minLength = field.getError('minlength').requiredLength;
      return `Minimum ${minLength} characters required`;
    }
    return '';
  }
}

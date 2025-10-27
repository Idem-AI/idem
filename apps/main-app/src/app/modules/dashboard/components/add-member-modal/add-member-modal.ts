import { Component, output, signal, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TeamService } from '../../services/team.service';

@Component({
  selector: 'app-add-member-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-member-modal.html',
  styleUrl: './add-member-modal.css',
})
export class AddMemberModal {
  // Services
  private readonly teamService = inject(TeamService);

  // Inputs
  readonly teamId = input.required<string>();

  // Outputs
  readonly closeModal = output<void>();
  readonly memberAdded = output<void>();

  // Signals
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  // Form data
  protected memberEmail = signal('');
  protected memberDisplayName = signal('');
  protected memberRole = signal<'admin' | 'member' | 'viewer'>('member');

  // Role options
  protected readonly roleOptions = [
    { value: 'admin', label: 'Admin', description: 'Can manage team and members' },
    { value: 'member', label: 'Member', description: 'Can contribute to projects' },
    { value: 'viewer', label: 'Viewer', description: 'Can view team information' },
  ];

  /**
   * Handle form submission
   */
  protected onSubmit(): void {
    if (this.isSubmitting()) return;

    const email = this.memberEmail().trim();
    const displayName = this.memberDisplayName().trim();

    if (!email) {
      this.errorMessage.set('Email is required');
      return;
    }

    if (!displayName) {
      this.errorMessage.set('Display name is required');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.errorMessage.set('Please enter a valid email address');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.teamService
      .addTeamMember(this.teamId(), {
        email,
        displayName,
        role: this.memberRole(),
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.memberAdded.emit();
          this.close();
        },
        error: (error) => {
          console.error('Error adding member:', error);
          this.errorMessage.set(error.error?.message || 'Failed to add member');
          this.isSubmitting.set(false);
        },
      });
  }

  /**
   * Close modal
   */
  protected close(): void {
    this.closeModal.emit();
  }

  /**
   * Handle backdrop click
   */
  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  /**
   * Get role badge color
   */
  protected getRoleBadgeColor(role: string): string {
    switch (role) {
      case 'admin':
        return 'bg-secondary/20 text-secondary border-secondary/30';
      case 'member':
        return 'bg-accent/20 text-accent border-accent/30';
      case 'viewer':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  }
}

import { Component, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TeamService } from '../../services/team.service';

@Component({
  selector: 'app-create-team-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-team-modal.html',
  styleUrl: './create-team-modal.css',
})
export class CreateTeamModal {
  // Services
  private readonly teamService = inject(TeamService);

  // Outputs
  readonly closeModal = output<void>();
  readonly teamCreated = output<void>();

  // Signals
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  // Form data
  protected teamName = signal('');
  protected teamDescription = signal('');

  /**
   * Handle form submission
   */
  protected onSubmit(): void {
    if (this.isSubmitting()) return;

    const name = this.teamName().trim();
    if (!name) {
      this.errorMessage.set('Team name is required');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.teamService
      .createTeam({
        name,
        description: this.teamDescription().trim(),
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.teamCreated.emit();
          this.close();
        },
        error: (error) => {
          console.error('Error creating team:', error);
          this.errorMessage.set(error.error?.message || 'Failed to create team');
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
}

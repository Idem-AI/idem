import { Component, OnInit, inject, PLATFORM_ID, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';

type Step = 'intro' | 'reason' | 'alternatives' | 'consequences' | 'confirm' | 'done';

const REASONS = [
  { value: 'not_useful', label: "IDEM ne répond pas à mes besoins" },
  { value: 'too_expensive', label: "C'est trop cher pour moi" },
  { value: 'found_alternative', label: "J'ai trouvé une autre solution" },
  { value: 'privacy', label: "Je veux protéger mes données personnelles" },
  { value: 'temporary', label: "Je fais une pause, je reviendrai peut-être" },
  { value: 'other', label: "Autre raison" },
];

@Component({
  selector: 'app-delete-account',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './delete-account.html',
})
export class DeleteAccount implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly authService = inject(AuthService);

  protected step = signal<Step>('intro');
  protected selectedReason = '';
  protected otherReason = '';
  protected confirmEmail = '';
  protected confirmChecked = false;
  protected isLoading = false;
  protected errorMessage = '';
  protected userEmail = '';

  protected readonly reasons = REASONS;

  protected readonly steps: { id: Step; label: string }[] = [
    { id: 'intro', label: 'Informations' },
    { id: 'reason', label: 'Motif' },
    { id: 'alternatives', label: 'Alternatives' },
    { id: 'consequences', label: 'Conséquences' },
    { id: 'confirm', label: 'Confirmation' },
  ];

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const user = this.authService.getCurrentUser();
    this.userEmail = user?.email ?? '';
  }

  get stepIndex(): number {
    const order: Step[] = ['intro', 'reason', 'alternatives', 'consequences', 'confirm', 'done'];
    return order.indexOf(this.step());
  }

  get progressPercent(): number {
    return Math.round((this.stepIndex / 4) * 100);
  }

  protected next(): void {
    const flow: Step[] = ['intro', 'reason', 'alternatives', 'consequences', 'confirm'];
    const idx = flow.indexOf(this.step() as Step);
    if (idx < flow.length - 1) {
      this.step.set(flow[idx + 1]);
      if (isPlatformBrowser(this.platformId)) window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  protected back(): void {
    const flow: Step[] = ['intro', 'reason', 'alternatives', 'consequences', 'confirm'];
    const idx = flow.indexOf(this.step() as Step);
    if (idx > 0) {
      this.step.set(flow[idx - 1]);
      if (isPlatformBrowser(this.platformId)) window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  protected canProceedFromReason(): boolean {
    if (!this.selectedReason) return false;
    if (this.selectedReason === 'other' && !this.otherReason.trim()) return false;
    return true;
  }

  protected canSubmit(): boolean {
    return (
      this.confirmEmail.trim().toLowerCase() === this.userEmail.toLowerCase() &&
      this.confirmChecked
    );
  }

  protected async submitDeletion(): Promise<void> {
    if (!this.canSubmit()) return;
    this.isLoading = true;
    this.errorMessage = '';
    try {
      await this.authService.requestAccountDeletion(
        this.selectedReason,
        this.selectedReason === 'other' ? this.otherReason : undefined,
      );
      this.step.set('done');
      if (isPlatformBrowser(this.platformId)) window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      this.errorMessage =
        "Une erreur s'est produite. Veuillez réessayer ou contacter support@idem.africa.";
    } finally {
      this.isLoading = false;
    }
  }

  protected isStepCompleted(id: Step): boolean {
    const order: Step[] = ['intro', 'reason', 'alternatives', 'consequences', 'confirm', 'done'];
    return order.indexOf(id) < order.indexOf(this.step());
  }
}

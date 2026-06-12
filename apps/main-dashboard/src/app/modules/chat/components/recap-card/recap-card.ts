import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '../../../../../environments/environment';
import { OnboardingPolicyAcceptances, OnboardingRecapData } from '../../models/chat.model';

/**
 * Carte récapitulative de l'onboarding conversationnel : l'utilisateur relit
 * ses réponses, accepte les politiques requises et confirme la création.
 */
@Component({
  selector: 'app-recap-card',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './recap-card.html',
  styleUrl: './recap-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecapCardComponent {
  readonly recap = input.required<OnboardingRecapData>();
  readonly busy = input<boolean>(false);

  readonly confirmed = output<OnboardingPolicyAcceptances>();
  readonly restartRequested = output<void>();

  protected readonly landingUrl = environment.services.domain;

  protected readonly privacy = signal(false);
  protected readonly terms = signal(false);
  protected readonly beta = signal(false);
  protected readonly marketing = signal(false);

  protected readonly canConfirm = computed(
    () => this.privacy() && this.terms() && this.beta() && !this.busy(),
  );

  protected confirm(): void {
    if (!this.canConfirm()) return;
    this.confirmed.emit({
      privacy: this.privacy(),
      terms: this.terms(),
      beta: this.beta(),
      marketing: this.marketing(),
    });
  }
}

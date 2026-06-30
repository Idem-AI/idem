import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ProjectModel } from '@idem/shared-models';
import { ChatDeliverablesService } from '../../services/chat-deliverables.service';
import { ChatBrandingService } from '../../services/chat-branding.service';
import { DeliverableKind } from '../../models/chat.model';

export type FeatureState = 'ready' | 'generate' | 'locked';

export interface FeatureSelection {
  kind: DeliverableKind;
  state: FeatureState;
}

interface FeatureTile {
  kind: DeliverableKind;
  image: string;
  titleKey: string;
  descKey: string;
  state: FeatureState;
  lockReasonKey?: string;
}

interface FeatureMeta {
  kind: DeliverableKind;
  image: string;
  descKey: string;
  /** Nécessite une identité de marque complète (logo + couleurs + typo) */
  needsBrandIdentity?: boolean;
}

// Illustrations partagées avec le tableau de bord (assets/images/dashboard).
const FEATURES: FeatureMeta[] = [
  { kind: 'branding', image: 'branding.png', descKey: 'chat.launcher.features.branding' },
  { kind: 'businessPlan', image: 'business_plan.png', descKey: 'chat.launcher.features.businessPlan' },
  { kind: 'pitchDeck', image: 'pitch_deck.png', descKey: 'chat.launcher.features.pitchDeck', needsBrandIdentity: true },
  { kind: 'finance', image: 'finance.png', descKey: 'chat.launcher.features.finance' },
  { kind: 'diagrams', image: 'diagrams.png', descKey: 'chat.launcher.features.diagrams' },
];

/**
 * Lanceur de fonctionnalités affiché à la première ouverture du chat.
 * Cartes illustrées (mêmes visuels que le tableau de bord), allégées : pas
 * d'étiquette de statut — un discret badge marque ce qui est déjà prêt, un
 * cadenas ce qui attend un prérequis. Un appel à compléter l'identité de
 * marque s'affiche tant qu'elle n'est pas terminée.
 */
@Component({
  selector: 'app-feature-launcher',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './feature-launcher.html',
  styleUrl: './feature-launcher.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureLauncherComponent {
  private readonly deliverables = inject(ChatDeliverablesService);
  private readonly branding = inject(ChatBrandingService);

  readonly project = input<ProjectModel | null>(null);
  readonly projectName = input<string>('');
  readonly disabled = input<boolean>(false);

  readonly selected = output<FeatureSelection>();
  /** Demande de compléter l'identité de marque (bandeau d'invitation). */
  readonly completeBranding = output<void>();

  protected readonly brandComplete = computed(() => this.branding.isComplete(this.project()));

  protected readonly tiles = computed<FeatureTile[]>(() => {
    const project = this.project();
    const brandComplete = this.brandComplete();

    return FEATURES.map((f) => {
      let state: FeatureState;
      let lockReasonKey: string | undefined;

      if (f.needsBrandIdentity && !brandComplete) {
        state = 'locked';
        lockReasonKey = 'chat.launcher.locked.needsBranding';
      } else if (f.kind === 'branding') {
        state = brandComplete && this.branding.hasCharte(project) ? 'ready' : 'generate';
      } else {
        state = this.deliverables.buildCard(f.kind, project).available ? 'ready' : 'generate';
      }

      return {
        kind: f.kind,
        image: `assets/images/dashboard/${f.image}`,
        titleKey: this.deliverables.config(f.kind).titleKey,
        descKey: f.descKey,
        state,
        lockReasonKey,
      };
    });
  });

  protected select(tile: FeatureTile): void {
    if (this.disabled() || tile.state === 'locked') return;
    this.selected.emit({ kind: tile.kind, state: tile.state });
  }

  protected onCompleteBranding(): void {
    if (this.disabled()) return;
    this.completeBranding.emit();
  }
}

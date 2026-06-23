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
  icon: string;
  /** Couleur d'accent sémantique de la fonctionnalité (icône) */
  accent: string;
  titleKey: string;
  descKey: string;
  state: FeatureState;
  lockReasonKey?: string;
}

interface FeatureMeta {
  kind: DeliverableKind;
  icon: string;
  accent: string;
  descKey: string;
  /** Nécessite une identité de marque complète (logo + couleurs + typo) */
  needsBrandIdentity?: boolean;
}

const FEATURES: FeatureMeta[] = [
  { kind: 'branding', icon: 'pi pi-palette', accent: '#ec4899', descKey: 'chat.launcher.features.branding' },
  { kind: 'businessPlan', icon: 'pi pi-calendar', accent: '#6366f1', descKey: 'chat.launcher.features.businessPlan' },
  { kind: 'pitchDeck', icon: 'pi pi-desktop', accent: '#22d3ee', descKey: 'chat.launcher.features.pitchDeck', needsBrandIdentity: true },
  { kind: 'finance', icon: 'pi pi-chart-pie', accent: '#10b981', descKey: 'chat.launcher.features.finance' },
  { kind: 'diagrams', icon: 'pi pi-sitemap', accent: '#f59e0b', descKey: 'chat.launcher.features.diagrams' },
  { kind: 'legalDocs', icon: 'pi pi-file-edit', accent: '#94a3b8', descKey: 'chat.launcher.features.legalDocs' },
];

/**
 * Lanceur de fonctionnalités affiché à la première ouverture du chat :
 * grille centrée façon tableau de bord (allégée). Chaque fonctionnalité
 * indique son état (prête / à générer / verrouillée tant qu'un prérequis
 * manque) et reste actionnable d'un clic.
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

  protected readonly tiles = computed<FeatureTile[]>(() => {
    const project = this.project();
    const brandComplete = this.branding.isComplete(project);

    return FEATURES.map((f) => {
      let state: FeatureState;
      let lockReasonKey: string | undefined;

      if (f.needsBrandIdentity && !brandComplete) {
        state = 'locked';
        lockReasonKey = 'chat.launcher.locked.needsBranding';
      } else if (f.kind === 'branding') {
        // L'identité de marque est la fondation : jamais verrouillée
        state = brandComplete && this.branding.hasCharte(project) ? 'ready' : 'generate';
      } else {
        state = this.deliverables.buildCard(f.kind, project).available ? 'ready' : 'generate';
      }

      return {
        kind: f.kind,
        icon: f.icon,
        accent: f.accent,
        titleKey: this.deliverables.config(f.kind).titleKey,
        descKey: f.descKey,
        state,
        lockReasonKey,
      };
    });
  });

  protected readonly readyCount = computed(
    () => this.tiles().filter((t) => t.state === 'ready').length,
  );

  protected select(tile: FeatureTile): void {
    if (this.disabled() || tile.state === 'locked') return;
    this.selected.emit({ kind: tile.kind, state: tile.state });
  }
}

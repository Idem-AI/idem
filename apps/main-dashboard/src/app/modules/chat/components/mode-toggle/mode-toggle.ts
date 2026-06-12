import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { UiModeService } from '../../../../shared/services/ui-mode.service';
import { UiMode } from '../../models/chat.model';

/**
 * Switch de mode Chat / Avancé.
 * Compact, toujours visible dans les sidebars des deux modes.
 */
@Component({
  selector: 'app-mode-toggle',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './mode-toggle.html',
  styleUrl: './mode-toggle.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModeToggleComponent {
  private readonly uiModeService = inject(UiModeService);

  /** Mode actuellement affiché (contexte d'où le toggle est rendu) */
  readonly current = input.required<UiMode>();
  /** Variante icône seule pour les sidebars repliées */
  readonly collapsed = input<boolean>(false);

  protected switchTo(mode: UiMode): void {
    if (mode === this.current()) return;
    if (mode === 'chat') {
      this.uiModeService.switchToChat();
    } else {
      this.uiModeService.switchToAdvanced();
    }
  }

  protected toggle(): void {
    this.switchTo(this.current() === 'chat' ? 'advanced' : 'chat');
  }
}

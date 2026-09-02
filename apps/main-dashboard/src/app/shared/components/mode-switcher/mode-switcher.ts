import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { UiModeService } from '../../services/ui-mode.service';
import { OnboardingSurveyService } from '../../services/onboarding-survey.service';
import { UiMode } from '../../../modules/chat/models/chat.model';

interface ModeOption {
  mode: UiMode;
  icon: string;
  labelKey: string;
  descriptionKey: string;
}

const MODE_OPTIONS: readonly ModeOption[] = [
  {
    mode: 'guided',
    icon: 'pi pi-compass',
    labelKey: 'modes.guided.name',
    descriptionKey: 'modes.guided.short',
  },
  {
    mode: 'chat',
    icon: 'pi pi-comments',
    labelKey: 'modes.chat.name',
    descriptionKey: 'modes.chat.short',
  },
  {
    mode: 'advanced',
    icon: 'pi pi-th-large',
    labelKey: 'modes.advanced.name',
    descriptionKey: 'modes.advanced.short',
  },
];

/**
 * Sélecteur de mode d'interface.
 *
 * Remplace l'ancien switch à deux positions, que beaucoup d'utilisateurs ne
 * repéraient pas. Ici le contrôle est explicitement libellé (« Mode : Assisté »)
 * et ouvre une liste où chaque mode est décrit en une ligne : on comprend au
 * premier regard qu'on peut changer, et ce que ça change.
 */
@Component({
  selector: 'app-mode-switcher',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './mode-switcher.html',
  styleUrl: './mode-switcher.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModeSwitcherComponent {
  private readonly uiModeService = inject(UiModeService);
  private readonly survey = inject(OnboardingSurveyService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Mode affiché comme actif (par défaut : le mode global mémorisé). */
  readonly current = input<UiMode | null>(null);
  /** Variante compacte : icône seule, pour les sidebars repliées. */
  readonly compact = input<boolean>(false);
  /** Aligne le panneau à droite du déclencheur (headers). */
  readonly alignRight = input<boolean>(false);
  /** Ouvre le panneau vers le haut (pieds de sidebar, où il n'y a pas la place). */
  readonly dropUp = input<boolean>(false);

  protected readonly isOpen = signal(false);
  protected readonly options = MODE_OPTIONS;

  protected readonly activeMode = computed<UiMode>(
    () => this.current() ?? this.uiModeService.mode(),
  );

  protected readonly activeOption = computed<ModeOption>(
    () => MODE_OPTIONS.find((o) => o.mode === this.activeMode()) ?? MODE_OPTIONS[2],
  );

  /** Mode conseillé par le sondage d'accueil, mis en avant dans la liste. */
  protected readonly recommendedMode = computed(() => this.survey.recommendedMode());

  protected toggle(): void {
    this.isOpen.update((open) => !open);
  }

  protected close(): void {
    this.isOpen.set(false);
  }

  protected select(mode: UiMode): void {
    this.close();
    if (mode === this.activeMode()) return;
    this.uiModeService.switchTo(mode);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close();
  }
}

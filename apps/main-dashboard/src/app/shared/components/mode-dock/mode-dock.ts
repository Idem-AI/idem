import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { filter, map, startWith } from 'rxjs/operators';
import { AuthService } from '../../../modules/auth/services/auth.service';
import { UiMode } from '../../../modules/chat/models/chat.model';
import { OnboardingSurveyService } from '../../services/onboarding-survey.service';
import { UiModeService } from '../../services/ui-mode.service';

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
 * Mode d'affichage déduit de la disposition servie par la route : la page sait
 * toujours à quel mode elle appartient, alors que la préférence mémorisée peut
 * être en retard (lien partagé, retour arrière, session restaurée).
 */
const LAYOUT_MODE: Readonly<Record<string, UiMode>> = {
  guided: 'guided',
  chat: 'chat',
  dashboard: 'advanced',
  global: 'advanced',
};

/**
 * Dock flottant de changement de mode d'interface.
 *
 * Monté une seule fois à la racine, il remplace les copies du sélecteur qui
 * vivaient dans chaque en-tête et chaque pied de sidebar : la commande la plus
 * structurante de l'application était à un endroit différent selon le mode, et
 * disparaissait dès que la sidebar était repliée. Ici elle occupe toujours le
 * même coin, à la même taille, quelle que soit la page.
 *
 * Deux exceptions, portées par les données de route :
 *  - les pages d'édition de contenu (`documentType`), où l'éditeur est en
 *    plein écran et où rien ne doit flotter au-dessus du document ;
 *  - le paiement (`layout: 'bare'`), volontairement sans chrome.
 */
@Component({
  selector: 'app-mode-dock',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './mode-dock.html',
  styleUrl: './mode-dock.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.is-hidden]': '!isVisible()',
    '[class.is-chat]': 'activeLayout() === "chat"',
  },
})
export class ModeDockComponent {
  private readonly uiModeService = inject(UiModeService);
  private readonly survey = inject(OnboardingSurveyService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly optionButtons = viewChildren<ElementRef<HTMLButtonElement>>('option');

  protected readonly isOpen = signal(false);
  protected readonly options = MODE_OPTIONS;

  /** Utilisateur connecté : hors session, changer de mode n'a nulle part où aller. */
  private readonly user = toSignal(inject(AuthService).user$, { initialValue: undefined });

  /** Données de la route la plus profonde, recalculées à chaque navigation. */
  private readonly routeData = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.deepestRouteData()),
    ),
    { initialValue: {} as Record<string, unknown> },
  );

  protected readonly activeLayout = computed(
    () => this.routeData()['layout'] as string | undefined,
  );

  protected readonly isVisible = computed(() => {
    if (!this.user()) {
      return false;
    }
    const data = this.routeData();
    return !data['documentType'] && data['layout'] !== 'bare';
  });

  protected readonly activeMode = computed<UiMode>(() => {
    const layout = this.activeLayout();
    return (layout ? LAYOUT_MODE[layout] : undefined) ?? this.uiModeService.mode();
  });

  protected readonly activeOption = computed<ModeOption>(
    () => MODE_OPTIONS.find((option) => option.mode === this.activeMode()) ?? MODE_OPTIONS[2],
  );

  /** Mode conseillé par le sondage d'accueil, mis en avant dans la liste. */
  protected readonly recommendedMode = computed(() => this.survey.recommendedMode());

  constructor() {
    // Une navigation referme le panneau : sans ça il survivait au changement de
    // page et restait ouvert au-dessus d'un écran qu'on n'a pas demandé.
    effect(() => {
      this.routeData();
      this.isOpen.set(false);
    });
  }

  protected toggle(): void {
    const opening = !this.isOpen();
    this.isOpen.set(opening);
    if (opening) {
      // Le panneau s'ouvre sur le mode actif : au clavier, on part de là où on est.
      queueMicrotask(() => this.focusOption(this.indexOf(this.activeMode())));
    }
  }

  protected close(restoreFocus = false): void {
    if (!this.isOpen()) {
      return;
    }
    this.isOpen.set(false);
    if (restoreFocus) {
      this.trigger()?.nativeElement.focus();
    }
  }

  protected select(mode: UiMode): void {
    this.close();
    if (mode === this.activeMode()) {
      return;
    }
    this.uiModeService.switchTo(mode);
  }

  /** Navigation au clavier dans le panneau : flèches, Début/Fin, Échap. */
  protected onPanelKeydown(event: KeyboardEvent, index: number): void {
    const count = this.options.length;
    switch (event.key) {
      case 'ArrowDown':
        this.focusOption((index + 1) % count);
        break;
      case 'ArrowUp':
        this.focusOption((index - 1 + count) % count);
        break;
      case 'Home':
        this.focusOption(0);
        break;
      case 'End':
        this.focusOption(count - 1);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.isOpen() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close(true);
  }

  private focusOption(index: number): void {
    this.optionButtons()[index]?.nativeElement.focus();
  }

  private indexOf(mode: UiMode): number {
    const index = MODE_OPTIONS.findIndex((option) => option.mode === mode);
    return index === -1 ? 0 : index;
  }

  /**
   * Fusionne les données de toute la chaîne de routes actives : une route
   * enfant peut porter `documentType` là où le parent porte `layout`.
   */
  private deepestRouteData(): Record<string, unknown> {
    let route = this.router.routerState.root.firstChild;
    let data: Record<string, unknown> = {};
    while (route) {
      data = { ...data, ...route.snapshot.data };
      route = route.firstChild;
    }
    return data;
  }
}

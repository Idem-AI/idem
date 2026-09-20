import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../modules/auth/services/auth.service';
import { BillingService } from '../../../modules/billing/services/billing.service';
import { CurrentProjectService } from '../../services/current-project.service';
import { BetaBadgeComponent } from '../beta-badge/beta-badge';
import { LanguageSelectorComponent } from '../language-selector/language-selector';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle';

/**
 * La barre du haut, une seule fois pour toute l'application.
 *
 * Elle existait en deux exemplaires : l'un imbriqué dans la barre latérale du
 * projet, l'autre dans la disposition sans barre latérale. Les deux portaient
 * les mêmes commandes, jamais tout à fait pareilles — la langue et le thème ne
 * figuraient que dans l'une, le menu utilisateur n'avait pas les mêmes entrées,
 * et le compteur affiché n'était pas le même chiffre. Toute correction devait
 * être faite deux fois, et l'a rarement été.
 *
 * Ce qu'elle porte, de gauche à droite : la sortie vers la console, le projet
 * ouvert quand on en consulte un, puis l'état du compte, les préférences et
 * l'identité. Les commandes de la barre latérale ne sont affichées que là où
 * une barre latérale existe — c'est l'unique différence entre les deux
 * dispositions, et elle est portée par un paramètre, pas par une copie.
 */
@Component({
  selector: 'app-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    BetaBadgeComponent,
    LanguageSelectorComponent,
    ThemeToggleComponent,
  ],
  // Un clic ailleurs, ou Échap, referme les menus ouverts. Les bascules
  // arrêtent la propagation, sinon ce même clic les refermerait aussitôt.
  host: {
    '(document:click)': 'closeMenus()',
    '(document:keydown.escape)': 'closeMenus()',
  },

  template: `
    <nav
      class="fixed top-0 left-0 right-0 z-50 glass border-b border-[var(--glass-border)] px-3 py-3 lg:px-6"
    >
      <div class="flex items-center justify-between gap-3">
        <div class="flex min-w-0 items-center">
          <!-- Commandes de la barre latérale : seulement là où il y en a une -->
          @if (withSidebar()) {
            <button
              type="button"
              class="mr-2 inline-flex items-center rounded-lg p-2 text-sm text-text-tertiary transition-colors hover:bg-[var(--glass-bg-light)] focus:outline-none focus:ring-2 focus:ring-primary/50 md:hidden"
              (click)="openMobileDrawer.emit()"
            >
              <span class="sr-only">{{ 'dashboard.sidebar.sr.openMobileMenu' | translate }}</span>
              <i class="pi pi-bars text-lg" aria-hidden="true"></i>
            </button>

            <button
              type="button"
              class="mr-2 hidden items-center rounded-lg p-2 text-sm text-text-tertiary transition-colors hover:bg-[var(--glass-bg-light)] focus:outline-none focus:ring-2 focus:ring-primary/50 md:inline-flex"
              (click)="toggleSidebar.emit()"
            >
              <span class="sr-only">{{ 'dashboard.sidebar.sr.toggleSidebar' | translate }}</span>
              <i class="pi pi-bars text-lg" aria-hidden="true"></i>
            </button>
          }

          <!-- Logo : vers la console, d'où partent tous les projets -->
          <a routerLink="/console" class="flex shrink-0 items-center gap-2">
            <img
              src="/assets/icons/logo_white.png"
              [alt]="'dashboard.sidebar.logoAlt' | translate"
              class="h-auto w-[50px] sm:w-[120px] dark:hidden"
            />
            <img
              src="/assets/icons/logo_dark.png"
              [alt]="'dashboard.sidebar.logoAlt' | translate"
              class="hidden h-auto w-[50px] sm:w-[120px] dark:block"
            />
            <app-beta-badge />
          </a>

          <!-- Projet ouvert : hors d'un projet, il n'y a rien à sélectionner -->
          @if (withProjectSelector()) {
            <div class="project-selector relative ml-6 hidden md:block">
              <button
                type="button"
                data-tour="project-selector"
                class="glass-card flex min-w-[200px] items-center justify-between gap-3 px-4 py-2 transition-colors hover:bg-[var(--glass-bg-light)]"
                [attr.aria-expanded]="isProjectMenuOpen()"
                aria-haspopup="listbox"
                (click)="toggleProjectMenu($event)"
              >
                <span class="flex min-w-0 items-center gap-3">
                  <span class="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true"></span>
                  <span class="truncate font-medium text-text-primary">
                    {{ projects.selected()?.name || ('dashboard.sidebar.selectProject' | translate) }}
                  </span>
                </span>
                <i
                  class="pi pi-chevron-down text-text-tertiary transition-transform duration-200"
                  [class.rotate-180]="isProjectMenuOpen()"
                  aria-hidden="true"
                ></i>
              </button>

              @if (isProjectMenuOpen()) {
                <div
                  class="glass-card absolute left-0 top-full z-50 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-[var(--glass-border)] py-2 shadow-xl"
                  role="listbox"
                >
                  <a
                    routerLink="/projects"
                    class="flex w-full items-center gap-3 px-4 py-3 text-left text-text-primary transition-colors hover:bg-[var(--glass-bg-light)]"
                    (click)="closeMenus()"
                  >
                    <i class="pi pi-list text-primary" aria-hidden="true"></i>
                    <span class="font-medium">
                      {{ 'dashboard.sidebar.viewAllProjects' | translate }}
                    </span>
                  </a>

                  @for (project of projects.projects(); track project.id) {
                    <button
                      type="button"
                      role="option"
                      class="flex w-full items-center gap-3 px-4 py-3 text-left text-text-primary transition-colors hover:bg-[var(--glass-bg-light)]"
                      [attr.aria-selected]="projects.selected()?.id === project.id"
                      [class.bg-primary]="projects.selected()?.id === project.id"
                      [class.text-white]="projects.selected()?.id === project.id"
                      (click)="chooseProject(project.id!)"
                    >
                      <span class="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true"></span>
                      <span class="truncate font-medium">{{ project.name }}</span>
                    </button>
                  }
                </div>
              }
            </div>
          }
        </div>

        <div class="flex shrink-0 items-center gap-2 sm:gap-3">
          <!--
            L'état du compte, à la place de l'ancienne jauge.
            Celle-ci s'intitulait « Crédits » tout en affichant le quota de
            générations du jour : deux grandeurs sans rapport, même nom, et un
            chiffre qui ne correspondait jamais au solde réel. Ici c'est le
            solde de crédits, le même que sous « Mon compte ».
          -->
          @if (account(); as summary) {
            <a
              routerLink="/account"
              class="flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] px-2 py-1.5 text-xs transition-colors hover:border-[var(--color-primary)] sm:gap-2 sm:px-2.5"
              [attr.aria-label]="'account.title' | translate"
            >
              <i
                class="pi pi-bolt text-[11px]"
                [class.text-warning]="summary.isLow"
                [class.text-text-tertiary]="!summary.isLow"
                aria-hidden="true"
              ></i>
              <span
                class="tabular-nums"
                [class.text-warning]="summary.isLow"
                [class.text-text-secondary]="!summary.isLow"
              >
                <span class="sm:hidden">{{ summary.credits }}</span>
                <span class="hidden sm:inline">
                  {{ 'account.creditsShort' | translate: { count: summary.credits } }}
                </span>
              </span>

              @if (summary.needsAttention) {
                <span class="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true"></span>
              }
            </a>
          }

          @if (user(); as account) {
            <div class="user-menu relative">
              <button
                type="button"
                class="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-[var(--glass-bg-light)]"
                [attr.aria-expanded]="isUserMenuOpen()"
                aria-haspopup="menu"
                (click)="toggleUserMenu($event)"
              >
                <span class="sr-only">{{ 'dashboard.sidebar.userAvatarAlt' | translate }}</span>
                @if (account.photoURL) {
                  <img
                    [src]="account.photoURL"
                    alt=""
                    class="h-8 w-8 rounded-full border-2 border-[var(--glass-border-medium)] md:h-10 md:w-10"
                  />
                } @else {
                  <span
                    class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 md:h-10 md:w-10"
                  >
                    <i class="pi pi-user text-primary" aria-hidden="true"></i>
                  </span>
                }
              </button>

              @if (isUserMenuOpen()) {
                <div
                  class="glass-card absolute right-0 z-50 mt-2 w-64 rounded-xl border border-[var(--glass-border)] py-2 shadow-xl"
                  role="menu"
                  (click)="$event.stopPropagation()"
                >
                  <div class="border-b border-[var(--glass-border)] px-4 py-3">
                    <p class="truncate font-medium text-text-primary">{{ account.displayName }}</p>
                    <p class="truncate text-sm text-text-tertiary">{{ account.email }}</p>
                  </div>

                  @for (entry of userMenu; track entry.route) {
                    <a
                      [routerLink]="entry.route"
                      role="menuitem"
                      class="flex items-center gap-3 px-4 py-3 text-text-primary transition-colors hover:bg-[var(--glass-bg-light)]"
                      (click)="closeMenus()"
                    >
                      <i [class]="entry.icon" class="text-primary" aria-hidden="true"></i>
                      <span>{{ entry.labelKey | translate }}</span>
                    </a>
                  }

                  <!--
                    Préférences dans le menu plutôt que dans la barre : sur
                    mobile, deux commandes de plus à côté du logo, du solde et
                    de l'avatar rendaient la barre illisible. Ici elles sont à
                    un clic, et toujours au même endroit.
                  -->
                  <hr class="my-2 border-[var(--glass-border)]" />

                  <div class="flex items-center justify-between gap-3 px-4 py-2">
                    <span class="text-sm text-text-secondary">
                      {{ 'account.language' | translate }}
                    </span>
                    <app-language-selector direction="down" align="right" />
                  </div>

                  <div class="flex items-center justify-between gap-3 px-4 py-2">
                    <span class="text-sm text-text-secondary">
                      {{ 'account.theme' | translate }}
                    </span>
                    <app-theme-toggle />
                  </div>

                  <hr class="my-2 border-[var(--glass-border)]" />

                  <button
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center gap-3 px-4 py-3 text-danger transition-colors hover:bg-danger/10"
                    (click)="logout()"
                  >
                    <i class="pi pi-sign-out" aria-hidden="true"></i>
                    <span>{{ 'dashboard.sidebar.userMenu.logout' | translate }}</span>
                  </button>
                </div>
              }
            </div>
          } @else {
            <div class="h-10 w-10 animate-pulse rounded-full bg-[var(--color-surface-3)]"></div>
          }
        </div>
      </div>
    </nav>
  `,
})
export class TopbarComponent {
  private readonly auth = inject(AuthService);
  private readonly billing = inject(BillingService);
  private readonly router = inject(Router);

  // Lu par le gabarit : protégé plutôt que privé.
  protected readonly projects = inject(CurrentProjectService);

  /** Vrai quand une barre latérale accompagne cette barre du haut. */
  readonly withSidebar = input(false);

  /** Vrai sur les pages d'un projet, où il y a un projet à changer. */
  readonly withProjectSelector = input(false);

  readonly toggleSidebar = output<void>();
  readonly openMobileDrawer = output<void>();

  protected readonly isProjectMenuOpen = signal(false);
  protected readonly isUserMenuOpen = signal(false);

  protected readonly user = toSignal(this.auth.user$);

  protected readonly userMenu = [
    { route: '/account', icon: 'pi pi-wallet', labelKey: 'account.title' },
    { route: '/account/profile', icon: 'pi pi-user', labelKey: 'dashboard.sidebar.userMenu.profile' },
    { route: '/projects', icon: 'pi pi-folder', labelKey: 'dashboard.sidebar.viewAllProjects' },
  ];

  /**
   * Le solde de crédits, tel qu'il figurera aussi sous « Mon compte ».
   *
   * `null` tant que la facturation n'a pas répondu : un « 0 » par défaut ferait
   * croire à un compte vide à chaque chargement de page.
   */
  protected readonly account = computed(() => {
    const plans = this.billing.plans();
    if (plans.length === 0) return null;

    // iDeploy se facture à l'abonnement et aux ressources : ses crédits ne se
    // dépensent pas en générant, les compter ici gonflerait le chiffre.
    const credits = plans
      .filter((plan) => plan.engine !== 'ideploy')
      .reduce((total, plan) => total + plan.credits, 0);

    return {
      credits,
      // Moins de vingt crédits : moins d'un livrable structurant. Alerter plus
      // tôt banaliserait l'avertissement.
      isLow: credits < 20,
      needsAttention: this.billing.attention() !== null,
    };
  });

  constructor() {
    // Montée sur toutes les pages : c'est le bon endroit pour charger une fois
    // les droits, le catalogue et la liste des projets.
    if (!this.billing.me()) this.billing.loadMe().subscribe();
    if (!this.billing.catalog()) this.billing.loadCatalog().subscribe();
    this.projects.load().subscribe();
  }

  /**
   * Ouvre un menu et referme l'autre.
   *
   * `stopPropagation` empêche l'écouteur de fermeture posé sur le document de
   * refermer aussitôt ce que ce clic vient d'ouvrir.
   */
  protected toggleProjectMenu(event: Event): void {
    event.stopPropagation();
    this.isUserMenuOpen.set(false);
    this.isProjectMenuOpen.update((open) => !open);
  }

  protected toggleUserMenu(event: Event): void {
    event.stopPropagation();
    this.isProjectMenuOpen.set(false);
    this.isUserMenuOpen.update((open) => !open);
  }

  protected closeMenus(): void {
    this.isProjectMenuOpen.set(false);
    this.isUserMenuOpen.set(false);
  }

  protected chooseProject(projectId: string): void {
    this.closeMenus();
    this.projects.select(projectId);
  }

  protected async logout(): Promise<void> {
    this.closeMenus();

    try {
      await firstValueFrom(this.auth.logout());
    } finally {
      // La session locale est déjà abandonnée : on quitte l'espace authentifié
      // même si l'appel de déconnexion a échoué.
      void this.router.navigate(['/login']);
    }
  }
}

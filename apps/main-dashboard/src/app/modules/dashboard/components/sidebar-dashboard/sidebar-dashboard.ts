import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  signal,
  computed,
  DestroyRef,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate, state } from '@angular/animations';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { UiModeService } from '../../../../shared/services/ui-mode.service';
import { GuidedJourneyService } from '../../../guided/services/guided-journey.service';
import { BillingService } from '../../../billing/services/billing.service';
import { CurrentProjectService } from '../../../../shared/services/current-project.service';
import { LanguageSelectorComponent } from '../../../../shared/components/language-selector/language-selector';
import { ThemeToggleComponent } from '../../../../shared/components/theme-toggle/theme-toggle';

@Component({
  selector: 'app-sidebar-dashboard',
  templateUrl: './sidebar-dashboard.html',
  styleUrls: ['./sidebar-dashboard.css'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    LanguageSelectorComponent,
    ThemeToggleComponent,
  ],
  animations: [
    trigger('slideInOut', [
      transition(':enter', [
        style({ transform: 'translateY(-100%)' }),
        animate('300ms ease-in', style({ transform: 'translateY(0%)' })),
      ]),
      transition(':leave', [animate('300ms ease-out', style({ transform: 'translateY(-100%)' }))]),
    ]),
    trigger('mobileDrawerSlide', [
      transition(':enter', [
        style({ transform: 'translateX(-100%)', opacity: 0 }),
        animate(
          '350ms cubic-bezier(0.25, 0.8, 0.25, 1)',
          style({ transform: 'translateX(0%)', opacity: 1 }),
        ),
      ]),
      transition(':leave', [
        style({ transform: 'translateX(0%)', opacity: 1 }),
        animate(
          '300ms cubic-bezier(0.4, 0.0, 0.2, 1)',
          style({ transform: 'translateX(-100%)', opacity: 0 }),
        ),
      ]),
    ]),
    trigger('backdropFade', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('250ms ease-out', style({ opacity: 1 })),
      ]),
      transition(':leave', [animate('200ms ease-in', style({ opacity: 0 }))]),
    ]),
    trigger('sidebarExpand', [
      state(
        'expanded',
        style({
          width: '260px',
        }),
      ),
      state(
        'collapsed',
        style({
          width: '80px',
        }),
      ),
      transition('expanded <=> collapsed', [animate('300ms ease-in-out')]),
    ]),
    trigger('fadeInOut', [
      state('visible', style({ opacity: 1 })),
      state('hidden', style({ opacity: 0, display: 'none' })),
      transition('visible <=> hidden', [animate('200ms ease-in-out')]),
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarDashboard implements OnInit {
  // Services and Router
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly uiModeService = inject(UiModeService);
  private readonly journey = inject(GuidedJourneyService);
  private readonly billing = inject(BillingService);

  // Lu par le gabarit (tiroir mobile) : protégé plutôt que privé.
  protected readonly projects = inject(CurrentProjectService);

  // Navigation items
  protected readonly navigationItems = signal<
    Array<{
      labelKey: string;
      icon: string;
      route: string;
      isActive: boolean;
      isNew?: boolean;
      isExpanded?: boolean;
      children?: Array<{ labelKey: string; route: string; icon: string; isActive: boolean }>;
    }>
  >([
    {
      labelKey: 'dashboard.sidebar.projectHome',
      icon: 'pi pi-home',
      route: 'project/dashboard',
      isActive: false,
    },
    {
      labelKey: 'dashboard.sidebar.branding',
      icon: 'pi pi-palette',
      route: 'project/branding',
      isActive: false,
    },
    {
      labelKey: 'dashboard.sidebar.businessPlan',
      icon: 'pi pi-calendar',
      route: 'project/business-plan',
      isActive: false,
    },
    {
      labelKey: 'dashboard.sidebar.finance',
      icon: 'pi pi-chart-pie',
      route: 'project/finance',
      isActive: false,
      isExpanded: false,
      children: [
        {
          labelKey: 'dashboard.finance.sections.overview',
          route: 'project/finance',
          icon: 'pi pi-chart-pie',
          isActive: false,
        },
        {
          labelKey: 'dashboard.finance.sections.products',
          route: 'project/finance/products',
          icon: 'pi pi-tag',
          isActive: false,
        },
        {
          labelKey: 'dashboard.finance.sections.sales',
          route: 'project/finance/sales',
          icon: 'pi pi-shopping-cart',
          isActive: false,
        },
        {
          labelKey: 'dashboard.finance.sections.charges',
          route: 'project/finance/charges',
          icon: 'pi pi-wallet',
          isActive: false,
        },
        {
          labelKey: 'dashboard.finance.sections.investments',
          route: 'project/finance/investments',
          icon: 'pi pi-briefcase',
          isActive: false,
        },
        {
          labelKey: 'dashboard.finance.sections.amortization',
          route: 'project/finance/amortization',
          icon: 'pi pi-history',
          isActive: false,
        },
        {
          labelKey: 'dashboard.finance.sections.financing',
          route: 'project/finance/financing',
          icon: 'pi pi-money-bill',
          isActive: false,
        },
        {
          labelKey: 'dashboard.finance.sections.exploitation',
          route: 'project/finance/exploitation',
          icon: 'pi pi-chart-line',
          isActive: false,
        },
        {
          labelKey: 'dashboard.finance.sections.bilan',
          route: 'project/finance/bilan',
          icon: 'pi pi-book',
          isActive: false,
        },
        {
          labelKey: 'dashboard.finance.sections.cashflow',
          route: 'project/finance/cashflow',
          icon: 'pi pi-arrow-right-arrow-left',
          isActive: false,
        },
        {
          labelKey: 'dashboard.finance.sections.ratios',
          route: 'project/finance/ratios',
          icon: 'pi pi-percentage',
          isActive: false,
        },
      ],
    },
    {
      labelKey: 'dashboard.sidebar.pitchDeck',
      icon: 'pi pi-desktop',
      route: 'project/pitch-deck',
      isActive: false,
    },
    {
      labelKey: 'dashboard.sidebar.communication',
      icon: 'pi pi-megaphone',
      route: 'project/communication',
      isActive: false,
    },
    {
      labelKey: 'dashboard.sidebar.legalDocs',
      icon: 'pi pi-file-edit',
      route: 'project/legal-docs',
      isActive: false,
    },
    {
      labelKey: 'dashboard.sidebar.simulations',
      icon: 'pi pi-bolt',
      route: 'project/simulations',
      isActive: false,
      isNew: true,
    },
    {
      labelKey: 'dashboard.sidebar.advisor',
      icon: 'pi pi-comments',
      route: 'project/advisor',
      isActive: false,
    },
    {
      labelKey: 'dashboard.sidebar.diagrams',
      icon: 'pi pi-chart-line',
      route: 'project/diagrams',
      isActive: false,
    },
    {
      labelKey: 'dashboard.sidebar.development',
      icon: 'pi pi-code',
      route: 'project/development',
      isActive: false,
    },
    {
      labelKey: 'dashboard.sidebar.deployment',
      icon: 'pi pi-send',
      route: 'project/ideploy',
      isActive: false,
    },
  ]);

  // ─────────────────────────────────────────── Navigation du mode Assisté

  protected readonly isGuidedMode = computed(() => this.uiModeService.mode() === 'guided');

  /**
   * Le menu complet reste affiché en mode Assisté, mais tout ce que le
   * parcours n'a pas encore ouvert apparaît grisé et cadenassé : on voit où
   * l'on va sans pouvoir y sauter. Les étapes déjà produites, elles,
   * redeviennent cliquables — ce qui est fait reste consultable.
   */
  protected readonly displayedNavItems = computed(() => {
    const guided = this.isGuidedMode();
    return this.navigationItems().map((item) => {
      const locked = guided && !this.journey.isRouteAllowed(`/${item.route}`);
      return {
        ...item,
        locked,
        // Un groupe verrouillé ne se déplie pas : ses sous-pages sont fermées aussi.
        isExpanded: locked ? false : item.isExpanded,
      };
    });
  });

  /**
   * Clic sur une entrée verrouillée : on bloque la navigation et on explique.
   * Le `routerLink` est déjà neutralisé, ceci couvre le clic milieu / Entrée.
   */
  protected onNavItemClick(item: { route: string; locked: boolean }, event: Event): void {
    if (!item.locked) return;
    event.preventDefault();
    event.stopPropagation();
    this.journey.reportBlocked(`/${item.route}`);
  }

  /** Un groupe verrouillé (Finances) ouvre la modale au lieu de se déplier. */
  protected onNavGroupClick(item: { route: string; locked: boolean }, event: Event): void {
    if (item.locked) {
      this.onNavItemClick(item, event);
      return;
    }
    this.toggleExpand(item);
  }

  /** Version mobile : même verrou, plus la fermeture du tiroir. */
  protected onMobileNavItemClick(item: { route: string; locked: boolean }, event: Event): void {
    if (item.locked) {
      this.onNavItemClick(item, event);
      return;
    }
    this.toggleMobileDrawer();
  }

  /** Toggle d'expansion d'un item parent (Finances) */
  toggleExpand(item: { route: string }): void {
    const items = this.navigationItems();
    this.navigationItems.set(
      items.map((i) => (i.route === item.route ? { ...i, isExpanded: !i.isExpanded } : i)),
    );
  }

  /**
   * L'offre et les crédits, résumés pour le pied de la barre.
   *
   * Tirés du même signal que « Mon compte » : le chiffre affiché en permanence
   * et celui de la page de facturation ne peuvent pas diverger, et un paiement
   * qui aboutit les met à jour tous les deux d'un coup.
   *
   * Rien n'est traduit ici. `instant()` lit la table de traduction au moment du
   * calcul sans s'y abonner : le résumé serait figé dans la langue active au
   * premier rendu et ne suivrait pas un changement de langue. Le gabarit reçoit
   * donc une clé et un nombre, et c'est le pipe `translate` — lui, réactif —
   * qui rend le texte.
   *
   * `null` tant que la facturation n'a pas répondu : un « 0 crédit » affiché
   * par défaut ferait croire à un compte vide.
   */
  protected readonly accountSummary = computed(() => {
    const plans = this.billing.plans();
    if (plans.length === 0) return null;

    // Les moteurs restés sur l'offre gratuite ne sont pas nommés : l'espace
    // d'une barre latérale ne supporte pas un inventaire, et c'est l'offre
    // payée que l'on veut y reconnaître.
    const paid = plans.filter((plan) => plan.state !== 'free');

    const credits = plans
      .filter((plan) => plan.engine !== 'ideploy')
      .reduce((total, plan) => total + plan.credits, 0);

    return {
      // Une seule offre payée se nomme ; plusieurs se comptent.
      planName: paid.length === 1 ? `${paid[0].engineLabel} ${paid[0].currentName}` : null,
      planKey: paid.length === 0 ? 'account.freePlan' : 'account.severalPlans',
      paidCount: paid.length,
      credits,
      needsAttention: this.billing.attention() !== null,
    };
  });

  // Signals for UI State
  protected readonly isLoading = signal(true);
  protected readonly isSidebarCollapsed = signal(false);
  protected readonly isMobileDrawerOpen = signal(false);

  /**
   * Sélecteur de projet du tiroir mobile, fermé par défaut.
   *
   * Un compte avec vingt projets repoussait tout le menu hors de l'écran.
   * Fermé, le tiroir montre le projet courant puis la navigation ; ouvert, la
   * liste défile dans sa propre zone.
   */
  protected readonly isMobileProjectListOpen = signal(false);

  // Computed values for UI states
  protected readonly sidebarState = computed(() =>
    this.isSidebarCollapsed() ? 'collapsed' : 'expanded',
  );

  protected readonly textVisibility = computed(() =>
    this.isSidebarCollapsed() ? 'hidden' : 'visible',
  );

  // Output event to notify parent components of sidebar state changes
  @Output() sidebarCollapsedChange = new EventEmitter<boolean>();

  protected readonly currentRoute = signal<string>('');

  constructor() {
    // Initialize sidebar collapsed state from localStorage
    const savedSidebarState = localStorage.getItem('sidebarCollapsed');
    if (savedSidebarState) {
      this.isSidebarCollapsed.set(savedSidebarState === 'true');
    }

    // Track current route for active menu highlighting
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.currentRoute.set(event.urlAfterRedirects);
        // Update menu items to reflect active state
        this.updateSidebarRoutes();
      }
    });

  }

  ngOnInit() {
    this.updateActiveStates();
    this.loadProjects();

    // La barre est montée sur toutes les pages de travail : c'est le bon
    // endroit pour charger les droits une fois. Le catalogue vient avec, sans
    // lui on connaîtrait le solde mais pas le nom de l'offre.
    if (!this.billing.me()) this.billing.loadMe().subscribe();
    if (!this.billing.catalog()) this.billing.loadCatalog().subscribe();

    // La sidebar du mode Assisté est dessinée à partir du parcours : il doit
    // connaître le projet actif pour savoir ce qui est ouvert.
    if (this.isGuidedMode()) {
      void this.journey.loadFromCookie();
    }
  }

  /**
   * Charge les projets, puis vérifie qu'on a bien de quoi afficher cette page.
   *
   * La liste vient du service partagé : la barre du haut l'a déjà demandée, et
   * un second appel ne dirait rien de plus.
   */
  private loadProjects(): void {
    this.isLoading.set(true);

    this.projects
      .load()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (projects) => {
          this.isLoading.set(false);

          // Cette barre ne sert plus qu'aux pages de projet : sans projet, il
          // n'y a rien à y naviguer.
          if (projects.length === 0) this.leaveProjectScope('/create-project');
        },
        error: () => {
          this.isLoading.set(false);
          this.leaveProjectScope('/create-project');
        },
      });
  }

  /** Choisit un projet depuis le tiroir mobile, puis referme le tiroir. */
  protected chooseProject(projectId: string): void {
    this.toggleMobileDrawer();
    this.projects.select(projectId);
  }

  /**
   * Renvoie ailleurs, mais seulement depuis une page de projet.
   *
   * Cette barre latérale sert désormais aussi « Mon compte » et la liste des
   * projets, qui n'ont pas besoin d'un projet sélectionné. Rediriger
   * inconditionnellement — ce que faisait le code précédent — éjectait de sa
   * facturation tout utilisateur n'ayant encore créé aucun projet, au moment
   * précis où il venait choisir une offre.
   */
  private leaveProjectScope(target: string): void {
    if (!this.router.url.startsWith('/project/')) return;
    void this.router.navigate([target], { replaceUrl: true });
  }

  updateSidebarRoutes() {
    this.updateActiveStates();
  }

  /**
   * Updates active states for navigation items
   */
  private updateActiveStates(): void {
    const currentPath = this.currentRoute();
    const items = this.navigationItems();

    const updatedItems = items.map((item) => {
      const childrenActive = item.children?.some((c) => currentPath.includes(`/${c.route}`));
      const isActive = currentPath.includes(`/${item.route}`) || !!childrenActive;
      return {
        ...item,
        isActive,
        // Expand automatiquement si une route enfant est active
        isExpanded: childrenActive ? true : item.isExpanded,
        children: item.children?.map((c) => ({
          ...c,
          // Active uniquement si la route correspond exactement (évite que /finance matche tout)
          isActive: currentPath === `/${c.route}` || currentPath.startsWith(`/${c.route}/`),
        })),
      };
    });

    this.navigationItems.set(updatedItems);
  }

  protected toggleMobileProjectList(): void {
    this.isMobileProjectListOpen.update((open) => !open);
  }

  toggleMobileDrawer() {
    this.isMobileDrawerOpen.update((open) => !open);
    this.isMobileProjectListOpen.set(false);

    // Prevent body scroll when drawer is open
    if (this.isMobileDrawerOpen()) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  /**
   * Toggles the sidebar between expanded and collapsed states
   */
  toggleSidebar() {
    this.isSidebarCollapsed.update((collapsed) => !collapsed);
    // Update menu items to reflect the new state
    this.updateSidebarRoutes();
    // Save state to localStorage
    localStorage.setItem('sidebarCollapsed', String(this.isSidebarCollapsed()));
    // Emit event to parent component
    this.sidebarCollapsedChange.emit(this.isSidebarCollapsed());
  }
}

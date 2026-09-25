import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { ProjectModel } from '@idem/shared-models';
import { ProjectService } from '../../services/project.service';
import { AsyncPipe, DatePipe } from '@angular/common';

import { AuthService } from '../../../auth/services/auth.service';
import { Router } from '@angular/router';
import { first, Observable } from 'rxjs';
import { ProjectCard } from '../../components/project-card/project-card';
import { CookieService } from '../../../../shared/services/cookie.service';
import { CurrentProjectService } from '../../../../shared/services/current-project.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';

import { NotificationService } from '../../../../shared/services/notification.service';
import { AnalyticsService } from '../../../../shared/services/analytics.service';
import { UiModeService } from '../../../../shared/services/ui-mode.service';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';

/** Types de projet traduits, tels que proposés à la création. */
const KNOWN_PROJECT_TYPES = new Set([
  'enterprise',
  'ecommerce',
  'web',
  'mobile',
  'iot',
  'desktop',
  'api',
  'ai',
  'blockchain',
  'other',
]);

@Component({
  selector: 'app-projects-list',
  imports: [ProjectCard, TranslateModule, IdemLoaderComponent],
  templateUrl: './projects-list.html',
  styleUrl: './projects-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsList implements OnInit {
  // Services
  private readonly projectService = inject(ProjectService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly notificationService = inject(NotificationService);
  private readonly analyticsService = inject(AnalyticsService);
  private readonly uiModeService = inject(UiModeService);
  private readonly currentProject = inject(CurrentProjectService);

  // Data signals and state
  userProjects$!: Observable<ProjectModel[]>;
  protected readonly allProjects = signal<ProjectModel[]>([]);
  protected readonly recentProjects = signal<ProjectModel[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isMenuOpen = signal(false);
  protected readonly isDropdownOpen = signal(false);
  protected readonly user$ = this.auth.user$;
  cookieService = inject(CookieService);
  @ViewChild('menu') menuRef!: ElementRef;
  protected readonly logoLoadErrors = signal<Record<string, boolean>>({});

  // Deletion modal state
  protected readonly projectToDelete = signal<ProjectModel | null>(null);
  protected readonly isDeleting = signal(false);

  // UI States for UX controls
  protected readonly searchQuery = signal('');
  protected readonly selectedTypeFilter = signal<string>('all');
  protected readonly viewMode = signal<'grid' | 'list'>('grid');

  /** Total number of projects for stats display */
  protected readonly projectCount = signal(0);

  /**
   * Rappel du parcours assisté.
   *
   * Repris de la console, que cette page remplace : en mode Assisté, on doit
   * pouvoir reprendre où l'on s'est arrêté sans repasser par un projet.
   * Seulement s'il existe un projet — sinon il n'y a rien à reprendre.
   */
  protected readonly showGuidedResume = computed(
    () => this.uiModeService.mode() === 'guided' && this.allProjects().length > 0,
  );

  protected resumeGuidedJourney(): void {
    void this.router.navigate(['/guided']);
  }

  /** Salutation selon l'heure. Les clés existent en français et en anglais. */
  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'dashboard.projectsList.greeting.morning';
    if (hour < 18) return 'dashboard.projectsList.greeting.afternoon';
    return 'dashboard.projectsList.greeting.evening';
  });

  /**
   * Type d'un projet, ramené à son code.
   *
   * Le champ est un objet `{ code, name }` dans le modèle, mais d'anciens
   * enregistrements portent encore une simple chaîne. Lire les deux formes ici,
   * une fois, évite de répéter la question partout — et évite surtout qu'un
   * projet mal formé ne réponde à aucun filtre.
   */
  private typeCodeOf(project: ProjectModel): string {
    const type = project.type as unknown;
    if (typeof type === 'string') return type.toLowerCase();
    const code = (type as { code?: string; name?: string } | null)?.code
      ?? (type as { name?: string } | null)?.name;
    return (code ?? '').toLowerCase();
  }

  /** Date de dernière activité, pour le classement. */
  private lastTouched(project: ProjectModel): number {
    const raw = project.updatedAt ?? project.createdAt;
    const date = raw instanceof Date ? raw : new Date(raw);
    // Une date absente ou illisible ne doit pas renvoyer NaN : la comparaison
    // deviendrait imprévisible et l'ordre du tableau, aléatoire.
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  /**
   * Les onglets de filtre, déduits des projets réellement présents.
   *
   * Ils étaient figés sur quatre types — web, mobile, iot, desktop — alors que
   * la création en propose dix. Un projet « enterprise » ou « ecommerce », les
   * plus courants ici, n'apparaissait sous aucun onglet : cliquer vidait la
   * liste, et les compteurs affichaient zéro. Construire les onglets à partir
   * des données garantit qu'ils correspondent toujours à ce qu'on a.
   */
  protected readonly typeTabs = computed(() => {
    const counts = new Map<string, number>();

    for (const project of this.allProjects()) {
      const code = this.typeCodeOf(project);
      if (!code) continue;
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }

    const tabs = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([code, count]) => ({
        code,
        count,
        // Un code inconnu — donnée ancienne, type retiré du formulaire — n'a
        // pas de traduction. Sans repli, l'onglet afficherait la clé brute.
        labelKey: KNOWN_PROJECT_TYPES.has(code) ? `dashboard.projectsList.types.${code}` : null,
        label: code,
      }));

    return [
      {
        code: 'all',
        count: this.allProjects().length,
        labelKey: 'dashboard.projectsList.filters.all',
        label: 'all',
      },
      ...tabs,
    ];
  });

  /**
   * La liste affichée : filtrée, cherchée, puis classée.
   *
   * Le classement manquait entièrement — la liste sortait dans l'ordre rendu
   * par l'API. Le projet modifié en dernier passe désormais devant, ce qui est
   * l'ordre dans lequel on revient travailler.
   */
  protected readonly filteredProjects = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const filter = this.selectedTypeFilter();

    return this.allProjects()
      .filter((project) => filter === 'all' || this.typeCodeOf(project) === filter)
      .filter((project) => {
        if (!query) return true;
        // Un projet sans nom ni description ne doit pas faire échouer la
        // recherche pour tous les autres.
        const haystack = `${project.name ?? ''} ${project.description ?? ''}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => this.lastTouched(b) - this.lastTouched(a));
  });

  ngOnInit() {
    try {
      this.user$.pipe(first()).subscribe((user) => {
        if (user) {
          this.isLoading.set(true);
          this.userProjects$ = this.projectService.getProjects();
          this.userProjects$.subscribe({
            next: (projects) => {
              this.allProjects.set(projects);
              this.currentProject.replaceAll(projects);
              this.projectCount.set(projects.length);
              this.recentProjects.set(
                projects
                  .slice()
                  .sort((a, b) => {
                    const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
                    const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
                    return dateB.getTime() - dateA.getTime();
                  })
                  .slice(0, 3),
              );
              this.isLoading.set(false);
            },
            error: (error) => {
              console.error('Error fetching projects:', error);
              this.isLoading.set(false);
              // If there's an auth error, redirect to login
              if (error.status === 401 || error.status === 403) {
                console.log('Authentication error, redirecting to login');
                this.router.navigate(['/login']);
              }
            },
          });
        } else {
          console.log('User not authenticated, redirecting to login');
          this.isLoading.set(false);
          this.router.navigate(['/login']);
        }
      });
    } catch (error) {
      console.error('Error in ngOnInit:', error);
      this.isLoading.set(false);
      this.router.navigate(['/login']);
    }
  }

  protected setViewMode(mode: 'grid' | 'list') {
    this.viewMode.set(mode);
  }

  protected setTypeFilter(filter: string) {
    this.selectedTypeFilter.set(filter);
  }

  protected onSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
  }

  protected getProjectMonogram(name: string): string {
    if (!name) return '';
    return name.substring(0, 2).toUpperCase();
  }

  protected getProjectTypeIcon(typeVal: any): string {
    const type = typeof typeVal === 'string' ? typeVal : typeVal?.code || typeVal?.name || '';
    switch (type.toLowerCase()) {
      case 'web':
        return 'pi pi-globe';
      case 'mobile':
        return 'pi pi-mobile';
      case 'iot':
        return 'pi pi-cog';
      case 'desktop':
        return 'pi pi-desktop';
      default:
        return 'pi pi-folder';
    }
  }

  protected getProjectTypeName(typeVal: any): string {
    return typeof typeVal === 'string' ? typeVal : typeVal?.code || typeVal?.name || '';
  }

  protected getPlaceholderGradient(id: string | undefined, name: string): string {
    const stringToHash = id || name || '';
    let hash = 0;
    for (let i = 0; i < stringToHash.length; i++) {
      hash = stringToHash.charCodeAt(i) + ((hash << 5) - hash);
    }
    const gradients = [
      'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', // Blue - Indigo
      'linear-gradient(135deg, #10b981 0%, #047857 100%)', // Emerald - Teal
      'linear-gradient(135deg, #ec4899 0%, #be185d 100%)', // Rose - Pink
      'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)', // Amber - Orange
      'linear-gradient(135deg, #8b5cf6 0%, #5b21b6 100%)', // Violet - Purple
      'linear-gradient(135deg, #64748b 0%, #334155 100%)', // Slate - Dark gray
    ];
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
  }

  /**
   * Toggle main menu visibility
   */
  protected toggleMenu() {
    this.isMenuOpen.update((open) => !open);
  }

  /**
   * Toggle user dropdown menu visibility
   */
  protected toggleDropdown() {
    this.isDropdownOpen.update((open) => !open);
  }

  /**
   * Logout user and navigate to login page
   */
  protected logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  /**
   * Navigate to project dashboard and set project cookie
   */
  protected openProjectDashboard(projectId: string) {
    this.isDropdownOpen.set(false);
    this.currentProject.select(projectId);
  }

  protected handleLogoError(projectId: string) {
    this.logoLoadErrors.update((errors) => ({ ...errors, [projectId]: true }));
  }

  protected hasLogoError(projectId: string): boolean {
    return !!this.logoLoadErrors()[projectId];
  }

  protected isLogoInline(svg: string | undefined): boolean {
    return !!svg && svg.trimStart().startsWith('<');
  }

  openCreateProject() {
    this.router.navigate(['/create-project']);
  }

  protected openDeleteModal(project: ProjectModel) {
    this.projectToDelete.set(project);
  }

  protected closeDeleteModal() {
    if (this.isDeleting()) return;
    this.projectToDelete.set(null);
  }

  protected confirmDeleteProject() {
    const project = this.projectToDelete();
    if (!project || !project.id || this.isDeleting()) return;
    const deletedId = project.id;

    this.isDeleting.set(true);
    this.projectService.deleteProject(deletedId).subscribe({
      next: () => {
        // Update local project list signal
        this.allProjects.update((projects) => projects.filter((p) => p.id !== deletedId));
        this.currentProject.replaceAll(this.allProjects());
        this.projectCount.update((count) => Math.max(0, count - 1));
        this.recentProjects.update((recent) => recent.filter((p) => p.id !== deletedId));

        // Clear active project cookie if deleted
        if (this.cookieService.get('projectId') === deletedId) {
          this.cookieService.remove('projectId');
        }

        // Track analytics event
        this.analyticsService.trackProjectDeleted({ project_id: deletedId });

        // Notification toast feedback
        this.notificationService.showSuccess({
          title: 'Projet supprimé',
          message: `Le projet "${project.name}" a été supprimé avec succès.`,
        });

        this.isDeleting.set(false);
        this.projectToDelete.set(null);
      },
      error: (error) => {
        console.error('Error deleting project:', error);
        this.notificationService.showError({
          title: 'Erreur',
          message: `Impossible de supprimer le projet. Veuillez réessayer.`,
        });
        this.isDeleting.set(false);
      },
    });
  }
}

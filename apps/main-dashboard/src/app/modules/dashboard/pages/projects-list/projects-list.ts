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
import { Loader } from 'apps/main-dashboard/src/app/shared/components/loader/loader';

import { AuthService } from '../../../auth/services/auth.service';
import { Router } from '@angular/router';
import { first, Observable } from 'rxjs';
import { ProjectCard } from '../../components/project-card/project-card';
import { CookieService } from '../../../../shared/services/cookie.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';

@Component({
  selector: 'app-projects-list',
  imports: [Loader, AsyncPipe, DatePipe, ProjectCard, TranslateModule, SafeHtmlPipe],
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

  // UI States for UX controls
  protected readonly searchQuery = signal('');
  protected readonly selectedTypeFilter = signal<string>('all');
  protected readonly viewMode = signal<'grid' | 'list'>('grid');

  /** Total number of projects for stats display */
  protected readonly projectCount = signal(0);

  /** Dynamic greeting based on time of day */
  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  });

  /** Filtered project list based on search and type */
  protected readonly filteredProjects = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const filter = this.selectedTypeFilter();
    let list = this.allProjects();

    if (filter !== 'all') {
      list = list.filter((p) => {
        const type = typeof p.type === 'string' ? p.type : (p.type as any)?.code || (p.type as any)?.name || '';
        return type.toLowerCase() === filter.toLowerCase();
      });
    }

    if (query) {
      list = list.filter((p) => 
        p.name.toLowerCase().includes(query) || 
        (p.description && p.description.toLowerCase().includes(query))
      );
    }

    return list;
  });

  /** Projects grouped by type count for filters display */
  protected readonly typeCounts = computed(() => {
    const projects = this.allProjects();
    const counts = { all: projects.length, web: 0, mobile: 0, iot: 0, desktop: 0 };
    for (const p of projects) {
      const type = typeof p.type === 'string' ? p.type : (p.type as any)?.code || (p.type as any)?.name || '';
      const lowerType = type.toLowerCase() as keyof typeof counts;
      if (lowerType in counts) {
        counts[lowerType]++;
      }
    }
    return counts;
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
    this.cookieService.set('projectId', projectId);
    this.router.navigate(['/project/dashboard']);
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
}

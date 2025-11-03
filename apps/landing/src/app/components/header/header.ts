import {
  Component,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  ViewChild,
  signal,
  computed,
} from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { BadgeModule } from 'primeng/badge';
import { AvatarModule } from 'primeng/avatar';
import { InputTextModule } from 'primeng/inputtext';
import { CommonModule } from '@angular/common';
import { MenuItem } from 'primeng/api';
import { BetaBadgeComponent } from '../../shared/components/beta-badge/beta-badge';
import { ButtonModule } from 'primeng/button';
import { DOCUMENT } from '@angular/common';
import { environment } from '../../../environments/environment';
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    RouterLinkActive,
    RouterLink,
    BadgeModule,
    AvatarModule,
    InputTextModule,
    CommonModule,
    BetaBadgeComponent,
    ButtonModule,
  ],
  templateUrl: './header.html',
  styleUrl: './header.css',
  animations: [
    trigger('slideInOut', [
      transition(':enter', [
        style({ transform: 'translateY(-100%)' }),
        animate('300ms ease-in', style({ transform: 'translateY(0%)' })),
      ]),
      transition(':leave', [animate('300ms ease-out', style({ transform: 'translateY(-100%)' }))]),
    ]),
  ],
})
export class Header implements OnInit {
  // Services
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  // UI State Signals
  protected readonly isMenuOpen = signal(false);
  protected readonly isDropdownOpen = signal(false);
  protected readonly userRefresh = signal(0);

  // User Data - Computed signal basé sur les cookies
  protected readonly user = computed(() => {
    this.userRefresh(); // Trigger reactivity
    return this.auth.getCurrentUser();
  });

  // Navigation items
  protected readonly items: MenuItem[] | undefined = [
    {
      label: $localize`:@@header.items.home:Home`,
      icon: 'pi pi-home',
    },
    {
      label: $localize`:@@header.items.projects:Projects`,
      icon: 'pi pi-search',
      badge: '3',
      items: [
        {
          label: $localize`:@@header.items.core:Core`,
          icon: 'pi pi-bolt',
          shortcut: '⌘+S',
        },
        {
          label: $localize`:@@header.items.blocks:Blocks`,
          icon: 'pi pi-server',
          shortcut: '⌘+B',
        },
        {
          separator: true,
        },
        {
          label: $localize`:@@header.items.uiKit:UI Kit`,
          icon: 'pi pi-pencil',
          shortcut: '⌘+U',
        },
      ],
    },
  ];

  @ViewChild('menu') menuRef!: ElementRef;

  async ngOnInit(): Promise<void> {
    // Récupérer l'utilisateur depuis l'API et forcer le refresh
    await this.auth.fetchCurrentUser();
    this.userRefresh.update((v: number) => v + 1);

    // Check authentication status
    const user = this.user();
    console.log('Header authentication status:', user ? 'Logged in' : 'Not logged in');
  }

  /**
   * Toggle mobile menu visibility
   */
  protected toggleMenu(): void {
    this.isMenuOpen.update((open) => !open);
  }

  /**
   * Toggle user dropdown visibility
   */
  protected toggleDropdown(): void {
    this.isDropdownOpen.update((open) => !open);
  }

  /**
   * Navigate to specified path
   */
  protected navigateTo(path: string): void {
    this.isDropdownOpen.set(false);
    this.isMenuOpen.set(false);
    this.router.navigate([path]);
  }

  /**
   * Navigate to dashboard with current language
   */
  protected navigateToDashboard(): void {
    this.isDropdownOpen.set(false);
    this.isMenuOpen.set(false);

    // Get current language from document lang attribute or default to 'en'
    const currentLang = this.document.documentElement.lang || 'en';

    // Store auth state in localStorage for cross-app sync
    const user = this.user();
    if (user) {
      localStorage.setItem(
        'idem_auth_sync',
        JSON.stringify({
          timestamp: Date.now(),
          userId: user.uid,
          email: user.email,
        }),
      );
    }

    // Redirect to dashboard with language parameter
    const dashboardUrl = `${environment.services.dashboard.url}?lang=${currentLang}`;
    window.location.href = dashboardUrl;
  }

  /**
   * Log out the current user
   */
  protected async logout(): Promise<void> {
    this.isDropdownOpen.set(false);
    await this.auth.logout();
    this.userRefresh.update((v: number) => v + 1);
    this.router.navigate(['/login']);
  }

  @HostListener('document:click', ['$event'])
  protected onClickOutside(event: Event): void {
    if (this.isMenuOpen() && this.menuRef && !this.menuRef.nativeElement.contains(event.target)) {
      this.isMenuOpen.set(false);
    }
  }

  @HostListener('document:click', ['$event.target'!])
  protected onClickOutsideDropdown(targetElement: HTMLElement): void {
    const dropdownButton = targetElement.closest('button.flex.items-center');
    const dropdownMenu = targetElement.closest('.fixed.right-0.mt-2');

    if (this.isDropdownOpen() && !dropdownButton && !dropdownMenu) {
      this.isDropdownOpen.set(false);
    }
  }
}

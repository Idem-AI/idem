import {
  Component,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  ViewChild,
  signal,
} from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../auth/services/auth.service';
import { BadgeModule } from 'primeng/badge';
import { AvatarModule } from 'primeng/avatar';
import { InputTextModule } from 'primeng/inputtext';
import { CommonModule } from '@angular/common';
import { MenuItem } from 'primeng/api';
import { toSignal } from '@angular/core/rxjs-interop';
import { first } from 'rxjs/operators';
import { BetaBadgeComponent } from '../../../../shared/components/beta-badge/beta-badge';
import { ButtonModule } from 'primeng/button';
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
      transition(':leave', [
        animate('300ms ease-out', style({ transform: 'translateY(-100%)' })),
      ]),
    ]),
  ],
})
export class Header implements OnInit {
  // Services
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // UI State Signals
  protected readonly isMenuOpen = signal(false);
  protected readonly isDropdownOpen = signal(false);

  // User Data Signal
  protected readonly user = toSignal(this.auth.user$);

  // Navigation items
  protected readonly items: MenuItem[] | undefined = [
    {
      label: 'Home',
      icon: 'pi pi-home',
    },
    {
      label: 'Projects',
      icon: 'pi pi-search',
      badge: '3',
      items: [
        {
          label: 'Core',
          icon: 'pi pi-bolt',
          shortcut: '⌘+S',
        },
        {
          label: 'Blocks',
          icon: 'pi pi-server',
          shortcut: '⌘+B',
        },
        {
          separator: true,
        },
        {
          label: 'UI Kit',
          icon: 'pi pi-pencil',
          shortcut: '⌘+U',
        },
      ],
    },
  ];

  @ViewChild('menu') menuRef!: ElementRef;

  ngOnInit(): void {
    // Check authentication status when component initializes
    this.auth.user$.pipe(first()).subscribe((user) => {
      console.log(
        'Header authentication status:',
        user ? 'Logged in' : 'Not logged in'
      );
    });
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
   * Log out the current user
   */
  protected logout(): void {
    this.isDropdownOpen.set(false);
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  @HostListener('document:click', ['$event'])
  protected onClickOutside(event: Event): void {
    if (
      this.isMenuOpen() &&
      this.menuRef &&
      !this.menuRef.nativeElement.contains(event.target)
    ) {
      this.isMenuOpen.set(false);
    }
  }

  @HostListener('document:click', ['$event.target'])
  protected onClickOutsideDropdown(targetElement: HTMLElement): void {
    const dropdownButton = targetElement.closest('button.flex.items-center');
    const dropdownMenu = targetElement.closest('.fixed.right-0.mt-2');

    if (this.isDropdownOpen() && !dropdownButton && !dropdownMenu) {
      this.isDropdownOpen.set(false);
    }
  }
}

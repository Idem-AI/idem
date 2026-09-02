import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../modules/auth/services/auth.service';
import { BetaBadgeComponent } from '../../shared/components/beta-badge/beta-badge';
import { LanguageSelectorComponent } from '../../shared/components/language-selector/language-selector';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle/theme-toggle';
import { ModeSwitcherComponent } from '../../shared/components/mode-switcher/mode-switcher';

/**
 * Layout du mode Assisté : volontairement dépouillé.
 *
 * Pas de sidebar, pas de menu à explorer — juste le logo, le sélecteur de mode
 * (visible et libellé, pour qu'on sache tout de suite qu'on peut en changer)
 * et le parcours au centre.
 */
@Component({
  selector: 'app-guided-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TranslateModule,
    BetaBadgeComponent,
    LanguageSelectorComponent,
    ThemeToggleComponent,
    ModeSwitcherComponent,
  ],
  templateUrl: './guided-layout.html',
  styleUrl: './guided-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuidedLayoutComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly user = toSignal(this.auth.user$);
  protected readonly isUserMenuOpen = signal(false);

  protected toggleUserMenu(): void {
    this.isUserMenuOpen.update((open) => !open);
  }

  protected navigateTo(path: string): void {
    this.isUserMenuOpen.set(false);
    this.router.navigateByUrl(path);
  }

  protected logout(): void {
    this.isUserMenuOpen.set(false);
    this.auth.logout().subscribe();
    this.router.navigate(['/login']);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.isUserMenuOpen()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.isUserMenuOpen.set(false);
    }
  }
}

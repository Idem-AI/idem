import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { environment } from '@env';

import { AuthService } from '../../core/auth';
import { LanguageMenu } from '../../shared/components/language-menu/language-menu';
import { ThemeToggle } from '../../shared/components/theme-toggle/theme-toggle';

/**
 * Shell for the authenticated surface.
 *
 * A top bar rather than a sidebar: the product has two destinations, and a
 * permanent sidebar would spend horizontal space the report needs.
 */
@Component({
  selector: 'sim-app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, ThemeToggle, LanguageMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'onDocumentClick($event)' },
  templateUrl: './app-shell.html',
})
export class AppShell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly dashboardUrl = environment.services.dashboard.url;
  protected readonly user = this.auth.user;
  protected readonly menuOpen = signal(false);

  protected readonly initials = computed(() => {
    const user = this.user();
    const source = user?.displayName || user?.email || '';
    const parts = source.split(/[\s.@]+/).filter(Boolean);
    return (parts[0]?.[0] ?? '?').concat(parts[1]?.[0] ?? '').toUpperCase();
  });

  protected async signOut(): Promise<void> {
    this.menuOpen.set(false);
    await this.auth.signOut();
    await this.router.navigate(['/login']);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.menuOpen() && !this.host.nativeElement.contains(event.target as Node)) {
      this.menuOpen.set(false);
    }
  }
}

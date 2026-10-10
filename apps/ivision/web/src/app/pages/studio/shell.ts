import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { filter, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { LanguageService } from '../../core/language.service';
import { ChatMode } from '../../core/models';
import { StudioState } from '../../core/studio.state';
import { ThemeService } from '../../core/theme.service';
import { BrandMark } from '../../shared/components/brand-mark';

/**
 * La coque de l'atelier : à gauche les conversations du mode courant (images OU vidéos), les
 * marques, les crédits ; sur téléphone, une barre d'onglets en bas et un tiroir de conversations.
 */
@Component({
  selector: 'iv-studio-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslateModule, IdemLoaderComponent, BrandMark],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
})
export class StudioShell {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly state = inject(StudioState);
  protected readonly theme = inject(ThemeService);
  protected readonly language = inject(LanguageService);
  protected readonly accountUrl = `${environment.services.dashboard.url}/account`;

  protected readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  /** Le mode de la page courante : celui de la conversation, sinon vidéo. */
  protected readonly mode = computed<ChatMode>(() => (/^\/studio\/image/.test(this.url()) ? 'image' : 'video'));
  protected readonly activeSession = computed(() => /^\/studio\/(?:image|video)\/([^/?]+)/.exec(this.url())?.[1] ?? null);

  constructor() {
    this.state.refreshCredits();
    this.state.refreshBrands();
    let last: ChatMode | null = null;
    // Les conversations listées suivent le mode : on ne mélange pas images et vidéos.
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe(() => {
      if (this.mode() !== last) {
        last = this.mode();
        this.state.refreshSessions(last);
      }
      this.state.drawerOpen.set(false);
    });
    last = this.mode();
    this.state.refreshSessions(last);
  }

  protected toggleTheme(): void {
    this.theme.setMode(this.theme.isDark() ? 'light' : 'dark');
  }

  protected toggleLanguage(): void {
    this.language.set(this.language.current() === 'fr' ? 'en' : 'fr');
  }
}

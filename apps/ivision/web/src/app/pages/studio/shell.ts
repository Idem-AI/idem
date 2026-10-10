import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { filter, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { LanguageService } from '../../core/language.service';
import { ChatMode, StudioMode } from '../../core/models';
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
  /** Les trois ateliers, jamais mélangés. */
  protected readonly tabs: { mode: StudioMode; icon: string; label: string }[] = [
    { mode: 'video', icon: 'pi-video', label: 'studio.video' },
    { mode: 'image', icon: 'pi-image', label: 'studio.image' },
    { mode: 'montage', icon: 'pi-microphone', label: 'studio.montage' },
  ];

  protected readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  /** Le mode de la page courante : celui de la conversation, le montage, sinon vidéo. */
  protected readonly mode = computed<StudioMode>(() => (/^\/studio\/image/.test(this.url()) ? 'image' : /^\/studio\/montage/.test(this.url()) ? 'montage' : 'video'));
  protected readonly activeSession = computed(() => /^\/studio\/(?:image|video|montage)\/([^/?]+)/.exec(this.url())?.[1] ?? null);

  constructor() {
    this.state.refreshCredits();
    this.state.refreshBrands();
    let last: StudioMode | null = null;
    // L'historique suit l'atelier : on ne mélange pas images, vidéos et montages.
    const refresh = (mode: StudioMode) => (mode === 'montage' ? this.state.refreshMontages() : this.state.refreshSessions(mode as ChatMode));
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe(() => {
      if (this.mode() !== last) {
        last = this.mode();
        refresh(last);
      }
      this.state.drawerOpen.set(false);
    });
    last = this.mode();
    refresh(last);
  }

  protected toggleTheme(): void {
    this.theme.setMode(this.theme.isDark() ? 'light' : 'dark');
  }

  protected toggleLanguage(): void {
    this.language.set(this.language.current() === 'fr' ? 'en' : 'fr');
  }
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AppVersionService } from './shared/services/app-version.service';
import { LanguageService } from './shared/services/language.service';
import { ThemeService } from './shared/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (version.updateAvailable()) {
      <div role="status" class="fixed bottom-4 left-1/2 z-[1000] flex max-w-[calc(100%-32px)] -translate-x-1/2 flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-sm shadow-lg"
        style="background:var(--color-bg-darker);border:1px solid var(--glass-border-medium);color:var(--color-text-primary);">
        <i class="pi pi-refresh" aria-hidden="true" style="color:var(--color-primary-500);"></i>
        <span>{{ 'appUpdate.message' | translate }}</span>
        <button type="button" class="inner-button button-sm" (click)="version.reload()">{{ 'appUpdate.reload' | translate }}</button>
      </div>
    }
    <router-outlet />
  `,
})
export class App {
  // Instantiated at bootstrap so they resolve the shared `idem_lang` /
  // `idem_theme` cookies and apply language + theme before the UI renders.
  private readonly languageService = inject(LanguageService);
  private readonly themeService = inject(ThemeService);
  protected readonly version = inject(AppVersionService);

  constructor() {
    this.version.start();
  }
}

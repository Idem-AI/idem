import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LanguageService } from './shared/services/language.service';
import { ThemeService } from './shared/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<router-outlet />`,
})
export class App {
  // Instantiated at bootstrap so they resolve the shared `idem_lang` /
  // `idem_theme` cookies and apply language + theme before the UI renders.
  private readonly languageService = inject(LanguageService);
  private readonly themeService = inject(ThemeService);
}

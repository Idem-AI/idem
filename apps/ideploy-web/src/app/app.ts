import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LanguageService } from './shared/services/language.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<router-outlet />`,
})
export class App {
  // Instantiated at bootstrap so it resolves the shared `idem_lang` cookie and
  // applies the language before the UI renders.
  private readonly languageService = inject(LanguageService);
}

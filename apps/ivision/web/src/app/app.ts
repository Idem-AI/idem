import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LanguageService } from './core/language.service';
import { ThemeService } from './core/theme.service';

@Component({
  selector: 'iv-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<router-outlet />`,
})
export class App {
  // Instanciés au démarrage : langue et thème partagés (cookies IDEM) appliqués avant l'interface.
  private readonly language = inject(LanguageService);
  private readonly theme = inject(ThemeService);
}

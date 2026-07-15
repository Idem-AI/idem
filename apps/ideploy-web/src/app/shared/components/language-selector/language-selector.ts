import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../services/language.service';

/**
 * Compact EN/FR language switcher for the app shell. Changing the language writes
 * the shared `idem_lang` cookie (via LanguageService), so the choice propagates to
 * every other Idem app.
 */
@Component({
  selector: 'app-language-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex items-center gap-0.5 rounded-md p-0.5"
      style="background:rgba(255,255,255,0.04);"
      role="group"
      aria-label="Language">
      @for (lang of languages; track lang.code) {
        <button
          type="button"
          class="px-2 py-1 rounded text-[11px] font-bold uppercase transition-opacity"
          [style.background]="current() === lang.code ? 'rgba(37,99,235,0.20)' : 'transparent'"
          [style.color]="current() === lang.code ? '#60a5fa' : '#8d919a'"
          [attr.aria-pressed]="current() === lang.code"
          (click)="select(lang.code)">
          {{ lang.code }}
        </button>
      }
    </div>
  `,
})
export class LanguageSelectorComponent {
  private readonly languageService = inject(LanguageService);
  private readonly translate = inject(TranslateService);

  protected readonly languages = [
    { code: 'en', label: 'English' },
    { code: 'fr', label: 'Français' },
  ];

  private readonly currentLang = signal(this.translate.currentLang || 'en');
  protected readonly current = computed(() => this.currentLang());

  constructor() {
    this.translate.onLangChange.subscribe((e) => this.currentLang.set(e.lang));
  }

  protected select(code: string): void {
    this.languageService.setLanguage(code);
  }
}

import { Component, inject, signal, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from '../../services/language.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-language-selector',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './language-selector.html',
  styleUrl: './language-selector.css',
})
export class LanguageSelectorComponent {
  private readonly languageService = inject(LanguageService);

  readonly direction = input<'up' | 'down'>('up');
  readonly align = input<'left' | 'right'>('left');

  protected readonly isOpen = signal(false);
  protected readonly currentLanguage = signal(this.languageService.getCurrentLanguage());

  protected readonly languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
  ];

  /**
   * Toggle language dropdown
   */
  protected toggleDropdown(): void {
    this.isOpen.update((open) => !open);
  }

  /**
   * Change language
   */
  protected changeLanguage(langCode: string): void {
    this.languageService.setLanguage(langCode);
    this.currentLanguage.set(langCode);
    this.isOpen.set(false);
  }

  /**
   * Get current language object
   */
  protected getCurrentLanguageObject() {
    return this.languages.find((lang) => lang.code === this.currentLanguage());
  }
}

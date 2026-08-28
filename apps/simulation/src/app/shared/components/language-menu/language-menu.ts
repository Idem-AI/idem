import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { LanguageService, SupportedLanguage } from '../../../core/i18n/language.service';

@Component({
  selector: 'sim-language-menu',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative inline-block',
    '(document:click)': 'onDocumentClick($event)',
    '(keydown.escape)': 'open.set(false)',
  },
  template: `
    <button
      type="button"
      class="sim-btn sim-btn-ghost sim-btn-sm uppercase"
      [attr.aria-expanded]="open()"
      aria-haspopup="menu"
      [attr.aria-label]="'language.change' | translate"
      (click)="open.set(!open())"
    >
      <svg viewBox="0 0 24 24" class="size-4.5" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
      </svg>
      {{ current() }}
    </button>

    @if (open()) {
      <div
        role="menu"
        class="sim-rise absolute right-0 top-full z-40 mt-1 w-36 overflow-hidden rounded-xl border border-line bg-panel-raised shadow-raised"
      >
        @for (language of languages; track language) {
          <button
            type="button"
            role="menuitemradio"
            [attr.aria-checked]="current() === language"
            class="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-ink-muted transition-colors hover:bg-panel-sunken hover:text-ink"
            [class.text-ink]="current() === language"
            (click)="choose(language)"
          >
            {{ 'language.' + language | translate }}
            @if (current() === language) {
              <svg viewBox="0 0 24 24" class="size-4 text-brand" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="m5 13 4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            }
          </button>
        }
      </div>
    }
  `,
})
export class LanguageMenu {
  private readonly service = inject(LanguageService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly open = signal(false);
  protected readonly current = this.service.language;
  protected readonly languages = this.service.available;

  protected choose(language: SupportedLanguage): void {
    this.service.use(language);
    this.open.set(false);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }
}

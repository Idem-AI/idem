import { Injectable, inject, DestroyRef } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root',
})
export class CustomTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly translate = inject(TranslateService);
  private lastTitleKey: string | undefined;

  constructor() {
    super();
    const destroyRef = inject(DestroyRef);
    // Listen for language changes to update the browser title accordingly
    this.translate.onLangChange.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => {
      this.refreshTitle();
    });
  }

  override updateTitle(routerState: RouterStateSnapshot): void {
    const titleKey = this.buildTitle(routerState);
    this.lastTitleKey = titleKey;
    this.refreshTitle();
  }

  private refreshTitle(): void {
    if (this.lastTitleKey) {
      this.translate.get(this.lastTitleKey).subscribe((translatedTitle) => {
        this.title.setTitle(`Idem - ${translatedTitle}`);
      });
    } else {
      this.title.setTitle('Idem');
    }
  }
}

import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

const APP_NAME = 'IDEM Simulator';

/**
 * Sets the document title from the route's `title`, treated as a translation
 * key so the tab label follows the active language.
 */
@Injectable()
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly translate = inject(TranslateService);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const key = this.buildTitle(snapshot);
    if (!key) {
      this.title.setTitle(APP_NAME);
      return;
    }

    this.translate.get(key).subscribe((translated: string) => {
      // ngx-translate echoes the key back when it has no entry for it.
      const label = translated === key ? key : translated;
      this.title.setTitle(`${label} · ${APP_NAME}`);
    });
  }
}

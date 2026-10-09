import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Le signe d'iVision : un cadre d'image dont l'œil est un bouton de lecture. */
@Component({
  selector: 'iv-brand-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center gap-2' },
  template: `
    @if (withName()) {
      <img src="/assets/iVision light.svg" [style.height.px]="size()" alt="iVision" class="dark:hidden block" />
      <img src="/assets/iVision dark.svg" [style.height.px]="size()" alt="iVision" class="hidden dark:block" />
    } @else {
      <img src="/assets/icon ivision.svg" [style.height.px]="size()" alt="iVision" />
    }
  `,
})
export class BrandMark {
  readonly size = input(28);
  readonly withName = input(true);
}

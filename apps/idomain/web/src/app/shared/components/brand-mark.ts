import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Le signe d'iDomain : la façade à gradins dont le losange dit « c'est chez moi », et le nom. */
@Component({
  selector: 'idm-brand-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center gap-2' },
  template: `
    <svg viewBox="0 0 32 32" [style.width.px]="size()" [style.height.px]="size()" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="1.5" y="1.5" width="29" height="29" rx="8" style="fill: var(--color-primary-500)" />
      <g style="stroke: var(--color-on-primary)">
        <path d="M8 24 V13 H11 V11 H14 V9 H18 V11 H21 V13 H24 V24" stroke-width="1.8" />
        <path d="M14 24 V19.5 C14 17.5 18 17.5 18 19.5 V24" stroke-width="1.6" />
        <path d="M16 11.2 L17.6 12.8 L16 14.4 L14.4 12.8 Z" stroke-width="1.4" />
      </g>
    </svg>
    @if (withName()) {
      <span class="text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">iDomain</span>
    } @else {
      <span class="sr-only">iDomain</span>
    }
  `,
})
export class BrandMark {
  readonly size = input(28);
  readonly withName = input(true);
}

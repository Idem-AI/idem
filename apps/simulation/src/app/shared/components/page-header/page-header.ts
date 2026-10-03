import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * L'en-tête d'un écran, au dessin du dashboard IDEM : un grand titre, une
 * phrase qui dit à quoi sert la page, et l'action principale à droite.
 */
@Component({
  selector: 'sim-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div class="min-w-0">
        <ng-content select="[breadcrumb]" />
        <h1 class="text-2xl font-bold md:text-3xl">{{ heading() }}</h1>
        @if (description()) {
          <p class="mt-1.5 max-w-2xl text-sm leading-relaxed text-text-secondary md:text-base">
            {{ description() }}
          </p>
        }
      </div>
      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <ng-content select="[actions]" />
      </div>
    </header>
  `,
})
export class PageHeader {
  readonly heading = input.required<string>();
  readonly description = input<string>();
}

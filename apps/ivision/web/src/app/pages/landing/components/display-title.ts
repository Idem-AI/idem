import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Display } from './display';

/** Une ligne de titre : le texte, puis la partie soulignée (`em`), puis la fin (ponctuation). */
export interface TitleLine {
  t?: string;
  em?: string;
  end?: string;
}

/**
 * Un titre monumental de la landing, au style des autres applis IDEM : la couleur des titres,
 * et les mots importants soulignés par la vague du design system (`.i-underline`), jamais mis
 * en couleur primaire. Les lignes viennent des traductions (`[lines]="'…title' | translate"`),
 * chacune sur sa ligne ; `nowrap` interdit la coupure dans une ligne (titres courts du hero).
 */
@Component({
  selector: 'iv-display-title',
  imports: [NgTemplateOutlet, Display],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (level() === 1) {
      <h1><ng-container [ngTemplateOutlet]="content" /></h1>
    } @else {
      <h2><ng-container [ngTemplateOutlet]="content" /></h2>
    }
    <ng-template #content>
      @for (line of rows(); track $index) {
        <span [ivDisplay]="size()" [class.whitespace-nowrap]="nowrap()">{{ line.t }}@if (line.em) {<span class="i-underline">{{ line.em }}</span>}{{ line.end }}</span>
      }
    </ng-template>
  `,
})
export class DisplayTitle {
  /** Les lignes du titre (un tableau des traductions ; autre chose est ignoré). */
  readonly lines = input<unknown>([]);
  readonly level = input<1 | 2>(2);
  readonly size = input<'hero' | 'section'>('section');
  readonly nowrap = input(false);

  protected readonly rows = computed(() => (Array.isArray(this.lines()) ? (this.lines() as TitleLine[]) : []));
}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ErrorIllustrationComponent, ErrorScene } from './error-illustration';

/**
 * L'état d'erreur standard du tableau de bord : une illustration qui dit ce
 * qui a échoué, un titre, une phrase, et les actions — TOUJOURS centrées.
 *
 * Chaque page dessinait le sien : triangle d'alerte en `text-6xl`, couleurs de
 * la palette Tailwind écrites en dur, boutons qui se calaient à gauche. Un seul
 * composant, et le défaut ne peut plus revenir page par page.
 *
 * `variant` :
 *  - `page`    (défaut) : l'erreur occupe la page, dans une carte ;
 *  - `panel`   : l'erreur remplace une zone de la page, sans carte ;
 *  - `compact` : superposée à un contenu (aperçu de document), sans carte.
 *
 * @example
 * ```html
 * <app-error-state scene="document" [title]="'common.error' | translate" [message]="error()">
 *   <button type="button" class="inner-button" (click)="retry()">…</button>
 * </app-error-state>
 * ```
 */
@Component({
  selector: 'app-error-state',
  imports: [ErrorIllustrationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div
      class="flex flex-col items-center text-center"
      [class.min-h-[60vh]]="variant() === 'page'"
      [class.justify-center]="variant() === 'page'"
      [class.px-4]="variant() !== 'compact'"
      [class.py-10]="variant() === 'panel'"
      role="alert"
    >
      <div
        class="w-full flex flex-col items-center"
        [class.glass-card]="variant() === 'page'"
        [class.max-w-lg]="variant() !== 'compact'"
        [class.max-w-xs]="variant() === 'compact'"
        [class.p-8]="variant() === 'page'"
        [class.sm:p-10]="variant() === 'page'"
      >
        <app-error-illustration [scene]="scene()" [width]="variant() === 'compact' ? 96 : 150" />
        @if (title()) {
          <h2
            class="font-semibold text-text-primary"
            [class.text-xl]="variant() !== 'compact'"
            [class.mt-5]="variant() !== 'compact'"
            [class.text-sm]="variant() === 'compact'"
            [class.mt-3]="variant() === 'compact'"
          >
            {{ title() }}
          </h2>
        }
        @if (message()) {
          <p
            class="text-text-secondary mt-2 max-w-md"
            [class.text-sm]="variant() === 'compact'"
          >
            {{ message() }}
          </p>
        }
        <div class="flex flex-wrap items-center justify-center gap-3 empty:hidden" [class.mt-6]="variant() !== 'compact'" [class.mt-3]="variant() === 'compact'">
          <ng-content />
        </div>
      </div>
    </div>
  `,
})
export class ErrorStateComponent {
  readonly scene = input<ErrorScene>('document');
  readonly title = input<string | null | undefined>('');
  readonly message = input<string | null | undefined>('');
  readonly variant = input<'page' | 'panel' | 'compact'>('page');
}

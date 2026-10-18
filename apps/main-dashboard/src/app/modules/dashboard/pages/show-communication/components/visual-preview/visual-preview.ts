import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FontHints } from '@idem/shared-document-editor/angular';
import { Flyer, FlyerFormat } from '../../../../models/communication.model';

/** Dimensions réelles de chaque format, en pixels — celles du rendu PNG côté API. */
const FORMAT_SIZE: Record<FlyerFormat, [number, number]> = {
  square: [1080, 1080],
  story: [1080, 1920],
  banner: [1200, 630],
  post: [1200, 1500],
  a4: [1240, 1754],
};

/** Le rendu peut arriver juste après la génération : trois nouvelles tentatives, espacées. */
const BACKOFF_MS = [1200, 3000, 6000];

/**
 * Aperçu d'un visuel de Communication : LE RENDU LUI-MÊME (le PNG que l'on télécharge), affiché dès
 * que le visuel existe — y compris juste après sa génération. L'ancien aperçu reconstruisait la page
 * dans une iframe ; ouvert avec son HTML déjà là (visuel tout juste généré, fenêtre), il restait vide.
 *
 * Tant que l'image arrive, la forme du format (squelette) ; si elle tarde, de nouvelles tentatives,
 * puis « Réessayer ». « Modifier » ouvre l'éditeur partagé sur le visuel.
 */
@Component({
  selector: 'app-visual-preview',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <figure class="group relative mx-auto overflow-hidden rounded-xl border border-[var(--glass-border-subtle)]" [style.aspect-ratio]="ratio()" [style.max-height.px]="maxHeight()" [style.max-width]="maxWidth()">
      @if (src(); as url) {
        @if (!loaded() && !givenUp()) {
          <div class="skeleton absolute inset-0" role="status" [attr.aria-label]="'common.loading' | translate"></div>
        }
        @if (givenUp()) {
          <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-sm text-[var(--color-text-secondary)]" role="alert">
            <i class="pi pi-image text-2xl" aria-hidden="true"></i>
            <button type="button" class="outer-button button-sm" (click)="retry()">{{ 'common.retry' | translate }}</button>
          </div>
        } @else {
          <img
            class="block h-full w-full object-contain transition-opacity duration-300"
            [class.opacity-0]="!loaded()"
            [src]="url"
            [alt]="visual().marketingText.headline || ''"
            [attr.width]="size()[0]"
            [attr.height]="size()[1]"
            (load)="onLoad()"
            (error)="onError()"
          />
        }
      } @else {
        <div class="skeleton absolute inset-0" role="status" [attr.aria-label]="'common.loading' | translate"></div>
      }
      @if (loaded()) {
        <button type="button" class="inner-button button-sm absolute right-2 top-2 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 focus-visible:opacity-100" (click)="edit()">
          <i class="pi pi-pencil" aria-hidden="true"></i> {{ 'common.edit' | translate }}
        </button>
      }
    </figure>
  `,
})
export class VisualPreview {
  private readonly router = inject(Router);

  readonly projectId = input.required<string>();
  readonly visual = input.required<Flyer>();
  /** Gardé pour compatibilité : le rendu PNG porte déjà ses polices. */
  readonly fonts = input<FontHints>({});
  /** Hauteur maximale de l'aperçu à l'écran. */
  readonly maxHeight = input<number>(460);

  /** L'utilisateur a demandé à retoucher : l'hôte peut fermer sa fenêtre avant. */
  readonly editRequested = output<void>();

  protected readonly size = computed(() => FORMAT_SIZE[this.visual().format] ?? FORMAT_SIZE.square);
  protected readonly ratio = computed(() => `${this.size()[0]} / ${this.size()[1]}`);
  /** La largeur qui laisse le format tenir dans la hauteur maximale. */
  protected readonly maxWidth = computed(() => `min(100%, ${Math.round((this.maxHeight() * this.size()[0]) / this.size()[1])}px)`);

  protected readonly loaded = signal(false);
  protected readonly givenUp = signal(false);
  private readonly attempt = signal(0);
  private timer: ReturnType<typeof setTimeout> | null = null;

  /** L'adresse du rendu, avec un numéro de tentative (sinon le navigateur resservirait l'échec en cache). */
  protected readonly src = computed(() => {
    const url = this.visual().imageUrl;
    if (!url) return '';
    const n = this.attempt();
    return n ? `${url}${url.includes('?') ? '&' : '?'}r=${n}` : url;
  });

  constructor() {
    // Un autre visuel (variante, retouche, déclinaison) repart d'un état neuf.
    effect(() => {
      this.visual().imageUrl;
      this.clearTimer();
      this.loaded.set(false);
      this.givenUp.set(false);
      this.attempt.set(0);
    });
    inject(DestroyRef).onDestroy(() => this.clearTimer());
  }

  protected onLoad(): void {
    this.clearTimer();
    this.loaded.set(true);
  }

  protected onError(): void {
    const n = this.attempt();
    const wait = BACKOFF_MS[n];
    if (wait === undefined) {
      this.givenUp.set(true);
      return;
    }
    this.clearTimer();
    this.timer = setTimeout(() => this.attempt.set(n + 1), wait);
  }

  protected retry(): void {
    this.givenUp.set(false);
    this.loaded.set(false);
    this.attempt.update((n) => n + 1);
  }

  /** Ouvre l'éditeur d'IDEM sur ce visuel. */
  protected edit(): void {
    this.editRequested.emit();
    this.router.navigate(['/project/communication/flyer/edit'], { queryParams: { flyerId: this.visual().id } });
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

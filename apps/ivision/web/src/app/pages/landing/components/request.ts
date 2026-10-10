import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

interface RequestPart {
  t?: string;
  /** Un mot que la vidéo reprend : souligné, comme compris par iVision. */
  k?: string;
}

/**
 * « Dites-le » : la demande telle qu'on l'écrit dans le compositeur de l'atelier (la marque lue,
 * le cran de créativité, le bouton d'envoi). Les mots que la vidéo reprend (vidéo, −30 %,
 * 31 décembre) sont soulignés : on voit ce qu'iVision a compris. Sur grand écran, une flèche part
 * du bouton d'envoi vers les écrans d'à côté. Les puces et le bouton sont une illustration, pas
 * des commandes : ils ne sont ni focalisables ni annoncés.
 */
@Component({
  selector: 'iv-request',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <figure class="request relative m-0">
      <div class="rounded-[1.75rem] border border-[var(--glass-border)] bg-surface-1 p-5 shadow-xl sm:p-6">
        <figcaption class="text-xs font-semibold text-text-tertiary">{{ 'landing.request.label' | translate }}</figcaption>
        <!-- Sur une ligne : aucun espace ne doit s'insérer entre un mot souligné et sa ponctuation. -->
        <p class="mt-2 text-lg leading-snug text-text-primary sm:text-xl 3xl:text-2xl">@for (part of parts(); track $index) {@if (part.k) {<span class="key" [style.--i]="$index">{{ part.k }}</span>} @else {<ng-container>{{ part.t }}</ng-container>}}</p>
        <div class="mt-5 flex flex-wrap items-center gap-2" aria-hidden="true">
          <span class="tag"><i class="pi pi-globe"></i> {{ 'landing.request.site' | translate }}</span>
          <span class="tag"><i class="pi pi-sparkles"></i> {{ 'landing.request.creativity' | translate }}</span>
          <span class="send ml-auto grid size-11 place-items-center rounded-full bg-primary-500 text-[var(--color-on-primary)]">
            <i class="pi pi-arrow-up"></i>
          </span>
        </div>
      </div>
      <!-- La demande part vers les écrans. -->
      <svg class="arrow" viewBox="0 0 96 64" fill="none" aria-hidden="true">
        <path class="flow" d="M2 48 C34 52 60 40 86 12" />
        <path d="M76 12 H87 V23" />
      </svg>
    </figure>
  `,
  styles: `
    .tag:hover {
      transform: none;
    }
    /* Les mots compris : un trait de la couleur de marque, posé l'un après l'autre au chargement. */
    .key {
      background: linear-gradient(var(--color-primary-200), var(--color-primary-200)) no-repeat 0 92% / 100% 0.32em;
      animation: key-in 0.7s var(--ease-fluid) both;
      animation-delay: calc(0.6s + var(--i, 0) * 0.25s);
    }
    :host-context(.dark) .key {
      background-image: linear-gradient(var(--color-primary-700), var(--color-primary-700));
    }
    @keyframes key-in {
      from {
        background-size: 0 0.32em;
      }
    }
    .arrow {
      position: absolute;
      top: calc(100% - 4.5rem);
      right: -6.5rem;
      display: none;
      width: 6rem;
      stroke: var(--color-primary-500);
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .flow {
      stroke-dasharray: 4 7;
      animation: flow 1.6s linear infinite;
    }
    @keyframes flow {
      to {
        stroke-dashoffset: -22;
      }
    }
    @media (min-width: 1024px) {
      .arrow {
        display: block;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .key,
      .flow {
        animation: none;
      }
    }
  `,
})
export class LandingRequest {
  private readonly translate = inject(TranslateService);
  private readonly raw = toSignal(this.translate.stream('landing.request.parts'), { initialValue: [] as RequestPart[] });
  protected readonly parts = computed(() => (Array.isArray(this.raw()) ? (this.raw() as RequestPart[]) : []));
}

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import type { EditorLang } from '../index';

export type PickerFormat = 'story' | 'square' | 'portrait' | 'landscape';

/** Largeur / hauteur de chaque format : la vignette dessine la vraie forme. */
const SHAPES: Record<PickerFormat, number> = { story: 9 / 16, portrait: 4 / 5, square: 1, landscape: 16 / 9 };
const ORDER: PickerFormat[] = ['story', 'portrait', 'square', 'landscape'];

const TEXT: Record<EditorLang, { title: string; formats: Record<PickerFormat, { label: string; ratio: string; hint: string }>; ready: string; loading: string }> = {
  fr: {
    title: 'Format de la vidéo',
    formats: {
      story: { label: 'Vertical', ratio: '9:16', hint: 'Statut WhatsApp, Reels, TikTok' },
      portrait: { label: 'Portrait', ratio: '4:5', hint: 'Fil Instagram, Facebook' },
      square: { label: 'Carré', ratio: '1:1', hint: 'Partout dans les fils' },
      landscape: { label: 'Paysage', ratio: '16:9', hint: 'YouTube, site, LinkedIn' },
    },
    ready: 'MP4 prêt',
    loading: 'Recomposition…',
  },
  en: {
    title: 'Video format',
    formats: {
      story: { label: 'Vertical', ratio: '9:16', hint: 'WhatsApp status, Reels, TikTok' },
      portrait: { label: 'Portrait', ratio: '4:5', hint: 'Instagram, Facebook feed' },
      square: { label: 'Square', ratio: '1:1', hint: 'Every feed' },
      landscape: { label: 'Landscape', ratio: '16:9', hint: 'YouTube, website, LinkedIn' },
    },
    ready: 'MP4 ready',
    loading: 'Recomposing…',
  },
};

/**
 * LE CHOIX DU FORMAT d'une vidéo, partagé par IDEM et iVision : les quatre formats TOUJOURS proposés (la vidéo se
 * recompose sur la toile choisie), chacun en carte avec sa forme dessinée, son nom, son rapport et l'endroit où il
 * sert. Le format choisi est encadré ; un format déjà exporté porte « MP4 prêt ».
 */
@Component({
  selector: 'idem-video-format-picker',
  imports: [IdemLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fp" role="radiogroup" [attr.aria-label]="t().title">
      @for (f of order; track f) {
        <button
          type="button"
          role="radio"
          class="fp__card"
          [class.fp__card--on]="f === value()"
          [attr.aria-checked]="f === value()"
          [disabled]="busy() && f !== value()"
          (click)="f !== value() && change.emit(f)"
        >
          <span class="fp__shape-box" aria-hidden="true">
            <span class="fp__shape" [style.width.rem]="size(f).w" [style.height.rem]="size(f).h"></span>
          </span>
          <span class="fp__text">
            <span class="fp__label">{{ t().formats[f].label }} <span class="fp__ratio">{{ t().formats[f].ratio }}</span></span>
            <span class="fp__hint">
              @if (busy() && f === value()) {
                <idem-loader size="xs" /> {{ t().loading }}
              } @else if (ready().includes(f)) {
                <i class="pi pi-check-circle fp__ok" aria-hidden="true"></i> {{ t().ready }}
              } @else {
                {{ t().formats[f].hint }}
              }
            </span>
          </span>
        </button>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .fp { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.5rem; }
    @media (max-width: 640px) { .fp { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .fp__card { display: flex; align-items: center; gap: 0.6rem; min-width: 0; padding: 0.45rem 0.65rem; border-radius: 12px; border: 1.5px solid var(--glass-border); background: var(--glass-bg-light); text-align: left; cursor: pointer; transition: border-color 0.15s ease, background-color 0.15s ease, transform 0.15s ease; }
    .fp__card:hover:not(:disabled) { border-color: var(--color-primary-400, var(--color-primary-500)); transform: translateY(-1px); }
    .fp__card:focus-visible { outline: 2px solid var(--color-primary-500); outline-offset: 2px; }
    .fp__card:disabled { cursor: default; opacity: 0.6; }
    .fp__card--on { border-color: var(--color-primary-500); background: color-mix(in oklch, var(--color-primary-500) 10%, var(--glass-bg-light)); box-shadow: 0 0 0 3px color-mix(in oklch, var(--color-primary-500) 18%, transparent); }
    .fp__shape-box { flex: none; display: flex; align-items: center; justify-content: center; width: 1.9rem; height: 1.9rem; }
    .fp__shape { display: block; border-radius: 4px; border: 2px solid var(--color-text-tertiary); }
    .fp__card--on .fp__shape { border-color: var(--color-primary-500); background: color-mix(in oklch, var(--color-primary-500) 18%, transparent); }
    .fp__text { display: flex; flex-direction: column; min-width: 0; }
    .fp__label { font-size: 0.875rem; font-weight: 700; color: var(--color-text-primary); white-space: nowrap; }
    .fp__ratio { font-weight: 500; font-size: 0.75rem; color: var(--color-text-tertiary); }
    .fp__hint { display: flex; align-items: center; gap: 0.3rem; font-size: 0.72rem; color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .fp__ok { color: var(--color-success); font-size: 0.72rem; }
  `,
})
export class IdemVideoFormatPickerComponent {
  /** Le format affiché. */
  readonly value = input.required<string>();
  /** Les formats dont le MP4 à jour est prêt. */
  readonly ready = input<string[]>([]);
  /** L'aperçu se recompose : les autres cartes attendent. */
  readonly busy = input<boolean>(false);
  readonly lang = input<EditorLang>('fr');
  readonly change = output<PickerFormat>();

  protected readonly order = ORDER;
  protected readonly t = computed(() => TEXT[this.lang()] ?? TEXT.fr);

  /** La forme du format, inscrite dans un carré de 1,8 rem. */
  protected size(f: PickerFormat): { w: number; h: number } {
    const r = SHAPES[f];
    return r < 1 ? { w: Math.round(1.8 * r * 100) / 100, h: 1.8 } : { w: 1.8, h: Math.round((1.8 / r) * 100) / 100 };
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Location } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { StudioState } from '../../../core/studio.state';
import { CharterResult } from '../chat/charter-result';

/**
 * LA CHARTE GRAPHIQUE d'une marque, en entier, sans quitter iVision : toutes ses pages, rendues comme dans
 * IDEM. « Modifier » ouvre sa page dans IDEM (où l'éditeur est à un clic) ; « Ouvrir mon projet » ouvre le
 * projet IDEM (business plan, deck, site…).
 */
@Component({
  selector: 'iv-charter-page',
  imports: [TranslateModule, CharterResult],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="custom-scrollbar h-full overflow-y-auto">
      <div class="mx-auto max-w-5xl px-4 py-6">
        <header class="flex items-center gap-3">
          <button type="button" class="button-icon !p-2" (click)="back()" [attr.aria-label]="'common.back' | translate">
            <i class="pi pi-arrow-left" aria-hidden="true"></i>
          </button>
          <div class="min-w-0">
            <h1 class="truncate text-2xl font-semibold tracking-tight">{{ 'charter.title' | translate }}</h1>
            @if (brand(); as b) {
              <p class="truncate text-sm text-[var(--color-text-secondary)]">{{ b.name }}</p>
            }
          </div>
        </header>
        <iv-charter-result class="mt-4 block" [brandId]="brandId()" [projectId]="brand()?.idemProjectId" [full]="true" />
      </div>
    </div>
  `,
})
export class CharterPage {
  private readonly location = inject(Location);
  private readonly state = inject(StudioState);

  readonly brandId = input.required<string>();
  protected readonly brand = computed(() => this.state.brands().find((b) => b.id === this.brandId()) ?? null);

  constructor() {
    if (!this.state.brandsLoaded()) this.state.refreshBrands();
  }

  protected back(): void {
    this.location.back();
  }
}

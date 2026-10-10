import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ApiService } from '../../../core/api.service';
import { loadFontSheet } from '../../../core/fonts';
import { Brand, PaletteRole } from '../../../core/models';

/**
 * Après le scan d'un site : trois palettes et trois appariements typographiques, montrés tels
 * qu'ils rendront (couleurs en aplats, polices chargées). L'utilisateur choisit, la marque est
 * prête et la demande en attente reprend.
 */
@Component({
  selector: 'iv-brand-choice',
  imports: [TranslateModule, IdemLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (brand(); as b) {
      <div class="mt-3 flex flex-col gap-4">
        @if (b.proposals; as p) {
          <fieldset>
            <legend class="mb-2 text-sm font-medium">{{ 'chat.choice.palettes' | translate }}</legend>
            <div class="grid gap-2 sm:grid-cols-3">
              @for (pal of p.palettes; track pal.id) {
                <label class="!flex cursor-pointer flex-col gap-2 rounded-xl border p-3 !mb-0"
                  [class]="palette() === pal.id ? 'border-[var(--color-primary-500)]' : 'border-[var(--glass-border-subtle)]'">
                  <input type="radio" class="sr-only" name="palette-{{ b.id }}" [value]="pal.id" [checked]="palette() === pal.id" (change)="palette.set(pal.id)" />
                  <span class="flex h-8 overflow-hidden rounded-lg border border-[var(--glass-border-subtle)]" aria-hidden="true">
                    @for (role of roles; track role) {
                      <span class="flex-1" [style.background]="pal.colors[role]"></span>
                    }
                  </span>
                  <span class="text-sm font-medium">{{ 'chat.choice.palette.' + pal.id | translate }}</span>
                  <span class="text-xs text-[var(--color-text-tertiary)]">{{ 'chat.choice.paletteWhy.' + pal.id | translate }}</span>
                </label>
              }
            </div>
          </fieldset>

          <fieldset>
            <legend class="mb-2 text-sm font-medium">{{ 'chat.choice.typographies' | translate }}</legend>
            <div class="grid gap-2 sm:grid-cols-3">
              @for (typo of p.typographies; track typo.id) {
                <label class="!flex cursor-pointer flex-col gap-1 rounded-xl border p-3 !mb-0"
                  [class]="typography() === typo.id ? 'border-[var(--color-primary-500)]' : 'border-[var(--glass-border-subtle)]'">
                  <input type="radio" class="sr-only" name="typo-{{ b.id }}" [value]="typo.id" [checked]="typography() === typo.id" (change)="typography.set(typo.id)" />
                  <span class="text-xl leading-tight" [style.font-family]="quote(typo.display)">{{ b.name }}</span>
                  <span class="text-sm text-[var(--color-text-secondary)]" [style.font-family]="quote(typo.body)">{{ 'chat.choice.sample' | translate }}</span>
                  <span class="mt-1 text-xs text-[var(--color-text-tertiary)]">{{ 'chat.choice.typography.' + typo.id | translate }} — {{ typo.display }} · {{ typo.body }}</span>
                </label>
              }
            </div>
          </fieldset>
        }

        <div class="flex flex-wrap items-end gap-3">
          <label class="!flex flex-col gap-1 text-sm !mb-0">
            <span>{{ 'chat.choice.name' | translate }}</span>
            <input type="text" maxlength="80" class="!w-64" [value]="name()" (input)="name.set($any($event.target).value)" />
          </label>
          <button type="button" class="inner-button button-sm" [disabled]="saving()" (click)="confirm()">
            @if (saving()) { <idem-loader size="xs" /> }
            {{ 'chat.choice.confirm' | translate }}
          </button>
        </div>
        @if (error()) {
          <p class="text-sm text-[var(--color-danger)]" role="alert">{{ 'errors.generic' | translate }}</p>
        }
      </div>
    }
  `,
})
export class BrandChoice {
  private readonly api = inject(ApiService);
  readonly brand = input.required<Brand>();
  readonly chosen = output<Brand>();

  protected readonly roles: PaletteRole[] = ['primary', 'secondary', 'accent', 'background', 'text'];
  protected readonly palette = signal('site');
  protected readonly typography = signal('site');
  protected readonly name = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal(false);

  constructor() {
    effect(() => {
      const b = this.brand();
      this.palette.set(b.proposals?.chosen.palette ?? 'site');
      this.typography.set(b.proposals?.chosen.typography ?? 'site');
      this.name.set(b.name);
      for (const t of b.proposals?.typographies ?? []) {
        loadFontSheet(t.displayCss);
        loadFontSheet(t.bodyCss);
      }
    });
  }

  protected quote(family: string): string {
    return `'${family.replace(/'/g, '')}', system-ui, sans-serif`;
  }

  protected confirm(): void {
    this.saving.set(true);
    this.error.set(false);
    this.api.chooseProposals(this.brand().id, { palette: this.palette(), typography: this.typography(), name: this.name().trim() }).subscribe({
      next: (brand) => {
        this.saving.set(false);
        this.chosen.emit(brand);
      },
      error: () => {
        this.saving.set(false);
        this.error.set(true);
      },
    });
  }
}

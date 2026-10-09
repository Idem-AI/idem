import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { parseEnvFile } from '../../utils/parse-env-file.util';

export interface EnvRow {
  key: string;
  value: string;
}

export interface ExpectedVariable {
  key: string;
  default: string | null;
  required: boolean;
}

/**
 * The variables an application consumes: typed one by one, pasted as a
 * `.env`, or uploaded from a file. When the compose file declares variables
 * (`${DB_PASSWORD:-x}`), the ones still missing are offered as one-click rows.
 */
@Component({
  selector: 'app-env-vars-editor',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-3">
      @if (missing().length > 0) {
        <div class="rounded-lg p-3 text-xs" style="border:1px solid var(--color-surface-2);">
          <p class="mb-2" style="color:var(--color-text-secondary);">{{ 'envEditor.expected' | translate }}</p>
          <div class="flex flex-wrap gap-2">
            @for (v of missing(); track v.key) {
              <button type="button" class="outer-button button-sm font-mono" (click)="addExpected(v)">
                + {{ v.key }}@if (v.required) {<span aria-hidden="true"> *</span>}
              </button>
            }
          </div>
        </div>
      }

      @for (row of rows(); track $index) {
        <div class="grid grid-cols-[1fr_1.4fr_auto] items-center gap-2">
          <input type="text" class="font-mono" [value]="row.key" [attr.aria-label]="'envEditor.key' | translate"
                 placeholder="KEY" autocomplete="off" spellcheck="false" (input)="edit($index, 'key', $any($event.target).value)" />
          <input [type]="revealed() ? 'text' : 'password'" class="font-mono" [value]="row.value" [attr.aria-label]="'envEditor.value' | translate"
                 placeholder="value" autocomplete="off" spellcheck="false" (input)="edit($index, 'value', $any($event.target).value)" />
          <button type="button" class="outer-button button-sm" [attr.aria-label]="'envEditor.remove' | translate" (click)="remove($index)">
            <i class="pi pi-trash text-xs" aria-hidden="true"></i>
          </button>
        </div>
      }

      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="outer-button button-sm" (click)="add()">
          <i class="pi pi-plus mr-1 text-xs" aria-hidden="true"></i>{{ 'envEditor.add' | translate }}
        </button>
        <button type="button" class="outer-button button-sm" (click)="pasting.set(!pasting())">
          {{ 'envEditor.paste' | translate }}
        </button>
        <label class="outer-button button-sm cursor-pointer">
          <i class="pi pi-upload mr-1 text-xs" aria-hidden="true"></i>{{ 'envEditor.upload' | translate }}
          <input type="file" class="sr-only" accept=".env,.txt,text/plain" (change)="upload($event)" />
        </label>
        <button type="button" class="outer-button button-sm ml-auto" [attr.aria-pressed]="revealed()" (click)="revealed.set(!revealed())">
          <i class="pi text-xs" [class.pi-eye]="!revealed()" [class.pi-eye-slash]="revealed()" aria-hidden="true"></i>
          {{ (revealed() ? 'envEditor.hide' : 'envEditor.show') | translate }}
        </button>
      </div>

      @if (pasting()) {
        <div>
          <textarea class="font-mono text-sm" rows="6" [attr.aria-label]="'envEditor.paste' | translate"
                    placeholder="KEY=value&#10;OTHER=value" #paste></textarea>
          <button type="button" class="inner-button button-sm mt-2" (click)="importText(paste.value); pasting.set(false)">
            {{ 'envEditor.import' | translate }}
          </button>
        </div>
      }
    </div>
  `,
})
export class EnvVarsEditorComponent {
  readonly rows = model<EnvRow[]>([]);
  readonly expected = input<ExpectedVariable[]>([]);

  protected readonly pasting = signal(false);
  protected readonly revealed = signal(false);

  /** Expected by the compose file and not in the list yet. */
  protected readonly missing = computed(() => {
    const have = new Set(this.rows().map((r) => r.key));
    return this.expected().filter((v) => !have.has(v.key));
  });

  protected add(): void {
    this.rows.update((rows) => [...rows, { key: '', value: '' }]);
  }

  protected addExpected(v: ExpectedVariable): void {
    this.rows.update((rows) => [...rows, { key: v.key, value: v.default ?? '' }]);
  }

  protected remove(index: number): void {
    this.rows.update((rows) => rows.filter((_, i) => i !== index));
  }

  protected edit(index: number, field: keyof EnvRow, value: string): void {
    this.rows.update((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  protected importText(text: string): void {
    const parsed = parseEnvFile(text);
    this.rows.update((rows) => {
      const merged = new Map(rows.filter((r) => r.key).map((r) => [r.key, r.value]));
      for (const p of parsed) merged.set(p.key, p.value);
      return [...merged].map(([key, value]) => ({ key, value }));
    });
  }

  protected upload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    void file.text().then((text) => this.importText(text));
    input.value = '';
  }
}

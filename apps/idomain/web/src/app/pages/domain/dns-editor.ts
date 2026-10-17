import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ApiService, apiMessage } from '../../core/api.service';
import { RecordSet } from '../../core/models';

const TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'CAA', 'SRV'] as const;

/**
 * La vue avancée des DNS : chaque jeu (nom + type) et ses valeurs. On écrit un jeu entier — c'est
 * ce que le registrar enregistre —, jamais toute la zone : modifier l'adresse du site ne touche ni
 * le courrier (MX), ni les vérifications (TXT).
 */
@Component({
  selector: 'idm-dns-editor',
  imports: [FormsModule, TranslateModule, IdemLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (records() === null) {
      <idem-loader block [label]="'dns.loading' | translate" />
    } @else {
      @if (records()!.length) {
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-[var(--color-text-tertiary)]">
                <th scope="col" class="py-2 pr-4 font-medium">{{ 'dns.name' | translate }}</th>
                <th scope="col" class="py-2 pr-4 font-medium">{{ 'dns.type' | translate }}</th>
                <th scope="col" class="py-2 pr-4 font-medium">{{ 'dns.values' | translate }}</th>
                <th scope="col" class="py-2 font-medium"><span class="sr-only">{{ 'dns.actions' | translate }}</span></th>
              </tr>
            </thead>
            <tbody>
              @for (r of records(); track r.name + r.type) {
                <tr class="border-t border-[var(--glass-border-subtle)] align-top">
                  <td class="py-2 pr-4 font-mono">{{ r.name }}</td>
                  <td class="py-2 pr-4">{{ r.type }}</td>
                  <td class="break-all py-2 pr-4 font-mono text-xs">@for (v of r.values; track v) { <span class="block">{{ v }}</span> }</td>
                  <td class="whitespace-nowrap py-2 text-right">
                    <button type="button" class="button-ghost button-sm" (click)="edit(r)" [attr.aria-label]="'dns.edit' | translate: { name: r.name, type: r.type }"><i class="pi pi-pencil text-xs" aria-hidden="true"></i></button>
                    <button type="button" class="button-ghost button-sm text-[var(--color-danger)]" [disabled]="saving()" (click)="remove(r)" [attr.aria-label]="'dns.remove' | translate: { name: r.name, type: r.type }"><i class="pi pi-trash text-xs" aria-hidden="true"></i></button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <p class="text-sm text-[var(--color-text-secondary)]">{{ 'dns.empty' | translate }}</p>
      }

      <form class="mt-5 grid gap-3 sm:grid-cols-[1fr_120px]" (ngSubmit)="save()">
        <p class="text-sm font-medium sm:col-span-2">{{ (editing() ? 'dns.editTitle' : 'dns.addTitle') | translate }}</p>
        <div>
          <label for="dns-name">{{ 'dns.name' | translate }}</label>
          <input id="dns-name" type="text" name="name" [(ngModel)]="name" placeholder="@" autocapitalize="none" spellcheck="false" />
        </div>
        <div>
          <label for="dns-type">{{ 'dns.type' | translate }}</label>
          <select id="dns-type" name="type" [(ngModel)]="type">
            @for (t of types; track t) { <option [value]="t">{{ t }}</option> }
          </select>
        </div>
        <div class="sm:col-span-2">
          <label for="dns-values">{{ 'dns.valuesHint' | translate }}</label>
          <textarea id="dns-values" name="values" rows="3" class="font-mono text-xs" [(ngModel)]="values" spellcheck="false"></textarea>
        </div>
        @if (error()) { <p class="text-sm text-[var(--color-danger)] sm:col-span-2" role="alert">{{ error() }}</p> }
        <div class="flex gap-2 sm:col-span-2">
          <button type="submit" class="inner-button button-sm inline-flex items-center gap-2" [disabled]="saving()">
            @if (saving()) { <idem-loader size="xs" /> }
            {{ 'dns.save' | translate }}
          </button>
          @if (editing()) { <button type="button" class="button-ghost button-sm" (click)="reset()">{{ 'common.cancel' | translate }}</button> }
        </div>
      </form>
    }
  `,
})
export class DnsEditor {
  private readonly api = inject(ApiService);
  private readonly translate = inject(TranslateService);
  readonly domainId = input.required<string>();

  protected readonly types = TYPES;
  protected readonly records = signal<RecordSet[] | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly editing = signal(false);
  protected name = '@';
  protected type: (typeof TYPES)[number] = 'A';
  protected values = '';
  private ttl = 3600;

  constructor() {
    queueMicrotask(() => this.load());
  }

  private load(): void {
    this.api.records(this.domainId()).subscribe({
      next: (r) => this.records.set(r.records),
      error: (e) => {
        this.records.set([]);
        this.error.set(apiMessage(e, this.translate.instant('dns.loadError')));
      },
    });
  }

  protected edit(r: RecordSet): void {
    this.editing.set(true);
    this.name = r.name;
    this.type = r.type as (typeof TYPES)[number];
    this.values = r.values.join('\n');
    this.ttl = r.ttl;
  }

  protected reset(): void {
    this.editing.set(false);
    this.name = '@';
    this.type = 'A';
    this.values = '';
    this.ttl = 3600;
  }

  protected remove(r: RecordSet): void {
    if (!confirm(this.translate.instant('dns.confirmRemove', { name: r.name, type: r.type }))) return;
    this.write({ ...r, values: [] });
  }

  protected save(): void {
    const values = this.values.split('\n').map((v) => v.trim()).filter(Boolean);
    if (!values.length) {
      this.error.set(this.translate.instant('dns.valuesRequired'));
      return;
    }
    this.write({ name: this.name.trim() || '@', type: this.type, ttl: this.ttl, values });
  }

  private write(set: RecordSet): void {
    this.saving.set(true);
    this.error.set(null);
    this.api.saveRecordSet(this.domainId(), set).subscribe({
      next: (r) => {
        this.saving.set(false);
        this.records.set(r.records);
        this.reset();
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(apiMessage(e, this.translate.instant('dns.saveError')));
      },
    });
  }
}

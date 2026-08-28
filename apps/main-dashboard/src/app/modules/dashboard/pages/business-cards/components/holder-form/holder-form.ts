import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import {
  BusinessCardField,
  BusinessCardHolder,
  BUSINESS_CARD_FIELDS,
} from '../../../../models/business-card.model';

/** Description d'un champ du formulaire (libellé i18n + type de saisie). */
interface FieldConfig {
  key: BusinessCardField;
  type: 'text' | 'email' | 'tel' | 'url';
  icon: string;
  /** Occupe toute la largeur (adresse). */
  wide?: boolean;
}

const FIELDS: FieldConfig[] = [
  { key: 'fullName', type: 'text', icon: 'pi pi-user' },
  { key: 'jobTitle', type: 'text', icon: 'pi pi-briefcase' },
  { key: 'email', type: 'email', icon: 'pi pi-envelope' },
  { key: 'phone', type: 'tel', icon: 'pi pi-phone' },
  { key: 'mobile', type: 'tel', icon: 'pi pi-mobile' },
  { key: 'website', type: 'url', icon: 'pi pi-globe' },
  { key: 'linkedin', type: 'text', icon: 'pi pi-linkedin' },
  { key: 'address', type: 'text', icon: 'pi pi-map-marker', wide: true },
];

/**
 * Formulaire d'une personne. Émet ses valeurs à CHAQUE frappe (`valuesChange`)
 * pour alimenter l'aperçu temps réel ; `save` n'est émis qu'à la validation.
 */
@Component({
  selector: 'app-holder-form',
  imports: [ReactiveFormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-5">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        @for (field of fields; track field.key) {
          <div [class.sm:col-span-2]="field.wide">
            <label
              [for]="'card-field-' + field.key"
              class="flex items-center gap-2 text-sm font-medium text-text-secondary mb-1.5"
            >
              <i [class]="field.icon + ' text-xs text-text-tertiary'" aria-hidden="true"></i>
              <span>{{ 'dashboard.businessCards.fields.' + field.key | translate }}</span>
              @if (field.key === 'fullName') {
                <span class="text-red-400" aria-hidden="true">*</span>
              }
              @if (!isUsedByTemplate(field.key)) {
                <span
                  class="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-sm bg-[var(--glass-bg-subtle)] text-text-tertiary border border-[var(--glass-border)]"
                >
                  {{ 'dashboard.businessCards.form.unusedField' | translate }}
                </span>
              }
            </label>
            <input
              [id]="'card-field-' + field.key"
              [type]="field.type"
              [formControlName]="field.key"
              [attr.aria-required]="field.key === 'fullName' ? 'true' : null"
              [attr.aria-invalid]="field.key === 'fullName' && nameInvalid() ? 'true' : null"
              [attr.aria-describedby]="field.key === 'fullName' ? 'card-field-fullName-error' : null"
              [placeholder]="'dashboard.businessCards.placeholders.' + field.key | translate"
              class="w-full"
            />
            @if (field.key === 'fullName' && nameInvalid()) {
              <p id="card-field-fullName-error" class="text-xs text-red-400 mt-1">
                {{ 'dashboard.businessCards.form.nameRequired' | translate }}
              </p>
            }
          </div>
        }
      </div>

      <div class="flex flex-wrap items-center gap-3 pt-1">
        <button type="submit" class="inner-button !text-sm" [disabled]="saving()">
          <i class="pi" [class.pi-check]="!saving()" [class.pi-spinner]="saving()" [class.pi-spin]="saving()"></i>
          <span>{{ submitLabelKey() | translate }}</span>
        </button>
        <button type="button" class="outer-button !text-sm !py-2.5" (click)="cancel.emit()">
          {{ 'common.cancel' | translate }}
        </button>
      </div>
    </form>
  `,
})
export class HolderFormComponent {
  /** Personne éditée (absent = création). */
  readonly holder = input<BusinessCardHolder | null>(null);
  /** Champs réellement utilisés par le template (pour signaler les autres). */
  readonly templateFields = input<BusinessCardField[]>([...BUSINESS_CARD_FIELDS]);
  readonly saving = input<boolean>(false);

  readonly valuesChange = output<Record<string, string>>();
  readonly save = output<Record<string, string>>();
  readonly cancel = output<void>();

  private readonly fb = inject(FormBuilder);
  protected readonly fields = FIELDS;

  protected readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(80)]],
    jobTitle: [''],
    email: [''],
    phone: [''],
    mobile: [''],
    website: [''],
    linkedin: [''],
    address: [''],
  });

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  private readonly submitted = signal(false);

  protected readonly nameInvalid = computed(
    () => this.submitted() && !this.value().fullName?.trim(),
  );

  protected readonly submitLabelKey = computed(() =>
    this.holder() ? 'dashboard.businessCards.form.update' : 'dashboard.businessCards.form.create',
  );

  constructor() {
    // Charge la personne éditée (ou remet le formulaire à zéro en création).
    effect(() => {
      const holder = this.holder();
      this.submitted.set(false);
      this.form.reset({
        fullName: holder?.fullName ?? '',
        jobTitle: holder?.jobTitle ?? '',
        email: holder?.email ?? '',
        phone: holder?.phone ?? '',
        mobile: holder?.mobile ?? '',
        website: holder?.website ?? '',
        linkedin: holder?.linkedin ?? '',
        address: holder?.address ?? '',
      });
    });

    // Aperçu temps réel : chaque frappe remonte au parent.
    effect(() => this.valuesChange.emit(this.cleanValues()));
  }

  protected isUsedByTemplate(field: BusinessCardField): boolean {
    const used = this.templateFields();
    return used.length === 0 || used.includes(field);
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.form.invalid) return;
    this.save.emit(this.cleanValues());
  }

  private cleanValues(): Record<string, string> {
    const raw = this.value();
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'string' && value.trim()) clean[key] = value.trim();
    }
    return clean;
  }
}

import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ApiService, apiMessage } from '../../core/api.service';
import { Contact } from '../../core/models';

/**
 * Le titulaire du domaine : les coordonnées que les registres exigent pour l'enregistrer à son
 * nom. Demandées une fois, réutilisées ensuite. Les champs natifs sont stylés par le design system.
 */
@Component({
  selector: 'idm-contact-form',
  imports: [ReactiveFormsModule, TranslateModule, IdemLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="save()" class="grid gap-4 sm:grid-cols-2" novalidate>
      @for (f of fields; track f.name) {
        <div [class.sm:col-span-2]="f.wide">
          <label [for]="'contact-' + f.name">{{ 'contact.fields.' + f.name | translate }}@if (!f.optional) { <span aria-hidden="true"> *</span> }</label>
          <input [id]="'contact-' + f.name" [type]="f.type" [formControlName]="f.name" [attr.autocomplete]="f.autocomplete" [attr.inputmode]="f.inputmode ?? null"
            [attr.aria-invalid]="invalid(f.name)" [attr.aria-describedby]="invalid(f.name) ? 'contact-' + f.name + '-error' : null" />
          @if (invalid(f.name)) {
            <p [id]="'contact-' + f.name + '-error'" class="mt-1 text-xs text-[var(--color-danger)]">{{ 'contact.invalid' | translate }}</p>
          }
        </div>
      }
      @if (error()) {
        <p class="text-sm text-[var(--color-danger)] sm:col-span-2" role="alert">{{ error() }}</p>
      }
      <div class="flex gap-2 sm:col-span-2">
        <button type="submit" class="inner-button inline-flex items-center gap-2" [disabled]="saving()">
          @if (saving()) { <idem-loader size="xs" /> }
          {{ 'contact.save' | translate }}
        </button>
        @if (cancellable()) {
          <button type="button" class="button-ghost" (click)="cancelled.emit()">{{ 'common.cancel' | translate }}</button>
        }
      </div>
    </form>
  `,
})
export class ContactForm {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);
  readonly contact = input<Contact | null>(null);
  /** Pré-remplissage depuis le compte IDEM (adresse e-mail, nom). */
  readonly defaults = input<Partial<Contact>>({});
  readonly cancellable = input(false);
  readonly saved = output<Contact>();
  readonly cancelled = output<void>();

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  private submitted = false;

  protected readonly fields: { name: keyof Contact; type: string; autocomplete: string; optional?: boolean; wide?: boolean; inputmode?: string }[] = [
    { name: 'firstName', type: 'text', autocomplete: 'given-name' },
    { name: 'lastName', type: 'text', autocomplete: 'family-name' },
    { name: 'company', type: 'text', autocomplete: 'organization', optional: true, wide: true },
    { name: 'email', type: 'email', autocomplete: 'email', wide: true },
    { name: 'phoneCountryCode', type: 'text', autocomplete: 'tel-country-code', inputmode: 'numeric' },
    { name: 'phone', type: 'tel', autocomplete: 'tel-national' },
    { name: 'address', type: 'text', autocomplete: 'street-address', wide: true },
    { name: 'city', type: 'text', autocomplete: 'address-level2' },
    { name: 'postalCode', type: 'text', autocomplete: 'postal-code', optional: true },
    { name: 'country', type: 'text', autocomplete: 'country' },
    { name: 'state', type: 'text', autocomplete: 'address-level1', optional: true },
  ];

  protected readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(80)]],
    lastName: ['', [Validators.required, Validators.maxLength(80)]],
    company: [''],
    email: ['', [Validators.required, Validators.email]],
    phoneCountryCode: ['237', [Validators.required, Validators.pattern(/^\+?\d{1,4}$/)]],
    phone: ['', [Validators.required, Validators.pattern(/^[\d\s.-]{6,20}$/)]],
    address: ['', [Validators.required, Validators.minLength(3)]],
    city: ['', Validators.required],
    postalCode: [''],
    // Code pays à deux lettres (CM, CI, SN…), demandé par les registres.
    country: ['CM', [Validators.required, Validators.pattern(/^[A-Za-z]{2}$/)]],
    state: [''],
  });

  constructor() {
    effect(() => {
      const c = this.contact() ?? this.defaults();
      // Les champs absents (null) restent vides : seules les valeurs connues pré-remplissent le formulaire.
      this.form.patchValue(Object.fromEntries(Object.entries(c).filter(([, v]) => v !== null && v !== undefined)) as Record<string, string>);
    });
  }

  protected invalid(name: string): boolean {
    const control = this.form.get(name);
    return Boolean(control && control.invalid && (control.touched || this.submitted));
  }

  protected save(): void {
    this.submitted = true;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const value = this.form.getRawValue();
    this.api.saveContact({ ...value, country: value.country.toUpperCase(), company: value.company || null, postalCode: value.postalCode || null, state: value.state || null }).subscribe({
      next: ({ contact }) => {
        this.saving.set(false);
        this.saved.emit(contact);
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(apiMessage(e, this.translate.instant('contact.saveError')));
      },
    });
  }
}

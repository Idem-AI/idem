import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, model, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { DIAL_COUNTRIES, DialCountry, guessCountry, parseInternational, toInternational } from './whatsapp-countries';

/**
 * CHAMP TÉLÉPHONE — l'indicatif d'un côté, le numéro de l'autre, dans un seul cadre.
 *
 * Saisir « +237 6… » en entier ne marche presque jamais du premier coup sur un téléphone ;
 * ici l'indicatif se choisit (la liste native du téléphone s'ouvre) et un numéro international
 * collé est reconnu : le pays se règle tout seul. `value` est toujours « +indicatif + numéro »,
 * ou vide tant que la saisie n'est pas exploitable.
 */
@Component({
  selector: 'app-whatsapp-phone-field',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    .wpf {
      display: flex;
      align-items: stretch;
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-xl);
      background: var(--idem-field-bg);
      transition:
        border-color var(--duration-150) var(--ease-out),
        box-shadow var(--duration-150) var(--ease-out);
    }

    .wpf:hover {
      border-color: var(--glass-border-medium);
    }

    .wpf:focus-within {
      border-color: var(--color-primary-500);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary-500) 18%, transparent);
    }

    .wpf-error,
    .wpf-error:focus-within {
      border-color: var(--color-danger);
    }

    .wpf-country {
      position: relative;
      display: flex;
      flex-shrink: 0;
      align-items: center;
      gap: 0.45rem;
      padding: 0 0.85rem;
      border-right: 1px solid var(--glass-border);
      border-radius: var(--radius-xl) 0 0 var(--radius-xl);
      cursor: pointer;
    }

    .wpf-country:hover {
      background: var(--glass-bg-subtle);
    }

    .wpf-iso {
      border-radius: 0.4rem;
      background: color-mix(in srgb, var(--color-primary-500) 12%, transparent);
      padding: 0.15rem 0.4rem;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: var(--color-primary-500);
    }

    .wpf-dial {
      font-size: 1rem;
      font-weight: 600;
      color: var(--color-text-primary);
      font-variant-numeric: tabular-nums;
    }

    .wpf-chevron {
      font-size: 0.65rem;
      color: var(--color-text-tertiary);
    }

    /* La liste native fait le travail (clavier, lecteur d'écran, sélecteur du téléphone) ; elle est
       seulement posée, invisible, sur toute la pastille. */
    .wpf-country select {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
    }

    .wpf-country:focus-within {
      outline: 2px solid var(--color-primary-500);
      outline-offset: -2px;
    }

    .wpf input[type='tel'],
    .wpf input[type='tel']:hover,
    .wpf input[type='tel']:focus {
      min-width: 0;
      flex: 1;
      border: 0;
      border-radius: 0 var(--radius-xl) var(--radius-xl) 0;
      background: transparent;
      box-shadow: none;
      padding: 0.95rem 1rem;
      font-size: 1.05rem;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
    }
  `,
  template: `
    <div class="wpf" [class.wpf-error]="invalid()">
      <label class="wpf-country">
        <span class="wpf-iso" aria-hidden="true">{{ country().iso }}</span>
        <span class="wpf-dial" aria-hidden="true">+{{ country().dial }}</span>
        <i class="pi pi-chevron-down wpf-chevron" aria-hidden="true"></i>
        <select [attr.aria-label]="'dashboard.showCommunication.whatsapp.phone.country' | translate" [disabled]="disabled()" (change)="pickCountry($any($event.target).value)">
          @for (option of countries; track option.iso) {
            <option [value]="option.iso" [selected]="option.iso === country().iso">{{ option.name }} (+{{ option.dial }})</option>
          }
        </select>
      </label>
      <input
        type="tel"
        inputmode="tel"
        autocomplete="tel-national"
        enterkeyhint="send"
        [value]="national()"
        [disabled]="disabled()"
        [attr.aria-label]="'dashboard.showCommunication.whatsapp.phone.label' | translate"
        [attr.aria-invalid]="invalid()"
        [placeholder]="placeholder()"
        (input)="onInput($event)"
        (keydown.enter)="submitted.emit()"
      />
    </div>
  `,
})
export class WhatsappPhoneField {
  private readonly window = inject(DOCUMENT).defaultView;

  /** « +2250700000000 », ou vide si la saisie n'est pas encore un numéro. */
  readonly value = model('');
  readonly disabled = input(false);
  readonly invalid = input(false);
  /** Touche Entrée dans le champ : le parent lance l'envoi du code. */
  readonly submitted = output<void>();

  protected readonly countries = DIAL_COUNTRIES;
  protected readonly country = signal<DialCountry>(guessCountry(this.window?.navigator.language));
  protected readonly national = signal('');

  protected placeholder(): string {
    return this.country().iso === 'CI' ? '07 00 00 00 00' : '6 12 34 56 78';
  }

  protected pickCountry(iso: string): void {
    const next = DIAL_COUNTRIES.find((candidate) => candidate.iso === iso);
    if (!next) return;
    this.country.set(next);
    this.publish();
  }

  protected onInput(event: Event): void {
    const field = event.target as HTMLInputElement;
    // Un numéro collé avec son indicatif règle le pays ; on ne garde alors que le reste.
    const international = parseInternational(field.value);
    if (international) {
      this.country.set(international.country);
      this.national.set(international.national);
      field.value = international.national;
    } else {
      const clean = field.value.replace(/[^\d\s().+-]/g, '');
      if (clean !== field.value) field.value = clean;
      this.national.set(clean);
    }
    this.publish();
  }

  private publish(): void {
    const text = this.national().trim();
    // « + » en cours de frappe, pas encore reconnu : rien d'exploitable.
    this.value.set(!text || text.startsWith('+') ? '' : toInternational(this.country(), text));
  }
}

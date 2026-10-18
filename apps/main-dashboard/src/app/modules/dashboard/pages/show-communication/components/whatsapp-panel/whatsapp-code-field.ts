import { ChangeDetectionStrategy, Component, ElementRef, input, model, output, viewChildren } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

const LENGTH = 6;
const ALLOWED = /[A-Z0-9]/g;

/**
 * CODE À 6 CASES — le code reçu sur WhatsApp, un caractère par case.
 *
 * Le curseur avance seul, Retour arrière recule, et le code collé en entier (ou proposé par le
 * clavier du téléphone, `one-time-code`) se répartit dans les cases. `completed` part dès que la
 * sixième est remplie : plus besoin de chercher le bouton.
 */
@Component({
  selector: 'app-whatsapp-code-field',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    .wcf {
      display: flex;
      justify-content: center;
      gap: 0.5rem;
    }

    .wcf input[type='text'] {
      width: 2.9rem;
      height: 3.4rem;
      min-width: 0;
      padding: 0;
      border-radius: var(--radius-lg);
      text-align: center;
      font-family: var(--font-mono, ui-monospace, monospace);
      font-size: 1.4rem;
      font-weight: 700;
      text-transform: uppercase;
      caret-color: var(--color-primary-500);
    }

    .wcf input[type='text']:focus {
      border-color: var(--color-primary-500);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary-500) 18%, transparent);
    }

    .wcf input.wcf-filled {
      border-color: var(--glass-border-medium);
    }

    .wcf input.wcf-error {
      border-color: var(--color-danger);
    }

    @media (max-width: 22rem) {
      .wcf {
        gap: 0.35rem;
      }

      .wcf input[type='text'] {
        width: 2.5rem;
        height: 3rem;
      }
    }
  `,
  template: `
    <div class="wcf" role="group" [attr.aria-label]="'dashboard.showCommunication.whatsapp.code.label' | translate">
      @for (index of cells; track index) {
        <input
          #cell
          type="text"
          maxlength="1"
          autocapitalize="characters"
          autocorrect="off"
          spellcheck="false"
          enterkeyhint="done"
          [attr.autocomplete]="index === 0 ? 'one-time-code' : 'off'"
          [attr.aria-label]="'dashboard.showCommunication.whatsapp.code.cell' | translate: { n: index + 1, total: cells.length }"
          [attr.aria-invalid]="invalid()"
          [class.wcf-filled]="!!char(index)"
          [class.wcf-error]="invalid()"
          [value]="char(index)"
          [disabled]="disabled()"
          (input)="onInput(index, $event)"
          (keydown)="onKeydown(index, $event)"
          (paste)="onPaste($event)"
          (focus)="$any($event.target).select()"
        />
      }
    </div>
  `,
})
export class WhatsappCodeField {
  /** Le code saisi, en majuscules, 6 caractères au plus. */
  readonly value = model('');
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly completed = output<string>();

  protected readonly cells = Array.from({ length: LENGTH }, (_, i) => i);
  private readonly fields = viewChildren<ElementRef<HTMLInputElement>>('cell');

  /** Donne la main à la première case (à l'arrivée sur l'étape). */
  focusFirst(): void {
    this.fields()[0]?.nativeElement.focus();
  }

  protected char(index: number): string {
    return (this.value()[index] ?? '').trim();
  }

  protected onInput(index: number, event: Event): void {
    const field = event.target as HTMLInputElement;
    const typed = (field.value.toUpperCase().match(ALLOWED) ?? []).join('');
    if (!typed) {
      field.value = '';
      this.write(index, '');
      return;
    }
    // Le clavier peut proposer le code entier d'un coup : on le répartit.
    this.fill(index, typed);
  }

  protected onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = (event.clipboardData?.getData('text').toUpperCase().match(ALLOWED) ?? []).join('');
    if (pasted) this.fill(0, pasted);
  }

  protected onKeydown(index: number, event: KeyboardEvent): void {
    const fields = this.fields();
    if (event.key === 'Backspace' && !this.char(index) && index > 0) {
      event.preventDefault();
      this.write(index - 1, '');
      fields[index - 1].nativeElement.focus();
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      fields[index - 1].nativeElement.focus();
    } else if (event.key === 'ArrowRight' && index < LENGTH - 1) {
      event.preventDefault();
      fields[index + 1].nativeElement.focus();
    } else if (event.key === 'Enter' && this.value().length === LENGTH) {
      this.completed.emit(this.value());
    }
  }

  /** Pose `chars` à partir de la case `start`, puis place le curseur après le dernier caractère posé. */
  private fill(start: number, chars: string): void {
    const current = this.value().padEnd(LENGTH, ' ').split('');
    for (let offset = 0; offset < chars.length && start + offset < LENGTH; offset++) current[start + offset] = chars[offset];
    this.commit(current.join('').trimEnd());
    const next = Math.min(start + chars.length, LENGTH - 1);
    this.fields()[next]?.nativeElement.focus();
  }

  private write(index: number, char: string): void {
    const current = this.value().padEnd(LENGTH, ' ').split('');
    current[index] = char || ' ';
    this.commit(current.join('').trimEnd());
  }

  private commit(next: string): void {
    // Une case vidée au milieu laisse un blanc : le code n'est complet que sans trou.
    this.value.set(next);
    if (next.length === LENGTH && !next.includes(' ')) this.completed.emit(next);
  }
}

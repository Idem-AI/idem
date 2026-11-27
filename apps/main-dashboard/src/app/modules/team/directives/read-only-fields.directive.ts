import { DestroyRef, Directive, effect, ElementRef, inject } from '@angular/core';
import { ProjectAccessUiService } from '../services/project-access-ui.service';

const MARK = 'data-team-readonly';
const FIELDS = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select, input[type=checkbox], input[type=radio], [contenteditable="true"]';

/**
 * Posée sur la zone de contenu du tableau de bord : quand la page est, pour la
 * personne, en lecture seule, ses champs le deviennent aussi — les textes en
 * `readonly` (on peut encore les sélectionner et les copier), les listes, cases
 * et zones éditables en `disabled`. Les boutons ne sont pas touchés : ceux qui
 * écrivent sont déjà masqués (`appWriteOnly`), les autres (onglets,
 * téléchargements) doivent continuer de marcher.
 *
 * Restent utilisables : les champs de recherche et de filtre, et tout ce qui est
 * placé sous `data-team-keep-editable`.
 *
 * Les écrans se dessinent après coup (chargements, onglets) : un observateur
 * applique la règle aux champs qui apparaissent. Seuls les champs marqués par
 * cette directive sont rendus à leur état en sortie de lecture seule.
 */
@Directive({ selector: '[appReadOnlyFields]' })
export class ReadOnlyFieldsDirective {
  private readonly host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  private readonly ui = inject(ProjectAccessUiService);
  private observer: MutationObserver | null = null;

  constructor() {
    effect(() => (this.ui.readOnly() ? this.lock() : this.unlock()));
    inject(DestroyRef).onDestroy(() => this.observer?.disconnect());
  }

  private lock(): void {
    this.apply(this.host);
    if (this.observer || typeof MutationObserver === 'undefined') return;
    this.observer = new MutationObserver(() => this.apply(this.host));
    this.observer.observe(this.host, { childList: true, subtree: true });
  }

  private apply(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>(FIELDS).forEach((field) => {
      if (field.hasAttribute(MARK) || field.closest('[data-team-keep-editable]')) return;
      // Chercher, filtrer, choisir un onglet : lire, pas écrire.
      if (field instanceof HTMLInputElement && field.type === 'search') return;
      if (field.getAttribute('role') === 'searchbox' || /search|filter|recherche|filtre/i.test(field.getAttribute('aria-label') ?? '')) return;
      const textual =
        (field instanceof HTMLInputElement && !['checkbox', 'radio', 'file', 'range', 'color'].includes(field.type)) ||
        field instanceof HTMLTextAreaElement;
      if (textual) {
        if ((field as HTMLInputElement).readOnly) return;
        (field as HTMLInputElement).readOnly = true;
        field.setAttribute(MARK, 'readonly');
      } else if (field.isContentEditable) {
        field.setAttribute('contenteditable', 'false');
        field.setAttribute(MARK, 'contenteditable');
      } else {
        if ((field as HTMLInputElement).disabled) return;
        (field as HTMLInputElement).disabled = true;
        field.setAttribute(MARK, 'disabled');
      }
    });
  }

  private unlock(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.host.querySelectorAll<HTMLElement>(`[${MARK}]`).forEach((field) => {
      const how = field.getAttribute(MARK);
      if (how === 'readonly') (field as HTMLInputElement).readOnly = false;
      else if (how === 'disabled') (field as HTMLInputElement).disabled = false;
      else if (how === 'contenteditable') field.setAttribute('contenteditable', 'true');
      field.removeAttribute(MARK);
    });
  }
}

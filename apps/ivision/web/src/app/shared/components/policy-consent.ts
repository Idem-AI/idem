import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';

let uid = 0;

/**
 * L'ACCORD DES POLITIQUES D'IDEM, en une case : utiliser son site crée un projet IDEM, et IDEM ne génère rien
 * sur un projet dont la politique de confidentialité, les conditions d'utilisation et les conditions du
 * programme bêta n'ont pas été acceptées. Chaque texte s'ouvre dans un nouvel onglet ; la case n'est
 * jamais cochée d'avance.
 */
@Component({
  selector: 'iv-policy-consent',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-start gap-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
      <input [id]="id" type="checkbox" class="mt-0.5 flex-none" [checked]="accepted()" (change)="accepted.set($any($event.target).checked)" />
      <label [for]="id" class="!mb-0 !text-xs !font-normal">
        {{ 'consent.iAccept' | translate }}
        <a class="underline" [href]="landing + '/privacy-policy'" target="_blank" rel="noopener">{{ 'consent.privacy' | translate }}</a>,
        <a class="underline" [href]="landing + '/terms-of-service'" target="_blank" rel="noopener">{{ 'consent.terms' | translate }}</a>
        {{ 'consent.and' | translate }}
        <a class="underline" [href]="landing + '/beta-policy'" target="_blank" rel="noopener">{{ 'consent.beta' | translate }}</a>
        {{ 'consent.ofIdem' | translate }}
      </label>
    </div>
  `,
})
export class PolicyConsent {
  readonly accepted = model(false);
  protected readonly id = `iv-consent-${++uid}`;
  protected readonly landing = environment.services.landing.url.replace(/\/+$/, '');
}

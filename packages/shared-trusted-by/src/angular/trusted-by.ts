import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { resolvePartners, TRUSTED_BY_ASSETS_BASE_PATH, type ResolvedPartner } from '../partners';

/**
 * Bandeau défilant « Ils nous font confiance », partagé par les applications
 * Angular d'Idem (landing, iDeploy, …).
 *
 * Les logos sont servis par l'application hôte : `npm run sync:trusted-by` les
 * dépose dans son dossier `public/`. Si une application les monte ailleurs,
 * elle le dit via `basePath`.
 *
 * @example
 * ```html
 * <idem-trusted-by label="Ils nous font confiance" />
 * ```
 */
@Component({
  selector: 'idem-trusted-by',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="idem-trusted-by">
      @if (label(); as heading) {
        <p class="idem-trusted-by__label">{{ heading }}</p>
      }
      <div class="idem-trusted-by__viewport">
        <div class="idem-trusted-by__track">
          @for (partner of partners(); track partner.name) {
            <a
              class="idem-trusted-by__link"
              [href]="partner.url"
              [title]="partner.name"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img class="idem-trusted-by__logo" [src]="partner.logoUrl" [alt]="partner.name" />
            </a>
          }
        </div>
        <!-- Copie décorative : elle assure la boucle, pas le contenu. -->
        <div class="idem-trusted-by__track" aria-hidden="true">
          @for (partner of partners(); track partner.name) {
            <span class="idem-trusted-by__link">
              <img class="idem-trusted-by__logo" [src]="partner.logoUrl" alt="" />
            </span>
          }
        </div>
      </div>
    </div>
  `,
  styleUrls: ['../trusted-by.css'],
})
export class TrustedByComponent {
  /** Où l'application sert les logos. Par défaut, le chemin de `sync:trusted-by`. */
  readonly basePath = input<string>(TRUSTED_BY_ASSETS_BASE_PATH);

  /** Intitulé au-dessus du bandeau. Omis, aucun titre n'est rendu. */
  readonly label = input<string | null>(null);

  protected readonly partners = computed<ResolvedPartner[]>(() => resolvePartners(this.basePath()));
}

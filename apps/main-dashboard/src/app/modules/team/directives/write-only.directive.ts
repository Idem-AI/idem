import { computed, Directive, inject } from '@angular/core';
import { ProjectAccessUiService } from '../services/project-access-ui.service';

/**
 * Une action qui modifie le projet (générer, créer, modifier, supprimer,
 * importer) : elle disparaît pour un membre d'équipe qui n'a que « Voir » sur
 * l'espace de la page. Il ne voit pas un bouton qui lui serait refusé.
 *
 * ```html
 * <button class="inner-button" appWriteOnly (click)="generate()">…</button>
 * ```
 *
 * L'API refuse de toute façon (403 `read_only`) : la directive évite d'en
 * arriver là, elle ne protège rien à elle seule.
 */
@Directive({
  selector: '[appWriteOnly]',
  host: {
    '[attr.hidden]': "hidden() ? '' : null",
    '[style.display]': "hidden() ? 'none' : null",
    '[attr.aria-hidden]': "hidden() ? 'true' : null",
  },
})
export class WriteOnlyDirective {
  private readonly access = inject(ProjectAccessUiService);
  protected readonly hidden = computed(() => this.access.readOnly());
}

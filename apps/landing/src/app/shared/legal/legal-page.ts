import { ChangeDetectionStrategy, Component, computed, inject, LOCALE_ID } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { LegalDocumentTemplate } from '../components/legal-document-template/legal-document-template';
import { toLegalLocale } from './content.model';
import { legalContent } from './docs';
import { relatedLinks } from './related';
import { renderLegalDoc } from './render';

/**
 * La page d’un texte juridique, quelle qu’elle soit.
 *
 * Une seule page sert les treize documents : l’identifiant vient des données
 * de la route (`data.legalDoc`), le contenu du registre, la langue de
 * `LOCALE_ID`. C’est ce qui garantit que tous les textes se présentent de la
 * même façon — même en-tête, même sommaire, même date d’effet, mêmes renvois.
 *
 * Avant, chaque texte était un composant à lui, avec son propre gabarit :
 * c’est ainsi qu’un document finit par oublier d’afficher sa date, et qu’un
 * autre part en production avec « [Jurisdiction] » dans sa clause de
 * compétence.
 */
@Component({
  selector: 'app-legal-page',
  standalone: true,
  imports: [LegalDocumentTemplate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let doc = rendered();

    @if (doc) {
      <app-legal-document-template
        [title]="doc.title"
        [subtitle]="doc.subtitle"
        [effectiveDate]="doc.effectiveDate"
        [version]="doc.version"
        [versionLabel]="doc.versionLabel"
        [sections]="doc.sections"
        [navigation]="doc.navigation"
        [related]="related()"
        [relatedTitle]="doc.relatedTitle"
      />
    }
  `,
})
export class LegalPage {
  private readonly route = inject(ActivatedRoute);
  private readonly locale = toLegalLocale(inject(LOCALE_ID));

  /** L’identifiant posé par la route : `data: { legalDoc: 'privacy-policy' }`. */
  private readonly docId = computed<string>(
    () => (this.route.snapshot.data['legalDoc'] as string | undefined) ?? '',
  );

  protected readonly rendered = computed(() => {
    const content = legalContent(this.docId());
    return content ? renderLegalDoc(content, this.locale) : null;
  });

  protected readonly related = computed(() => relatedLinks(this.docId(), this.locale));
}

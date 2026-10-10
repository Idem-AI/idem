import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { IdemDocumentEditorComponent } from '@idem/shared-document-editor/angular';
import { ApiService } from '../../../core/api.service';
import { IvisionVisualAdapter } from './visual-adapter';

/**
 * L'éditeur d'un visuel : l'éditeur partagé d'IDEM (`<idem-document-editor>`), plein écran,
 * ouvert sur l'élément cliqué dans l'aperçu (`?section=&path=`). Le retour ramène à la
 * conversation qui a produit le visuel.
 */
@Component({
  selector: 'iv-visual-edit',
  imports: [IdemDocumentEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-dvh' },
  template: `
    <idem-document-editor
      [adapter]="adapter"
      [contextId]="brandId()"
      [documentId]="visualId()"
      [target]="section() ? { sectionId: section()!, path: path() ?? null } : null"
      [heading]="heading"
      (exit)="back()"
    />
  `,
})
export class VisualEditPage {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  protected readonly adapter = inject(IvisionVisualAdapter);
  protected readonly heading = inject(TranslateService).instant('visualEdit.title');

  readonly brandId = input.required<string>();
  readonly visualId = input.required<string>();
  /** Lien profond depuis l'aperçu : la section et l'élément cliqués. */
  readonly section = input<string>();
  readonly path = input<string>();

  /** Retour à la conversation du visuel (sinon à l'atelier des visuels). */
  protected back(): void {
    this.api.visual(this.visualId()).subscribe({
      next: (v) => this.router.navigate(v.sessionId ? ['/studio/image', v.sessionId] : ['/studio/image']),
      error: () => this.router.navigate(['/studio/image']),
    });
  }
}

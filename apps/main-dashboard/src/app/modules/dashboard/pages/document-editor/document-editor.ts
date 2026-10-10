import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  DocumentTypeAdapter,
  EDITOR_TARGET_PARAMS,
  EditorDocumentType,
  IdemDocumentEditorComponent,
} from '@idem/shared-document-editor/angular';
import { CookieService } from '../../../../shared/services/cookie.service';
import { TokenService } from '../../../../shared/services/token.service';
import { ErrorStateComponent } from '../../../../shared/components/error-state/error-state';
import { injectEditorAdapter } from './adapters/inject-editor-adapter';

/**
 * La page « éditeur » d'IDEM : l'éditeur partagé (`@idem/shared-document-editor`, le même
 * qu'iVision) sur un document du projet courant.
 *
 * Ce qui reste propre à IDEM vit ici : l'adaptateur résolu depuis la route
 * (`data.documentType`), le projet lu dans le cookie, l'attente de l'authentification, le lien
 * profond (`?section=<id>&path=<chemin>`, `?documentId=`) et le retour vers la page du document.
 */
@Component({
  selector: 'app-document-editor',
  imports: [IdemDocumentEditorComponent, ErrorStateComponent, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (noProject()) {
      <app-error-state
        scene="document"
        [title]="'dashboard.documentEditor.noProject.title' | translate"
        [message]="'dashboard.documentEditor.noProject.subtitle' | translate"
      >
        <button type="button" class="inner-button" (click)="back()">
          {{ 'dashboard.documentEditor.noProject.back' | translate }}
        </button>
      </app-error-state>
    } @else if (ready()) {
      <idem-document-editor
        [adapter]="adapter"
        [contextId]="projectId!"
        [documentId]="documentId"
        [target]="target"
        [heading]="heading()"
        (exit)="back()"
      />
    }
  `,
})
export class DocumentEditorComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cookieService = inject(CookieService);
  private readonly tokenService = inject(TokenService);
  private readonly translate = inject(TranslateService);

  /** Adaptateur du document, résolu depuis la route (data.documentType). */
  protected readonly adapter: DocumentTypeAdapter = injectEditorAdapter(
    this.route.snapshot.data['documentType'] as EditorDocumentType | undefined,
  );
  protected readonly projectId = this.cookieService.get('projectId');
  protected readonly documentId = this.route.snapshot.queryParamMap.get(EDITOR_TARGET_PARAMS.document);
  protected readonly target = (() => {
    const query = this.route.snapshot.queryParamMap;
    const sectionId = query.get(EDITOR_TARGET_PARAMS.section);
    return sectionId ? { sectionId, path: query.get(EDITOR_TARGET_PARAMS.path) } : null;
  })();

  protected readonly noProject = signal(!this.projectId);
  protected readonly ready = signal(false);
  protected readonly heading = computed(() => this.translate.instant(this.adapter.i18nTitleKey));

  async ngOnInit(): Promise<void> {
    if (!this.projectId) return;
    await this.tokenService.waitForAuthReady();
    this.ready.set(true);
  }

  /** Un document parmi plusieurs revient à SA page, pas à la liste. */
  protected back(): void {
    this.router.navigate(this.documentId ? [this.adapter.backRoute, this.documentId] : [this.adapter.backRoute]);
  }
}

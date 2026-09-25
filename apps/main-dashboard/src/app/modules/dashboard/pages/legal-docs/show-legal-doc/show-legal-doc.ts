import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { CookieService } from '../../../../../shared/services/cookie.service';
import { DocumentPreviewComponent } from '../../../components/document-preview/document-preview';
import { LegalDocsService } from '../../../services/ai-agents/legal-docs.service';
import { LegalDocumentModel } from '../../../models/legalDocs.model';
import { LegalIllustrationComponent } from '../components/legal-illustration/legal-illustration';

/**
 * Un document juridique du projet (`/project/legal-docs/:documentId`) : aperçu
 * rendu comme dans l'éditeur, avec le même dock que le business plan (pages,
 * zoom, éditer, télécharger). L'espace juridique reste la liste.
 */
@Component({
  selector: 'app-show-legal-doc',
  imports: [TranslateModule, IdemLoaderComponent, DocumentPreviewComponent, LegalIllustrationComponent],
  templateUrl: './show-legal-doc.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowLegalDocPage implements OnInit {
  private readonly legalDocsService = inject(LegalDocsService);
  private readonly cookieService = inject(CookieService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly documentId = signal<string | null>(this.route.snapshot.paramMap.get('documentId'));
  protected readonly isLoading = signal(true);
  protected readonly hasError = signal(false);
  protected readonly document = signal<LegalDocumentModel | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    const projectId = this.cookieService.get('projectId');
    const documentId = this.documentId();
    if (!projectId || !documentId) {
      this.isLoading.set(false);
      return;
    }
    this.isLoading.set(true);
    this.hasError.set(false);
    this.legalDocsService
      .getLegalDocs(projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (legal) => {
          this.document.set(legal?.documents.find((d) => d.id === documentId) ?? null);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Error loading legal document:', err);
          this.hasError.set(true);
          this.isLoading.set(false);
        },
      });
  }

  protected goToList(): void {
    this.router.navigate(['/project/legal-docs']);
  }
}

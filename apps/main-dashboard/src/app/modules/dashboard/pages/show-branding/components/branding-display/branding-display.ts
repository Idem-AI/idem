import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ProjectService } from '../../../../services/project.service';
import { CookieService } from '../../../../../../shared/services/cookie.service';
import { Loader } from '../../../../../../shared/components/loader/loader';
import { DocumentPreviewComponent } from '../../../../components/document-preview/document-preview';
import {
  expectedBrandingSections,
  hasCharterContent,
  StoredBranding,
} from '../../../../models/branding-charter';
import {
  analyzeGenerationCompleteness,
  SectionCompletionItem,
} from '../../../../models/generation-completeness';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Page d'affichage de la charte graphique. La charte est rendue par l'aperçu
 * de document (mêmes sections que l'éditeur) ; son PDF n'est produit qu'au
 * téléchargement. Les pages manquantes ou en échec y apparaissent à leur
 * place, et la régénération passe par la page de génération de la charte.
 */
@Component({
  selector: 'app-branding-display',
  imports: [DocumentPreviewComponent, Loader, TranslateModule],
  templateUrl: './branding-display.html',
  styleUrl: './branding-display.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandingDisplayComponent implements OnInit {
  private readonly projectService = inject(ProjectService);
  private readonly cookieService = inject(CookieService);
  private readonly router = inject(Router);

  protected readonly isLoading = signal<boolean>(true);
  /** true dès que la charte a des sections HTML à afficher. */
  protected readonly hasBranding = signal<boolean>(false);
  /** Clé i18n du message d'erreur de chargement. */
  protected readonly loadError = signal<string | null>(null);
  /** Sections attendues de la charte et leur statut, dans l'ordre du document. */
  protected readonly outline = signal<SectionCompletionItem[]>([]);

  /** Format PDF choisi à la génération : le transmettre évite l'écran de choix. */
  private pdfFormat: string | undefined;

  ngOnInit(): void {
    const projectId = this.cookieService.get('projectId');
    if (!projectId) {
      this.isLoading.set(false);
      return;
    }

    this.projectService.getProjectById(projectId).subscribe({
      next: (project) => {
        const branding = project?.analysisResultModel?.branding as unknown as
          | StoredBranding
          | undefined;
        this.pdfFormat = branding?.pdfFormat;
        this.hasBranding.set(hasCharterContent(branding));
        this.outline.set(
          analyzeGenerationCompleteness(
            expectedBrandingSections(branding),
            branding?.sections ?? [],
          ).items,
        );
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading branding:', err);
        this.loadError.set('dashboard.brandingDisplay.errors.load');
        this.isLoading.set(false);
      },
    });
  }

  /** Régénère une page de la charte (nom canonique de l'étape). */
  protected regenerateSection(sectionName: string): void {
    this.navigateToGeneration({ sections: sectionName });
  }

  /** Complète la charte : seules les pages manquantes ou en échec sont générées. */
  protected resumeGeneration(): void {
    this.navigateToGeneration({});
  }

  /** Tout régénérer — sans format imposé, comme depuis la page de la charte : on peut en changer. */
  protected regenerateAll(): void {
    this.router.navigate(['/project/branding/generate'], { queryParams: { force: 'true' } });
  }

  private navigateToGeneration(queryParams: Record<string, string>): void {
    if (this.pdfFormat) queryParams['format'] = this.pdfFormat;
    this.router.navigate(['/project/branding/generate'], { queryParams });
  }

  protected handleGenerateRequest(): void {
    this.router.navigate(['/project/branding/generate']);
  }

  protected goBack(): void {
    this.router.navigate(['/project/branding']);
  }
}

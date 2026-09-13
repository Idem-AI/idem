import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ProjectService } from '../../../../services/project.service';
import { CookieService } from '../../../../../../shared/services/cookie.service';
import { Loader } from '../../../../../../shared/components/loader/loader';
import { DocumentPreviewComponent } from '../../../../components/document-preview/document-preview';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Page d'affichage de la charte graphique. La charte est rendue par l'aperçu
 * de document (mêmes sections que l'éditeur) ; son PDF n'est produit qu'au
 * téléchargement.
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

  ngOnInit(): void {
    const projectId = this.cookieService.get('projectId');
    if (!projectId) {
      this.isLoading.set(false);
      return;
    }

    this.projectService.getProjectById(projectId).subscribe({
      next: (project) => {
        const sections: { data?: unknown }[] =
          project?.analysisResultModel?.branding?.sections ?? [];
        this.hasBranding.set(
          sections.some((section) => typeof section.data === 'string' && section.data.trim() !== ''),
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

  protected handleGenerateRequest(): void {
    this.router.navigate(['/project/branding/generate']);
  }

  protected goBack(): void {
    this.router.navigate(['/project/branding']);
  }
}

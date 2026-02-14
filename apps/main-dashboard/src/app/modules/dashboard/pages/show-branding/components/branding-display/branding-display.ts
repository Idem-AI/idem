import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { BrandIdentityModel } from '../../../../models/brand-identity.model';
import { BrandingService } from '../../../../services/ai-agents/branding.service';
import { ProjectService } from '../../../../services/project.service';
import { CookieService } from '../../../../../../shared/services/cookie.service';
import { TokenService } from '../../../../../../shared/services/token.service';
import { PdfViewer } from '../../../../../../shared/components/pdf-viewer/pdf-viewer';
import { Loader } from '../../../../../../shared/components/loader/loader';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-branding-display',
  standalone: true,
  imports: [PdfViewer, Loader, TranslateModule],
  templateUrl: './branding-display.html',
  styleUrl: './branding-display.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandingDisplayComponent implements OnInit {
  private readonly brandingService = inject(BrandingService);
  private readonly projectService = inject(ProjectService);
  private readonly cookieService = inject(CookieService);
  private readonly tokenService = inject(TokenService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly isLoading = signal<boolean>(true);
  protected readonly branding = signal<BrandIdentityModel | null>(null);
  protected readonly pdfSrc = signal<string | null>(null);
  protected readonly isDownloadingPdf = signal<boolean>(false);
  protected readonly pdfError = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const projectId = this.cookieService.get('projectId');
    if (!projectId) {
      this.isLoading.set(false);
      return;
    }

    // Load project data to get branding
    this.projectService.getProjectById(projectId).subscribe({
      next: async (project) => {
        const brandingData = project?.analysisResultModel?.branding;
        if (brandingData) {
          this.branding.set(brandingData);
        }

        // Load PDF
        this.brandingService.downloadBrandingPdf(projectId).subscribe({
          next: (pdfBlob: Blob) => {
            if (pdfBlob && pdfBlob.size > 0) {
              this.loadPdfFromBlob(pdfBlob);
              if (brandingData) {
                this.branding.set({ ...brandingData, pdfBlob });
              }
            }
            this.isLoading.set(false);
          },
          error: async () => {
            // No PDF available, try loading from backend with auth
            if (brandingData?.sections) {
              try {
                await this.tokenService.waitForAuthReady();
                await this.loadPdfFromBackend();
              } catch (error: any) {
                console.error('Authentication error:', error);
                this.pdfError.set(
                  this.translate.instant('dashboard.brandingDisplay.errors.authFailed'),
                );
              }
            }
            this.isLoading.set(false);
          },
        });
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Load PDF from provided blob (optimized path)
   */
  private loadPdfFromBlob(pdfBlob: Blob): void {
    try {
      this.isDownloadingPdf.set(true);
      this.pdfError.set(null);

      // Create object URL for PDF viewer
      const pdfUrl = URL.createObjectURL(pdfBlob);
      this.pdfSrc.set(pdfUrl);
      console.log('PDF loaded from provided blob (optimized)');
    } catch (error: any) {
      console.error('Error loading PDF from blob:', error);
      this.pdfError.set(this.translate.instant('dashboard.brandingDisplay.errors.loadPdf'));
    } finally {
      this.isDownloadingPdf.set(false);
    }
  }

  /**
   * Load PDF from backend endpoint (fallback)
   */
  private async loadPdfFromBackend(): Promise<void> {
    try {
      this.isDownloadingPdf.set(true);
      this.pdfError.set(null);

      const projectId = this.cookieService.get('projectId');
      if (!projectId) {
        throw new Error(
          this.translate.instant('dashboard.brandingDisplay.errors.projectIdNotFound'),
        );
      }

      // Verify authentication before making request
      const token = this.tokenService.getToken();
      if (!token) {
        throw new Error(this.translate.instant('dashboard.brandingDisplay.errors.authRequired'));
      }

      console.log('Requesting PDF from backend for project:', projectId);

      // Download PDF blob from backend with timeout
      const pdfBlob = (await Promise.race([
        this.brandingService.downloadBrandingPdf(projectId).toPromise(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('PDF generation timeout (30s)')), 30000),
        ),
      ])) as Blob;

      if (pdfBlob && pdfBlob.size > 0) {
        // Verify it's actually a PDF
        if (pdfBlob.type !== 'application/pdf') {
          console.warn('Received blob is not a PDF:', pdfBlob.type);
        }

        // Create object URL for PDF viewer
        const pdfUrl = URL.createObjectURL(pdfBlob);
        this.pdfSrc.set(pdfUrl);
        console.log('PDF loaded from backend (fallback), size:', pdfBlob.size, 'bytes');
      } else {
        throw new Error('Received empty or invalid PDF blob');
      }
    } catch (error: any) {
      console.error('Error loading PDF from backend:', error);

      // Handle specific error types
      let errorMessage = this.translate.instant('dashboard.brandingDisplay.errors.loadPdf');

      if (
        error.status === 401 ||
        error.message.includes('Authentication') ||
        error.message.includes('not authenticated')
      ) {
        errorMessage = this.translate.instant('dashboard.brandingDisplay.errors.authFailedRefresh');
      } else if (error.status === 404) {
        errorMessage = this.translate.instant('dashboard.brandingDisplay.errors.pdfNotFound');
      } else if (error.status === 500) {
        errorMessage = this.translate.instant('dashboard.brandingDisplay.errors.pdfServerError');
      } else if (error.message?.includes('timeout')) {
        errorMessage = 'PDF generation timeout. Please try again.';
      } else if (error.message?.includes('empty')) {
        errorMessage = 'PDF generation failed - empty response from server.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      this.pdfError.set(errorMessage);
    } finally {
      this.isDownloadingPdf.set(false);
    }
  }

  protected async regeneratePdf(): Promise<void> {
    try {
      // Ensure auth is ready before attempting regeneration
      await this.tokenService.waitForAuthReady();
      await this.loadPdfFromBackend();
    } catch (error: any) {
      console.error('Error in regeneratePdf:', error);
      this.pdfError.set(
        this.translate.instant('dashboard.brandingDisplay.errors.regenerateFailed'),
      );
    }
  }

  protected downloadPdf(): void {
    if (this.pdfSrc()) {
      const link = document.createElement('a');
      link.href = this.pdfSrc()!;
      link.download = 'branding-guide.pdf';
      link.click();
    }
  }

  protected handleGenerateRequest(): void {
    this.router.navigate(['/project/branding/generate']);
  }

  protected goBack(): void {
    this.router.navigate(['/project/branding']);
  }
}

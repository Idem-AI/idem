import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
  OnInit,
} from '@angular/core';
import { BrandIdentityModel } from '../../../../models/brand-identity.model';
import { BrandingService } from '../../../../services/ai-agents/branding.service';
import { CookieService } from '../../../../../../shared/services/cookie.service';
import { TokenService } from '../../../../../../shared/services/token.service';
import { PdfViewer } from '../../../../../../shared/components/pdf-viewer/pdf-viewer';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-branding-display',
  standalone: true,
  imports: [PdfViewer, TranslateModule],
  templateUrl: './branding-display.html',
  styleUrl: './branding-display.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandingDisplayComponent implements OnInit {
  readonly branding = input.required<BrandIdentityModel | null>();
  readonly generateRequested = output<void>();

  private readonly brandingService = inject(BrandingService);
  private readonly cookieService = inject(CookieService);
  private readonly tokenService = inject(TokenService);
  private readonly translate = inject(TranslateService);

  protected readonly pdfSrc = signal<string | null>(null);
  protected readonly isDownloadingPdf = signal<boolean>(false);
  protected readonly pdfError = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    if (this.branding()?.pdfBlob) {
      // Use the PDF blob that was already loaded in the parent component
      this.loadPdfFromBlob(this.branding()!.pdfBlob!);
    } else if (this.branding()?.sections) {
      try {
        // Wait for auth to be ready before making API calls
        await this.tokenService.waitForAuthReady();

        // Fallback: load PDF from backend if no blob provided
        await this.loadPdfFromBackend();
      } catch (error: any) {
        console.error('Authentication error in ngOnInit:', error);
        this.pdfError.set(this.translate.instant('dashboard.brandingDisplay.errors.authFailed'));
      }
    }
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

      // Download PDF blob from backend
      const pdfBlob = await this.brandingService.downloadBrandingPdf(projectId).toPromise();

      if (pdfBlob) {
        // Create object URL for PDF viewer
        const pdfUrl = URL.createObjectURL(pdfBlob);
        this.pdfSrc.set(pdfUrl);
        console.log('PDF loaded from backend (fallback)');
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
    this.generateRequested.emit();
  }
}

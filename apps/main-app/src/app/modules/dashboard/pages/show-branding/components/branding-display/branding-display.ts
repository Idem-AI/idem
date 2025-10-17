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

@Component({
  selector: 'app-branding-display',
  standalone: true,
  imports: [PdfViewer],
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
        this.pdfError.set('Authentication failed. Please refresh the page and try again.');
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
      this.pdfError.set('Failed to load PDF. Please try again.');
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
        throw new Error('Project ID not found');
      }

      // Verify authentication before making request
      const token = this.tokenService.getToken();
      if (!token) {
        throw new Error('Authentication required. Please login again.');
      }

      // Download PDF blob from backend
      const pdfBlob = await this.brandingService
        .downloadBrandingPdf(projectId)
        .toPromise();

      if (pdfBlob) {
        // Create object URL for PDF viewer
        const pdfUrl = URL.createObjectURL(pdfBlob);
        this.pdfSrc.set(pdfUrl);
        console.log('PDF loaded from backend (fallback)');
      }
    } catch (error: any) {
      console.error('Error loading PDF from backend:', error);
      
      // Handle specific error types
      let errorMessage = 'Failed to load PDF. Please try again.';
      
      if (error.status === 401 || error.message.includes('Authentication') || error.message.includes('not authenticated')) {
        errorMessage = 'Authentication failed. Please refresh the page and login again.';
      } else if (error.status === 404) {
        errorMessage = 'PDF not found. The branding document may not have been generated yet.';
      } else if (error.status === 500) {
        errorMessage = 'Server error generating PDF. Please try regenerating the branding.';
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
      this.pdfError.set('Failed to regenerate PDF. Please check your authentication and try again.');
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

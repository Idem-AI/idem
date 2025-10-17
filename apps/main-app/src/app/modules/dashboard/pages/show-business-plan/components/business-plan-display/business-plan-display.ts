import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
  OnInit,
} from '@angular/core';
import { BusinessPlanModel } from '../../../../models/businessPlan.model';
import { BusinessPlanService } from '../../../../services/ai-agents/business-plan.service';
import { CookieService } from '../../../../../../shared/services/cookie.service';
import { TokenService } from '../../../../../../shared/services/token.service';
import { PdfViewer } from '../../../../../../shared/components/pdf-viewer/pdf-viewer';

@Component({
  selector: 'app-business-plan-display',
  standalone: true,
  imports: [PdfViewer],
  templateUrl: './business-plan-display.html',
  styleUrl: './business-plan-display.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessPlanDisplayComponent implements OnInit {
  readonly businessPlan = input.required<BusinessPlanModel | null>();

  private readonly businessPlanService = inject(BusinessPlanService);
  private readonly cookieService = inject(CookieService);
  private readonly tokenService = inject(TokenService);

  protected readonly pdfSrc = signal<string | null>(null);
  protected readonly isDownloadingPdf = signal<boolean>(false);
  protected readonly pdfError = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    if (this.businessPlan()?.pdfBlob) {
      // Use the PDF blob that was already loaded in the parent component
      this.loadPdfFromBlob(this.businessPlan()!.pdfBlob!);
    } else if (this.businessPlan()?.sections) {
      // Wait for auth to be ready before making API calls
      await this.tokenService.waitForAuthReady();
      
      // Fallback: load PDF from backend if no blob provided
      await this.loadPdfFromBackend();
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

      // Download PDF blob from backend
      const pdfBlob = await this.businessPlanService
        .downloadBusinessPlanPdf(projectId)
        .toPromise();

      if (pdfBlob) {
        // Create object URL for PDF viewer
        const pdfUrl = URL.createObjectURL(pdfBlob);
        this.pdfSrc.set(pdfUrl);
        console.log('PDF loaded from backend (fallback)');
      }
    } catch (error: any) {
      console.error('Error loading PDF from backend:', error);
      this.pdfError.set(
        error.message || 'Failed to load PDF. Please try again.'
      );
    } finally {
      this.isDownloadingPdf.set(false);
    }
  }

  protected async regeneratePdf(): Promise<void> {
    await this.loadPdfFromBackend();
  }

  protected downloadPdf(): void {
    if (this.pdfSrc()) {
      const link = document.createElement('a');
      link.href = this.pdfSrc()!;
      link.download = 'business-plan.pdf';
      link.click();
    }
  }
}

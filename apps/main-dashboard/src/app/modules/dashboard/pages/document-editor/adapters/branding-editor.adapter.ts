import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BrandingService } from '../../../services/ai-agents/branding.service';
import { PageFormat } from '../models/editor.types';
import { HtmlSectionsEditorAdapter } from './html-sections.adapter.base';

/**
 * Formats de page de la charte — la table `PAGE_FORMATS` de `pdf.service.ts`
 * côté API. L'aperçu et l'éditeur doivent afficher la page du PDF produit.
 */
const BRANDING_PAGE_FORMATS: Record<string, PageFormat> = {
  SLIDE_16_9: { width: '297mm', height: '167mm' },
  A4_PORTRAIT: { width: '210mm', height: '297mm' },
  A4_LANDSCAPE: { width: '297mm', height: '210mm' },
};

/** Adaptateur de la charte graphique / brand identity (16:9 par défaut). */
@Injectable({ providedIn: 'root' })
export class BrandingEditorAdapter extends HtmlSectionsEditorAdapter {
  readonly type = 'branding' as const;
  readonly pageFormat: PageFormat = BRANDING_PAGE_FORMATS['SLIDE_16_9'];
  readonly multiPage = false;
  readonly i18nTitleKey = 'dashboard.documentEditor.branding.title';
  readonly backRoute = '/project/branding/display';
  readonly editRoute = '/project/branding/edit';
  readonly pdfFileName = 'branding-guide.pdf';
  protected readonly resource = 'brandings';
  protected readonly analysisKey = 'branding' as const;

  private readonly brandingService = inject(BrandingService);

  downloadPdf(projectId: string): Observable<Blob> {
    return this.brandingService.downloadBrandingPdf(projectId);
  }

  protected override pageFormatOf(bucket: unknown): PageFormat | undefined {
    const format = (bucket as { pdfFormat?: string } | undefined)?.pdfFormat;
    return format ? BRANDING_PAGE_FORMATS[format] : undefined;
  }
}

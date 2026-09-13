import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BusinessPlanService } from '../../../services/ai-agents/business-plan.service';
import { PageFormat } from '../models/editor.types';
import { HtmlSectionsEditorAdapter } from './html-sections.adapter.base';

/** Adaptateur du Business Plan (A4 portrait). */
@Injectable({ providedIn: 'root' })
export class BusinessPlanEditorAdapter extends HtmlSectionsEditorAdapter {
  readonly type = 'business-plan' as const;
  readonly pageFormat: PageFormat = { width: '210mm', height: '297mm' };
  // Document flexible : une section peut s'étendre sur PLUSIEURS pages A4
  // (contenu détaillé, graphes, sources). Ce n'est PAS une page fixe comme le
  // pitch deck / la charte graphique.
  readonly multiPage = true;
  readonly i18nTitleKey = 'dashboard.documentEditor.businessPlan.title';
  readonly backRoute = '/project/business-plan';
  readonly editRoute = '/project/business-plan/edit';
  readonly pdfFileName = 'business-plan.pdf';
  protected readonly resource = 'businessPlans';
  protected readonly analysisKey = 'businessPlan' as const;

  private readonly businessPlanService = inject(BusinessPlanService);

  downloadPdf(projectId: string): Observable<Blob> {
    return this.businessPlanService.downloadBusinessPlanPdf(projectId);
  }
}

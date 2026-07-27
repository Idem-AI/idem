import { Injectable } from '@angular/core';
import { PageFormat } from '../models/editor.types';
import { HtmlSectionsEditorAdapter } from './html-sections.adapter.base';

/** Adaptateur du Business Plan (A4 portrait). */
@Injectable({ providedIn: 'root' })
export class BusinessPlanEditorAdapter extends HtmlSectionsEditorAdapter {
  readonly type = 'business-plan' as const;
  readonly pageFormat: PageFormat = { width: '210mm', height: '297mm' };
  // Chaque section = une page A4 pleine (comme pitch/charte). Le contenu est
  // généré pour remplir et tenir dans la page.
  readonly multiPage = false;
  readonly i18nTitleKey = 'dashboard.documentEditor.businessPlan.title';
  readonly backRoute = '/project/business-plan';
  protected readonly resource = 'businessPlans';
  protected readonly analysisKey = 'businessPlan' as const;
}

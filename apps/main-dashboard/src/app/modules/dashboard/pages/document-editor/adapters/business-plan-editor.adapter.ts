import { Injectable } from '@angular/core';
import { PageFormat } from '../models/editor.types';
import { HtmlSectionsEditorAdapter } from './html-sections.adapter.base';

/** Adaptateur du Business Plan (A4 portrait). */
@Injectable({ providedIn: 'root' })
export class BusinessPlanEditorAdapter extends HtmlSectionsEditorAdapter {
  readonly type = 'business-plan' as const;
  readonly pageFormat: PageFormat = { width: '210mm', height: '297mm' };
  readonly multiPage = true;
  readonly i18nTitleKey = 'dashboard.documentEditor.businessPlan.title';
  readonly backRoute = '/project/business-plan';
  protected readonly resource = 'businessPlans';
  protected readonly analysisKey = 'businessPlan' as const;
}

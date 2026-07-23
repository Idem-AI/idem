import { Injectable } from '@angular/core';
import { PageFormat } from '../models/editor.types';
import { HtmlSectionsEditorAdapter } from './html-sections.adapter.base';

/** Adaptateur de la charte graphique / brand identity (slides 16:9 paysage). */
@Injectable({ providedIn: 'root' })
export class BrandingEditorAdapter extends HtmlSectionsEditorAdapter {
  readonly type = 'branding' as const;
  readonly pageFormat: PageFormat = { width: '297mm', height: '167mm' };
  readonly i18nTitleKey = 'dashboard.documentEditor.branding.title';
  readonly backRoute = '/project/branding/display';
  protected readonly resource = 'brandings';
  protected readonly analysisKey = 'branding' as const;
}

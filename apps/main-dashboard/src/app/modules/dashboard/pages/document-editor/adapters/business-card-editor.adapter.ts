import { Injectable } from '@angular/core';
import { PageFormat } from '../models/editor.types';
import { HtmlSectionsEditorAdapter } from './html-sections.adapter.base';

/**
 * Adaptateur du TEMPLATE de carte de visite (recto + verso, 85 × 55 mm).
 *
 * Particularité : les sections éditées contiennent des marqueurs `{{champ}}`
 * qui restent tels quels. Les cartes des personnes sont rendues à partir de ce
 * template, donc chaque sauvegarde ici mène automatiquement toutes les cartes
 * à jour — il n'y a rien à re-propager.
 */
@Injectable({ providedIn: 'root' })
export class BusinessCardEditorAdapter extends HtmlSectionsEditorAdapter {
  readonly type = 'business-card' as const;
  readonly pageFormat: PageFormat = { width: '85mm', height: '55mm' };
  readonly multiPage = false;
  readonly i18nTitleKey = 'dashboard.documentEditor.businessCard.title';
  readonly backRoute = '/project/business-cards';
  protected readonly resource = 'business-cards';
  protected readonly analysisKey = 'businessCard' as const;
}

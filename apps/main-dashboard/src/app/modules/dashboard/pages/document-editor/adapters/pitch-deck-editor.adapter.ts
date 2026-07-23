import { Injectable } from '@angular/core';
import { PageFormat } from '../models/editor.types';
import { HtmlSectionsEditorAdapter } from './html-sections.adapter.base';

/** Adaptateur du Pitch Deck (slides 16:9 paysage). */
@Injectable({ providedIn: 'root' })
export class PitchDeckEditorAdapter extends HtmlSectionsEditorAdapter {
  readonly type = 'pitch-deck' as const;
  readonly pageFormat: PageFormat = { width: '297mm', height: '167mm' };
  readonly i18nTitleKey = 'dashboard.documentEditor.pitchDeck.title';
  readonly backRoute = '/project/pitch-deck';
  protected readonly resource = 'pitchDecks';
  protected readonly analysisKey = 'pitchDeck' as const;
}

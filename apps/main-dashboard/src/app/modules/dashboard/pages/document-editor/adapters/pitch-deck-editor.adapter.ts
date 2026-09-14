import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PitchDeckService } from '../../../services/ai-agents/pitch-deck.service';
import { findDeliverableDocument } from '../../../models/deliverable-document.model';
import { PageFormat } from '../models/editor.types';
import { HtmlSectionsBucket, HtmlSectionsEditorAdapter } from './html-sections.adapter.base';

/** Adaptateur du Pitch Deck (slides 16:9 paysage). */
@Injectable({ providedIn: 'root' })
export class PitchDeckEditorAdapter extends HtmlSectionsEditorAdapter {
  readonly type = 'pitch-deck' as const;
  readonly pageFormat: PageFormat = { width: '297mm', height: '167mm' };
  readonly multiPage = false;
  readonly i18nTitleKey = 'dashboard.documentEditor.pitchDeck.title';
  /** Liste des decks ; un deck précis s'affiche sous `backRoute/<documentId>`. */
  readonly backRoute = '/project/pitch-deck';
  readonly editRoute = '/project/pitch-deck/edit';
  readonly pdfFileName = 'pitch-deck.pdf';
  protected readonly resource = 'pitchDecks';
  protected readonly analysisKey = 'pitchDeck' as const;

  private readonly pitchDeckService = inject(PitchDeckService);

  /** Un projet garde plusieurs decks : celui désigné, le plus récent à défaut. */
  protected override bucketOf(
    analysis: Record<string, unknown> | undefined,
    documentId?: string | null,
  ): HtmlSectionsBucket | undefined {
    return findDeliverableDocument(analysis, 'pitchDeck', documentId) ?? undefined;
  }

  downloadPdf(projectId: string, documentId?: string | null): Observable<Blob> {
    return this.pitchDeckService.downloadPitchDeckPdf(projectId, documentId);
  }
}

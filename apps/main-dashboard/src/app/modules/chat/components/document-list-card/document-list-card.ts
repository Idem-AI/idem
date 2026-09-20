import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ChatDocumentSummary, MultiDocumentKind } from '../../services/chat-documents.service';

/**
 * Les documents d'un livrable, listés dans le fil.
 *
 * Un projet garde plusieurs business plans et plusieurs pitch decks : sans
 * cette carte, le chat agissait toujours sur le plus récent et l'utilisateur
 * n'avait aucun moyen d'ouvrir, de renommer ou de supprimer les autres sans
 * passer en mode Avancé.
 */
@Component({
  selector: 'app-document-list-card',
  standalone: true,
  imports: [DatePipe, FormsModule, TranslateModule],
  templateUrl: './document-list-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentListCardComponent {
  readonly kind = input.required<MultiDocumentKind>();
  readonly documents = input<readonly ChatDocumentSummary[]>([]);
  readonly busy = input<boolean>(false);

  readonly opened = output<string>();
  readonly downloaded = output<string>();
  readonly renamed = output<{ id: string; name: string }>();
  readonly removed = output<string>();
  readonly createRequested = output<void>();

  /** Document en cours de renommage. */
  protected readonly editingId = signal<string | null>(null);
  /** Document dont la suppression attend un second clic. */
  protected readonly confirmDeleteId = signal<string | null>(null);
  protected readonly draftName = signal('');

  protected readonly titleKey = computed(() =>
    this.kind() === 'businessPlan'
      ? 'chat.documents.businessPlan.title'
      : 'chat.documents.pitchDeck.title',
  );

  protected readonly createKey = computed(() =>
    this.kind() === 'businessPlan'
      ? 'chat.documents.businessPlan.create'
      : 'chat.documents.pitchDeck.create',
  );

  protected progress(document: ChatDocumentSummary): number {
    if (document.expected === 0) return 0;
    return Math.round((document.completed / document.expected) * 100);
  }

  protected startRename(document: ChatDocumentSummary): void {
    if (this.busy()) return;
    this.confirmDeleteId.set(null);
    this.editingId.set(document.id);
    this.draftName.set(document.name);
  }

  protected commitRename(document: ChatDocumentSummary): void {
    const name = this.draftName().trim();
    this.editingId.set(null);
    if (!name || name === document.name) return;
    this.renamed.emit({ id: document.id, name });
  }

  protected cancelRename(): void {
    this.editingId.set(null);
  }

  /** La suppression est définitive : elle demande un second clic, jamais une modale. */
  protected requestDelete(document: ChatDocumentSummary): void {
    if (this.busy()) return;
    if (this.confirmDeleteId() !== document.id) {
      this.confirmDeleteId.set(document.id);
      return;
    }
    this.confirmDeleteId.set(null);
    this.removed.emit(document.id);
  }
}

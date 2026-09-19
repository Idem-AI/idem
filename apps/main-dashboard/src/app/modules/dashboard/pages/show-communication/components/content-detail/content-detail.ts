import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { CommunicationService } from '../../../../services/ai-agents/communication.service';
import { FontHints } from '../../../document-editor/models/editor.types';
import {
  ContentChannel,
  ContentIdea,
  Flyer,
  FlyerFormat,
} from '../../../../models/communication.model';
import {
  FLYER_FORMATS,
  PLANNABLE_CHANNELS,
  channelIcon,
  statusPillClass,
} from '../../communication-ui';
import { VisualPreview } from '../visual-preview/visual-preview';

/** Champ actuellement en cours de modification. `null` = tout est en lecture. */
type EditableField =
  | 'title'
  | 'hook'
  | 'description'
  | 'caption'
  | 'hashtags'
  | 'callToAction'
  | 'scheduledFor'
  | 'channel'
  | null;

/**
 * Le détail d'UNE publication prévue.
 *
 * C'est ce qui manquait le plus : les cartes du planning montraient un titre et
 * rien d'autre, alors que tout ce qui sert à publier — le texte du post, les
 * mots-clés, la date, le réseau — était déjà là, produit et payé, mais invisible.
 *
 * Chaque information porte son propre bouton « Modifier » : on corrige une
 * phrase sans entrer dans un mode d'édition global, et l'enregistrement part
 * tout seul. Un formulaire complet à valider en bloc découragerait la petite
 * correction, qui est justement la plus fréquente.
 */
@Component({
  selector: 'app-content-detail',
  imports: [FormsModule, TranslateModule, VisualPreview],
  templateUrl: './content-detail.html',
  styleUrl: './content-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentDetail {
  private readonly communication = inject(CommunicationService);

  readonly projectId = input.required<string>();
  readonly planId = input.required<string>();
  readonly item = input.required<ContentIdea>();
  /** Bornes de la période : une publication ne se déplace pas en dehors. */
  readonly period = input.required<{ start: string; end: string }>();
  readonly visuals = input<Flyer[]>([]);
  readonly fonts = input<FontHints>({});

  readonly itemChange = output<ContentIdea>();
  readonly visualCreated = output<Flyer>();
  readonly deleted = output<string>();
  readonly closed = output<void>();
  readonly failed = output<string>();

  protected readonly channelIcon = channelIcon;
  protected readonly statusPillClass = statusPillClass;
  protected readonly channels = PLANNABLE_CHANNELS;
  protected readonly formats = FLYER_FORMATS;

  protected readonly editing = signal<EditableField>(null);
  protected readonly draft = signal('');
  protected readonly isSaving = signal(false);
  protected readonly isCreatingVisual = signal(false);
  protected readonly chosenFormat = signal<FlyerFormat>('square');
  protected readonly copied = signal(false);

  /** Le visuel le plus récent de cette publication. */
  protected readonly visual = computed<Flyer | null>(() => {
    const ids = new Set(this.item().flyerIds ?? []);
    if (!ids.size) return null;
    return this.visuals().filter((candidate) => ids.has(candidate.id)).slice(-1)[0] ?? null;
  });

  /** Tous les visuels de cette publication (déclinaisons comprises). */
  protected readonly allVisuals = computed<Flyer[]>(() => {
    const ids = new Set(this.item().flyerIds ?? []);
    return this.visuals().filter((candidate) => ids.has(candidate.id));
  });

  protected readonly hashtagsText = computed(() => (this.item().hashtags ?? []).join(', '));

  // ── Édition champ par champ ──────────────────────────────────────────────

  protected startEdit(field: Exclude<EditableField, null>): void {
    this.editing.set(field);
    this.draft.set(this.valueOf(field));
  }

  protected cancelEdit(): void {
    this.editing.set(null);
    this.draft.set('');
  }

  /** Enregistre le champ en cours et renvoie la publication mise à jour. */
  protected saveEdit(): void {
    const field = this.editing();
    if (!field || this.isSaving()) return;

    const value = this.draft();
    const patch: Partial<ContentIdea> =
      field === 'hashtags'
        ? {
            // Saisie libre séparée par des virgules : c'est ainsi que les gens
            // écrivent des mots-clés. Le `#` éventuel est retiré, l'API le remet.
            hashtags: value
              .split(/[,\s]+/)
              .map((tag) => tag.replace(/^#/, '').trim())
              .filter(Boolean)
              .slice(0, 8),
          }
        : ({ [field]: value } as Partial<ContentIdea>);

    this.isSaving.set(true);
    this.communication
      .updatePlanItem(this.projectId(), this.planId(), this.item().id, patch)
      .subscribe({
        next: (plan) => {
          const updated = plan.items.find((candidate) => candidate.id === this.item().id);
          if (updated) this.itemChange.emit(updated);
          this.isSaving.set(false);
          this.editing.set(null);
        },
        error: (err) => {
          this.failed.emit(err?.error?.message || 'content-update');
          this.isSaving.set(false);
        },
      });
  }

  /** Le réseau se choisit d'un clic, sans passer par une saisie. */
  protected setChannel(channel: ContentChannel): void {
    if (channel === this.item().channel) {
      this.editing.set(null);
      return;
    }
    this.isSaving.set(true);
    this.communication
      .updatePlanItem(this.projectId(), this.planId(), this.item().id, { channel })
      .subscribe({
        next: (plan) => {
          const updated = plan.items.find((candidate) => candidate.id === this.item().id);
          if (updated) this.itemChange.emit(updated);
          this.isSaving.set(false);
          this.editing.set(null);
        },
        error: (err) => {
          this.failed.emit(err?.error?.message || 'content-update');
          this.isSaving.set(false);
        },
      });
  }

  // ── Visuel ───────────────────────────────────────────────────────────────

  protected setFormat(format: FlyerFormat): void {
    this.chosenFormat.set(format);
  }

  protected createVisual(): void {
    if (this.isCreatingVisual()) return;
    this.isCreatingVisual.set(true);

    this.communication
      .generateFlyer(this.projectId(), this.item().id, this.chosenFormat())
      .subscribe({
        next: (visual) => {
          this.visualCreated.emit(visual);
          this.itemChange.emit({
            ...this.item(),
            flyerIds: [...(this.item().flyerIds ?? []), visual.id],
          });
          this.isCreatingVisual.set(false);
        },
        error: (err) => {
          this.failed.emit(err?.error?.message || 'visual');
          this.isCreatingVisual.set(false);
        },
      });
  }

  protected declinate(format: FlyerFormat): void {
    const source = this.visual();
    if (!source || this.isCreatingVisual()) return;
    this.isCreatingVisual.set(true);

    this.communication.declinateVisual(this.projectId(), source.id, [format]).subscribe({
      next: (created) => {
        for (const visual of created) this.visualCreated.emit(visual);
        if (created.length) {
          this.itemChange.emit({
            ...this.item(),
            flyerIds: [...(this.item().flyerIds ?? []), ...created.map((v) => v.id)],
          });
        }
        this.isCreatingVisual.set(false);
      },
      error: (err) => {
        this.failed.emit(err?.error?.message || 'declinate');
        this.isCreatingVisual.set(false);
      },
    });
  }

  protected download(): void {
    const visual = this.visual();
    if (!visual?.imageUrl) return;
    this.communication.downloadFlyerImage(visual.imageUrl).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${visual.id}.png`;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: (err) => this.failed.emit(err?.error?.message || 'download'),
    });
  }

  protected copyCaption(): void {
    const text = this.item().caption || '';
    if (!text || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 2000);
      })
      .catch(() => {
        /* presse-papiers indisponible */
      });
  }

  protected close(): void {
    this.closed.emit();
  }

  /**
   * Retirer une publication du planning, en deux temps.
   *
   * La confirmation est demandée SUR le bouton plutôt que dans une boîte de
   * dialogue : une fenêtre par-dessus une fenêtre se ferme au clic à côté, et
   * l'utilisateur ne sait plus ce qu'il a validé.
   */
  protected askDelete(): void {
    this.confirmingDelete.set(true);
  }

  protected cancelDelete(): void {
    this.confirmingDelete.set(false);
  }

  protected confirmDelete(): void {
    this.deleted.emit(this.item().id);
  }

  protected readonly confirmingDelete = signal(false);

  private valueOf(field: Exclude<EditableField, null>): string {
    const item = this.item();
    switch (field) {
      case 'title':
        return item.title || '';
      case 'hook':
        return item.hook || '';
      case 'description':
        return item.description || '';
      case 'caption':
        return item.caption || '';
      case 'callToAction':
        return item.callToAction || '';
      case 'scheduledFor':
        return item.scheduledFor || '';
      case 'hashtags':
        return this.hashtagsText();
      default:
        return '';
    }
  }
}

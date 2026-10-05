import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
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
  channelLabelKey,
  formatDay,
  statusPillClass,
  toChannel,
} from '../../communication-ui';
import { VisualComposing } from '../visual-composing/visual-composing';
import { VisualPreview } from '../visual-preview/visual-preview';
import { VideoComposing, VideoProgressState } from '../video-composing/video-composing';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { MotionVideoService } from '../../../../services/ai-agents/motion-video.service';
import { priceVideo, VideoFormat, VideoOptions, VideoType } from '../../../../models/motion-video.model';
import { CreativityLevel, creativityCost, DEFAULT_CREATIVITY } from '@idem/shared-models';
import { CreativityGaugeComponent } from '../../../../../../shared/components/creativity-gauge/creativity-gauge';
import { CreativityService } from '../../../../../../shared/services/creativity.service';

/** Formats de contenu qui sont des vidéos. */
const VIDEO_CONTENT_FORMATS = ['reel', 'short-video'];

/** Le format vidéo naturel de chaque réseau. */
const VIDEO_FORMAT_BY_CHANNEL: Partial<Record<ContentChannel, VideoFormat>> = {
  tiktok: 'story',
  instagram: 'story',
  facebook: 'story',
  youtube: 'landscape',
  linkedin: 'square',
  x: 'square',
};

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
  imports: [FormsModule, TranslateModule, VisualComposing, VisualPreview, VideoComposing, IdemLoaderComponent, CreativityGaugeComponent],
  templateUrl: './content-detail.html',
  styleUrl: './content-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentDetail {
  private readonly communication = inject(CommunicationService);
  private readonly translate = inject(TranslateService);
  private readonly motionVideos = inject(MotionVideoService);
  private readonly creativityPricing = inject(CreativityService);

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
  /** Ouvrir une vidéo de ce contenu dans l'écran Vidéos. */
  readonly openVideo = output<string>();
  readonly needsCredits = output<{ cost: number; balance: number }>();

  protected readonly channelIcon = channelIcon;
  protected readonly channelLabelKey = channelLabelKey;
  protected readonly toChannel = toChannel;
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

  // ── Vidéo (contenus vidéo du calendrier) ─────────────────────────────────

  /** Un contenu vidéo montre sa vidéo, pas un visuel ; l'utilisateur peut basculer. */
  protected readonly isVideo = computed(() => VIDEO_CONTENT_FORMATS.includes(this.item().format) || !!this.item().videoType);
  protected readonly preferVisual = signal(false);
  protected readonly videoType = computed<VideoType>(() => this.item().videoType ?? 'mix');
  protected readonly videoOptions = signal<VideoOptions | null>(null);
  protected readonly videoBusy = signal(false);
  protected readonly videoProgress = signal<VideoProgressState>({});
  protected readonly videoFormat = computed<VideoFormat>(() => VIDEO_FORMAT_BY_CHANNEL[this.item().channel] ?? 'story');
  protected readonly videoTypes = computed(() => this.videoOptions()?.types ?? []);
  /** La jauge de créativité de ce contenu (visuel et vidéo) ; Medium par défaut. */
  protected readonly creativity = signal<CreativityLevel>(DEFAULT_CREATIVITY);
  /** Prix du visuel au cran Low / Medium pour ce projet (lu sur l'API). */
  protected readonly visualBaseCost = signal<number | null>(null);
  protected readonly videoBasePrice = computed(() => {
    const options = this.videoOptions();
    return options ? priceVideo(options.pricing, { durationSec: 15, formats: [this.videoFormat()], quality: 'hd' }) : null;
  });
  protected readonly videoPrice = computed(() => {
    const base = this.videoBasePrice();
    return base == null ? null : creativityCost(base, this.creativity());
  });
  protected readonly lastVideoId = computed(() => (this.item().videoIds ?? []).slice(-1)[0] ?? null);
  protected readonly choosingVideoType = signal(false);
  protected readonly videoTypeIcon = computed(() => this.videoTypes().find((t) => t.id === this.videoType())?.icon ?? 'pi pi-video');

  private optionsRequested = false;
  private visualPriceRequested = false;

  constructor() {
    // Le prix d'un visuel pour ce projet (cran Low / Medium) : la jauge en déduit chaque cran.
    effect(() => {
      if (this.visualPriceRequested) return;
      this.visualPriceRequested = true;
      const projectId = this.projectId();
      untracked(() => this.creativityPricing.baseCost(projectId, 'flyer').subscribe((cost) => this.visualBaseCost.set(cost)));
    });
    // Le barème des vidéos (pour dire le prix avant de générer), une fois, pour un contenu vidéo.
    effect(() => {
      if (!this.isVideo() || this.optionsRequested) return;
      this.optionsRequested = true;
      const projectId = this.projectId();
      untracked(() =>
        this.motionVideos.options(projectId).subscribe({
          next: (options) => this.videoOptions.set(options),
          error: () => undefined,
        })
      );
    });
  }

  // ── Édition champ par champ ──────────────────────────────────────────────

  /** « lun. 12 oct. » plutôt que la date ISO. */
  protected day(iso: string): string {
    return formatDay(iso, this.translate.currentLang);
  }

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
      .generateFlyer(this.projectId(), this.item().id, this.chosenFormat(), this.creativity())
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

  /** Le type de vidéo se change d'un clic (enregistré sur le contenu). */
  protected setVideoType(type: VideoType): void {
    this.choosingVideoType.set(false);
    if (type === this.item().videoType) return;
    this.communication.updatePlanItem(this.projectId(), this.planId(), this.item().id, { videoType: type }).subscribe({
      next: (plan) => {
        const updated = plan.items.find((candidate) => candidate.id === this.item().id);
        if (updated) this.itemChange.emit(updated);
      },
      error: (err) => this.failed.emit(err?.error?.message || 'content-update'),
    });
  }

  /** Génère LA vidéo de ce contenu : son type, son brief (accroche, angle, appel à l'action). */
  protected createVideo(): void {
    if (this.videoBusy()) return;
    this.videoBusy.set(true);
    this.videoProgress.set({});
    let finished = false;
    this.motionVideos
      .createStream(this.projectId(), {
        brief: { musicMood: 'auto', sfx: true, allowStock: true, allowGenerate: true },
        scope: { durationSec: 15, formats: [this.videoFormat()], quality: 'hd' },
        type: this.videoType(),
        contentId: this.item().id,
        creativity: this.creativity(),
      })
      .subscribe({
        next: (event) => {
          if (event.type === 'progress') {
            this.videoProgress.update((p) => ({ ...p, [event.stage]: { state: event.state, data: event.data } }));
          } else if (event.type === 'complete') {
            finished = true;
            this.videoBusy.set(false);
            this.itemChange.emit({ ...this.item(), videoIds: [...(this.item().videoIds ?? []), event.video.id] });
          } else {
            finished = true;
            this.videoBusy.set(false);
            if (event.status === 402) {
              this.needsCredits.emit({ cost: event.cost ?? this.videoPrice() ?? 0, balance: event.balance ?? 0 });
              return;
            }
            this.failed.emit('dashboard.showCommunication.video.errors.create');
          }
        },
        complete: () => {
          if (!finished) {
            this.videoBusy.set(false);
            this.failed.emit('dashboard.showCommunication.video.errors.create');
          }
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

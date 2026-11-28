import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CreativityLevel } from '@idem/shared-models';
import {
  FlyerFormat,
  StudioAttachment,
  StudioAttachmentRole,
  StudioRequest,
} from '../../../../models/communication.model';
import { CommunicationService } from '../../../../services/ai-agents/communication.service';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { WriteOnlyDirective } from '../../../../../team/directives/write-only.directive';
import { CreativityGateDirective } from '../../../../../../shared/components/creativity-picker/creativity-gate';

/** `auto` : l'atelier choisit la forme d'après la demande. */
type FormatChoice = 'auto' | Extract<FlyerFormat, 'square' | 'story' | 'banner' | 'a4'>;

const FORMATS: readonly FormatChoice[] = ['auto', 'square', 'story', 'banner', 'a4'];

/** Ce que l'API accepte (le reste est refusé avant l'envoi, avec un mot d'explication). */
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_ATTACHMENTS = 4;
const MAX_BYTES = 10 * 1024 * 1024;

export const ATTACHMENT_ROLES: readonly StudioAttachmentRole[] = ['auto', 'use', 'reference'];

let nextId = 0;

/**
 * La demande : une phrase, des images si l'on veut, et le visuel sort à la charte.
 *
 * Il n'y a plus de catégories à choisir : la personne écrit ce qu'elle veut. Elle
 * peut joindre des images — sa photo à poser dans le visuel, ou une affiche dont
 * reprendre la mise en page. Sans rien régler, l'agent lit dans la phrase ce que
 * chaque image est ; un petit menu sur l'image permet de le dire soi-même.
 *
 * Le bouton d'envoi est un rond avec une flèche. Comme partout dans IDEM, le clic
 * (ou Entrée) ouvre d'abord la bulle des crans : c'est le cran choisi qui part.
 *
 * Le format et le nombre de propositions sont des réglages avancés, repliés par
 * défaut ; ce qu'ils changent est ajouté EN TOUTES LETTRES à la phrase envoyée.
 */
@Component({
  selector: 'app-prompt-box',
  imports: [
    WriteOnlyDirective,
    FormsModule,
    TranslateModule,
    IdemLoaderComponent,
    CreativityGateDirective,
  ],
  templateUrl: './prompt-box.html',
  styleUrl: './prompt-box.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromptBox {
  private readonly translate = inject(TranslateService);
  private readonly communication = inject(CommunicationService);

  /** Le projet : les images jointes sont rangées dans son dossier. */
  readonly projectId = input.required<string>();
  /** Le texte saisi — lié dans les deux sens : le fil y dépose une retouche proposée. */
  readonly text = model('');
  /** Vrai pendant qu'un visuel se fabrique : on ne relance pas un second achat. */
  readonly busy = input(false);
  /** Clé de traduction du texte d'exemple. */
  readonly placeholder = input('dashboard.showCommunication.prompt.placeholder');
  readonly rows = input(3);

  readonly submitted = output<StudioRequest>();

  private readonly sendButton = viewChild<ElementRef<HTMLButtonElement>>('sendButton');
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly id = `pb-${++nextId}`;
  protected readonly formats = FORMATS;
  protected readonly roles = ATTACHMENT_ROLES;
  protected readonly advancedOpen = signal(false);
  protected readonly format = signal<FormatChoice>('auto');
  protected readonly variants = signal(false);
  /** Le cran choisi dans la bulle du bouton ; le dernier choisi est proposé au tour suivant. */
  protected readonly creativity = signal<CreativityLevel>('medium');

  protected readonly attachments = signal<StudioAttachment[]>([]);
  protected readonly uploading = signal(0);
  protected readonly dragging = signal(false);
  /** Clé de traduction d'un refus d'image (trop lourde, vidéo, trop nombreuses, envoi raté). */
  protected readonly attachError = signal<string | null>(null);

  protected readonly canAttach = computed(
    () => !this.busy() && this.attachments().length + this.uploading() < MAX_ATTACHMENTS,
  );

  protected readonly canSend = computed(
    () =>
      !this.busy() &&
      this.uploading() === 0 &&
      (this.text().trim().length > 0 || this.attachments().length > 0),
  );

  /** Ce qui a été réglé, rappelé à côté du lien quand le panneau est replié. */
  protected readonly summary = computed(() => {
    const parts: string[] = [];
    if (this.format() !== 'auto') {
      parts.push(
        this.translate.instant(`dashboard.showCommunication.prompt.formats.${this.format()}`),
      );
    }
    if (this.variants()) {
      parts.push(this.translate.instant('dashboard.showCommunication.prompt.variantsShort'));
    }
    return parts.join(' · ');
  });

  protected toggleAdvanced(): void {
    this.advancedOpen.update((open) => !open);
  }

  /**
   * Entrée = le même geste que le bouton : la bulle des crans s'ouvre, et c'est
   * le cran choisi qui envoie. Maj+Entrée = retour à la ligne.
   */
  protected onEnter(event: Event): void {
    const key = event as KeyboardEvent;
    if (key.shiftKey || key.isComposing) return;
    event.preventDefault();
    if (!this.canSend()) return;
    this.sendButton()?.nativeElement.click();
  }

  // ── Images jointes ───────────────────────────────────────────────────────

  protected pickFiles(): void {
    this.fileInput()?.nativeElement.click();
  }

  protected onFilesPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addFiles(Array.from(input.files ?? []));
    input.value = '';
  }

  /** Une image collée dans le champ (capture d'écran, image copiée) est jointe comme les autres. */
  protected onPaste(event: ClipboardEvent): void {
    const files = Array.from(event.clipboardData?.files ?? []);
    if (!files.length) return;
    event.preventDefault();
    this.addFiles(files);
  }

  protected onDragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    const box = event.currentTarget as HTMLElement;
    if (!box.contains(event.relatedTarget as Node | null)) this.dragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.addFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  protected setRole(attachment: StudioAttachment, role: StudioAttachmentRole): void {
    this.attachments.update((list) =>
      list.map((item) => (item.id === attachment.id ? { ...item, role } : item)),
    );
  }

  protected remove(attachment: StudioAttachment): void {
    this.attachments.update((list) => list.filter((item) => item.id !== attachment.id));
  }

  private addFiles(files: File[]): void {
    if (!files.length || this.busy()) return;
    this.attachError.set(null);

    if (files.some((file) => file.type.startsWith('video/'))) {
      // Ce fil fabrique des visuels fixes : une vidéo se monte dans l'onglet Vidéos.
      this.attachError.set('dashboard.showCommunication.prompt.attach.errors.video');
    }
    const images = files.filter((file) => IMAGE_TYPES.includes(file.type));
    if (images.length < files.filter((file) => !file.type.startsWith('video/')).length) {
      this.attachError.set('dashboard.showCommunication.prompt.attach.errors.type');
    }
    const light = images.filter((file) => file.size <= MAX_BYTES);
    if (light.length < images.length) {
      this.attachError.set('dashboard.showCommunication.prompt.attach.errors.size');
    }
    const room = MAX_ATTACHMENTS - this.attachments().length - this.uploading();
    const accepted = light.slice(0, Math.max(0, room));
    if (accepted.length < light.length) {
      this.attachError.set('dashboard.showCommunication.prompt.attach.errors.count');
    }
    if (!accepted.length) return;

    this.uploading.update((n) => n + accepted.length);
    this.communication.uploadStudioAttachments(this.projectId(), accepted).subscribe({
      next: (uploaded) => {
        this.attachments.update((list) => [...list, ...uploaded].slice(0, MAX_ATTACHMENTS));
        this.uploading.update((n) => Math.max(0, n - accepted.length));
      },
      error: () => {
        this.uploading.update((n) => Math.max(0, n - accepted.length));
        this.attachError.set('dashboard.showCommunication.prompt.attach.errors.upload');
      },
    });
  }

  // ── Envoi ────────────────────────────────────────────────────────────────

  protected submit(): void {
    if (!this.canSend()) return;
    const text = this.text().trim();

    const t = (key: string, params?: Record<string, unknown>) =>
      this.translate.instant(`dashboard.showCommunication.prompt.${key}`, params) as string;

    const format = this.format();
    const sentence = [
      text,
      format === 'auto' ? '' : t('asFormat', { format: t(`formatPrompts.${format}`) }),
      this.variants() ? t('variantsPrompt') : '',
    ]
      .filter(Boolean)
      .join(' ');

    this.submitted.emit({
      text: sentence,
      attachments: this.attachments(),
      creativity: this.creativity(),
    });
    // Retour aux réglages par défaut : trois propositions coûtent plus cher, on
    // ne les refacture pas à la demande suivante sans qu'on l'ait redemandé.
    this.text.set('');
    this.attachments.set([]);
    this.attachError.set(null);
    this.format.set('auto');
    this.variants.set(false);
    this.advancedOpen.set(false);
  }
}

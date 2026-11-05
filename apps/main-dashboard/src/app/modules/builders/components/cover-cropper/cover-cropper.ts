import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { BUILDERS_PROGRAM } from '@idem/shared-models/builders/program';

interface Crop {
  x: number;
  y: number;
  width: number;
}

const RATIO = BUILDERS_PROGRAM.coverWidth / BUILDERS_PROGRAM.coverHeight;

/**
 * Cadrer une couverture au format exact de la vitrine (16:9, 1600 × 900).
 *
 * Plutôt que de refuser une photo au mauvais format, on la cadre : l'image
 * apparaît dans le cadre de la fiche, on la déplace (souris, doigt ou flèches
 * du clavier) et on la zoome. Le zoom s'arrête là où le cadre ne contiendrait
 * plus 1600 px réels : ce qui est envoyé est toujours net. Une image trop
 * petite pour remplir le cadre est signalée tout de suite, avant tout envoi.
 *
 * Le cadrage est rendu dans un canvas à 1600 × 900 et rendu au parent en
 * JPEG ; l'API le vérifie et le réencode de toute façon.
 */
@Component({
  selector: 'app-cover-cropper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule],
  template: `
    @if (tooSmall()) {
      <div class="rounded-xl border border-[var(--glass-border)] p-5" role="alert">
        <p class="text-sm font-semibold text-danger">{{ 'builders.cover.cropper.tooSmallTitle' | translate }}</p>
        <p class="mt-1 text-sm text-text-secondary">
          {{ 'builders.cover.cropper.tooSmallBody' | translate: { width: minWidth, height: minHeight, actualWidth: natural().width, actualHeight: natural().height } }}
        </p>
        <button type="button" class="outer-button button-sm mt-3" (click)="cancelled.emit()">{{ 'builders.cover.cropper.chooseAnother' | translate }}</button>
      </div>
    } @else {
      <div
        #frame
        class="relative aspect-video w-full touch-none select-none overflow-hidden rounded-xl bg-[var(--color-surface-2)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        [class.cursor-grab]="!dragging()"
        [class.cursor-grabbing]="dragging()"
        tabindex="0"
        role="img"
        [attr.aria-label]="'builders.cover.cropper.frameLabel' | translate"
        (pointerdown)="startDrag($event)"
        (pointermove)="drag($event)"
        (pointerup)="endDrag($event)"
        (pointercancel)="endDrag($event)"
        (keydown)="nudge($event)"
      >
        @if (src()) {
          <img
            [src]="src()"
            alt=""
            draggable="false"
            class="pointer-events-none absolute max-w-none"
            [style.width.%]="imageBox().width"
            [style.height.%]="imageBox().height"
            [style.left.%]="imageBox().left"
            [style.top.%]="imageBox().top"
            (load)="onLoad($event)"
          />
        }
        <!-- Le repère des tiers : aide à poser le sujet, disparaît à l'export. -->
        <div class="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
          @for (cell of cells; track cell) {
            <span class="border border-[color-mix(in_srgb,white_25%,transparent)]"></span>
          }
        </div>
        <span class="pointer-events-none absolute bottom-3 left-3 rounded-full bg-[color-mix(in_srgb,black_60%,transparent)] px-3 py-1 text-xs font-medium text-[var(--color-on-primary)]">
          {{ 'builders.cover.cropper.dragHint' | translate }}
        </span>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-3">
        <label for="cover-zoom" class="!mb-0 text-sm text-text-secondary">{{ 'builders.cover.cropper.zoom' | translate }}</label>
        <input
          id="cover-zoom"
          type="range"
          class="!w-40 flex-1"
          min="1"
          [max]="maxZoom()"
          step="0.01"
          [value]="zoom()"
          [disabled]="maxZoom() <= 1"
          (input)="setZoom(+$any($event.target).value)"
        />
        <div class="ml-auto flex gap-2">
          <button type="button" class="button-ghost button-sm" (click)="cancelled.emit()">{{ 'common.cancel' | translate }}</button>
          <button type="button" class="inner-button button-sm" [disabled]="!ready()" (click)="confirm()">
            {{ 'builders.cover.cropper.confirm' | translate }}
          </button>
        </div>
      </div>
    }
  `,
})
export class CoverCropperComponent {
  readonly file = input.required<File>();
  readonly confirmed = output<Blob>();
  readonly cancelled = output<void>();

  private readonly frame = viewChild<ElementRef<HTMLDivElement>>('frame');
  private image: HTMLImageElement | null = null;
  private pointer: { id: number; x: number; y: number } | null = null;

  protected readonly minWidth = BUILDERS_PROGRAM.coverWidth;
  protected readonly minHeight = BUILDERS_PROGRAM.coverHeight;
  protected readonly cells = Array.from({ length: 9 }, (_, i) => i);

  protected readonly src = signal<string | null>(null);
  protected readonly natural = signal({ width: 0, height: 0 });
  protected readonly crop = signal<Crop>({ x: 0, y: 0, width: 0 });
  protected readonly zoom = signal(1);
  protected readonly dragging = signal(false);
  protected readonly ready = signal(false);

  /** La plus grande largeur 16:9 que l'image peut offrir. */
  private readonly baseWidth = computed(() => {
    const { width, height } = this.natural();
    return Math.min(width, height * RATIO);
  });

  protected readonly tooSmall = computed(() => this.ready() && this.baseWidth() < this.minWidth - 0.5);

  /** Le zoom s'arrête là où le cadre ne contiendrait plus 1600 px réels. */
  protected readonly maxZoom = computed(() => Math.max(1, Math.min(3, this.baseWidth() / this.minWidth)));

  /** Position et taille de l'image, en pourcentage du cadre. */
  protected readonly imageBox = computed(() => {
    const { width: w, height: h } = this.natural();
    const c = this.crop();
    if (!c.width) return { width: 100, height: 100, left: 0, top: 0 };
    const cropHeight = c.width / RATIO;
    return {
      width: (w / c.width) * 100,
      height: (h / cropHeight) * 100,
      left: (-c.x / c.width) * 100,
      top: (-c.y / cropHeight) * 100,
    };
  });

  constructor() {
    effect((onCleanup) => {
      const url = URL.createObjectURL(this.file());
      this.ready.set(false);
      this.src.set(url);
      onCleanup(() => URL.revokeObjectURL(url));
    });
    inject(DestroyRef).onDestroy(() => (this.image = null));
  }

  protected onLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    this.image = img;
    this.natural.set({ width: img.naturalWidth, height: img.naturalHeight });
    const width = this.baseWidth();
    // Le cadre part centré, au plus large.
    this.zoom.set(1);
    this.crop.set({ x: (img.naturalWidth - width) / 2, y: (img.naturalHeight - width / RATIO) / 2, width });
    this.ready.set(true);
  }

  protected setZoom(value: number): void {
    const z = Math.min(Math.max(value, 1), this.maxZoom());
    const c = this.crop();
    const centerX = c.x + c.width / 2;
    const centerY = c.y + c.width / RATIO / 2;
    const width = this.baseWidth() / z;
    this.zoom.set(z);
    this.place(centerX - width / 2, centerY - width / RATIO / 2, width);
  }

  protected startDrag(event: PointerEvent): void {
    if (!this.ready()) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    this.dragging.set(true);
  }

  protected drag(event: PointerEvent): void {
    if (!this.pointer || this.pointer.id !== event.pointerId) return;
    this.moveBy(event.clientX - this.pointer.x, event.clientY - this.pointer.y);
    this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }

  protected endDrag(event: PointerEvent): void {
    if (this.pointer?.id === event.pointerId) this.pointer = null;
    this.dragging.set(false);
  }

  /** Les flèches déplacent le cadre ; Maj accélère. */
  protected nudge(event: KeyboardEvent): void {
    const step = event.shiftKey ? 40 : 10;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    this.moveBy(move[0], move[1]);
  }

  protected confirm(): void {
    if (!this.image || !this.ready()) return;
    const canvas = document.createElement('canvas');
    canvas.width = BUILDERS_PROGRAM.coverWidth;
    canvas.height = BUILDERS_PROGRAM.coverHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    const c = this.crop();
    context.imageSmoothingQuality = 'high';
    context.drawImage(this.image, c.x, c.y, c.width, c.width / RATIO, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => blob && this.confirmed.emit(blob), 'image/jpeg', 0.92);
  }

  /** Un déplacement à l'écran, converti en pixels de l'image. */
  private moveBy(dx: number, dy: number): void {
    const frameWidth = this.frame()?.nativeElement.getBoundingClientRect().width ?? 1;
    const c = this.crop();
    const scale = c.width / frameWidth;
    this.place(c.x - dx * scale, c.y - dy * scale, c.width);
  }

  private place(x: number, y: number, width: number): void {
    const { width: w, height: h } = this.natural();
    const height = width / RATIO;
    this.crop.set({
      width,
      x: Math.min(Math.max(x, 0), Math.max(w - width, 0)),
      y: Math.min(Math.max(y, 0), Math.max(h - height, 0)),
    });
  }
}

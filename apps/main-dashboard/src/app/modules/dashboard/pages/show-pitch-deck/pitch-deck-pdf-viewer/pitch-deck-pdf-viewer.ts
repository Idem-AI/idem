import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnChanges,
  OnDestroy,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { DOCUMENT } from '@angular/common';

// pdfjs-dist is available transitively via ng2-pdf-viewer
// Using the matching version worker from CDN for zero-config reliability.
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api';

interface SlidePage {
  pageNumber: number;
  name: string;
}

@Component({
  selector: 'app-pitch-deck-pdf-viewer',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './pitch-deck-pdf-viewer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PitchDeckPdfViewer implements OnChanges, AfterViewInit, OnDestroy {
  private readonly document = inject(DOCUMENT);

  /** PDF blob to render */
  readonly pdfBlob = input<Blob | null>(null);
  /** Optional ordered slide names for thumbnail captions */
  readonly slideNames = input<string[]>([]);

  /** Emitted when the user clicks the download button */
  readonly downloadRequested = output<void>();
  /** Emitted when the user clicks the regenerate button */
  readonly regenerateRequested = output<void>();

  @ViewChild('mainCanvas', { static: false })
  private mainCanvas?: ElementRef<HTMLCanvasElement>;

  @ViewChildren('thumbCanvas')
  private thumbCanvases?: QueryList<ElementRef<HTMLCanvasElement>>;

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly pages = signal<SlidePage[]>([]);
  protected readonly activePage = signal(1);

  private pdfDocument: PDFDocumentProxy | null = null;
  private objectUrl: string | null = null;
  private mainRenderTask: { cancel(): void } | null = null;

  protected readonly currentSlideName = computed(() => {
    const pages = this.pages();
    const idx = this.activePage() - 1;
    return pages[idx]?.name ?? '';
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pdfBlob'] && this.pdfBlob()) {
      this.loadPdf(this.pdfBlob() as Blob);
    }
  }

  ngAfterViewInit(): void {
    // If blob already available at view init, ensure main canvas is rendered once pages exist
    if (this.pages().length > 0) {
      this.renderMainPage(this.activePage());
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private ensureWorker(): void {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    }
  }

  private async loadPdf(blob: Blob): Promise<void> {
    this.cleanup();
    this.ensureWorker();
    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      const arrayBuffer = await blob.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
      }).promise;
      this.pdfDocument = pdf;

      const names = this.slideNames();
      const pages: SlidePage[] = Array.from({ length: pdf.numPages }, (_, i) => ({
        pageNumber: i + 1,
        name: names[i] ?? `Slide ${i + 1}`,
      }));
      this.pages.set(pages);
      this.activePage.set(1);
      this.loading.set(false);

      // Let Angular render the canvases, then paint
      setTimeout(() => {
        this.renderMainPage(1);
        this.renderThumbnails();
      }, 0);
    } catch (err) {
      console.error('[PitchDeckPdfViewer] Failed to load PDF:', err);
      this.errorMessage.set('Impossible de charger le PDF.');
      this.loading.set(false);
    }
  }

  private async renderMainPage(pageNumber: number): Promise<void> {
    if (!this.pdfDocument || !this.mainCanvas) return;
    try {
      this.mainRenderTask?.cancel();
      const page: PDFPageProxy = await this.pdfDocument.getPage(pageNumber);
      const canvas = this.mainCanvas.nativeElement;
      const container = canvas.parentElement as HTMLElement | null;
      const containerWidth = container?.clientWidth ?? 900;
      const viewport = page.getViewport({ scale: 1 });
      const scale = (containerWidth / viewport.width) * (this.devicePixelRatio() || 1);
      const scaledViewport = page.getViewport({ scale });

      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      canvas.style.width = `${containerWidth}px`;
      canvas.style.height = `${(containerWidth / viewport.width) * viewport.height}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const task = page.render({ canvasContext: ctx, viewport: scaledViewport });
      this.mainRenderTask = task;
      await task.promise;
    } catch (err: unknown) {
      const name = (err as { name?: string } | null)?.name;
      if (name !== 'RenderingCancelledException') {
        console.warn('[PitchDeckPdfViewer] Main render error:', err);
      }
    }
  }

  private async renderThumbnails(): Promise<void> {
    if (!this.pdfDocument || !this.thumbCanvases) return;
    const canvases = this.thumbCanvases.toArray();
    for (let i = 0; i < canvases.length; i++) {
      const pageNumber = i + 1;
      try {
        const page = await this.pdfDocument.getPage(pageNumber);
        const canvas = canvases[i].nativeElement;
        const container = canvas.parentElement as HTMLElement | null;
        const width = container?.clientWidth ?? 200;
        const viewport = page.getViewport({ scale: 1 });
        const ratio = this.devicePixelRatio() || 1;
        const scale = (width / viewport.width) * ratio;
        const scaledViewport = page.getViewport({ scale });

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${(width / viewport.width) * viewport.height}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
      } catch (err) {
        console.warn('[PitchDeckPdfViewer] Thumbnail render error:', err);
      }
    }
  }

  private devicePixelRatio(): number {
    return this.document.defaultView?.devicePixelRatio ?? 1;
  }

  private cleanup(): void {
    try {
      this.mainRenderTask?.cancel();
    } catch {
      /* noop */
    }
    this.mainRenderTask = null;
    if (this.pdfDocument) {
      this.pdfDocument.destroy();
      this.pdfDocument = null;
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  protected selectPage(pageNumber: number): void {
    if (pageNumber === this.activePage()) return;
    this.activePage.set(pageNumber);
    this.renderMainPage(pageNumber);
  }

  protected prev(): void {
    const next = this.activePage() - 1;
    if (next >= 1) this.selectPage(next);
  }

  protected next(): void {
    const next = this.activePage() + 1;
    if (next <= this.pages().length) this.selectPage(next);
  }

  protected onDownload(): void {
    this.downloadRequested.emit();
  }

  protected onRegenerate(): void {
    this.regenerateRequested.emit();
  }
}

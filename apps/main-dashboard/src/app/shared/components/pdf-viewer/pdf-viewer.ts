import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';
import { DOCUMENT } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-pdf-viewer',
  standalone: true,
  imports: [NgxExtendedPdfViewerModule, TranslateModule],
  templateUrl: './pdf-viewer.html',
  styleUrl: './pdf-viewer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfViewer implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private resizeObserver?: ResizeObserver;
  private readonly translate = inject(TranslateService);
  // Inputs
  readonly pdfSrc = input.required<string | null>();
  readonly isLoading = input<boolean>(false);
  readonly error = input<string | null>(null);
  readonly showPagination = input<boolean>(true);
  readonly title = input<string>('PDF Document');

  // Outputs
  readonly regenerateRequested = output<void>();
  readonly downloadRequested = output<void>();

  // Internal state
  protected readonly totalPages = signal<number>(0);
  protected readonly currentPage = signal<number>(1);
  protected readonly viewportWidth = signal<number>(0);
  protected readonly viewportHeight = signal<number>(0);

  // Computed responsive properties
  protected readonly isMobile = computed(() => this.viewportWidth() < 768);
  protected readonly isTablet = computed(
    () => this.viewportWidth() >= 768 && this.viewportWidth() < 1024,
  );
  protected readonly isDesktop = computed(() => this.viewportWidth() >= 1024);

  protected readonly pdfHeight = computed(() => {
    const baseHeight = this.viewportHeight() * 0.8; // 80% of viewport height
    if (this.isMobile()) {
      return Math.max(400, Math.min(baseHeight, 600)); // 400px min, 600px max on mobile
    } else if (this.isTablet()) {
      return Math.max(500, Math.min(baseHeight, 700)); // 500px min, 700px max on tablet
    } else {
      return Math.max(600, Math.min(baseHeight, 800)); // 600px min, 800px max on desktop
    }
  });

  protected readonly containerMaxWidth = computed(() => {
    if (this.isMobile()) {
      return '100%';
    } else if (this.isTablet()) {
      return '90%';
    } else {
      return '1000px';
    }
  });

  protected onPdfLoadComplete(event: any): void {
    if (event && event.pagesCount) {
      this.totalPages.set(event.pagesCount);
    }
  }

  protected onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  protected onRegenerateClick(): void {
    this.regenerateRequested.emit();
  }

  protected onDownloadClick(): void {
    this.downloadRequested.emit();
  }

  ngOnInit(): void {
    this.updateViewportSize();
    this.setupResizeObserver();
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  private updateViewportSize(): void {
    this.viewportWidth.set(this.document.defaultView?.innerWidth || 0);
    this.viewportHeight.set(this.document.defaultView?.innerHeight || 0);
  }

  private setupResizeObserver(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateViewportSize();
      });
      this.resizeObserver.observe(this.document.body);
    } else {
      // Fallback for older browsers
      this.document.defaultView?.addEventListener('resize', () => {
        this.updateViewportSize();
      });
    }
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  Renderer2,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
  ChartConfigLite,
  EditableSection,
  EditorSelection,
  ElementStyle,
  FontHints,
  HOST_TO_IFRAME,
  IFRAME_TO_HOST,
  IframeMessage,
  PageFormat,
  RenderContext,
} from '../../models/editor.types';
import { buildIframeDocument } from '../../runtime/editor-iframe';

/** Événement de modification de texte remonté depuis l'iframe. */
export interface TextChangeEvent {
  sectionId: string;
  path: string;
  html: string;
}

/** Demande de réordonnancement remontée depuis l'iframe. */
export interface ReorderEvent {
  sectionId: string;
  parentPath: string;
  fromIndex: number;
  toIndex: number;
}

/**
 * Canvas d'édition : rend le document dans un iframe sandbox fidèle au PDF
 * (Tailwind + Chart.js locaux), gère le pont postMessage bidirectionnel, le zoom
 * et le défilement. Le rendu complet (`render`) n'a lieu qu'à l'ouverture et sur
 * IA/annulation ; les autres modifications sont appliquées en direct.
 */
@Component({
  selector: 'app-editor-canvas',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #scroll class="canvas-scroll" tabindex="0">
      <div
        class="zoom-wrap"
        [style.width.px]="pageWidthPx() * zoom()"
        [style.height.px]="iframeHeight() * zoom()"
      >
        <iframe
          #frame
          title="Document preview"
          class="editor-iframe"
          [srcdoc]="srcdoc()"
          [style.width.px]="pageWidthPx()"
          [style.height.px]="iframeHeight()"
          [style.transform]="'scale(' + zoom() + ')'"
        ></iframe>
      </div>
    </div>
  `,
  styles: [
    `
      :host { display: block; height: 100%; }
      .canvas-scroll {
        width: 100%; height: 100%; overflow: auto;
        background:
          radial-gradient(circle at center, var(--glass-bg-subtle) 1px, transparent 1px);
        background-size: 22px 22px;
        display: flex; justify-content: center; padding: 24px;
      }
      .canvas-scroll:focus-visible { outline: none; }
      .zoom-wrap { position: relative; flex-shrink: 0; }
      .editor-iframe {
        border: none; background: transparent; transform-origin: top left; display: block;
      }
    `,
  ],
})
export class EditorCanvasComponent implements OnInit, OnDestroy {
  readonly pageFormat = input.required<PageFormat>();
  readonly fonts = input<FontHints>({});
  readonly dark = input<boolean>(false);
  readonly zoom = input<number>(1);

  readonly ready = output<void>();
  readonly selectionChange = output<EditorSelection | null>();
  readonly textChange = output<TextChangeEvent>();
  readonly reorderRequest = output<ReorderEvent>();

  private readonly sanitizer = inject(DomSanitizer);
  private readonly renderer = inject(Renderer2);

  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
  private readonly scroll = viewChild<ElementRef<HTMLElement>>('scroll');

  protected readonly srcdoc = signal<SafeHtml>('');
  protected readonly iframeHeight = signal<number>(800);

  private unlisten?: () => void;
  private pendingScrollTop: number | null = null;

  protected pageWidthPx(): number {
    return this.cssToPx(this.pageFormat().width) + 40;
  }

  ngOnInit(): void {
    this.unlisten = this.renderer.listen('window', 'message', (event: MessageEvent) =>
      this.onMessage(event),
    );
  }

  ngOnDestroy(): void {
    this.unlisten?.();
  }

  /** (Re)construit intégralement le document iframe à partir des sections. */
  render(sections: EditableSection[], preserveScroll = false): void {
    const scrollEl = this.scroll()?.nativeElement;
    if (preserveScroll && scrollEl) this.pendingScrollTop = scrollEl.scrollTop;
    const ctx: RenderContext = {
      primaryFont: this.fonts().primaryFont,
      secondaryFont: this.fonts().secondaryFont,
      fontUrl: this.fonts().fontUrl,
      dark: this.dark(),
    };
    const html = buildIframeDocument(sections, ctx, this.pageFormat());
    this.srcdoc.set(this.sanitizer.bypassSecurityTrustHtml(html));
  }

  applyStyle(sectionId: string, path: string, style: ElementStyle): void {
    this.post({ source: HOST_TO_IFRAME, type: 'apply-style', sectionId, path, style });
  }

  applyChart(sectionId: string, path: string, config: ChartConfigLite): void {
    this.post({ source: HOST_TO_IFRAME, type: 'apply-chart', sectionId, path, config });
  }

  applyAttr(sectionId: string, path: string, name: string, value: string | null): void {
    this.post({ source: HOST_TO_IFRAME, type: 'apply-attr', sectionId, path, name, value });
  }

  moveNode(sectionId: string, path: string, toIndex: number): void {
    this.post({ source: HOST_TO_IFRAME, type: 'move-node', sectionId, path, toIndex });
  }

  removeNodeLive(sectionId: string, path: string): void {
    this.post({ source: HOST_TO_IFRAME, type: 'remove-node', sectionId, path });
  }

  selectPath(sectionId: string, path: string): void {
    this.post({ source: HOST_TO_IFRAME, type: 'select-path', sectionId, path });
  }

  clearSelection(): void {
    this.post({ source: HOST_TO_IFRAME, type: 'clear-selection' });
  }

  setTheme(dark: boolean): void {
    this.post({ source: HOST_TO_IFRAME, type: 'set-theme', dark });
  }

  private post(message: unknown): void {
    this.frame()?.nativeElement.contentWindow?.postMessage(message, '*');
  }

  private onMessage(event: MessageEvent): void {
    const frameWin = this.frame()?.nativeElement.contentWindow;
    if (!frameWin || event.source !== frameWin) return;
    const msg = event.data as IframeMessage;
    if (!msg || msg.source !== IFRAME_TO_HOST) return;

    switch (msg.type) {
      case 'ready':
        this.ready.emit();
        break;
      case 'height':
        this.iframeHeight.set(Math.max(400, Math.ceil(msg.height)));
        if (this.pendingScrollTop != null) {
          const target = this.pendingScrollTop;
          this.pendingScrollTop = null;
          requestAnimationFrame(() => {
            const el = this.scroll()?.nativeElement;
            if (el) el.scrollTop = target;
          });
        }
        break;
      case 'select':
        this.selectionChange.emit(msg.selection);
        break;
      case 'deselect':
        this.selectionChange.emit(null);
        break;
      case 'text-change':
        this.textChange.emit({ sectionId: msg.sectionId, path: msg.path, html: msg.html });
        break;
      case 'reorder':
        this.reorderRequest.emit({
          sectionId: msg.sectionId,
          parentPath: msg.parentPath,
          fromIndex: msg.fromIndex,
          toIndex: msg.toIndex,
        });
        break;
    }
  }

  /** Convertit une longueur CSS ('210mm', '900px') en pixels (96 dpi). */
  private cssToPx(value: string): number {
    const num = parseFloat(value);
    if (Number.isNaN(num)) return 794;
    if (value.includes('mm')) return Math.round((num * 96) / 25.4);
    if (value.includes('cm')) return Math.round((num * 96) / 2.54);
    return Math.round(num);
  }
}

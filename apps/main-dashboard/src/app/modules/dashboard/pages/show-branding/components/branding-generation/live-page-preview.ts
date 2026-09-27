import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { buildIframeDocument } from '../../../document-editor/runtime/editor-iframe';
import { PageFormat, RenderContext } from '../../../document-editor/models/editor.types';

/** Marge du document de l'iframe autour de la page (cf. `.idem-doc`). */
const DOC_PADDING_PX = 20;
const PX_PER_MM = 96 / 25.4;

function toPx(length: string): number {
  const value = parseFloat(length);
  return length.trim().endsWith('mm') ? value * PX_PER_MM : value;
}

/**
 * Une page de la charte, telle qu'elle vient d'être produite, en miniature.
 *
 * Même document que l'éditeur et l'aperçu (`buildIframeDocument`) : la page
 * s'affiche ici exactement comme elle s'imprimera. Une seule iframe, dont le
 * contenu change avec la page montrée — pas vingt iframes qui chargeraient
 * chacune leur runtime. Elle n'est pas interactive : c'est une image vivante.
 */
@Component({
  selector: 'app-live-page-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="frame-box" [style.height.px]="boxHeight()">
      <iframe
        class="frame"
        tabindex="-1"
        [title]="label()"
        sandbox="allow-scripts"
        [srcdoc]="srcdoc()"
        [style.width.px]="docWidth()"
        [style.height.px]="docHeight()"
        [style.transform]="'scale(' + scale() + ')'"
      ></iframe>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .frame-box {
        position: relative;
        overflow: hidden;
      }
      .frame {
        position: absolute;
        top: 0;
        left: 0;
        border: 0;
        transform-origin: 0 0;
        pointer-events: none;
        background: transparent;
        color-scheme: light;
      }
    `,
  ],
})
export class LivePagePreviewComponent {
  readonly html = input.required<string>();
  readonly format = input.required<PageFormat>();
  readonly context = input<RenderContext>({ dark: false });
  readonly label = input<string>('');

  private readonly sanitizer = inject(DomSanitizer);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly width = signal(0);

  protected readonly docWidth = computed(() => toPx(this.format().width) + 2 * DOC_PADDING_PX);
  protected readonly docHeight = computed(() => toPx(this.format().height) + 2 * DOC_PADDING_PX);
  protected readonly scale = computed(() => (this.width() > 0 ? this.width() / this.docWidth() : 0));
  protected readonly boxHeight = computed(() => this.docHeight() * this.scale());

  protected readonly srcdoc = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(
      buildIframeDocument(
        [{ id: 'live', name: this.label(), type: 'html', html: this.html() }],
        this.context(),
        this.format(),
        false,
        false,
        'preview',
      ),
    ),
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const element = this.host.nativeElement;
      this.width.set(element.clientWidth);
      const observer = new ResizeObserver(([entry]) => this.width.set(entry.contentRect.width));
      observer.observe(element);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { BusinessCardOrientation, BUSINESS_CARD_SIZE_MM } from '../../../../models/business-card.model';
import { CardPreviewFonts, buildCardPreviewDocument, mmToPx } from '../../utils/business-card-preview';

/**
 * Aperçu temps réel d'une face de carte.
 *
 * Le document iframe n'est reconstruit QUE lorsque le template (ou la police /
 * l'orientation) change. Les valeurs saisies sont envoyées par postMessage et
 * ré-interpolées à l'intérieur de l'iframe : la frappe au clavier ne provoque
 * donc aucun rechargement, donc aucun clignotement.
 */
@Component({
  selector: 'app-card-preview',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card-shell" [style.width.px]="displayWidth()" [style.height.px]="displayHeight()">
      @if (templateHtml()) {
        <iframe
          #frame
          class="card-frame"
          title="{{ label() }}"
          [srcdoc]="srcdoc()"
          [style.width.px]="cardWidth()"
          [style.height.px]="cardHeight()"
          [style.transform]="'scale(' + scale() + ')'"
          (load)="onFrameLoad()"
        ></iframe>
      } @else {
        <div class="card-empty"></div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: inline-block;
      }
      .card-shell {
        position: relative;
        overflow: hidden;
        border-radius: 10px;
        background: #fff;
        box-shadow:
          0 1px 2px rgb(0 0 0 / 0.14),
          0 10px 28px -12px rgb(0 0 0 / 0.45);
      }
      .card-frame {
        border: 0;
        display: block;
        transform-origin: top left;
        background: #fff;
      }
      .card-empty {
        width: 100%;
        height: 100%;
        background: repeating-linear-gradient(
          45deg,
          var(--glass-bg-subtle),
          var(--glass-bg-subtle) 10px,
          transparent 10px,
          transparent 20px
        );
      }
    `,
  ],
})
export class CardPreviewComponent {
  /** HTML du template de la face (contient les marqueurs `{{champ}}`). */
  readonly templateHtml = input<string>('');
  /** Valeurs de la personne (interpolation temps réel). */
  readonly values = input<Record<string, string | undefined | null>>({});
  readonly orientation = input<BusinessCardOrientation>('landscape');
  readonly fonts = input<CardPreviewFonts>({});
  /** Largeur d'affichage souhaitée en px (la carte est mise à l'échelle). */
  readonly displayWidth = input<number>(340);
  readonly label = input<string>('Business card preview');

  private readonly sanitizer = inject(DomSanitizer);
  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');

  private readonly frameReady = signal(false);

  protected readonly cardWidth = computed(() => mmToPx(BUSINESS_CARD_SIZE_MM[this.orientation()].width));
  protected readonly cardHeight = computed(() =>
    mmToPx(BUSINESS_CARD_SIZE_MM[this.orientation()].height),
  );
  protected readonly scale = computed(() => this.displayWidth() / this.cardWidth());
  protected readonly displayHeight = computed(() => Math.round(this.cardHeight() * this.scale()));

  /**
   * Document de l'iframe : ne dépend QUE du template / orientation / polices.
   * Les valeurs n'en font volontairement pas partie (voir en-tête de classe).
   */
  protected readonly srcdoc = computed<SafeHtml>(() => {
    const html = this.templateHtml();
    if (!html) return '';
    const doc = buildCardPreviewDocument(this.wrapWithRuntime(html), this.orientation(), this.fonts());
    return this.sanitizer.bypassSecurityTrustHtml(doc);
  });

  constructor() {
    // Recharge du document → l'iframe doit être ré-alimentée après son `load`.
    effect(() => {
      this.srcdoc();
      this.frameReady.set(false);
    });
    // Toute modification des valeurs est poussée dans l'iframe déjà chargée.
    effect(() => {
      const values = this.values();
      if (this.frameReady()) this.push(values);
    });
  }

  protected onFrameLoad(): void {
    this.frameReady.set(true);
    this.push(this.values());
  }

  private push(values: Record<string, string | undefined | null>): void {
    this.frame()?.nativeElement.contentWindow?.postMessage(
      { source: 'idem-card-host', type: 'values', values },
      '*',
    );
  }

  /**
   * Enveloppe le template avec le runtime d'interpolation exécuté DANS l'iframe :
   * il mémorise le gabarit d'origine et le ré-interpole à chaque message, ce qui
   * permet de faire réapparaître un bloc optionnel précédemment masqué.
   */
  private wrapWithRuntime(templateHtml: string): string {
    return `${templateHtml}
<script>
(function () {
  var root = document.body.firstElementChild;
  if (!root) return;
  var wrapper = document.createElement('div');
  wrapper.innerHTML = root.outerHTML;
  var template = wrapper.innerHTML;

  function escapeHtml(v) {
    return String(v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function render(values) {
    var html = template.replace(/\\{\\{\\s*([a-zA-Z0-9_]+)\\s*\\}\\}/g, function (_m, key) {
      var value = values && values[key];
      return value ? escapeHtml(String(value).trim()) : '';
    });
    var holder = document.createElement('div');
    holder.innerHTML = html;
    var next = holder.firstElementChild;
    if (!next) return;
    document.body.replaceChild(next, document.body.firstElementChild);
    var nodes = document.querySelectorAll('[data-field]');
    for (var i = nodes.length - 1; i >= 0; i--) {
      var el = nodes[i];
      var hasText = (el.textContent || '').trim().length > 0;
      var hasMedia = el.querySelector('img[src], svg') !== null;
      if (!hasText && !hasMedia) el.remove();
    }
  }

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || data.source !== 'idem-card-host' || data.type !== 'values') return;
    render(data.values || {});
  });

  // Rendu immédiat : évite que les marqueurs bruts apparaissent le temps que
  // l'hôte pousse les premières valeurs.
  render({});
})();
</script>`;
  }
}

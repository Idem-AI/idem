import {
  afterNextRender,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
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
  EditorMode,
  EditorSelection,
  ElementRect,
  ElementStyle,
  FontHints,
  HOST_TO_IFRAME,
  HostMessage,
  IFRAME_TO_HOST,
  IframeMessage,
  PageFormat,
  RenderContext,
  SectionLayout,
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

/** Bouton d'action du document (ex. « Régénérer » d'une page de remplacement). */
export interface DocumentActionEvent {
  action: string;
  name: string;
}

/** Bornes et paliers du zoom de l'espace de travail. */
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 3;
export const ZOOM_PRESETS: readonly number[] = [
  0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3,
];

/** Marge intérieure du document iframe (`.idem-doc`), ajoutée à la largeur de page. */
const DOC_PADDING_PX = 40;

function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 1000) / 1000));
}

/** Point en coordonnées client (fenêtre) qui reste immobile pendant un zoom. */
interface ClientPoint {
  cx: number;
  cy: number;
}

/** Rectangle en coordonnées client. */
interface ViewBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Canvas d'un document : rend les sections dans un iframe fidèle au PDF
 * (Tailwind + Chart.js locaux) et gère le pont postMessage bidirectionnel.
 *
 * Il porte aussi l'espace de travail, commun à l'éditeur et à l'aperçu :
 *  - zoom ancré (le point sous le curseur, les doigts ou le centre de la vue ne
 *    bouge pas), par boutons, Ctrl/⌘ + molette, pincement ou Ctrl/⌘ +/-/0 ;
 *  - ajustement à la largeur disponible, maintenu tant que l'utilisateur n'a
 *    pas choisi un zoom lui-même (rotation d'écran, panneau replié…) ;
 *  - suivi de la page visible, pour la navigation par page.
 *
 * Deux variantes :
 *  - `workspace` (éditeur plein écran) : le document défile DANS le canvas ;
 *  - `inline` (page du tableau de bord) : le canvas prend la hauteur du
 *    document et c'est la PAGE qui défile. Aucune page n'est coupée par un
 *    bord de conteneur ; seul le zoom au-delà de la largeur défile
 *    horizontalement dans le canvas.
 * Tous les calculs se font en coordonnées client, valables pour les deux.
 *
 * Le contenu projeté (`<ng-content>`) est posé dans le repère du document
 * zoomé : un menu contextuel s'y place en multipliant la boîte de l'élément
 * par le zoom, et défile avec le document.
 */
@Component({
  selector: 'app-editor-canvas',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.canvas-host-inline]': 'inline()' },
  template: `
    <div
      #scroll
      class="canvas-scroll"
      [class.canvas-inline]="inline()"
      tabindex="0"
      role="region"
      [attr.aria-label]="label()"
      [style.padding-bottom.px]="bottomInset() || null"
      (scroll)="onScroll()"
      (wheel)="onWheel($event)"
      (keydown)="onZoomKey($event)"
    >
      <div
        #wrap
        class="zoom-wrap"
        [style.width.px]="scaledWidth()"
        [style.height.px]="scaledHeight()"
      >
        <iframe
          #frame
          [title]="label()"
          class="editor-iframe"
          [srcdoc]="srcdoc()"
          [style.width.px]="pageWidthPx()"
          [style.height.px]="iframeHeight()"
          [style.transform]="'scale(' + zoomState() + ')'"
        ></iframe>
        <ng-content />
      </div>
    </div>
  `,
  styles: [
    `
      :host { display: block; height: 100%; }
      :host(.canvas-host-inline) { height: auto; }
      .canvas-scroll {
        position: relative;
        width: 100%; height: 100%; overflow: auto;
        overscroll-behavior: contain;
        touch-action: pan-x pan-y;
        background:
          radial-gradient(circle at center, var(--glass-bg-subtle) 1px, transparent 1px);
        background-size: 22px 22px;
        padding: 24px;
      }
      /* Posé dans une page : le canvas a la hauteur du document, la page
         défile ; pas de trame ni de marge (celle du document iframe porte
         l'ombre des pages). */
      .canvas-scroll.canvas-inline {
        height: auto;
        overflow-x: auto;
        overflow-y: hidden;
        overscroll-behavior: auto;
        background: none;
        padding: 0;
      }
      .canvas-scroll:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: -2px;
      }
      /* margin auto plutôt qu'un centrage flex : un document plus large que la
         vue reste accessible par défilement jusqu'à son bord gauche. */
      .zoom-wrap { position: relative; margin: 0 auto; }
      /* color-scheme: light — le document rendu est toujours clair (parité PDF).
         Sans cela, en thème sombre, l'iframe hérite de color-scheme: dark ;
         le navigateur, voyant deux schémas différents, peint un fond blanc
         opaque derrière tout le document au lieu de laisser le fond transparent. */
      .editor-iframe {
        border: none; background: transparent; transform-origin: top left; display: block;
        color-scheme: light;
      }
      @media (max-width: 640px) {
        .canvas-scroll { padding: 8px; }
      }
    `,
  ],
})
export class EditorCanvasComponent implements OnInit, OnDestroy {
  readonly pageFormat = input.required<PageFormat>();
  readonly multiPage = input<boolean>(false);
  readonly fitRoot = input<boolean>(false);
  readonly fonts = input<FontHints>({});
  readonly dark = input<boolean>(false);
  readonly mode = input<EditorMode>('edit');
  /**
   * `workspace` : espace de travail plein écran (trame pointillée, défilement
   * dans le canvas). `inline` : posé dans une page du tableau de bord (fond
   * transparent, la page défile).
   */
  readonly variant = input<'workspace' | 'inline'>('workspace');
  /** Zoom maximal atteint par l'ajustement à la largeur (jamais d'agrandissement flou). */
  readonly maxFitZoom = input<number>(1);
  /**
   * true → Ctrl/⌘ +/-/0 zooment le document où que soit le focus (éditeur plein
   * écran). Sinon, seulement quand le canvas a le focus : sur une page du
   * tableau de bord, ces raccourcis restent ceux du navigateur.
   */
  readonly captureZoomKeys = input<boolean>(false);
  readonly label = input<string>('Document');
  /** Marge basse (px) réservée à une barre flottante posée sur le canvas. */
  readonly bottomInset = input<number>(0);

  readonly ready = output<void>();
  readonly selectionChange = output<EditorSelection | null>();
  readonly textChange = output<TextChangeEvent>();
  readonly reorderRequest = output<ReorderEvent>();
  /** Échap pressé dans le document, hors édition de texte. */
  readonly escape = output<void>();
  /** Bouton d'action cliqué dans le document (aperçu). */
  readonly documentAction = output<DocumentActionEvent>();

  private readonly sanitizer = inject(DomSanitizer);
  private readonly renderer = inject(Renderer2);
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
  private readonly scroll = viewChild<ElementRef<HTMLElement>>('scroll');
  private readonly wrap = viewChild<ElementRef<HTMLElement>>('wrap');

  protected readonly inline = computed(() => this.variant() === 'inline');
  protected readonly srcdoc = signal<SafeHtml>('');
  protected readonly iframeHeight = signal<number>(800);
  protected readonly zoomState = signal<number>(1);
  private readonly fittingState = signal<boolean>(true);
  private readonly layoutState = signal<SectionLayout[]>([]);
  /** Ligne de lecture (35 % de la vue), en px du document à l'échelle 1. */
  private readonly probeState = signal<number>(0);

  /** Zoom courant (1 = taille réelle). */
  readonly zoom = this.zoomState.asReadonly();
  /** true tant que le zoom suit la largeur disponible. */
  readonly fitting = this.fittingState.asReadonly();
  /** Position de chaque page/section dans le document (échelle 1). */
  readonly sectionLayouts = this.layoutState.asReadonly();

  readonly pageWidthPx = computed(() => this.cssToPx(this.pageFormat().width) + DOC_PADDING_PX);
  readonly scaledWidth = computed(() => this.pageWidthPx() * this.zoomState());
  readonly scaledHeight = computed(() => this.iframeHeight() * this.zoomState());

  /** Index de la page lue : la dernière dont le haut a passé la ligne de lecture. */
  readonly currentSectionIndex = computed(() => {
    const layouts = this.layoutState();
    if (layouts.length === 0) return -1;
    const probe = this.probeState();
    let index = 0;
    layouts.forEach((layout, i) => {
      if (layout.top <= probe) index = i;
    });
    return index;
  });

  private unlisten: (() => void)[] = [];
  private resizeObserver?: ResizeObserver;
  private pendingScrollTop: number | null = null;
  private pendingSectionReveal: { id: string; smooth: boolean } | null = null;
  private revealSmooth = true;
  private scrollFrame = 0;
  /** Hauteur des barres fixées en haut de la fenêtre (variante inline). */
  private topInset = 0;

  constructor() {
    afterNextRender(() => this.observeViewport());
  }

  ngOnInit(): void {
    this.unlisten.push(
      this.renderer.listen('window', 'message', (event: MessageEvent) => this.onMessage(event)),
      this.renderer.listen('window', 'keydown', (event: KeyboardEvent) => {
        if (this.captureZoomKeys()) this.onZoomKey(event);
      }),
    );
  }

  ngOnDestroy(): void {
    this.unlisten.forEach((fn) => fn());
    this.resizeObserver?.disconnect();
    if (this.scrollFrame) cancelAnimationFrame(this.scrollFrame);
  }

  /** (Re)construit intégralement le document iframe à partir des sections. */
  render(sections: EditableSection[], preserveScroll = false): void {
    const scrollEl = this.scroll()?.nativeElement;
    // En inline, la page garde sa position d'elle-même : la hauteur de
    // l'iframe est conservée jusqu'au premier message du nouveau document.
    if (preserveScroll && scrollEl && !this.inline()) this.pendingScrollTop = scrollEl.scrollTop;
    const ctx: RenderContext = {
      primaryFont: this.fonts().primaryFont,
      secondaryFont: this.fonts().secondaryFont,
      fontUrl: this.fonts().fontUrl,
      dark: this.dark(),
    };
    const html = buildIframeDocument(
      sections,
      ctx,
      this.pageFormat(),
      this.multiPage(),
      this.fitRoot(),
      this.mode(),
    );
    this.srcdoc.set(this.sanitizer.bypassSecurityTrustHtml(html));
  }

  /* ------------------------------------------------------------------ */
  /* Zoom                                                                */
  /* ------------------------------------------------------------------ */

  /** Fixe le zoom (centre de la vue immobile) et quitte l'ajustement automatique. */
  zoomTo(value: number): void {
    this.fittingState.set(false);
    this.applyZoom(value);
  }

  /** Passe au palier de zoom suivant ou précédent. */
  zoomStep(direction: 1 | -1): void {
    const current = this.zoomState();
    const next =
      direction > 0
        ? ZOOM_PRESETS.find((z) => z > current + 0.005)
        : [...ZOOM_PRESETS].reverse().find((z) => z < current - 0.005);
    this.zoomTo(next ?? (direction > 0 ? ZOOM_MAX : ZOOM_MIN));
  }

  /** Ajuste le document à la largeur disponible et suit ensuite ses changements. */
  fitToWidth(): void {
    this.fittingState.set(true);
    const view = this.viewBox();
    this.applyZoom(this.fitZoom(), view ? { cx: view.left + view.width / 2, cy: view.top } : undefined);
  }

  /**
   * Applique un zoom en gardant immobile le point du document situé sous
   * `anchor` (par défaut, le centre de la partie visible).
   */
  private applyZoom(value: number, anchor?: ClientPoint): void {
    const next = clampZoom(value);
    const prev = this.zoomState();
    if (Math.abs(next - prev) < 0.001) return;
    const wrap = this.wrap()?.nativeElement;
    const view = this.viewBox();
    if (!wrap || !view) {
      this.zoomState.set(next);
      return;
    }
    const cx = anchor?.cx ?? view.left + view.width / 2;
    const cy = anchor?.cy ?? view.top + view.height / 2;
    const before = wrap.getBoundingClientRect();
    const docX = (cx - before.left) / prev;
    const docY = (cy - before.top) / prev;
    this.zoomState.set(next);
    // Rendu synchrone : le défilement se recale sur les nouvelles dimensions
    // dans la même frame, sans saut visible.
    this.cdr.detectChanges();
    const after = wrap.getBoundingClientRect();
    this.scrollViewBy(after.left + docX * next - cx, after.top + docY * next - cy, false);
    this.syncViewport();
  }

  private fitZoom(): number {
    const el = this.scroll()?.nativeElement;
    if (!el) return this.zoomState();
    const style = getComputedStyle(el);
    const available =
      el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    if (available <= 0) return this.zoomState();
    return clampZoom(Math.min(this.maxFitZoom(), available / this.pageWidthPx()));
  }

  /** Ctrl/⌘ + molette ou pincement du pavé tactile au-dessus des marges du canvas. */
  protected onWheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    // Même sensibilité que le relais de l'iframe (editor-iframe.ts).
    const delta = Math.max(-25, Math.min(25, event.deltaY));
    this.fittingState.set(false);
    this.applyZoom(this.zoomState() * Math.exp(-delta * 0.008), {
      cx: event.clientX,
      cy: event.clientY,
    });
  }

  protected onZoomKey(event: KeyboardEvent): void {
    if (!(event.ctrlKey || event.metaKey) || event.defaultPrevented) return;
    if (event.key === '=' || event.key === '+') {
      event.preventDefault();
      this.zoomStep(1);
    } else if (event.key === '-') {
      event.preventDefault();
      this.zoomStep(-1);
    } else if (event.key === '0') {
      event.preventDefault();
      this.fitToWidth();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Vue, défilement, pages                                              */
  /* ------------------------------------------------------------------ */

  /**
   * Partie visible du canvas, en coordonnées client. En inline, c'est la
   * portion du canvas dans la fenêtre, sous les barres fixées en haut.
   */
  private viewBox(): ViewBox | null {
    const el = this.scroll()?.nativeElement;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (!this.inline()) {
      return { left: rect.left, top: rect.top, width: el.clientWidth, height: el.clientHeight };
    }
    const top = Math.max(rect.top, this.topInset);
    const bottom = Math.min(rect.bottom, window.innerHeight);
    return { left: rect.left, top, width: el.clientWidth, height: Math.max(0, bottom - top) };
  }

  /**
   * Défile la vue. Horizontalement : le canvas. Verticalement : le canvas
   * (workspace) ou la page (inline). `instant` explicite quand ce n'est pas
   * une navigation : le style global pose `scroll-behavior: smooth`, qui ferait
   * glisser un recalage de zoom.
   */
  private scrollViewBy(dx: number, dy: number, smooth: boolean): void {
    const el = this.scroll()?.nativeElement;
    if (!el) return;
    const behavior: ScrollBehavior = smooth ? 'smooth' : 'instant';
    if (this.inline()) {
      if (dx) el.scrollBy({ left: dx, behavior });
      if (dy) window.scrollBy({ top: dy, behavior });
    } else if (dx || dy) {
      el.scrollBy({ left: dx, top: dy, behavior });
    }
  }

  /**
   * Hauteur des barres fixées en haut de la fenêtre (barre du tableau de
   * bord) : ce qui passe dessous n'est pas visible. Mesurée, pas supposée.
   */
  private measureTopInset(): void {
    let inset = 0;
    for (const node of document.elementsFromPoint(window.innerWidth / 2, 1)) {
      const position = getComputedStyle(node).position;
      if (position === 'fixed' || position === 'sticky') {
        inset = Math.max(inset, node.getBoundingClientRect().bottom);
      }
    }
    this.topInset = Math.min(inset, window.innerHeight / 3);
  }

  private observeViewport(): void {
    const el = this.scroll()?.nativeElement;
    if (!el) return;
    if (this.inline()) {
      this.measureTopInset();
      this.unlisten.push(
        this.renderer.listen('window', 'scroll', () => this.onScroll()),
        this.renderer.listen('window', 'resize', () => {
          this.measureTopInset();
          this.onScroll();
        }),
      );
    }
    const view = this.viewBox();
    this.applyZoom(this.fitZoom(), view ? { cx: view.left, cy: view.top } : undefined);
    this.syncViewport();
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => {
      if (this.fittingState()) {
        const box = this.viewBox();
        this.applyZoom(this.fitZoom(), box ? { cx: box.left + box.width / 2, cy: box.top } : undefined);
      }
      this.syncViewport();
    });
    this.resizeObserver.observe(el);
  }

  protected onScroll(): void {
    if (this.scrollFrame) return;
    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = 0;
      this.syncViewport();
    });
  }

  private syncViewport(): void {
    const view = this.viewBox();
    const wrap = this.wrap()?.nativeElement;
    if (!view || !wrap) return;
    const top = wrap.getBoundingClientRect().top;
    this.probeState.set((view.top + view.height * 0.35 - top) / this.zoomState());
  }

  /** Fait défiler la vue jusqu'au haut d'une page, désignée par son index ou son id. */
  scrollToSection(target: number | string, smooth = true): void {
    const layouts = this.layoutState();
    const layout =
      typeof target === 'number' ? layouts[target] : layouts.find((l) => l.id === target);
    const wrap = this.wrap()?.nativeElement;
    const view = this.viewBox();
    if (!layout || !wrap || !view) {
      if (typeof target === 'string') this.pendingSectionReveal = { id: target, smooth };
      return;
    }
    const top = wrap.getBoundingClientRect().top + layout.top * this.zoomState();
    this.scrollViewBy(0, top - view.top - 12, smooth);
  }

  /** Centre dans la vue un élément du document (boîte à l'échelle 1). */
  private reveal(rect: ElementRect, smooth: boolean): void {
    const wrap = this.wrap()?.nativeElement;
    const view = this.viewBox();
    if (!wrap || !view) return;
    const z = this.zoomState();
    const box = wrap.getBoundingClientRect();
    const top = box.top + rect.top * z;
    const height = rect.height * z;
    const targetTop = height > view.height * 0.7 ? top - 24 : top + height / 2 - view.height / 2;
    const centerX = box.left + (rect.left + rect.width / 2) * z;
    this.scrollViewBy(centerX - (view.left + view.width / 2), targetTop - view.top, smooth);
  }

  /* ------------------------------------------------------------------ */
  /* Pont hôte → iframe                                                  */
  /* ------------------------------------------------------------------ */

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

  /** Sélectionne un élément par son chemin et l'amène au centre de la vue. */
  selectPath(sectionId: string, path: string, smooth = true): void {
    this.revealSmooth = smooth;
    this.post({ source: HOST_TO_IFRAME, type: 'select-path', sectionId, path, reveal: true });
  }

  clearSelection(): void {
    this.post({ source: HOST_TO_IFRAME, type: 'clear-selection' });
  }

  setTheme(dark: boolean): void {
    this.post({ source: HOST_TO_IFRAME, type: 'set-theme', dark });
  }

  private post(message: HostMessage): void {
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
        this.layoutState.set(msg.sections ?? []);
        this.cdr.detectChanges();
        this.syncViewport();
        if (this.pendingScrollTop != null) {
          const target = this.pendingScrollTop;
          this.pendingScrollTop = null;
          requestAnimationFrame(() =>
            this.scroll()?.nativeElement.scrollTo({ top: target, behavior: 'instant' }),
          );
        }
        if (this.pendingSectionReveal) {
          const pending = this.pendingSectionReveal;
          this.pendingSectionReveal = null;
          this.scrollToSection(pending.id, pending.smooth);
        }
        break;
      case 'select':
        this.selectionChange.emit(msg.selection);
        if (msg.reveal) this.reveal(msg.selection.rect, this.revealSmooth);
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
      case 'zoom-gesture':
        if (msg.reset) {
          this.fitToWidth();
        } else {
          this.fittingState.set(false);
          const box = this.wrap()?.nativeElement.getBoundingClientRect();
          const z = this.zoomState();
          const anchor =
            box && msg.x != null && msg.y != null
              ? { cx: box.left + msg.x * z, cy: box.top + msg.y * z }
              : undefined;
          this.applyZoom(z * msg.factor, anchor);
        }
        break;
      case 'escape':
        this.escape.emit();
        break;
      case 'action':
        this.documentAction.emit({ action: msg.action, name: msg.name });
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

import { TOUR_STYLES } from './styles';
import type { TourHandle, TourOptions, TourPlacement, TourStep } from './types';

const STYLE_ID = 'idem-tour-styles';
const CARD_GAP = 14;
const VIEWPORT_MARGIN = 12;
const SPOTLIGHT_PADDING = 8;
const CONFETTI_COLORS = ['#1447e6', '#22d3ee', '#f59e0b', '#ec4899', '#10b981'];

/** N'injecte la feuille de styles qu'une fois par document. */
function ensureStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = TOUR_STYLES;
  doc.head.appendChild(style);
}

function isVisible(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = window.getComputedStyle(element);
  return style.visibility !== 'hidden' && style.display !== 'none';
}

/**
 * Visite guidée : un projecteur sur un élément, une bulle qui l'explique.
 *
 * Le moteur ne dépend d'aucun framework : il manipule le DOM directement et
 * se contente de sélecteurs CSS. Une étape dont la cible est absente de la
 * page — un bouton masqué sur mobile, par exemple — s'affiche centrée plutôt
 * que de casser la visite.
 */
class Tour implements TourHandle {
  private readonly doc = document;
  private root!: HTMLElement;
  private spotlight!: HTMLElement;
  private halo!: HTMLElement;
  private card!: HTMLElement;

  private index = -1;
  private stopped = false;
  private target: HTMLElement | null = null;

  private readonly onReposition = () => this.position();
  private readonly onKeydown = (event: KeyboardEvent) => this.handleKey(event);

  constructor(private readonly options: TourOptions) {}

  start(): void {
    if (this.options.steps.length === 0) {
      this.options.onFinish?.(true);
      return;
    }
    ensureStyles(this.doc);
    this.build();
    void this.show(0);
  }

  currentIndex(): number {
    return this.index;
  }

  next(): void {
    if (this.index >= this.options.steps.length - 1) {
      this.finish(true);
      return;
    }
    void this.show(this.index + 1);
  }

  back(): void {
    if (this.index <= 0) return;
    void this.show(this.index - 1);
  }

  stop(): void {
    this.finish(false);
  }

  // ─────────────────────────────────────────────────────────── construction

  private build(): void {
    this.root = this.doc.createElement('div');
    this.root.className = 'idem-tour-root';

    this.spotlight = this.doc.createElement('div');
    this.spotlight.className = 'idem-tour-spotlight';

    this.halo = this.doc.createElement('div');
    this.halo.className = 'idem-tour-halo';

    this.card = this.doc.createElement('div');
    this.card.className = 'idem-tour-card';
    this.card.setAttribute('role', 'dialog');
    this.card.setAttribute('aria-modal', 'false');
    this.card.setAttribute('aria-label', this.options.labels.dialogLabel);

    this.root.append(this.spotlight, this.halo, this.card);
    this.doc.body.appendChild(this.root);

    window.addEventListener('resize', this.onReposition);
    window.addEventListener('scroll', this.onReposition, true);
    this.doc.addEventListener('keydown', this.onKeydown);
  }

  // ─────────────────────────────────────────────────────────── affichage

  private async show(index: number): Promise<void> {
    const step = this.options.steps[index];
    if (!step) return;

    this.index = index;
    await step.before?.();

    this.target = this.resolveTarget(step);
    if (this.target) {
      this.target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      // Laisse le défilement se terminer avant de mesurer.
      await new Promise((resolve) => setTimeout(resolve, 220));
    }

    this.render(step);
    this.position();
    this.options.onStep?.(index, step);
  }

  /**
   * Première correspondance **visible**, pas simplement la première du DOM :
   * la même ancre existe souvent en plusieurs exemplaires (barre du haut,
   * sidebar, tiroir mobile) dont un seul est affiché selon la taille d'écran.
   */
  private resolveTarget(step: TourStep): HTMLElement | null {
    if (!step.target) return null;
    const matches = this.doc.querySelectorAll<HTMLElement>(step.target);
    for (const candidate of Array.from(matches)) {
      if (isVisible(candidate)) return candidate;
    }
    return null;
  }

  private render(step: TourStep): void {
    const { labels, steps } = this.options;
    const isLast = this.index === steps.length - 1;
    const counter = labels.stepOf
      .replace('{current}', String(this.index + 1))
      .replace('{total}', String(steps.length));

    this.card.innerHTML = '';

    if (step.celebrate) {
      this.card.appendChild(this.buildConfetti());
    }

    const counterEl = this.doc.createElement('p');
    counterEl.className = 'idem-tour-counter';
    counterEl.textContent = counter;

    let illustrationEl: HTMLElement | null = null;
    if (step.illustration) {
      illustrationEl = this.doc.createElement('div');
      illustrationEl.className = 'idem-tour-illustration';
      illustrationEl.setAttribute('aria-hidden', 'true');
      illustrationEl.innerHTML = step.illustration;
    }

    const titleEl = this.doc.createElement('h2');
    titleEl.className = 'idem-tour-title';
    titleEl.textContent = step.title;

    const bodyEl = this.doc.createElement('p');
    bodyEl.className = 'idem-tour-body';
    bodyEl.textContent = step.body;

    const foot = this.doc.createElement('div');
    foot.className = 'idem-tour-foot';

    const dots = this.doc.createElement('div');
    dots.className = 'idem-tour-dots';
    steps.forEach((_, i) => {
      const dot = this.doc.createElement('span');
      dot.className = `idem-tour-dot${i === this.index ? ' is-active' : ''}`;
      dots.appendChild(dot);
    });

    const actions = this.doc.createElement('div');
    actions.className = 'idem-tour-actions';

    if (!isLast) {
      const skip = this.doc.createElement('button');
      skip.type = 'button';
      skip.className = 'idem-tour-btn idem-tour-btn--quiet button-ghost button-sm';
      skip.textContent = labels.skip;
      skip.addEventListener('click', () => this.finish(false));
      actions.appendChild(skip);
    }

    if (this.index > 0) {
      const back = this.doc.createElement('button');
      back.type = 'button';
      back.className = 'idem-tour-btn idem-tour-btn--ghost outer-button button-sm';
      back.textContent = labels.back;
      back.addEventListener('click', () => this.back());
      actions.appendChild(back);
    }

    const next = this.doc.createElement('button');
    next.type = 'button';
    next.className = 'idem-tour-btn idem-tour-btn--primary inner-button button-sm';
    next.textContent = isLast ? labels.finish : labels.next;
    next.addEventListener('click', () => this.next());
    actions.appendChild(next);

    foot.append(dots, actions);
    if (illustrationEl) {
      this.card.append(illustrationEl);
    }
    this.card.append(counterEl, titleEl, bodyEl, foot);
    next.focus({ preventScroll: true });
  }

  private buildConfetti(): HTMLElement {
    const wrap = this.doc.createElement('div');
    wrap.className = 'idem-tour-confetti';
    for (let i = 0; i < 14; i++) {
      const piece = this.doc.createElement('i');
      piece.style.left = `${(i * 7 + 4) % 100}%`;
      piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      piece.style.animationDelay = `${(i % 7) * 0.08}s`;
      wrap.appendChild(piece);
    }
    return wrap;
  }

  // ─────────────────────────────────────────────────────────── position

  private position(): void {
    if (this.stopped) return;
    const step = this.options.steps[this.index];
    if (!step) return;

    if (!this.target || !this.target.isConnected) {
      this.positionCentered();
      return;
    }

    const rect = this.target.getBoundingClientRect();
    const top = rect.top - SPOTLIGHT_PADDING;
    const left = rect.left - SPOTLIGHT_PADDING;
    const width = rect.width + SPOTLIGHT_PADDING * 2;
    const height = rect.height + SPOTLIGHT_PADDING * 2;

    this.spotlight.classList.remove('is-centered');
    Object.assign(this.spotlight.style, {
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`,
      height: `${height}px`,
    });

    this.halo.style.display = '';
    Object.assign(this.halo.style, {
      top: `${top - 4}px`,
      left: `${left - 4}px`,
      width: `${width + 8}px`,
      height: `${height + 8}px`,
    });

    this.placeCard(rect, step.placement ?? 'auto');
  }

  private positionCentered(): void {
    this.spotlight.classList.add('is-centered');
    Object.assign(this.spotlight.style, {
      top: '50%',
      left: '50%',
      width: '0px',
      height: '0px',
    });
    this.halo.style.display = 'none';

    const card = this.card.getBoundingClientRect();
    Object.assign(this.card.style, {
      top: `${Math.max(VIEWPORT_MARGIN, (window.innerHeight - card.height) / 2)}px`,
      left: `${Math.max(VIEWPORT_MARGIN, (window.innerWidth - card.width) / 2)}px`,
    });
  }

  /** Choisit le côté qui tient à l'écran, en partant de la préférence donnée. */
  private placeCard(rect: DOMRect, preferred: TourPlacement): void {
    const card = this.card.getBoundingClientRect();
    const order: TourPlacement[] =
      preferred === 'auto'
        ? ['bottom', 'top', 'right', 'left']
        : [preferred, 'bottom', 'top', 'right', 'left'];

    for (const placement of order) {
      const spot = this.computeSpot(rect, card, placement);
      if (spot) {
        this.card.style.top = `${spot.top}px`;
        this.card.style.left = `${spot.left}px`;
        return;
      }
    }

    // Aucun côté ne tient : on recentre plutôt que de déborder.
    this.positionCentered();
  }

  private computeSpot(
    rect: DOMRect,
    card: DOMRect,
    placement: TourPlacement,
  ): { top: number; left: number } | null {
    const clamp = (value: number, max: number) =>
      Math.min(Math.max(value, VIEWPORT_MARGIN), Math.max(VIEWPORT_MARGIN, max));

    const maxLeft = window.innerWidth - card.width - VIEWPORT_MARGIN;
    const maxTop = window.innerHeight - card.height - VIEWPORT_MARGIN;

    switch (placement) {
      case 'bottom': {
        const top = rect.bottom + CARD_GAP;
        if (top + card.height > window.innerHeight - VIEWPORT_MARGIN) return null;
        return { top, left: clamp(rect.left + rect.width / 2 - card.width / 2, maxLeft) };
      }
      case 'top': {
        const top = rect.top - card.height - CARD_GAP;
        if (top < VIEWPORT_MARGIN) return null;
        return { top, left: clamp(rect.left + rect.width / 2 - card.width / 2, maxLeft) };
      }
      case 'right': {
        const left = rect.right + CARD_GAP;
        if (left + card.width > window.innerWidth - VIEWPORT_MARGIN) return null;
        return { top: clamp(rect.top + rect.height / 2 - card.height / 2, maxTop), left };
      }
      case 'left': {
        const left = rect.left - card.width - CARD_GAP;
        if (left < VIEWPORT_MARGIN) return null;
        return { top: clamp(rect.top + rect.height / 2 - card.height / 2, maxTop), left };
      }
      default:
        return null;
    }
  }

  // ─────────────────────────────────────────────────────────── clavier / fin

  private handleKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.finish(false);
    } else if (event.key === 'ArrowRight' || event.key === 'Enter') {
      event.preventDefault();
      this.next();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.back();
    }
  }

  private finish(completed: boolean): void {
    if (this.stopped) return;
    this.stopped = true;
    this.index = -1;

    window.removeEventListener('resize', this.onReposition);
    window.removeEventListener('scroll', this.onReposition, true);
    this.doc.removeEventListener('keydown', this.onKeydown);
    this.root.remove();

    if (activeTour === this) activeTour = null;
    this.options.onFinish?.(completed);
  }
}

/**
 * Visite en cours, s'il y en a une.
 *
 * Deux visites simultanées ne veulent rien dire : l'écran afficherait deux
 * bulles et deux projecteurs concurrents. L'invariant est tenu ici, au plus
 * près du DOM, plutôt que dans chaque application — un composant monté deux
 * fois ou un effet rejoué suffit sinon à en déclencher une seconde.
 */
let activeTour: Tour | null = null;

/** Lance une visite guidée et rend la main immédiatement. */
export function startTour(options: TourOptions): TourHandle {
  activeTour?.stop();

  const tour = new Tour(options);
  activeTour = tour;
  tour.start();
  return tour;
}

/** Y a-t-il une visite à l'écran ? */
export function isTourActive(): boolean {
  return activeTour !== null;
}

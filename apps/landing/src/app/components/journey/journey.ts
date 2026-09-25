import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';

interface Stage {
  /** Stable, non-localized path fragment shown in the mock browser bar. */
  readonly path: string;
  /** Short story beat, used by the rail and by assistive tech. */
  readonly step: string;
  readonly title: string;
  readonly caption: string;
  /** Product name and price, the only place a product is named. */
  readonly price: string;
  readonly ctaLabel: string;
  readonly link: string;
  readonly images: readonly string[];
  readonly imageAlt: string;
}

/* Two dissolve windows, both measured in fractions of one scroll step.
   Imagery gets the long one: two screenshots blending reads as depth.
   Copy gets the short one, so the outgoing text is fully gone before the
   incoming text arrives. Text over text is never legible.

   Copy is readable across 2 x TEXT_IN of the step and absent beyond TEXT_OUT,
   which leaves a quiet gap between two sections rather than a cross-fade. */
const SCENE_IN = 0.3;
const SCENE_OUT = 0.72;
const TEXT_IN = 0.3;
const TEXT_OUT = 0.5;

/* Chapter length is set in the stylesheet (--jn-step) rather than here, but
   it is the one number that decides whether a gesture skips a chapter: one
   trackpad flick covers roughly 700px, so a chapter shorter than that lands
   the reader past the next chapter and reads as a double scroll. CSS
   scroll-snap was tried instead and rejected — with snap areas this size a
   single wheel notch is pulled straight back to where it started, which is
   the freezing this section was fixed for in the first place. */

/** Smoothing of the mapped position, in case scroll input is coarse. Short:
 *  the picture has to feel attached to the finger, not towed behind it. */
const EASE_HALFLIFE_MS = 85;
/** Below this, the eased position is snapped and the loop goes quiet. */
const SETTLE_EPSILON = 0.0006;
/** Auto-advance delay for the screenshot swiper. */
const SWIPER_INTERVAL_MS = 5200;

/** Clamped smoothstep: no overshoot, decelerating at both ends. */
function smoothstep(value: number): number {
  const t = value <= 0 ? 0 : value >= 1 ? 1 : value;
  return t * t * (3 - 2 * t);
}

/**
 * Pinned, scroll-driven story of one entrepreneur going from a sentence to a
 * live company.
 *
 * The page scrolls natively from end to end. Nothing here calls
 * `preventDefault`, and nothing drives `scrollTo` behind the user's back: the
 * section only *reads* the scroll offset and maps it to a position in the
 * story. That is the whole fix for the section feeling stuck — an engine that
 * quantised gestures had to decide which wheel events belonged to which
 * gesture, and every wrong guess showed up as a frozen or late section.
 *
 * A single rAF loop reads the offset, eases it, and writes a handful of custom
 * properties on the two or three sections near the reading head. Geometry is
 * measured on resize, never per frame, so the loop never forces layout.
 */
@Component({
  selector: 'app-journey',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './journey.html',
  styleUrl: './journey.css',
  host: {
    '[class.jn-live]': 'live()',
  },
})
export class JourneyComponent implements AfterViewInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly zone = inject(NgZone);
  private readonly hostEl = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly stageRef = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly progressRef = viewChild.required<ElementRef<HTMLElement>>('progress');
  /** Live query, so a re-rendered view never leaves the engine writing to
   *  detached nodes. Each element carries its own data-index. */
  private readonly slideRefs = viewChildren<ElementRef<HTMLElement>>('slide');

  /** Nearest settled slide: drives the rail, the swiper target and aria state. */
  protected readonly activeIndex = signal(0);
  /** True once the scroll engine owns the layout (browser only). */
  protected readonly live = signal(false);
  /** Direction of the last screenshot change, for a direction-aware swipe. */
  protected readonly swipeDir = signal<1 | -1>(1);

  protected readonly imageIndices = signal<readonly number[]>([]);

  protected readonly navStart = $localize`:@@journey.nav.start:The idea`;
  protected readonly navDone = $localize`:@@journey.nav.done:Launched`;
  protected readonly createProjectUrl = `${environment.services.dashboard.url}/create-project`;

  /* The story is one person, one business, start to finish. Every caption
     stays in her words: what she gets, not what the product does. */
  protected readonly stages: readonly Stage[] = [
    {
      path: 'marque',
      step: $localize`:@@journey.step.name:The name`,
      title: $localize`:@@journey.name.title:Her business has a name: Verda`,
      caption: $localize`:@@journey.name.caption:A logo, colours, business cards. Enough to introduce herself to a customer on day one.`,
      price: $localize`:@@journey.name.price:Identity Pack · from 1,999 F`,
      ctaLabel: $localize`:@@journey.name.cta:Create my brand`,
      link: '/pricing',
      images: [
        'assets/images/journey/01-marque-charte.webp',
        'assets/images/journey/01-marque-palette.webp',
        'assets/images/journey/01-marque-mockup.webp',
      ],
      imageAlt: $localize`:@@journey.name.alt:The Verda brand book: logo, colour palette and typography`,
    },
    {
      path: 'plan',
      step: $localize`:@@journey.step.plan:The plan`,
      title: $localize`:@@journey.plan.title:Her business plan is written`,
      caption: $localize`:@@journey.plan.caption:What she sells, to whom, at what cost. The document a bank asks for, plus the deck she shows an investor.`,
      price: $localize`:@@journey.plan.price:Strategy Pack · from 2,999 F`,
      ctaLabel: $localize`:@@journey.plan.cta:Write my plan`,
      link: '/pricing',
      images: [
        'assets/images/journey/02-plan-types.webp',
        'assets/images/journey/02-plan-couverture.webp',
        'assets/images/journey/02-plan-financier.webp',
        'assets/images/journey/02-plan-objectifs.webp',
      ],
      imageAlt: $localize`:@@journey.plan.alt:Verda's business plan and investor pitch deck`,
    },
    {
      path: 'finances',
      step: $localize`:@@journey.step.numbers:The numbers`,
      title: $localize`:@@journey.numbers.title:She knows when she starts earning`,
      caption: $localize`:@@journey.numbers.caption:Price per kilo collected, running costs, the month she breaks even. Three years ahead, updated as the real numbers come in.`,
      price: $localize`:@@journey.numbers.price:Included in the Strategy Pack`,
      ctaLabel: $localize`:@@journey.numbers.cta:See the pricing`,
      link: '/pricing',
      images: [
        'assets/images/journey/03-finances-previsions.webp',
        'assets/images/journey/03-finances-rapport.webp',
      ],
      imageAlt: $localize`:@@journey.numbers.alt:Verda's financial projections and three-year forecast`,
    },
    {
      path: 'simulateur',
      step: $localize`:@@journey.step.test:The test`,
      title: $localize`:@@journey.test.title:She tests it before spending a franc`,
      caption: $localize`:@@journey.test.caption:What if the price of plastic drops? What if a competitor opens next door? The simulator plays out the scenarios and shows which ones she survives.`,
      price: $localize`:@@journey.test.price:IDEM Simulator · free during the beta`,
      ctaLabel: $localize`:@@journey.test.cta:Try the simulator`,
      link: '/simulation',
      images: [
        'assets/images/journey/04-simulateur-accueil.webp',
        'assets/images/journey/04-simulateur-analyse.webp',
      ],
      imageAlt: $localize`:@@journey.test.alt:IDEM Simulator: business scenarios played out over three years`,
    },
    {
      path: 'juridique',
      step: $localize`:@@journey.step.papers:The paperwork`,
      title: $localize`:@@journey.papers.title:Her company is on the right side of the law`,
      caption: $localize`:@@journey.papers.caption:Articles of association, shareholder agreement, terms of sale. OHADA-compliant and ready to file.`,
      price: $localize`:@@journey.papers.price:Compliance Pack · from 2,499 F`,
      ctaLabel: $localize`:@@journey.papers.cta:See the pricing`,
      link: '/pricing',
      images: [
        'assets/images/journey/05-juridique-documents.webp',
        'assets/images/journey/05-juridique-statuts.webp',
      ],
      imageAlt: $localize`:@@journey.papers.alt:OHADA articles of association generated for Verda`,
    },
    {
      path: 'communication',
      step: $localize`:@@journey.step.clients:The customers`,
      title: $localize`:@@journey.clients.title:Her first customers find her`,
      caption: $localize`:@@journey.clients.caption:A month of posts planned, the visuals already designed, and one button to publish them on her networks.`,
      price: $localize`:@@journey.clients.price:IDEM Media · 1,999–4,999 F/mo`,
      ctaLabel: $localize`:@@journey.clients.cta:See the pricing`,
      link: '/pricing',
      images: [
        'assets/images/journey/06-communication-calendrier.webp',
        'assets/images/journey/06-communication-visuels.webp',
        'assets/images/journey/06-communication-post.webp',
      ],
      imageAlt: $localize`:@@journey.clients.alt:Verda's editorial calendar and generated social media posts`,
    },
    {
      path: 'site',
      step: $localize`:@@journey.step.site:The website`,
      title: $localize`:@@journey.site.title:Her website builds itself in front of her`,
      caption: $localize`:@@journey.site.caption:She describes what she wants in one sentence. Companies can book a collection online.`,
      price: $localize`:@@journey.site.price:iCode · free to generate`,
      ctaLabel: $localize`:@@journey.site.cta:Discover iCode`,
      link: '/idev',
      images: ['assets/images/journey/07-site-icode.webp'],
      imageAlt: $localize`:@@journey.site.alt:The Verda website generated in the iCode editor`,
    },
    {
      path: 'en-ligne',
      step: $localize`:@@journey.step.online:Online`,
      title: $localize`:@@journey.online.title:Her website is live`,
      caption: $localize`:@@journey.online.caption:verda.idem.africa — address, security certificate and hosting on African servers, in one click.`,
      price: $localize`:@@journey.online.price:iDeploy · 5 free deployments`,
      ctaLabel: $localize`:@@journey.online.cta:Deploy with iDeploy`,
      link: '/ideploy',
      images: [
        'assets/images/journey/08-ligne-site.webp',
        'assets/images/journey/08-ligne-ideploy.webp',
      ],
      imageAlt: $localize`:@@journey.online.alt:The Verda website online, hosted in Africa`,
    },
    {
      path: 'conseil',
      step: $localize`:@@journey.step.funding:The funding`,
      title: $localize`:@@journey.funding.title:An advisor helps her get funded`,
      caption: $localize`:@@journey.funding.caption:A certified expert goes through her file with her, then introduces her to banks and investors.`,
      price: $localize`:@@journey.funding.price:IDEM Conseil · from 2,500 F/mo`,
      ctaLabel: $localize`:@@journey.funding.cta:Talk to an advisor`,
      link: '/pricing',
      images: ['assets/images/journey/09-conseil-accompagnement.webp'],
      imageAlt: $localize`:@@journey.funding.alt:IDEM Conseil: a certified advisor reviewing the funding file`,
    },
  ];

  /** Intro + stages + outro. */
  protected readonly sectionCount = this.stages.length + 2;


  /* ── Scroll engine state ─────────────────────────────────────── */
  private rafId = 0;
  private frameStamp = 0;
  private lastScrollY = -1;
  private renderPos = 0;
  private settled = false;
  private observer?: IntersectionObserver;
  private resizeObserver?: ResizeObserver;
  private reduceMotion = false;
  private motionQuery?: MediaQueryList;

  /* ── Geometry, measured on resize rather than every frame ────── */
  /** Document offset of the host's top edge. */
  private hostTop = 0;
  /** Scrollable distance the pinned stage travels across. */
  private span = 0;

  /* ── Swiper state ────────────────────────────────────────────── */
  private swiperTimerId: ReturnType<typeof setInterval> | null = null;
  private swiperPaused = false;
  private touchStartX = 0;
  private touchStartY = 0;

  private readonly onMotionChange = (e: MediaQueryListEvent) => {
    this.reduceMotion = e.matches;
    if (this.reduceMotion) this.stopSwiper();
    else this.startSwiper();
  };

  private readonly onResize = () => {
    this.measure();
    this.settled = false;
  };

  constructor() {
    this.imageIndices.set(this.stages.map(() => 0));
  }

  /* ────────────────────────────────────────────────────────────── */
  /*  Lifecycle                                                     */
  /* ────────────────────────────────────────────────────────────── */

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Browser only: the server DOM has no setProperty for custom properties,
    // and a host style binding would throw there and break prerendering.
    // The stylesheet carries the same value as its default.
    this.hostEl.nativeElement.style.setProperty('--jn-count', String(this.sectionCount));

    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reduceMotion = this.motionQuery.matches;
    this.motionQuery.addEventListener('change', this.onMotionChange);

    // Hand layout over to the pinned engine, then sync before the next paint.
    this.live.set(true);

    this.zone.runOutsideAngular(() => {
      this.measure();
      this.renderPos = this.readPosition();
      this.paint(this.renderPos);

      this.observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) this.start();
          else this.stop();
        },
        { rootMargin: '15% 0px 15% 0px' }
      );
      this.observer.observe(this.hostEl.nativeElement);

      // Anything that changes the page's height moves the pinned range: the
      // host's own growth, and the content above it settling (fonts, images).
      this.resizeObserver = new ResizeObserver(this.onResize);
      this.resizeObserver.observe(this.hostEl.nativeElement);
      this.resizeObserver.observe(document.documentElement);

      window.addEventListener('resize', this.onResize, { passive: true });
      window.addEventListener('orientationchange', this.onResize, { passive: true });
    });

    this.startSwiper();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.resizeObserver?.disconnect();
    this.motionQuery?.removeEventListener('change', this.onMotionChange);
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('resize', this.onResize);
      window.removeEventListener('orientationchange', this.onResize);
    }
    this.stop();
    this.stopSwiper();
  }

  /* ────────────────────────────────────────────────────────────── */
  /*  Scroll engine                                                 */
  /* ────────────────────────────────────────────────────────────── */

  private start(): void {
    if (this.rafId) return;
    this.frameStamp = 0;
    this.lastScrollY = -1;
    this.settled = false;
    this.measure();

    // Explicitly outside Angular: the frame loop should not register as
    // pending work or trigger change detection.
    this.zone.runOutsideAngular(() => {
      this.rafId = requestAnimationFrame(this.tick);
    });
  }

  private stop(): void {
    if (!this.rafId) return;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  /**
   * Caches the pinned range. Reading `offsetHeight` forces layout, so it
   * happens here — on resize — and never inside the frame loop, which only
   * needs `window.scrollY`.
   */
  private measure(): void {
    const host = this.hostEl.nativeElement;
    const stage = this.stageRef().nativeElement;
    this.hostTop = host.getBoundingClientRect().top + window.scrollY;
    this.span = host.offsetHeight - stage.offsetHeight;
  }

  private readonly tick = (now: number): void => {
    this.rafId = requestAnimationFrame(this.tick);

    const scrollY = window.scrollY;
    const moved = scrollY !== this.lastScrollY;
    this.lastScrollY = scrollY;

    // Nothing moved and the eased position has caught up: no DOM work at all.
    if (!moved && this.settled) {
      this.frameStamp = now;
      return;
    }

    const dt = this.frameStamp ? Math.min(80, now - this.frameStamp) : 16.7;
    this.frameStamp = now;

    const target = this.readPosition();
    const delta = target - this.renderPos;

    if (this.reduceMotion || Math.abs(delta) < SETTLE_EPSILON) {
      this.renderPos = target;
      this.settled = true;
    } else {
      // Exponential approach, framerate independent.
      this.renderPos += delta * (1 - Math.pow(2, -dt / EASE_HALFLIFE_MS));
      this.settled = false;
    }

    this.paint(this.renderPos);
  };

  /** Scroll offset inside the pinned range, mapped to a slide position. */
  private readPosition(): number {
    if (this.span <= 0) return 0;
    const progress = (window.scrollY - this.hostTop) / this.span;
    return Math.min(1, Math.max(0, progress)) * (this.sectionCount - 1);
  }

  /** Writes the per-slide motion variables. Transforms and opacity only. */
  private paint(pos: number): void {
    const slides = this.slideRefs();

    for (const ref of slides) {
      const el = ref.nativeElement;
      const index = Number(el.dataset['index']);
      const signed = pos - index;
      const distance = Math.abs(signed);
      const wasNear = el.classList.contains('is-near');

      if (distance >= 1) {
        if (wasNear) {
          el.classList.remove('is-near', 'is-current');
          el.style.setProperty('--e', '0');
          el.style.setProperty('--w', '1');
          el.style.setProperty('--t', '0');
          el.style.setProperty('--tw', '1');
        }
        continue;
      }

      const scene = smoothstep((SCENE_OUT - distance) / (SCENE_OUT - SCENE_IN));
      const text = smoothstep((TEXT_OUT - distance) / (TEXT_OUT - TEXT_IN));

      if (!wasNear) el.classList.add('is-near');

      // Hysteresis around the halfway mark. `is-current` starts the closing
      // animation, so a reading head resting exactly on the boundary must not
      // be able to toggle it on and off frame after frame.
      const wasCurrent = el.classList.contains('is-current');
      const isCurrent = distance < (wasCurrent ? 0.55 : 0.45);
      if (isCurrent !== wasCurrent) el.classList.toggle('is-current', isCurrent);

      el.style.setProperty('--e', scene.toFixed(3));
      el.style.setProperty('--w', (1 - scene).toFixed(3));
      el.style.setProperty('--t', text.toFixed(3));
      el.style.setProperty('--tw', (1 - text).toFixed(3));
      el.style.setProperty('--s', signed >= 0 ? '1' : '-1');
    }

    const ratio = this.sectionCount > 1 ? pos / (this.sectionCount - 1) : 0;
    this.progressRef().nativeElement.style.transform = `scaleX(${ratio.toFixed(4)})`;

    const active = Math.round(pos);
    if (active !== this.activeIndex()) {
      this.zone.run(() => this.activeIndex.set(active));
    }
  }

  /**
   * Rail navigation: an ordinary smooth page scroll to a section's resting
   * offset. Native, so the user interrupting it just takes the scroll back.
   */
  protected goTo(index: number): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.measure();
    if (this.span <= 0) return;
    const ratio = index / (this.sectionCount - 1);
    window.scrollTo({
      top: this.hostTop + this.span * ratio,
      behavior: this.reduceMotion ? 'auto' : 'smooth',
    });
  }

  /* ────────────────────────────────────────────────────────────── */
  /*  Screenshot swiper                                             */
  /* ────────────────────────────────────────────────────────────── */

  protected imageIndex(stageIndex: number): number {
    return this.imageIndices()[stageIndex] ?? 0;
  }

  protected showImage(stageIndex: number, imageIndex: number, event?: Event): void {
    event?.stopPropagation();
    const total = this.stages[stageIndex].images.length;
    const next = ((imageIndex % total) + total) % total;
    const current = this.imageIndex(stageIndex);
    if (next === current) return;

    // Shortest visual direction, so wrapping around still reads correctly.
    const forward = (next - current + total) % total <= total / 2;
    this.swipeDir.set(forward ? 1 : -1);
    this.imageIndices.update((list) => {
      const copy = [...list];
      copy[stageIndex] = next;
      return copy;
    });
    this.startSwiper();
  }

  protected nextImage(stageIndex: number, event?: Event): void {
    this.showImage(stageIndex, this.imageIndex(stageIndex) + 1, event);
  }

  protected prevImage(stageIndex: number, event?: Event): void {
    this.showImage(stageIndex, this.imageIndex(stageIndex) - 1, event);
  }

  protected onShotTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
  }

  protected onShotTouchEnd(stageIndex: number, event: TouchEvent): void {
    const touch = event.changedTouches[0];
    const dx = this.touchStartX - touch.clientX;
    const dy = this.touchStartY - touch.clientY;
    // Horizontal intent only: vertical drags belong to the page scroll.
    if (Math.abs(dx) < 44 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    if (dx > 0) this.nextImage(stageIndex);
    else this.prevImage(stageIndex);
  }

  protected pauseSwiper(): void {
    this.swiperPaused = true;
  }

  protected resumeSwiper(): void {
    this.swiperPaused = false;
  }

  private startSwiper(): void {
    if (!isPlatformBrowser(this.platformId) || this.reduceMotion) return;
    this.stopSwiper();
    this.zone.runOutsideAngular(() => {
      this.swiperTimerId = setInterval(() => {
        if (this.swiperPaused || document.hidden) return;
        const stageIndex = this.activeIndex() - 1;
        const stage = this.stages[stageIndex];
        if (!stage || stage.images.length < 2) return;
        this.zone.run(() => this.nextImage(stageIndex));
      }, SWIPER_INTERVAL_MS);
    });
  }

  private stopSwiper(): void {
    if (this.swiperTimerId === null) return;
    clearInterval(this.swiperTimerId);
    this.swiperTimerId = null;
  }
}

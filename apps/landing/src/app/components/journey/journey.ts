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
import { RouterLink } from '@angular/router';

interface Stage {
  /** Stable, non-localized path fragment shown in the mock browser bar. */
  readonly path: string;
  readonly step: string;
  readonly title: string;
  readonly caption: string;
  readonly price: string;
  readonly ctaLabel: string;
  readonly link: string;
  readonly images: readonly string[];
  readonly imageAlt: string;
}

/* Two dissolve windows, both measured in fractions of one scroll step.
   Imagery gets the long one: two screenshots blending reads as depth.
   Copy gets the short one, offset earlier, so the outgoing text is gone
   before the incoming text arrives. Text over text is never legible. */
const SCENE_IN = 0.3;
const SCENE_OUT = 0.7;
const TEXT_IN = 0.2;
const TEXT_OUT = 0.42;
/** Fraction of the remaining distance closed every 16.7ms (time-corrected). */
const EASE_HALFLIFE_MS = 190;
/** Auto-advance delay for the screenshot swiper. */
const SWIPER_INTERVAL_MS = 5200;

/* One gesture, one section. A gesture ends after this much quiet: trackpad
   inertia fires for a while after the fingers lift, and all of it belongs to
   the same flick. */
const GESTURE_IDLE_MS = 140;
/** Wheel distance that commits the first step of a gesture. */
const WHEEL_FIRST_PX = 16;
/** Extra distance needed to keep stepping inside one long gesture. */
const WHEEL_REPEAT_PX = 280;
/** Swipe distance that commits a step. */
const TOUCH_STEP_PX = 42;
/** How close to a rest point counts as arrived. */
const ARRIVED = 0.02;

/** Clamped smoothstep: no overshoot, decelerating at both ends. */
function smoothstep(value: number): number {
  const t = value <= 0 ? 0 : value >= 1 ? 1 : value;
  return t * t * (3 - 2 * t);
}

/**
 * Pinned, scroll-driven story of one entrepreneur going from a sentence to a
 * live company.
 *
 * Scrolling stays 100% native: the stage is `position: sticky`, so slides can
 * only advance while the section is pinned full-screen. Leaving the section at
 * either end is an ordinary page scroll, with nothing to lock, release, or
 * re-align. A single rAF loop maps scroll offset to a smoothed, continuous
 * position and writes three custom properties per visible slide.
 */
@Component({
  selector: 'app-journey',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './journey.html',
  styleUrl: './journey.css',
  host: {
    '[class.jn-live]': 'live()',
    '[style.--jn-count]': 'sectionCount',
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
  protected readonly navDone = $localize`:@@journey.nav.done:Live`;
  private readonly seePricing = $localize`:@@journey.pricingCta:See pricing`;

  protected readonly stages: readonly Stage[] = [
    {
      path: 'brand',
      step: $localize`:@@what-is-idem.step.brand.label:Brand`,
      title: $localize`:@@services.brand.name:Brand identity`,
      caption: $localize`:@@journey.brand.caption:Her logo, brand guidelines and business cards, ready in minutes.`,
      price: $localize`:@@services.brand.price:Identity Pack from 1,999 F`,
      ctaLabel: $localize`:@@services.brand.cta:Create my brand`,
      link: '/pricing',
      images: [
        'assets/images/overview/brand-identity.webp',
        'assets/images/overview/generated logos options.webp',
        'assets/images/overview/logo variations.webp',
        'assets/images/overview/colors palette.webp',
        'assets/images/overview/typography.webp',
      ],
      imageAlt: $localize`:@@services.brand.alt:IDEM brand studio: generated logo concepts and OKLCH color palette`,
    },
    {
      path: 'strategy',
      step: $localize`:@@what-is-idem.step.strategy.label:Strategy`,
      title: $localize`:@@journey.strategy.title:Business plan & pitch deck`,
      caption: $localize`:@@journey.strategy.caption:A structured business plan and an investor pitch deck, ready to present.`,
      price: $localize`:@@services.strategy.price:Strategy Pack from 2,999 F`,
      ctaLabel: $localize`:@@services.strategy.cta:Build my plan`,
      link: '/pricing',
      images: [
        'assets/images/overview/businessplan.webp',
        'assets/images/overview/pitchdek.webp',
      ],
      imageAlt: $localize`:@@services.strategy.alt:IDEM business plan dashboard with financial projections and OHADA compliance`,
    },
    {
      path: 'finance',
      step: $localize`:@@journey.step.finance:Finances`,
      title: $localize`:@@journey.finance.title:Financial projections`,
      caption: $localize`:@@journey.finance.caption:3-year forecasts, then plan vs actuals tracked month by month.`,
      price: $localize`:@@services.finance.price:Included in the Strategy Pack`,
      ctaLabel: this.seePricing,
      link: '/pricing',
      images: [
        'assets/images/overview/financial dashboard.webp',
        'assets/images/overview/financial-report.webp',
      ],
      imageAlt: $localize`:@@journey.finance.alt:IDEM financial projections and 3-year revenue forecast dashboard`,
    },
    {
      path: 'legal',
      step: $localize`:@@journey.step.legal:Legal`,
      title: $localize`:@@journey.legal.title:OHADA legal kit`,
      caption: $localize`:@@journey.legal.caption:Articles, shareholder agreement and T&Cs, compliant with OHADA law.`,
      price: $localize`:@@services.legal.price:Compliance Pack from 2,499 F`,
      ctaLabel: this.seePricing,
      link: '/pricing',
      images: ['assets/images/overview/statust-of-enterprise.webp'],
      imageAlt: $localize`:@@journey.legal.alt:OHADA legal document kit and articles of association generator`,
    },
    {
      path: 'media',
      step: $localize`:@@journey.step.media:Communication`,
      title: 'IDEM Media',
      caption: $localize`:@@journey.media.caption:Communication strategy, editorial calendar and one-click publishing of flyers and videos to her networks.`,
      price: $localize`:@@offer.media.price:1,999–4,999 F/mo`,
      ctaLabel: this.seePricing,
      link: '/pricing',
      images: [
        'assets/images/overview/editorial calander.webp',
        'assets/images/overview/falyer-generation.webp',
      ],
      imageAlt: $localize`:@@services.media.alt:IDEM Media social editorial calendar and content publisher`,
    },
    {
      path: 'icode',
      step: $localize`:@@what-is-idem.step.product.label:Product`,
      title: 'iCode',
      caption: $localize`:@@journey.code.caption:Her online shop, generated from a sentence and editable live.`,
      price: $localize`:@@services.code.price:Free to generate · Project Pass 999 F`,
      ctaLabel: $localize`:@@services.code.cta:Discover iCode`,
      link: '/idev',
      images: ['assets/images/overview/generated-website-icode.webp'],
      imageAlt: $localize`:@@services.code.alt:iCode editor with a live web-app preview generated by AI`,
    },
    {
      path: 'ideploy',
      step: $localize`:@@what-is-idem.step.deploy.label:Deploy`,
      title: 'iDeploy',
      caption: $localize`:@@journey.deploy.caption:Her site goes live on cafe.idem.africa, free domain and SSL.`,
      price: $localize`:@@services.deploy.price:5 deployments free`,
      ctaLabel: $localize`:@@services.deploy.cta:Deploy with iDeploy`,
      link: '/ideploy',
      images: ['assets/images/overview/hosted-website.webp'],
      imageAlt: $localize`:@@services.deploy.alt:iDeploy console: domain management, one-click deploy status and server metrics`,
    },
    {
      path: 'conseil',
      step: $localize`:@@what-is-idem.step.support.label:Support`,
      title: 'IDEM Conseil',
      caption: $localize`:@@journey.conseil.caption:A certified advisor helps her land her first financing.`,
      price: $localize`:@@services.conseil.price:from 2,500 F/mo`,
      ctaLabel: this.seePricing,
      link: '/pricing',
      images: [
        'assets/images/overview/businessplan.webp',
        'assets/images/overview/financial-report.webp',
      ],
      imageAlt: $localize`:@@services.conseil.alt:IDEM Conseil portal: certified advisor profiles and investor-matching dashboard`,
    },
  ];

  /** Intro + stages + outro. */
  protected readonly sectionCount = this.stages.length + 2;

  /** Zero-padded position of a stage in the sequence. */
  protected stepNumber(index: number): string {
    return String(index + 1).padStart(2, '0');
  }

  /* ── Scroll engine state ─────────────────────────────────────── */
  private rafId = 0;
  private frameStamp = 0;
  private lastScrollY = -1;
  private targetPos = 0;
  private renderPos = 0;
  private settled = false;
  private observer?: IntersectionObserver;
  private reduceMotion = false;
  private motionQuery?: MediaQueryList;
  private onScrollEnd?: () => void;

  /* ── Gesture state ───────────────────────────────────────────── */
  /** Section a programmatic step is currently travelling to. */
  private navTarget: number | null = null;
  private wasPinned = false;
  private gestureUsed = false;
  private wheelAccum = 0;
  private gestureIdleId: ReturnType<typeof setTimeout> | null = null;
  private swipeStartY = 0;
  private swipeStepped = false;

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

  constructor() {
    this.imageIndices.set(this.stages.map(() => 0));
  }

  /* ────────────────────────────────────────────────────────────── */
  /*  Lifecycle                                                     */
  /* ────────────────────────────────────────────────────────────── */

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reduceMotion = this.motionQuery.matches;
    this.motionQuery.addEventListener('change', this.onMotionChange);

    // Hand layout over to the pinned engine, then sync before the next paint.
    this.live.set(true);

    this.zone.runOutsideAngular(() => {
      this.renderPos = this.targetPos = this.readPosition();
      this.paint(this.renderPos);

      this.observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) this.start();
          else this.stop();
        },
        { rootMargin: '15% 0px 15% 0px' }
      );
      this.observer.observe(this.hostEl.nativeElement);
    });

    this.startSwiper();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.motionQuery?.removeEventListener('change', this.onMotionChange);
    if (this.onScrollEnd) window.removeEventListener('scrollend', this.onScrollEnd);
    this.stop();
    this.stopSwiper();
    this.endGesture();
  }

  /* ────────────────────────────────────────────────────────────── */
  /*  Scroll engine                                                 */
  /* ────────────────────────────────────────────────────────────── */

  private start(): void {
    if (this.rafId) return;
    this.frameStamp = 0;
    this.lastScrollY = -1;
    this.settled = false;
    this.rafId = requestAnimationFrame(this.tick);

    window.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('touchstart', this.onTouchStart, { passive: true });
    window.addEventListener('touchmove', this.onTouchMove, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
  }

  private stop(): void {
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('touchstart', this.onTouchStart);
    window.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('keydown', this.onKeyDown);
    this.endGesture();
    this.navTarget = null;
    this.wasPinned = false;

    if (!this.rafId) return;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
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

    this.targetPos = this.readPosition();

    if (this.navTarget !== null && Math.abs(this.targetPos - this.navTarget) <= ARRIVED) {
      this.navTarget = null;
    }

    const delta = this.targetPos - this.renderPos;
    if (this.reduceMotion || Math.abs(delta) < 0.0008) {
      this.renderPos = this.targetPos;
      this.settled = true;
    } else {
      // Exponential approach, framerate independent.
      this.renderPos += delta * (1 - Math.pow(2, -dt / EASE_HALFLIFE_MS));
      this.settled = false;
    }

    this.paint(this.renderPos);
  };

  /* ────────────────────────────────────────────────────────────── */
  /*  Gestures: one gesture moves exactly one section                */
  /*  Only while the stage is actually pinned full-screen, measured  */
  /*  rather than guessed, so approaching or leaving the section is  */
  /*  always an ordinary page scroll.                                */
  /* ────────────────────────────────────────────────────────────── */

  private isPinned(): boolean {
    const rect = this.hostEl.nativeElement.getBoundingClientRect();
    const stageHeight = this.stageRef().nativeElement.offsetHeight;
    return rect.top <= 1 && rect.bottom >= stageHeight - 1;
  }

  /**
   * Section a step in this direction would land on, or null when the page
   * should keep the gesture: not pinned yet, or already at the end the gesture
   * points towards. Returning null is what makes leaving the section an
   * ordinary scroll with nothing to unlock.
   */
  private nextIndex(forward: boolean): number | null {
    if (!this.isPinned()) {
      this.wasPinned = false;
      return null;
    }
    const from = this.navTarget ?? Math.round(this.readPosition());
    const next = from + (forward ? 1 : -1);
    return next < 0 || next > this.sectionCount - 1 ? null : next;
  }

  private moveTo(index: number): void {
    if (!this.scrollToIndex(index, this.reduceMotion ? 'auto' : 'smooth')) return;
    this.navTarget = index;

    // Content loading elsewhere on the page can shift where the scroll lands.
    // Check once it comes to rest, and correct without animating. Browsers
    // without scrollend simply skip the check.
    if (this.onScrollEnd) return;
    this.onScrollEnd = () => {
      const target = this.navTarget;
      if (target === null) return;
      this.navTarget = null;
      if (Math.abs(this.readPosition() - target) > ARRIVED) {
        this.scrollToIndex(target, 'auto');
      }
    };
    window.addEventListener('scrollend', this.onScrollEnd);
  }

  private endGesture(): void {
    if (this.gestureIdleId) clearTimeout(this.gestureIdleId);
    this.gestureIdleId = null;
    this.gestureUsed = false;
    this.wheelAccum = 0;
  }

  private readonly onWheel = (event: WheelEvent): void => {
    if (event.ctrlKey) return; // pinch zoom

    // Trackpad inertia keeps firing after the fingers lift; all of it is one
    // gesture, and a gesture is worth one section.
    const midGesture = this.gestureIdleId !== null;
    if (this.gestureIdleId) clearTimeout(this.gestureIdleId);
    this.gestureIdleId = setTimeout(() => this.endGesture(), GESTURE_IDLE_MS);

    const forward = event.deltaY > 0;
    const next = this.nextIndex(forward);
    if (next === null) {
      this.wheelAccum = 0;
      return;
    }

    // The flick that pinned the section into place stops there rather than
    // carrying straight on into the next one.
    if (!this.wasPinned) {
      this.wasPinned = true;
      this.gestureUsed = midGesture;
      this.wheelAccum = 0;
    }

    event.preventDefault();
    this.wheelAccum += event.deltaY;

    const needed = this.gestureUsed ? WHEEL_REPEAT_PX : WHEEL_FIRST_PX;
    if (Math.abs(this.wheelAccum) < needed) return;

    this.wheelAccum = 0;
    this.gestureUsed = true;
    this.moveTo(next);
  };

  private readonly onTouchStart = (event: TouchEvent): void => {
    this.swipeStartY = event.touches[0].clientY;
    // A swipe that starts before the section is pinned belongs to the page.
    this.swipeStepped = !this.isPinned();
  };

  private readonly onTouchMove = (event: TouchEvent): void => {
    const delta = this.swipeStartY - event.touches[0].clientY;
    const next = this.nextIndex(delta > 0);
    if (next === null) return;

    event.preventDefault();
    if (this.swipeStepped || Math.abs(delta) < TOUCH_STEP_PX) return;
    this.swipeStepped = true;
    this.moveTo(next);
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    const forward =
      event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ';
    const back = event.key === 'ArrowUp' || event.key === 'PageUp';
    if (!forward && !back) return;

    // Never swallow keys meant for a focused control.
    const target = event.target as HTMLElement | null;
    if (target?.closest('a, button, input, select, textarea, [contenteditable]')) return;

    const next = this.nextIndex(forward);
    if (next === null) return;

    event.preventDefault();
    this.moveTo(next);
  };

  /** Scroll offset inside the pinned range, mapped to a slide position. */
  private readPosition(): number {
    const rect = this.hostEl.nativeElement.getBoundingClientRect();
    const span = rect.height - this.stageRef().nativeElement.offsetHeight;
    if (span <= 0) return 0;
    const progress = Math.min(1, Math.max(0, -rect.top / span));
    return progress * (this.sectionCount - 1);
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
      el.classList.toggle('is-current', distance < 0.5);
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

  /** Rail navigation: scrolls the page to the resting point of one section. */
  protected goTo(index: number): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.moveTo(index);
  }

  private scrollToIndex(index: number, behavior: ScrollBehavior): boolean {
    const rect = this.hostEl.nativeElement.getBoundingClientRect();
    const span = rect.height - this.stageRef().nativeElement.offsetHeight;
    if (span <= 0) return false;
    const ratio = index / (this.sectionCount - 1);
    window.scrollTo({ top: window.scrollY + rect.top + span * ratio, behavior });
    return true;
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

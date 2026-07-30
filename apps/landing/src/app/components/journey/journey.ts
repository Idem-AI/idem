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
/** Residual smoothing on top of the eased step, in case scroll input is raw. */
const EASE_HALFLIFE_MS = 120;
/** Auto-advance delay for the screenshot swiper. */
const SWIPER_INTERVAL_MS = 5200;

/* Step animation. Owned here rather than delegated to the browser's smooth
   scroll: its duration is unspecified and it can be cancelled out from under
   us, which is what let a single flick land two sections away. */
const STEP_BASE_MS = 400;
const STEP_PER_SECTION_MS = 70;
const STEP_MAX_MS = 900;
/** Rest after a step. Guarantees the section that was reached is seen at rest
 *  before anything can move again, so nothing ever looks skipped over. */
const STEP_SETTLE_MS = 150;

/* One gesture, one section. Quiet gap that separates two gestures. It has to
   clear the gaps inside macOS trackpad inertia, which keeps firing, with
   pauses, long after the fingers lift. */
const GESTURE_GAP_MS = 260;
/** Wheel distance that commits the first step of a fresh gesture. */
const WHEEL_START_PX = 12;
/** Distance needed to keep stepping without ever lifting off. */
const WHEEL_CHAIN_PX = 240;
/* Inertia decays, a gesture under way does not. Once a step is committed the
   rest of the burst is read as coasting until an event comes back up to this
   share of the burst's peak, which only happens if the user is still pushing. */
const WHEEL_ENERGY_RATIO = 0.6;
/** Swipe distance that commits a step. */
const TOUCH_STEP_PX = 42;

/** Clamped smoothstep: no overshoot, decelerating at both ends. */
function smoothstep(value: number): number {
  const t = value <= 0 ? 0 : value >= 1 ? 1 : value;
  return t * t * (3 - 2 * t);
}

/** Eased both ways: a step starts from rest and arrives at rest. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Pinned, scroll-driven story of one entrepreneur going from a sentence to a
 * live company.
 *
 * Scroll position stays the single source of truth. The stage is
 * `position: sticky`, so sections can only advance while it is pinned
 * full-screen, and one gesture is quantized to exactly one section by scrolling
 * the page to that section's resting offset. At either end the gesture is
 * handed straight back to the page, so arriving and leaving are ordinary
 * scrolls with nothing to lock, release, or re-align.
 *
 * A single rAF loop reads that offset, eases it, and writes a handful of custom
 * properties per visible section. Nothing else animates.
 */
@Component({
  selector: 'app-journey',
  imports: [RouterLink],
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

  /* ── Step animation ──────────────────────────────────────────── */
  /** Section the step in flight is travelling to, null when at rest. */
  private navTarget: number | null = null;
  private stepFrom = 0;
  private stepStamp = 0;
  private stepDuration = 0;

  /* ── Gesture state ───────────────────────────────────────────── */
  private wasPinned = false;
  private wheelAccum = 0;
  private lastWheelStamp = 0;
  private wheelPeak = 0;
  /** This gesture scrolled the section into place: it may not also step. */
  private entryGesture = false;
  /** A step was committed; what is left of the burst is read as inertia. */
  private coasting = false;
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
    this.cancelStep();
    this.wasPinned = false;
    this.entryGesture = false;
    this.coasting = false;

    if (!this.rafId) return;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  private readonly tick = (now: number): void => {
    this.rafId = requestAnimationFrame(this.tick);

    // A step in flight owns the scroll offset for its duration.
    if (this.navTarget !== null) this.driveStep(now);

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

  /** A step is playing, or holding on the section it just reached. */
  private stepBusy(): boolean {
    return this.navTarget !== null;
  }

  /** Starts a step. The rAF loop drives it from here. */
  private moveTo(index: number): void {
    const from = this.readPosition();

    if (this.reduceMotion) {
      this.scrollToPosition(index);
      return;
    }

    this.navTarget = index;
    this.stepFrom = from;
    this.stepStamp = 0;
    this.stepDuration = Math.min(
      STEP_MAX_MS,
      STEP_BASE_MS + STEP_PER_SECTION_MS * Math.abs(index - from)
    );
  }

  /** Advances the step, recomputed from live geometry so it lands exactly. */
  private driveStep(now: number): void {
    const target = this.navTarget;
    if (target === null) return;
    if (!this.stepStamp) this.stepStamp = now;

    const elapsed = now - this.stepStamp;
    const t = Math.min(1, elapsed / this.stepDuration);
    const pos = t < 1 ? this.stepFrom + (target - this.stepFrom) * easeInOutCubic(t) : target;

    if (!this.scrollToPosition(pos)) {
      this.navTarget = null;
      return;
    }

    // Then hold on the target for a moment. Re-asserting it absorbs any layout
    // shift that happened mid-step, and the section is seen at rest before
    // anything else can move, so nothing ever reads as skipped over.
    if (elapsed >= this.stepDuration + STEP_SETTLE_MS) this.navTarget = null;
  }

  private cancelStep(): void {
    this.navTarget = null;
    this.wheelAccum = 0;
  }

  private readonly onWheel = (event: WheelEvent): void => {
    if (event.ctrlKey) return; // pinch zoom

    const forward = event.deltaY > 0;
    const next = this.nextIndex(forward);
    if (next === null) {
      this.wheelAccum = 0;
      return;
    }

    event.preventDefault();

    const now = event.timeStamp;
    const magnitude = Math.abs(event.deltaY);

    // One gesture is one burst. Trackpad inertia keeps firing, with gaps, long
    // after the fingers lift; only real quiet separates two gestures.
    const fresh = now - this.lastWheelStamp > GESTURE_GAP_MS;
    this.lastWheelStamp = now;

    if (fresh) {
      this.entryGesture = false;
      this.coasting = false;
      this.wheelPeak = 0;
      this.wheelAccum = 0;
    }
    this.wheelPeak = Math.max(this.wheelPeak, magnitude);

    // The burst that scrolled the section into place is spent on that arrival,
    // however much inertia is left in it.
    if (!this.wasPinned) {
      this.wasPinned = true;
      this.entryGesture = !fresh;
    }
    if (this.entryGesture) {
      this.wheelAccum = 0;
      return;
    }

    // Mid-step, or the section just reached is still settling. Swallowing here
    // is what keeps one gesture worth one section.
    if (this.stepBusy()) {
      this.wheelAccum = 0;
      return;
    }

    // Back up near the burst's peak means the user is still pushing, so this is
    // fresh intent rather than the tail of the flick that already stepped.
    if (this.coasting && magnitude >= this.wheelPeak * WHEEL_ENERGY_RATIO) {
      this.coasting = false;
      this.wheelAccum = 0;
    }
    if (this.coasting) {
      this.wheelAccum = 0;
      return;
    }

    // A direction change starts the count over.
    if (this.wheelAccum * event.deltaY < 0) this.wheelAccum = 0;
    this.wheelAccum += event.deltaY;

    // A fresh gesture commits at once. Scrolling that never lifted off has to
    // cover real distance.
    if (Math.abs(this.wheelAccum) < (fresh ? WHEEL_START_PX : WHEEL_CHAIN_PX)) return;

    this.wheelAccum = 0;
    this.coasting = true;
    this.moveTo(next);
  };

  private readonly onTouchStart = (event: TouchEvent): void => {
    this.swipeStartY = event.touches[0].clientY;
    // A swipe that starts before the section is pinned, or while a step is
    // still playing, belongs to the page rather than to the story.
    this.swipeStepped = !this.isPinned() || this.stepBusy();
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
    // Held keys repeat fast: one step at a time, not one per repeat.
    if (!this.stepBusy()) this.moveTo(next);
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

  /**
   * Puts a section position at rest under the viewport. Always `auto`: the
   * global `scroll-behavior: smooth` would otherwise animate every frame of an
   * animation that is already eased.
   */
  private scrollToPosition(pos: number): boolean {
    const rect = this.hostEl.nativeElement.getBoundingClientRect();
    const span = rect.height - this.stageRef().nativeElement.offsetHeight;
    if (span <= 0) return false;
    const ratio = pos / (this.sectionCount - 1);
    window.scrollTo({ top: window.scrollY + rect.top + span * ratio, behavior: 'auto' });
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

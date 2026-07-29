import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  AfterViewInit,
  OnDestroy,
  PLATFORM_ID,
  NgZone,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';

interface Stage {
  readonly step: string;
  readonly title: string;
  readonly caption: string;
  readonly price: string;
  readonly ctaLabel: string;
  readonly link: string;
  readonly images: readonly string[];
  readonly imageAlt: string;
}

@Component({
  selector: 'app-journey',
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './journey.html',
  styleUrl: './journey.css',
})
export class JourneyComponent implements AfterViewInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly zone = inject(NgZone);
  private readonly hostEl = inject(ElementRef<HTMLElement>);

  /** Currently visible section index (0 = intro, 1..N = stages, N+1 = outro). */
  protected readonly activeIndex = signal(0);
  /** Direction of last transition: 'down' or 'up'. */
  protected readonly direction = signal<'down' | 'up'>('down');

  /** Track active image index for each stage. */
  protected readonly activeImageIndices = signal<number[]>([0, 0, 0, 0, 0, 0, 0, 0]);

  protected get totalSections(): number {
    return this.stages.length + 2;
  }

  /* ── Internal state ──────────────────────────────────────── */
  private observer?: IntersectionObserver;
  private isLocked = false;
  private isAligning = false;
  private alignTimeoutId: any = null;
  private releaseCooldown = false;
  private lastAdvanceTime = 0;
  private readonly ADVANCE_COOLDOWN_MS = 650;
  private readonly BOUNDARY_DWELL_MS = 850;
  private readonly BOUNDARY_RELEASE_THRESHOLD = 120;

  /* Swiper auto-play timer */
  private swiperTimerId: any = null;

  /* Accumulated wheel delta */
  private wheelAccumulator = 0;
  private readonly WHEEL_THRESHOLD = 60;

  /* Touch */
  private touchStartY = 0;
  private touchHandled = false;

  /* Bound listeners */
  private boundWheel = (e: WheelEvent) => this.onWheel(e);
  private boundTouchStart = (e: TouchEvent) => this.onTouchStart(e);
  private boundTouchMove = (e: TouchEvent) => this.onTouchMove(e);
  private boundTouchEnd = () => this.onTouchEnd();
  private boundKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);

  /* Single-gesture lock to prevent momentum double-skipping */
  private isAdvancingLocked = false;
  private wheelIdleTimerId: any = null;

  /* Image touch swipe tracking */
  private imgTouchStartX = 0;

  private readonly seePricing = $localize`:@@journey.pricingCta:See pricing`;

  protected readonly stages: readonly Stage[] = [
    {
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
      step: $localize`:@@journey.step.legal:Legal`,
      title: $localize`:@@journey.legal.title:OHADA legal kit`,
      caption: $localize`:@@journey.legal.caption:Articles, shareholder agreement and T&Cs, compliant with OHADA law.`,
      price: $localize`:@@services.legal.price:Compliance Pack from 2,499 F`,
      ctaLabel: this.seePricing,
      link: '/pricing',
      images: [
        'assets/images/overview/statust-of-enterprise.webp',
      ],
      imageAlt: $localize`:@@journey.legal.alt:OHADA legal document kit and articles of association generator`,
    },
    {
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
      step: $localize`:@@what-is-idem.step.product.label:Product`,
      title: 'iCode',
      caption: $localize`:@@journey.code.caption:Her online shop, generated from a sentence and editable live.`,
      price: $localize`:@@services.code.price:Free to generate · Project Pass 999 F`,
      ctaLabel: $localize`:@@services.code.cta:Discover iCode`,
      link: '/idev',
      images: [
        'assets/images/overview/generated-website-icode.webp',
      ],
      imageAlt: $localize`:@@services.code.alt:iCode editor with a live web-app preview generated by AI`,
    },
    {
      step: $localize`:@@what-is-idem.step.deploy.label:Deploy`,
      title: 'iDeploy',
      caption: $localize`:@@journey.deploy.caption:Her site goes live on cafe.idem.africa, free domain and SSL.`,
      price: $localize`:@@services.deploy.price:5 deployments free`,
      ctaLabel: $localize`:@@services.deploy.cta:Deploy with iDeploy`,
      link: '/ideploy',
      images: [
        'assets/images/overview/hosted-website.webp',
      ],
      imageAlt: $localize`:@@services.deploy.alt:iDeploy console: domain management, one-click deploy status and server metrics`,
    },
    {
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

  /* ────────────────────────────────────────────────────────── */
  /*  Lifecycle                                                 */
  /* ────────────────────────────────────────────────────────── */

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.45) {
            if (!this.releaseCooldown && !this.isLocked) {
              this.lock();
            }
          }
          if (!entry.isIntersecting || entry.intersectionRatio < 0.15) {
            this.releaseCooldown = false;
            if (!this.isLocked) {
              const rect = this.hostEl.nativeElement.getBoundingClientRect();
              if (rect.top > 0) {
                this.zone.run(() => this.activeIndex.set(0));
              } else if (rect.bottom < window.innerHeight) {
                this.zone.run(() => this.activeIndex.set(this.totalSections - 1));
              }
            }
          }
        },
        { threshold: [0, 0.15, 0.45, 1] }
      );

      this.observer.observe(this.hostEl.nativeElement);
    });

    this.startSwiperAutoPlay();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.stopSwiperAutoPlay();
    if (this.wheelIdleTimerId) clearTimeout(this.wheelIdleTimerId);
    this.unlock();
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Swiper logic & Image touch gestures                       */
  /* ────────────────────────────────────────────────────────── */

  protected getActiveImage(stageIndex: number): string {
    const images = this.stages[stageIndex].images;
    const imgIdx = this.activeImageIndices()[stageIndex] || 0;
    return images[imgIdx % images.length];
  }

  protected getActiveImageIndex(stageIndex: number): number {
    return this.activeImageIndices()[stageIndex] || 0;
  }

  protected setStageImage(stageIndex: number, imageIndex: number, event?: Event): void {
    if (event) event.stopPropagation();
    const images = this.stages[stageIndex].images;
    const validIndex = (imageIndex + images.length) % images.length;
    this.activeImageIndices.update((indices) => {
      const copy = [...indices];
      copy[stageIndex] = validIndex;
      return copy;
    });
    this.restartSwiperAutoPlay();
  }

  protected nextStageImage(stageIndex: number, event?: Event): void {
    if (event) event.stopPropagation();
    const current = this.getActiveImageIndex(stageIndex);
    this.setStageImage(stageIndex, current + 1);
  }

  protected prevStageImage(stageIndex: number, event?: Event): void {
    if (event) event.stopPropagation();
    const current = this.getActiveImageIndex(stageIndex);
    this.setStageImage(stageIndex, current - 1);
  }

  protected onImgTouchStart(e: TouchEvent): void {
    this.imgTouchStartX = e.touches[0].clientX;
  }

  protected onImgTouchEnd(stageIndex: number, e: TouchEvent): void {
    const deltaX = this.imgTouchStartX - e.changedTouches[0].clientX;
    if (Math.abs(deltaX) > 40) {
      if (deltaX > 0) {
        this.nextStageImage(stageIndex);
      } else {
        this.prevStageImage(stageIndex);
      }
    }
  }

  private startSwiperAutoPlay(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.stopSwiperAutoPlay();
    this.zone.runOutsideAngular(() => {
      this.swiperTimerId = setInterval(() => {
        const currentSection = this.activeIndex();
        // Section indices 1..8 correspond to stage 0..7
        if (currentSection >= 1 && currentSection <= this.stages.length) {
          const stageIdx = currentSection - 1;
          const stage = this.stages[stageIdx];
          if (stage && stage.images.length > 1) {
            this.zone.run(() => {
              const currentImgIdx = this.getActiveImageIndex(stageIdx);
              this.setStageImage(stageIdx, currentImgIdx + 1);
            });
          }
        }
      }, 6500);
    });
  }

  private stopSwiperAutoPlay(): void {
    if (this.swiperTimerId) {
      clearInterval(this.swiperTimerId);
      this.swiperTimerId = null;
    }
  }

  private restartSwiperAutoPlay(): void {
    this.startSwiperAutoPlay();
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Lock / Unlock                                             */
  /* ────────────────────────────────────────────────────────── */

  private lock(): void {
    if (this.isLocked) return;
    this.isLocked = true;
    this.isAligning = true;
    this.isAdvancingLocked = false;
    this.wheelAccumulator = 0;

    this.hostEl.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });

    window.addEventListener('wheel', this.boundWheel, { passive: false });
    window.addEventListener('touchstart', this.boundTouchStart, { passive: true });
    window.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    window.addEventListener('touchend', this.boundTouchEnd, { passive: true });
    window.addEventListener('keydown', this.boundKeyDown);

    if (this.alignTimeoutId) clearTimeout(this.alignTimeoutId);
    this.alignTimeoutId = setTimeout(() => {
      this.isAligning = false;
      this.lastAdvanceTime = Date.now();
    }, 450);
  }

  private unlock(scrollDirection?: 'up' | 'down'): void {
    if (!this.isLocked) return;
    this.isLocked = false;
    this.isAligning = false;
    this.isAdvancingLocked = false;
    if (this.alignTimeoutId) clearTimeout(this.alignTimeoutId);
    if (this.wheelIdleTimerId) clearTimeout(this.wheelIdleTimerId);
    this.releaseCooldown = true;
    this.wheelAccumulator = 0;

    window.removeEventListener('wheel', this.boundWheel);
    window.removeEventListener('touchstart', this.boundTouchStart);
    window.removeEventListener('touchmove', this.boundTouchMove);
    window.removeEventListener('touchend', this.boundTouchEnd);
    window.removeEventListener('keydown', this.boundKeyDown);

    if (scrollDirection) {
      this.snapToAdjacentSection(scrollDirection);
    }
  }

  private snapToAdjacentSection(direction: 'up' | 'down'): void {
    const host = this.hostEl.nativeElement;
    const wrapper = host.closest('section') || host.parentElement;
    if (!wrapper) return;

    const target = direction === 'down'
      ? wrapper.nextElementSibling as HTMLElement | null
      : wrapper.previousElementSibling as HTMLElement | null;

    if (target) {
      setTimeout(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Event handlers — Strict 1-gesture-1-slide enforcement     */
  /* ────────────────────────────────────────────────────────── */

  private onWheel(e: WheelEvent): void {
    if (!this.isLocked) return;

    e.preventDefault();
    e.stopPropagation();

    // Reset wheel idle timer on every wheel event
    if (this.wheelIdleTimerId) clearTimeout(this.wheelIdleTimerId);
    this.wheelIdleTimerId = setTimeout(() => {
      // Finger lifted / inertia stopped → unlock gesture for next scroll
      this.isAdvancingLocked = false;
      this.wheelAccumulator = 0;
    }, 180);

    if (this.isAligning) {
      this.wheelAccumulator = 0;
      return;
    }

    const idx = this.activeIndex();
    const last = this.totalSections - 1;
    const down = e.deltaY > 0;
    const now = Date.now();

    if ((down && idx === last) || (!down && idx === 0)) {
      if (now - this.lastAdvanceTime < this.BOUNDARY_DWELL_MS) {
        this.wheelAccumulator = 0;
        return;
      }

      this.wheelAccumulator += e.deltaY;
      if (Math.abs(this.wheelAccumulator) >= this.BOUNDARY_RELEASE_THRESHOLD) {
        this.unlock(down ? 'down' : 'up');
      }
      return;
    }

    this.wheelAccumulator += e.deltaY;

    if (Math.abs(this.wheelAccumulator) < this.WHEEL_THRESHOLD) return;

    if (now - this.lastAdvanceTime < this.ADVANCE_COOLDOWN_MS) {
      this.wheelAccumulator = 0;
      return;
    }

    const dir = this.wheelAccumulator > 0 ? 1 : -1;
    this.wheelAccumulator = 0;
    this.lastAdvanceTime = now;
    this.advance(dir);
  }

  private onTouchStart(e: TouchEvent): void {
    this.touchStartY = e.touches[0].clientY;
    this.touchHandled = false;
  }

  private onTouchMove(e: TouchEvent): void {
    if (!this.isLocked || this.touchHandled) return;

    const deltaY = this.touchStartY - e.touches[0].clientY;
    if (Math.abs(deltaY) < 50) return;

    const idx = this.activeIndex();
    const last = this.totalSections - 1;
    const down = deltaY > 0;
    const now = Date.now();

    if ((down && idx === last) || (!down && idx === 0)) {
      if (now - this.lastAdvanceTime < this.BOUNDARY_DWELL_MS) {
        return;
      }
      e.preventDefault();
      this.touchHandled = true;
      this.unlock(down ? 'down' : 'up');
      return;
    }

    e.preventDefault();
    if (this.isAligning) return;
    this.touchHandled = true;
    this.advance(down ? 1 : -1);
  }

  private onTouchEnd(): void {
    this.touchHandled = false;
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.isLocked) return;
    const idx = this.activeIndex();
    const last = this.totalSections - 1;
    const now = Date.now();

    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
      e.preventDefault();
      if (idx === last) {
        if (now - this.lastAdvanceTime >= this.BOUNDARY_DWELL_MS) {
          this.unlock('down');
        }
        return;
      }
      this.advance(1);
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      if (idx === 0) {
        if (now - this.lastAdvanceTime >= this.BOUNDARY_DWELL_MS) {
          this.unlock('up');
        }
        return;
      }
      this.advance(-1);
    }
  }

  private advance(delta: number): void {
    const last = this.totalSections - 1;
    const next = Math.max(0, Math.min(last, this.activeIndex() + delta));
    if (next !== this.activeIndex()) {
      this.zone.run(() => {
        this.direction.set(delta > 0 ? 'down' : 'up');
        this.activeIndex.set(next);
      });
      this.lastAdvanceTime = Date.now();
    }
  }

  /* ────────────────────────────────────────────────────────── */
  /*  Progress                                                  */
  /* ────────────────────────────────────────────────────────── */

  protected get progressPercent(): number {
    const max = this.totalSections - 1;
    return max > 0 ? (this.activeIndex() / max) * 100 : 0;
  }
}

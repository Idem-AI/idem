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
import { PromoTextComponent } from '@idem/shared-promotions/angular';

interface Stage {
  /** Stable, non-localized path fragment shown in the mock browser bar. */
  readonly path: string;
  /** One or two words naming the step (mobile kicker). */
  readonly label: string;
  readonly title: string;
  readonly caption: string;
  /** What the step leaves in hand, concretely. */
  readonly points: readonly string[];
  /** Product name and price, the only place a product is named. */
  readonly price: string;
  /** Article des promotions et où lire le prix sur l'API (le montant de `price` n'est qu'un secours). */
  readonly item?: string;
  readonly xaf?: number;
  readonly source?: string;
  readonly ctaLabel: string;
  readonly images: readonly string[];
  readonly imageAlt: string;
  /** Screenshot of the IDEM page the film plays in, when a slide is a .mp4. */
  readonly filmPage?: string;
}

/** Auto-advance delay for the screenshot swiper of the step being read. */
const SWIPER_INTERVAL_MS = 5200;
/** Volume of the step film: present, never louder than the page reading it. */
const FILM_VOLUME = 0.4;
/** Second the step film opens on, the first time only. */
const FILM_FIRST_START = 40;
/** Gestures that count as user activation for sound. */
const GESTURES = ['pointerdown', 'keydown', 'touchstart'] as const;

/**
 * Un cas concret, raconté étape par étape : Turo, plateforme agricole lancée
 * avec IDEM. Les captures sont celles du vrai projet Turo (base de dev), les
 * mêmes que le film du héros.
 *
 * La page défile nativement de bout en bout : rien n'intercepte la molette,
 * rien n'épingle la section. Sur grand écran, la liste des étapes reste en
 * place (`position: sticky`) et ouvre l'étape dont l'écran croise le milieu de
 * la fenêtre ; les écrans passent à côté, et le haut du suivant dépasse déjà
 * sous celui qu'on lit. L'étape active est l'écran qui couvre le milieu de la
 * fenêtre, relu au défilement (une image d'animation au plus) ; sur un écran
 * bas, l'index défile de lui-même pour garder cette étape visible.
 *
 * Le mouvement des écrans (arrivée, sortie) est confié au navigateur
 * (`animation-timeline: view()`), sans JavaScript ; là où ce n'est pas pris en
 * charge, les écrans sont simplement posés.
 */
@Component({
  selector: 'app-journey',
  imports: [PromoTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './journey.html',
  styleUrl: './journey.css',
})
export class JourneyComponent implements AfterViewInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly zone = inject(NgZone);

  /** One per step, carrying its data-index. */
  private readonly shotRefs = viewChildren<ElementRef<HTMLElement>>('shot');
  /** The steps index, which follows the step being read when it is taller than the screen. */
  private readonly stepsRef = viewChild<ElementRef<HTMLElement>>('steps');

  /** The step whose screen crosses the middle of the viewport. */
  protected readonly activeIndex = signal(0);
  /** Direction of the last screenshot change, for a direction-aware swipe. */
  protected readonly swipeDir = signal<1 | -1>(1);
  protected readonly imageIndices = signal<readonly number[]>([]);

  /** The step film: its state, shown by its own play and sound buttons. */
  protected readonly filmPaused = signal(true);
  protected readonly filmMuted = signal(false);
  private filmPausedByUser = false;
  private filmMutedByUser = false;
  protected readonly playLabel = $localize`:@@journey.turo.film.play:Play the video`;
  protected readonly pauseLabel = $localize`:@@journey.turo.film.pause:Pause the video`;
  protected readonly soundOnLabel = $localize`:@@journey.turo.film.soundOn:Turn the sound on`;
  protected readonly soundOffLabel = $localize`:@@journey.turo.film.soundOff:Turn the sound off`;

  protected readonly createProjectUrl = `${environment.services.dashboard.url}/create-project`;

  /* One business, start to finish: what IDEM produced for Turo, in the order
     it was made. Every screenshot is a final render, never a settings screen. */
  protected readonly stages: readonly Stage[] = [
    {
      path: 'marque',
      label: $localize`:@@journey.turo.brand.label:Identity`,
      title: $localize`:@@journey.turo.brand.title:Turo gets a brand of its own`,
      caption: $localize`:@@journey.turo.brand.caption:She gets her logo, her palette, her typefaces and a 20-page brand book: how to place the mark, the art direction, the rules for photos, ready-made posts and banners. From the app to the market stall, she shows up with one look.`,
      points: [
        $localize`:@@journey.turo.brand.p1:The logo in 7 versions: light, dark, monochrome, icon`,
        $localize`:@@journey.turo.brand.p2:A palette of 5 colours with their RGB and CMYK values`,
        $localize`:@@journey.turo.brand.p3:A 20-page brand book, ready to download`,
      ],
      price: $localize`:@@journey.name.price:Logo and brand guidelines · 1,500 F`, item: 'deliverable.logo_brand', xaf: 1500,
      ctaLabel: $localize`:@@journey.name.cta:Create my brand`,
      images: [
        'assets/images/journey/turo/01-marque-charte.webp',
        'assets/images/journey/turo/01-marque-palette.webp',
        'assets/images/journey/turo/01-marque-publications.webp',
      ],
      imageAlt: $localize`:@@journey.turo.brand.alt:The Turo brand book in IDEM: cover, colour palette and social posts`,
    },
    {
      path: 'business-plan',
      label: $localize`:@@journey.turo.plan.label:Business plan`,
      title: $localize`:@@journey.turo.plan.title:A business plan a bank can read`,
      caption: $localize`:@@journey.turo.plan.caption:She gets nine chapters written from her project: the smallholder market in Cameroon, her three tools and their prices, how cooperatives bring her farmers, her funding plan and three years of results. The charts come from her forecast, every figure follows SYSCOHADA, in F CFA.`,
      points: [
        $localize`:@@journey.turo.plan.p1:Market, offer, sales plan, funding`,
        $localize`:@@journey.turo.plan.p2:Charts built from the project's own figures`,
        $localize`:@@journey.turo.plan.p3:Download as PDF, edit by writing what to change`,
      ],
      price: $localize`:@@journey.plan.price:Business plan · 2,000 F`, item: 'deliverable.business_plan', xaf: 2000,
      ctaLabel: $localize`:@@journey.plan.cta:Write my plan`,
      images: [
        'assets/images/journey/turo/02-plan-couverture.webp',
        'assets/images/journey/turo/02-plan-graphique.webp',
        'assets/images/journey/turo/02-plan-synthese.webp',
      ],
      imageAlt: $localize`:@@journey.turo.plan.alt:Turo's business plan: cover, pricing chart and financial summary`,
    },
    {
      path: 'finances',
      label: $localize`:@@journey.turo.numbers.label:Finances`,
      title: $localize`:@@journey.turo.numbers.title:Numbers that hold up`,
      caption: $localize`:@@journey.turo.numbers.caption:She sees her sales, her costs, her cash and the year she turns a profit, over three years: 65 million F CFA of sales in the first year, a launch-year loss covered by her funding, profit from 2027. Her forecast updates as soon as she enters real figures.`,
      points: [
        $localize`:@@journey.turo.numbers.p1:Income statement, cash flow and balance sheet`,
        $localize`:@@journey.turo.numbers.p2:Break-even point and ratios computed for you`,
        $localize`:@@journey.turo.numbers.p3:The tables a bank asks for, ready to print`,
      ],
      price: $localize`:@@journey.numbers.price:3-year forecast · 1,000 F`, item: 'deliverable.financial_forecast', xaf: 1000,
      ctaLabel: $localize`:@@journey.turo.numbers.cta:Build my forecast`,
      images: ['assets/images/journey/turo/03-finances-apercu.webp'],
      imageAlt: $localize`:@@journey.turo.numbers.alt:Turo's finances in IDEM: sales, result, cash at year end and monthly sales`,
    },
    {
      path: 'pitch-deck',
      label: $localize`:@@journey.turo.pitch.label:Fundraising`,
      title: $localize`:@@journey.turo.pitch.title:A pitch deck ready for investors`,
      caption: $localize`:@@journey.turo.pitch.caption:She has eleven slides that tell her problem, her product, her market and her ask, in her colours and with her own figures: 1.2 million smallholders targeted first, the size of the market, the cost of serving each farmer. She presents them from IDEM or downloads them.`,
      points: [
        $localize`:@@journey.turo.pitch.p1:Problem, solution, market, traction, team`,
        $localize`:@@journey.turo.pitch.p2:The market sized in charts`,
        $localize`:@@journey.turo.pitch.p3:PDF export or live presentation`,
      ],
      price: $localize`:@@journey.funding.price:Pitch deck · 1,000 F`, item: 'deliverable.pitch_deck', xaf: 1000,
      ctaLabel: $localize`:@@journey.turo.pitch.cta:Prepare my pitch`,
      images: [
        'assets/images/journey/turo/04-pitch-couverture.webp',
        'assets/images/journey/turo/04-pitch-marche.webp',
        'assets/images/journey/turo/04-pitch-traction.webp',
      ],
      imageAlt: $localize`:@@journey.turo.pitch.alt:Turo's pitch deck: cover, market size and pilot results`,
    },
    {
      path: 'visuels',
      label: $localize`:@@journey.turo.visuals.label:Communication`,
      title: $localize`:@@journey.turo.visuals.title:Visuals that go out every week`,
      caption: $localize`:@@journey.turo.visuals.caption:She gets posters, posts and banners in her colours, each from a single request. One click opens a visual full size, offers it in other formats (square, story, banner, printable poster) and copies its text, ready for her to post on LinkedIn or X.`,
      points: [
        $localize`:@@journey.turo.visuals.p1:Visuals in the brand's colours and fonts`,
        $localize`:@@journey.turo.visuals.p2:Every format from a single visual`,
        $localize`:@@journey.turo.visuals.p3:A publishing calendar, approval from WhatsApp`,
      ],
      price: $localize`:@@journey.clients.price:Communication · 100 F a visual`, item: 'communication.flyer', xaf: 100,
      ctaLabel: $localize`:@@journey.turo.visuals.cta:Create a visual`,
      images: [
        'assets/images/journey/turo/05-visuels-liste.webp',
        'assets/images/journey/turo/05-visuels-apercu.webp',
      ],
      imageAlt: $localize`:@@journey.turo.visuals.alt:Turo's visuals in IDEM, and one of them opened full size`,
    },
    {
      path: 'video',
      label: $localize`:@@journey.turo.video.label:Video`,
      title: $localize`:@@journey.turo.video.title:A promo film, voice and music included`,
      caption: $localize`:@@journey.turo.video.caption:She gets a 90-second motion design film written from her project: a damaged leaf photographed at 8:00, a diagnosis at 8:02. Voice-over, royalty-free music, a version for Stories, Instagram, Facebook and YouTube. She changes any scene by writing what to change.`,
      points: [
        $localize`:@@journey.turo.video.p1:Motion design in the brand's colours`,
        $localize`:@@journey.turo.video.p2:Vertical, square and landscape versions`,
        $localize`:@@journey.turo.video.p3:An MP4 ready to post`,
      ],
      price: $localize`:@@journey.turo.video.price:Motion design video, voice and music included`, item: 'communication.motion_video',
      ctaLabel: $localize`:@@journey.turo.video.cta:Make my video`,
      images: ['assets/videos/turo-motion.mp4'],
      filmPage: 'assets/images/journey/turo/06-video-page.webp',
      imageAlt: $localize`:@@journey.turo.video.alt:Turo's promo video playing in IDEM's video page`,
    },
    {
      path: 'site',
      label: $localize`:@@journey.turo.site.label:Website`,
      title: $localize`:@@journey.turo.site.title:A website that builds itself`,
      caption: $localize`:@@journey.turo.site.caption:iCode writes her whole site from her business plan: the offer, the Farmer Pro subscription, the marketplace, the cooperatives, contact by WhatsApp. She changes it by asking in a sentence, or opens the code: nothing is locked.`,
      points: [
        $localize`:@@journey.turo.site.p1:Pages, texts and images generated`,
        $localize`:@@journey.turo.site.p2:Edited in conversation or in the code`,
        $localize`:@@journey.turo.site.p3:Built for phones and slow connections`,
      ],
      price: $localize`:@@journey.site.price:iCode · free to generate`,
      ctaLabel: $localize`:@@journey.site.cta:Discover iCode`,
      images: [
        'assets/images/journey/turo/07-site-icode.webp',
        'assets/images/journey/turo/07-site-accueil.webp',
      ],
      imageAlt: $localize`:@@journey.turo.site.alt:The Turo website in the iCode editor, and its home page`,
    },
    {
      path: 'en-ligne',
      label: $localize`:@@journey.turo.online.label:Online`,
      title: $localize`:@@journey.turo.online.title:Online in one click`,
      caption: $localize`:@@journey.turo.online.caption:She clicks Publish. IDEM builds her site, sends it to servers in Africa and gives her its address with its security certificate, in a few minutes. She can connect her own domain name afterwards, without touching a server.`,
      points: [
        $localize`:@@journey.turo.online.p1:Hosted in Africa, HTTPS included`,
        $localize`:@@journey.turo.online.p2:Every change published again in one click`,
        $localize`:@@journey.turo.online.p3:Your own domain name with iDomain`,
      ],
      price: $localize`:@@journey.online.price:iDeploy · always online from 10 F a day`, item: 'ideploy.meter', xaf: 10, source: 'meter:vitrine',
      ctaLabel: $localize`:@@journey.turo.online.cta:Put my site online`,
      images: [
        'assets/images/journey/turo/08-ligne-modale.webp',
        'assets/images/journey/turo/08-ligne-navigateur.webp',
      ],
      imageAlt: $localize`:@@journey.turo.online.alt:The Turo website put online from iCode, then open at its address`,
    },
  ];

  private scrollRaf = 0;
  private followTimer: ReturnType<typeof setTimeout> | null = null;
  private reduceMotion = false;
  private motionQuery?: MediaQueryList;

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

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reduceMotion = this.motionQuery.matches;
    this.motionQuery.addEventListener('change', this.onMotionChange);

    this.zone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true });
      window.addEventListener('resize', this.onScroll, { passive: true });
    });
    this.readActive();

    this.startSwiper();
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('scroll', this.onScroll);
      window.removeEventListener('resize', this.onScroll);
      cancelAnimationFrame(this.scrollRaf);
    }
    if (this.followTimer) clearTimeout(this.followTimer);
    this.motionQuery?.removeEventListener('change', this.onMotionChange);
    this.stopSwiper();
  }

  private readonly onScroll = () => {
    if (this.scrollRaf) return;
    this.scrollRaf = requestAnimationFrame(() => {
      this.scrollRaf = 0;
      this.readActive();
    });
  };

  /**
   * The step being read: the screen that covers the middle of the viewport
   * (screens touch each other, so one always does inside the section). Eight
   * rectangles per frame at most, read on scroll only.
   */
  private readActive(): void {
    const middle = window.innerHeight / 2;
    let index = -1;
    for (const ref of this.shotRefs()) {
      const r = ref.nativeElement.getBoundingClientRect();
      if (r.top <= middle && r.bottom > middle) index = Number(ref.nativeElement.dataset['index']);
    }
    if (index < 0 || index === this.activeIndex()) return;
    this.zone.run(() => this.activeIndex.set(index));
    this.followList(index);
    this.syncFilms();
  }

  /**
   * On a short screen the index is taller than the space it has: it scrolls by
   * itself so the step being read, and the one before it, stay in view. Done
   * once the step has finished opening, so its height is the final one.
   */
  private followList(index: number): void {
    const list = this.stepsRef()?.nativeElement;
    if (!list || list.scrollHeight <= list.clientHeight) return;
    if (this.followTimer) clearTimeout(this.followTimer);
    this.followTimer = setTimeout(() => {
      const items = list.querySelectorAll<HTMLElement>('.jn-step');
      const before = items[Math.max(0, index - 1)];
      list.scrollTo({ top: index === 0 ? 0 : before.offsetTop, behavior: this.reduceMotion ? 'auto' : 'smooth' });
    }, 260);
  }

  /** The AV1 + Opus version next to an .mp4 film. */
  protected webm(src: string): string {
    return src.replace(/\.mp4$/, '.webm');
  }

  protected isFilm(src: string): boolean {
    return src.endsWith('.mp4');
  }

  /**
   * Plays the film of the step being read when its slide is showing, pauses
   * every other one: nothing downloads or decodes off screen.
   */
  private syncFilms(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const active = this.activeIndex();
    document.querySelectorAll<HTMLVideoElement>('video.jn-film').forEach((film) => {
      const stage = Number(film.dataset['stage']);
      const visible = stage === active && this.imageIndex(stage) === Number(film.dataset['shot']);
      if (visible && film.paused && !this.filmPausedByUser) this.playFilm(film);
      else if (!visible && !film.paused) {
        film.pause();
        this.filmPaused.set(true);
      }
    });
  }

  /**
   * Plays the film with its sound at 40 %. A browser that refuses sound
   * without a gesture gets the film muted, and the sound comes back on the
   * visitor's first click or key press, unless they cut it themselves.
   */
  private playFilm(film: HTMLVideoElement): void {
    film.volume = FILM_VOLUME;
    film.muted = this.filmMutedByUser;
    // The first time, the film opens on its strongest part (40 s); the loop
    // then takes it back to the beginning.
    if (!film.dataset['started']) {
      film.dataset['started'] = '1';
      film.currentTime = FILM_FIRST_START;
      if (film.readyState < 1) {
        film.addEventListener('loadedmetadata', () => (film.currentTime = FILM_FIRST_START), { once: true });
      }
    }
    film
      .play()
      .then(() => this.zone.run(() => this.reflect(film)))
      .catch(() => {
        if (film.muted) return;
        film.muted = true;
        void film.play().then(() => this.zone.run(() => this.reflect(film))).catch(() => undefined);
        this.armSoundGesture(film);
      });
  }

  private reflect(film: HTMLVideoElement): void {
    this.filmPaused.set(film.paused);
    this.filmMuted.set(film.muted);
  }

  private armSoundGesture(film: HTMLVideoElement): void {
    const unmute = () => {
      for (const type of GESTURES) window.removeEventListener(type, unmute);
      if (this.filmMutedByUser) return;
      film.muted = false;
      film.volume = FILM_VOLUME;
      this.zone.run(() => this.reflect(film));
    };
    for (const type of GESTURES) window.addEventListener(type, unmute, { passive: true });
  }

  protected toggleFilm(event: Event): void {
    event.stopPropagation();
    const film = (event.currentTarget as HTMLElement).closest('.jn-pic')?.querySelector('video');
    if (!film) return;
    if (film.paused) {
      this.filmPausedByUser = false;
      this.playFilm(film);
    } else {
      this.filmPausedByUser = true;
      film.pause();
      this.reflect(film);
    }
  }

  protected toggleSound(event: Event): void {
    event.stopPropagation();
    const film = (event.currentTarget as HTMLElement).closest('.jn-pic')?.querySelector('video');
    if (!film) return;
    film.muted = !film.muted;
    film.volume = FILM_VOLUME;
    this.filmMutedByUser = film.muted;
    this.reflect(film);
  }

  /** "01", "02"… : the steps are a sequence, their order is information. */
  protected number(index: number): string {
    return String(index + 1).padStart(2, '0');
  }

  protected shotLabel(shot: number, total: number): string {
    return $localize`:@@journey.shot.dot:Screenshot ${shot + 1}:index: of ${total}:total:`;
  }

  /** From the list: bring that step's screen to the middle of the viewport. */
  protected goTo(index: number): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const el = this.shotRefs().find((ref) => Number(ref.nativeElement.dataset['index']) === index)?.nativeElement;
    el?.scrollIntoView({ behavior: this.reduceMotion ? 'auto' : 'smooth', block: 'center' });
  }

  /* ── Screenshot swiper ───────────────────────────────────────── */

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
    this.syncFilms();
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
        const stageIndex = this.activeIndex();
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

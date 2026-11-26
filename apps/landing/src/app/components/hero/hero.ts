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
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';

interface Chapter {
  readonly id: string;
  /** Second of the film where the chapter starts. */
  readonly start: number;
  readonly icon: string;
  readonly label: string;
}

/** The film is cut on these seconds (see scratch/hero-film, the HyperFrames source). */
const FILM_LENGTH = 33;

/** Gestures that count as user activation for the autoplay policy. */
const GESTURES = ['pointerdown', 'keydown', 'touchstart'] as const;

/**
 * Le héros de l'accueil.
 *
 * Le film de démonstration démarre toujours seul, sans son (demandé), et se met
 * en pause hors écran ; le bouton pause reste à portée. Deux sources de moins
 * de 700 Ko : AV1 en 720p là où il se lit, H.264 en 480p ailleurs.
 *
 * L'arc du bas et son bouton ne sont plus ici : c'est `app-dock`, rendu sur
 * toutes les pages par le gabarit de l'application.
 */
@Component({
  selector: 'app-hero',
  imports: [],
  templateUrl: './hero.html',
  styleUrl: './hero.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Hero implements AfterViewInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly zone = inject(NgZone);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly filmRef = viewChild.required<ElementRef<HTMLVideoElement>>('film');

  protected readonly dashboardUrl = environment.services.dashboard.url;

  protected readonly chapters: readonly Chapter[] = [
    { id: 'brand', start: 0, icon: 'pi-palette', label: $localize`:@@hero.demo.brand:Brand guidelines` },
    { id: 'plan', start: 4.6, icon: 'pi-chart-bar', label: $localize`:@@hero.demo.plan:Business plan` },
    { id: 'motion', start: 9.6, icon: 'pi-video', label: $localize`:@@hero.demo.motion:Promo video` },
    { id: 'visuals', start: 16.4, icon: 'pi-images', label: $localize`:@@hero.demo.visuals:Social visuals` },
    { id: 'site', start: 20.9, icon: 'pi-desktop', label: $localize`:@@hero.demo.site:Website` },
    { id: 'online', start: 24.4, icon: 'pi-globe', label: $localize`:@@hero.demo.online:Online in one click` },
  ];

  protected readonly playLabel = $localize`:@@hero.demo.play:Play the demo`;
  protected readonly pauseLabel = $localize`:@@hero.demo.pause:Pause the demo`;

  protected readonly active = signal(0);
  protected readonly playing = signal(false);

  /** The visitor paused the film: scrolling back to it does not restart it. */
  private pausedByUser = false;
  private inView = true;
  private rafId = 0;
  private filmObserver?: IntersectionObserver;


  private readonly tick = () => {
    this.rafId = requestAnimationFrame(this.tick);
    this.paintProgress();
  };

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const film = this.filmRef().nativeElement;

    // The film always starts on its own, muted (browsers allow muted autoplay).
    // The browser picks its source: AV1 where it decodes it, H.264 otherwise,
    // both under 700 KB.
    // Muted as a property, not only as an attribute: a video element rebuilt
    // by script does not inherit `muted` from the attribute, and an unmuted
    // video is refused autoplay.
    film.defaultMuted = true;
    film.muted = true;
    film.playsInline = true;
    film.setAttribute('muted', '');

    this.zone.runOutsideAngular(() => {
      film.addEventListener('play', this.onPlay);
      // The sidebar follows the film's own clock: every jump, loop and
      // buffering stop repaints it, not only the frames while playing.
      film.addEventListener('timeupdate', this.onTime);
      film.addEventListener('seeked', this.onTime);
      // The film can start before this code runs (`autoplay` in the
      // prerendered page): the `play` event is then already gone.
      if (!film.paused) this.onPlay();
      film.addEventListener('pause', this.onPause);
      // Each moment the film becomes playable is another chance to start it.
      film.addEventListener('loadedmetadata', this.tryPlay);
      film.addEventListener('canplay', this.tryPlay);
      document.addEventListener('visibilitychange', this.tryPlay);

      // Only plays while on screen: no decoding for a film nobody sees.
      this.filmObserver = new IntersectionObserver(
        ([entry]) => {
          this.inView = entry.isIntersecting;
          if (!this.inView) film.pause();
          else this.tryPlay();
        },
        { threshold: 0.05 },
      );
      this.filmObserver.observe(film);

    });

    // Starts right away (330 KB, muted): waiting for the page's `load` event
    // left it still whenever a request hung.
    this.startFilm();
  }

  /** Set once the page has loaded: before that, nothing may start the download. */
  private filmReady = false;

  private readonly startFilm = () => {
    this.filmReady = true;
    this.tryPlay();
  };

  ngOnDestroy(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const film = this.filmRef().nativeElement;
    film.removeEventListener('play', this.onPlay);
    film.removeEventListener('timeupdate', this.onTime);
    film.removeEventListener('seeked', this.onTime);
    film.removeEventListener('pause', this.onPause);
    window.removeEventListener('load', this.startFilm);
    film.removeEventListener('loadedmetadata', this.tryPlay);
    film.removeEventListener('canplay', this.tryPlay);
    document.removeEventListener('visibilitychange', this.tryPlay);
    this.disarmGesture();
    this.filmObserver?.disconnect();
    cancelAnimationFrame(this.rafId);
  }

  /** Jump to a chapter; the film plays from there. */
  protected seek(index: number): void {
    const film = this.filmRef().nativeElement;
    film.currentTime = this.chapters[index].start + 0.01;
    this.active.set(index);
    this.pausedByUser = false;
    void film.play().catch(() => undefined);
  }

  protected togglePlay(): void {
    const film = this.filmRef().nativeElement;
    if (film.paused) {
      this.pausedByUser = false;
      if (film.preload !== 'auto') film.preload = 'auto';
      void film.play().catch(() => undefined);
    } else {
      this.pausedByUser = true;
      film.pause();
    }
  }

  /**
   * Starts the film unless the visitor paused it or it is off screen. A
   * browser that still refuses (strict autoplay settings) gets it started on
   * the visitor's first gesture anywhere on the page.
   */
  private readonly tryPlay = () => {
    const film = this.filmRef().nativeElement;
    if (!this.filmReady || this.pausedByUser || !this.inView || !film.paused || document.hidden) return;
    film.muted = true;
    film.play().catch(() => this.armGesture());
  };

  private gestureArmed = false;
  private readonly onGesture = () => {
    this.disarmGesture();
    this.tryPlay();
  };

  private armGesture(): void {
    if (this.gestureArmed) return;
    this.gestureArmed = true;
    for (const type of GESTURES) window.addEventListener(type, this.onGesture, { passive: true });
  }

  private disarmGesture(): void {
    if (!this.gestureArmed) return;
    this.gestureArmed = false;
    for (const type of GESTURES) window.removeEventListener(type, this.onGesture);
  }

  private readonly onTime = () => this.paintProgress();

  private readonly onPlay = () => {
    this.zone.run(() => this.playing.set(true));
    cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(this.tick);
  };

  private readonly onPause = () => {
    // A pause that is not the visitor's (off screen) keeps the "playing" look off too.
    this.zone.run(() => this.playing.set(false));
    cancelAnimationFrame(this.rafId);
    this.paintProgress();
  };

  /** Active chapter and its progress, written as a custom property: no change detection per frame. */
  private paintProgress(): void {
    const t = this.filmRef().nativeElement.currentTime;
    let index = 0;
    for (let i = 0; i < this.chapters.length; i++) if (t >= this.chapters[i].start) index = i;
    const start = this.chapters[index].start;
    const end = this.chapters[index + 1]?.start ?? FILM_LENGTH;
    const progress = Math.min(1, Math.max(0, (t - start) / (end - start)));
    this.host.nativeElement.style.setProperty('--demo-progress', progress.toFixed(3));
    if (index !== this.active()) this.zone.run(() => this.active.set(index));
  }
}

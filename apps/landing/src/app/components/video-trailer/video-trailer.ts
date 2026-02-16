import {
  Component,
  signal,
  inject,
  PLATFORM_ID,
  viewChild,
  ElementRef,
  effect,
  OnDestroy,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-video-trailer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './video-trailer.html',
  styleUrl: './video-trailer.css',
})
export class VideoTrailer implements OnDestroy {
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly sanitizer = inject(DomSanitizer);
  private readonly platformId = inject(PLATFORM_ID);

  protected readonly sectionRef = viewChild<ElementRef<HTMLElement>>('videoSection');
  protected youtubeUrl: SafeResourceUrl;
  protected showVideo = signal(false);
  private observer?: IntersectionObserver;
  private autoplayTriggered = false;

  protected readonly videoPoster = 'assets/images/home/brand.webp';

  constructor() {
    const videoId = 'M-8n6dpC5o4';
    const url = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&rel=0&enablejsapi=1`;
    this.youtubeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);

    effect(() => {
      const section = this.sectionRef();
      console.log('[VideoTrailer] sectionRef changed:', section);
      if (section) {
        this.setupIntersectionObserver();
      }
    });
  }

  private setupIntersectionObserver(): void {
    console.log('[VideoTrailer] setupIntersectionObserver called');
    if (!isPlatformBrowser(this.platformId)) {
      console.log('[VideoTrailer] Not in browser, skipping');
      return;
    }
    if (this.observer) {
      console.log('[VideoTrailer] Observer already exists, skipping');
      return;
    }

    const section = this.sectionRef()?.nativeElement;
    if (!section) {
      console.log('[VideoTrailer] Section not found');
      return;
    }

    console.log('[VideoTrailer] Creating IntersectionObserver');
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          console.log('[VideoTrailer] Intersection detected:', {
            isIntersecting: entry.isIntersecting,
            intersectionRatio: entry.intersectionRatio,
            showVideo: this.showVideo(),
            autoplayTriggered: this.autoplayTriggered,
          });
          if (entry.isIntersecting && !this.autoplayTriggered) {
            console.log('[VideoTrailer] Playing video automatically');
            this.autoplayTriggered = true;
            this.playVideo();
          }
        });
      },
      {
        threshold: 0.1,
      },
    );

    this.observer.observe(section);
    console.log('[VideoTrailer] Observer attached to section');
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  protected playVideo(): void {
    this.showVideo.set(true);
  }
}

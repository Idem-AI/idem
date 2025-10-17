import {
  Component,
  signal,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnInit,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SeoService } from '../../../../shared/services/seo.service';

@Component({
  selector: 'app-video-trailer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './video-trailer.html',
  styleUrl: './video-trailer.css',
})
export class VideoTrailer implements OnInit, AfterViewInit {
  // Angular-initialized properties
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly seoService = inject(SeoService);

  @ViewChild('videoPlayer', { static: false }) videoPlayer!: ElementRef<HTMLVideoElement>;

  protected readonly isPlaying = signal(false);
  protected readonly isLoading = signal(true);
  protected readonly currentTime = signal(0);
  protected readonly duration = signal(0);
  protected readonly volume = signal(1);
  protected readonly isMuted = signal(false);

  ngOnInit(): void {
    this.setupSeoForVideoTrailer();
  }

  ngAfterViewInit(): void {
    const video = this.videoPlayer.nativeElement;

    video.addEventListener('loadedmetadata', () => {
      this.duration.set(video.duration);
      this.isLoading.set(false);
    });

    video.addEventListener('timeupdate', () => {
      this.currentTime.set(video.currentTime);
    });

    video.addEventListener('play', () => {
      this.isPlaying.set(true);
    });

    video.addEventListener('pause', () => {
      this.isPlaying.set(false);
    });

    video.addEventListener('ended', () => {
      this.isPlaying.set(false);
      this.currentTime.set(0);
    });
  }

  protected togglePlay(): void {
    const video = this.videoPlayer.nativeElement;

    if (this.isPlaying()) {
      video.pause();
    } else {
      video.play();
    }
  }

  protected toggleMute(): void {
    const video = this.videoPlayer.nativeElement;
    const newMutedState = !this.isMuted();

    video.muted = newMutedState;
    this.isMuted.set(newMutedState);
  }

  protected onVolumeChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const newVolume = parseFloat(target.value);

    this.volume.set(newVolume);
    this.videoPlayer.nativeElement.volume = newVolume;

    if (newVolume === 0) {
      this.isMuted.set(true);
      this.videoPlayer.nativeElement.muted = true;
    } else if (this.isMuted()) {
      this.isMuted.set(false);
      this.videoPlayer.nativeElement.muted = false;
    }
  }

  protected onSeek(event: Event): void {
    const target = event.target as HTMLInputElement;
    const newTime = parseFloat(target.value);

    this.videoPlayer.nativeElement.currentTime = newTime;
    this.currentTime.set(newTime);
  }

  protected formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  protected getProgressPercentage(): number {
    const duration = this.duration();
    const current = this.currentTime();
    return duration > 0 ? (current / duration) * 100 : 0;
  }

  private setupSeoForVideoTrailer(): void {
    // Add structured data for video trailer
    const videoStructuredData = {
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: 'Idem Platform Demo',
      description:
        "Interactive demo showcasing Idem's AI-powered brand creation and deployment capabilities",
      thumbnailUrl: `${this.seoService.domain}/assets/video/demo-thumbnail.jpg`,
      uploadDate: new Date().toISOString(),
      duration: 'PT3M45S',
      contentUrl: `${this.seoService.domain}/assets/video/idem-demo.mp4`,
      embedUrl: `${this.seoService.domain}/video-demo`,
      publisher: {
        '@type': 'Organization',
        name: 'Idem',
        logo: {
          '@type': 'ImageObject',
          url: `${this.seoService.domain}/assets/images/logo.png`,
        },
      },
      interactionStatistic: {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/WatchAction',
        userInteractionCount: 0,
      },
    };

    // Add structured data to page if not already present
    if (this.isBrowser() && !document.querySelector('script[data-video-trailer-structured-data]')) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-video-trailer-structured-data', 'true');
      script.textContent = JSON.stringify(videoStructuredData);
      document.head.appendChild(script);
    }
  }
}

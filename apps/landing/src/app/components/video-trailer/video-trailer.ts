import {
  Component,
  signal,
  inject,
  PLATFORM_ID,
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
export class VideoTrailer {
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly sanitizer = inject(DomSanitizer);

  protected youtubeUrl: SafeResourceUrl;
  protected showVideo = signal(false);

  protected readonly videoPoster =
    'assets/images/home/brand.webp';

  constructor() {
    const videoId = 'M-8n6dpC5o4';
    const url = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    this.youtubeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  protected playVideo(): void {
    this.showVideo.set(true);
  }
}


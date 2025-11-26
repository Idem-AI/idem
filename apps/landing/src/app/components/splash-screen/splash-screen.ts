import { Component, OnInit, inject, signal, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-splash-screen',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './splash-screen.html',
  styleUrl: './splash-screen.css',
})
export class SplashScreenComponent implements OnInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  protected readonly loading = signal(true);
  protected readonly progress = signal(0);
  protected readonly animationComplete = signal(false);

  private progressInterval?: number;

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      // In SSR context, skip splash screen
      this.loading.set(false);
      return;
    }

    this.startProgressAnimation();
  }

  private startProgressAnimation(): void {
    this.progress.set(0);

    // Animation de progression simple
    this.progressInterval = window.setInterval(() => {
      const currentProgress = this.progress();
      if (currentProgress < 100) {
        this.progress.set(currentProgress + 5);
      } else {
        this.clearProgressInterval();
      }
    }, 50);
  }

  private clearProgressInterval(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = undefined;
    }
  }

  ngOnDestroy(): void {
    this.clearProgressInterval();
  }
}

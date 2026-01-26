import { Component, OnInit, OnDestroy, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [],
  templateUrl: './hero-section.html',
  styleUrl: './hero-section.css',
})
export class HeroSection implements OnInit, OnDestroy {
  protected dashboardUrl = environment.services.dashboard.url;
  private readonly platformId = inject(PLATFORM_ID);

  // Countdown properties as signals
  protected days = signal('00');
  protected hours = signal('00');
  protected minutes = signal('00');
  protected seconds = signal('00');

  private countdownInterval: ReturnType<typeof setInterval> | undefined;
  // Date cible : 14 février 2026 à 23:59:59 (supposé pour l'année prochaine si passé, ou cette année)
  // On fixe à 2026 selon la date actuelle du user (Jan 2026)
  private targetDate = new Date('2026-02-14T23:59:59');

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.updateCountdown();
      this.countdownInterval = setInterval(() => {
        this.updateCountdown();
      }, 1000);
    }
  }

  ngOnDestroy() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  private updateCountdown() {
    const now = new Date().getTime();
    const distance = this.targetDate.getTime() - now;

    if (distance < 0) {
      this.days.set('00');
      this.hours.set('00');
      this.minutes.set('00');
      this.seconds.set('00');
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
      }
      return;
    }

    const d = Math.floor(distance / (1000 * 60 * 60 * 24));
    const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((distance % (1000 * 60)) / 1000);

    this.days.set(d < 10 ? '0' + d : d.toString());
    this.hours.set(h < 10 ? '0' + h : h.toString());
    this.minutes.set(m < 10 ? '0' + m : m.toString());
    this.seconds.set(s < 10 ? '0' + s : s.toString());
  }
}

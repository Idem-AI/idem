import {
  Component,
  HostBinding,
  ElementRef,
  inject,
  signal,
  AfterViewInit,
  OnDestroy,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-cta',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cta.html',
  styleUrl: './cta.css',
})
export class Cta implements AfterViewInit, OnDestroy {
  // Angular-initialized properties
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly elementRef = inject(ElementRef);
  protected readonly dashboardUrl = environment.services.dashboard.url;
  // Apply animation class binding
  @HostBinding('class.animate-in')
  protected readonly animateIn = signal(false);

  // State properties
  protected observer: IntersectionObserver | null = null;

  ngAfterViewInit(): void {
    if (this.isBrowser()) {
      this.setupIntersectionObserver();
      this.initHoverEffects();
    }
  }

  ngOnDestroy(): void {
    this.destroyIntersectionObserver();
  }

  private initHoverEffects(): void {
    // Add any additional hover effect initializations if needed
  }

  private setupIntersectionObserver(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Trigger animation when component becomes visible
            this.animateIn.set(true);
            this.observer?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 },
    );

    // Observe the CTA section
    const ctaSection = this.elementRef.nativeElement.querySelector('.cta-section');
    if (ctaSection) {
      this.observer.observe(ctaSection);
    } else {
      // If no specific section, observe the component itself
      this.observer.observe(this.elementRef.nativeElement);
    }
  }

  private destroyIntersectionObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

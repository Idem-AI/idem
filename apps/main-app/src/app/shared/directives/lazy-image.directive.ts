import { Directive, ElementRef, Input, OnInit, inject } from '@angular/core';

@Directive({
  selector: 'img[appLazyImage]',
  standalone: true,
})
export class LazyImageDirective implements OnInit {
  private readonly el = inject(ElementRef);

  @Input() appLazyImage = '';
  @Input() placeholder =
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23f0f0f0" width="400" height="300"/%3E%3C/svg%3E';

  ngOnInit(): void {
    const img = this.el.nativeElement as HTMLImageElement;

    // Set placeholder immediately
    img.src = this.placeholder;
    img.classList.add('lazy-loading');

    // Use Intersection Observer for lazy loading
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.loadImage(img);
              observer.unobserve(img);
            }
          });
        },
        {
          rootMargin: '50px', // Start loading 50px before image enters viewport
        }
      );

      observer.observe(img);
    } else {
      // Fallback for browsers without IntersectionObserver
      this.loadImage(img);
    }
  }

  private loadImage(img: HTMLImageElement): void {
    const tempImg = new Image();

    tempImg.onload = () => {
      img.src = this.appLazyImage || img.getAttribute('src') || '';
      img.classList.remove('lazy-loading');
      img.classList.add('lazy-loaded');
    };

    tempImg.onerror = () => {
      img.classList.remove('lazy-loading');
      img.classList.add('lazy-error');
    };

    tempImg.src = this.appLazyImage || img.getAttribute('src') || '';
  }
}

import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  OnInit,
  OnDestroy,
  TemplateRef,
  ContentChild,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-carousel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative w-full overflow-hidden" #carouselContainer>
      <!-- Mobile Carousel -->
      <div class="block md:hidden">
        <div
          class="flex transition-transform duration-300 ease-out"
          [style.transform]="'translateX(-' + currentIndex() * 100 + '%)'"
          #carouselTrack
        >
          @for (item of safeItems; track trackByFn(index, item); let index = $index) {
            <div class="w-full flex-shrink-0 px-2">
              <ng-container
                [ngTemplateOutlet]="itemTemplate"
                [ngTemplateOutletContext]="{
                  $implicit: item,
                  index: index,
                  isSelected: selectedItem === item,
                }"
              ></ng-container>
            </div>
          }
        </div>

        <!-- Navigation Dots -->
        @if (showDots && safeItems.length > 1) {
          <div class="flex justify-center mt-6 space-x-2">
            @for (item of safeItems; track trackByFn(index, item); let index = $index) {
              <button
                (click)="goToSlide(index)"
                class="w-2 h-2 rounded-full transition-all duration-200"
                [class.bg-primary]="currentIndex() === index"
                [class.bg-gray-400]="currentIndex() !== index"
                [class.scale-125]="currentIndex() === index"
                [attr.aria-label]="'Go to slide ' + (index + 1)"
              ></button>
            }
          </div>
        }

        <!-- Navigation Arrows -->
        @if (showArrows && safeItems.length > 1) {
          <button
            (click)="previousSlide()"
            [disabled]="currentIndex() === 0 && !infinite"
            class="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 glass backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed z-10"
            [attr.aria-label]="'Previous slide'"
          >
            <i class="pi pi-chevron-left"></i>
          </button>

          <button
            (click)="nextSlide()"
            [disabled]="currentIndex() === safeItems.length - 1 && !infinite"
            class="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 glass backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed z-10"
            [attr.aria-label]="'Next slide'"
          >
            <i class="pi pi-chevron-right"></i>
          </button>
        }
      </div>

      <!-- Tablet+ Grid -->
      <div class="hidden md:block">
        <div
          class="grid gap-4 md:gap-6"
          [class.md:grid-cols-2]="gridCols >= 2"
          [class.lg:grid-cols-3]="gridCols >= 3"
          [class.xl:grid-cols-4]="gridCols >= 4"
        >
          @for (item of safeItems; track trackByFn(index, item); let index = $index) {
            <ng-container
              [ngTemplateOutlet]="itemTemplate"
              [ngTemplateOutletContext]="{
                $implicit: item,
                index: index,
                isSelected: selectedItem === item,
              }"
            ></ng-container>
          }
        </div>
      </div>
    </div>
  `,
})
export class CarouselComponent<T> implements OnInit, OnDestroy {
  @Input() items: T[] = [];

  // Getter to ensure items is never undefined
  get safeItems(): T[] {
    return this.items || [];
  }
  @Input() selectedItem: T | null = null;
  @Input() trackByFn: (index: number, item: T) => any = (index, item) => index;
  @Input() autoPlay = false;
  @Input() autoPlayInterval = 3000;
  @Input() infinite = true;
  @Input() showDots = true;
  @Input() showArrows = true;
  @Input() gridCols = 3; // Number of columns for tablet+ view

  @Output() readonly itemSelected = new EventEmitter<T>();
  @Output() readonly slideChanged = new EventEmitter<number>();
  @Output() readonly currentItemChanged = new EventEmitter<T>();

  @ContentChild(TemplateRef) itemTemplate!: TemplateRef<any>;
  @ViewChild('carouselContainer') carouselContainer!: ElementRef;
  @ViewChild('carouselTrack') carouselTrack!: ElementRef;

  protected readonly currentIndex = signal(0);
  private autoPlayTimer?: number;
  private touchStartX = 0;
  private touchEndX = 0;

  protected readonly canGoPrevious = computed(() => this.infinite || this.currentIndex() > 0);

  protected readonly canGoNext = computed(
    () => this.infinite || this.currentIndex() < this.items.length - 1,
  );

  ngOnInit(): void {
    if (this.autoPlay) {
      this.startAutoPlay();
    }
    this.setupTouchEvents();
  }

  ngOnDestroy(): void {
    this.stopAutoPlay();
  }

  protected goToSlide(index: number): void {
    if (index >= 0 && index < this.items.length) {
      this.currentIndex.set(index);
      this.slideChanged.emit(index);
      // Emit the current item for auto-selection on mobile
      const currentItem = this.items[index];
      if (currentItem) {
        this.currentItemChanged.emit(currentItem);
      }
    }
  }

  protected nextSlide(): void {
    const nextIndex =
      this.infinite && this.currentIndex() === this.items.length - 1
        ? 0
        : Math.min(this.currentIndex() + 1, this.items.length - 1);

    this.goToSlide(nextIndex);
  }

  protected previousSlide(): void {
    const prevIndex =
      this.infinite && this.currentIndex() === 0
        ? this.items.length - 1
        : Math.max(this.currentIndex() - 1, 0);

    this.goToSlide(prevIndex);
  }

  private startAutoPlay(): void {
    this.stopAutoPlay();
    this.autoPlayTimer = window.setInterval(() => {
      this.nextSlide();
    }, this.autoPlayInterval);
  }

  private stopAutoPlay(): void {
    if (this.autoPlayTimer) {
      clearInterval(this.autoPlayTimer);
      this.autoPlayTimer = undefined;
    }
  }

  private setupTouchEvents(): void {
    // Touch events will be added to the carousel container after view init
    setTimeout(() => {
      if (this.carouselContainer?.nativeElement) {
        const element = this.carouselContainer.nativeElement;

        element.addEventListener('touchstart', (e: TouchEvent) => {
          this.touchStartX = e.changedTouches[0].screenX;
          this.stopAutoPlay();
        });

        element.addEventListener('touchend', (e: TouchEvent) => {
          this.touchEndX = e.changedTouches[0].screenX;
          this.handleSwipe();
          if (this.autoPlay) {
            this.startAutoPlay();
          }
        });
      }
    });
  }

  private handleSwipe(): void {
    const swipeThreshold = 50;
    const diff = this.touchStartX - this.touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        // Swipe left - next slide
        this.nextSlide();
      } else {
        // Swipe right - previous slide
        this.previousSlide();
      }
    }
  }
}

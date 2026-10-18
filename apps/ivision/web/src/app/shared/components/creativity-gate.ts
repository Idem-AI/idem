import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  computed,
  createComponent,
  DestroyRef,
  Directive,
  ElementRef,
  EnvironmentInjector,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Creativity } from '../../core/models';

const LEVELS: Creativity[] = ['low', 'medium', 'high', 'ultra'];
const WIDTH = 320;
const GAP = 10;

/**
 * LA BULLE DU NIVEAU DE CRÉATIVITÉ — un menu sous le bouton qui l'a ouverte (au-dessus s'il manque la place),
 * une petite flèche vers lui. Un cran par ligne ; cliquer un cran LANCE la création. Mêmes crans qu'IDEM : le
 * cran choisit la puissance du modèle, le prix reste le même.
 */
@Component({
  selector: 'iv-creativity-bubble',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.position]': "'fixed'",
    '[style.zIndex]': '80',
    '[style.left.px]': 'left()',
    '[style.top.px]': 'top()',
    '[style.width.px]': 'width()',
    '(keydown.escape)': 'dismissed.emit()',
  },
  styles: `
    .bubble { position: relative; padding: 0.4rem; border-radius: 1rem; border: 1px solid var(--glass-border); background: var(--color-surface-2); box-shadow: 0 18px 40px rgb(0 0 0 / 0.28); animation: bubble-in 140ms ease-out; }
    .caret { position: absolute; width: 12px; height: 12px; margin-left: -6px; transform: rotate(45deg); background: var(--color-surface-2); }
    .caret-up { top: -6px; border-left: 1px solid var(--glass-border); border-top: 1px solid var(--glass-border); }
    .caret-down { bottom: -6px; border-right: 1px solid var(--glass-border); border-bottom: 1px solid var(--glass-border); }
    .item { display: flex; width: 100%; align-items: center; gap: 0.75rem; padding: 0.55rem 0.6rem; border-radius: 0.65rem; text-align: left; color: var(--color-text-secondary); }
    .item:hover { background: var(--glass-bg-light); }
    .item:focus-visible { outline: 2px solid var(--color-primary-500); outline-offset: 2px; }
    @keyframes bubble-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .bubble { animation: none; } }
  `,
  template: `
    <div class="bubble" role="menu" [attr.aria-label]="'creativity.choose' | translate">
      <p class="mx-2 mt-1.5 text-sm font-semibold">{{ 'creativity.choose' | translate }}</p>
      <p class="mx-2 mb-1.5 mt-0.5 text-xs leading-snug text-[var(--color-text-tertiary)]">{{ (kind() === 'video' ? 'creativity.videoHint' : 'creativity.hint') | translate }}</p>
      @for (level of levels; track level; let i = $index) {
        <button type="button" role="menuitemradio" class="item" [attr.aria-checked]="value() === level" (click)="chosen.emit(level)" (keydown)="onItemKey($event, i)">
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="text-sm font-semibold" [class.text-[var(--color-primary-500)]]="value() === level">{{ 'creativity.names.' + level | translate }}</span>
            <span class="text-xs">{{ 'creativity.lines.' + level | translate }}</span>
          </span>
          <i class="pi pi-arrow-right text-xs text-[var(--color-text-tertiary)]" aria-hidden="true"></i>
        </button>
      }
      <span class="caret" [class.caret-up]="below()" [class.caret-down]="!below()" [style.left.px]="caret()" aria-hidden="true"></span>
    </div>
  `,
})
export class CreativityBubble {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  readonly value = input<Creativity>('medium');
  readonly kind = input<'video' | 'image'>('image');
  readonly chosen = output<Creativity>();
  readonly dismissed = output<void>();
  readonly left = signal(0);
  readonly top = signal(0);
  readonly width = signal(WIDTH);
  readonly caret = signal(24);
  readonly below = signal(true);
  protected readonly levels = LEVELS;

  focusCurrent(): void {
    this.items()[Math.max(0, LEVELS.indexOf(this.value()))]?.focus();
  }

  protected onItemKey(event: KeyboardEvent, index: number): void {
    const last = LEVELS.length - 1;
    const to = event.key === 'ArrowDown' ? Math.min(last, index + 1) : event.key === 'ArrowUp' ? Math.max(0, index - 1) : event.key === 'Home' ? 0 : event.key === 'End' ? last : -1;
    if (to < 0) {
      if (event.key === 'Tab') this.dismissed.emit();
      return;
    }
    event.preventDefault();
    this.items()[to]?.focus();
  }

  private items(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.item'));
  }
}

/**
 * LE NIVEAU DE CRÉATIVITÉ SE CHOISIT SUR LE BOUTON. Posé sur un bouton qui lance une création, il retient son
 * clic, ouvre la bulle des crans, et rejoue le clic une fois le cran choisi : l'action part avec ce cran.
 *
 *   <button ivCreativityGate [(creativity)]="creativity" (click)="send()">
 */
@Directive({ selector: '[ivCreativityGate]' })
export class CreativityGate {
  private readonly el: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly appRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);

  readonly creativity = model<Creativity>('medium');
  readonly kind = input<'video' | 'image'>('image', { alias: 'creativityKind' });
  /** Vrai : le clic passe sans bulle. */
  readonly off = input(false, { alias: 'creativityOff' });

  private bubble: ComponentRef<CreativityBubble> | null = null;
  private replaying = false;
  private listeners: (() => void)[] = [];

  constructor() {
    const host = this.el.nativeElement;
    const onClick = (event: MouseEvent) => this.intercept(event);
    host.addEventListener('click', onClick, true);
    inject(DestroyRef).onDestroy(() => {
      this.close(false);
      host.removeEventListener('click', onClick, true);
    });
  }

  /** Ouvre la bulle sans clic (la touche Entrée du champ de saisie) ; rien si le bouton est désactivé. */
  openMenu(): void {
    const host = this.el.nativeElement as HTMLButtonElement;
    if (this.off() || host.disabled || this.bubble) return;
    this.open();
  }

  private intercept(event: MouseEvent): void {
    const host = this.el.nativeElement as HTMLButtonElement;
    if (this.replaying || this.off() || host.disabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    if (this.bubble) return this.close(true);
    this.open();
  }

  private open(): void {
    const ref = createComponent(CreativityBubble, { environmentInjector: this.environmentInjector });
    ref.setInput('value', this.creativity());
    ref.setInput('kind', this.kind());
    ref.instance.chosen.subscribe((level) => this.choose(level));
    ref.instance.dismissed.subscribe(() => this.close(true));
    this.appRef.attachView(ref.hostView);
    document.body.appendChild(ref.location.nativeElement);
    this.bubble = ref;
    this.place();
    ref.changeDetectorRef.detectChanges();
    requestAnimationFrame(() => {
      this.place();
      ref.instance.focusCurrent();
    });
    const outside = (e: PointerEvent) => {
      const node = e.target as Node;
      if (!ref.location.nativeElement.contains(node) && !this.el.nativeElement.contains(node)) this.close(false);
    };
    const reposition = () => this.place();
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    this.listeners = [
      () => document.removeEventListener('pointerdown', outside, true),
      () => window.removeEventListener('resize', reposition),
      () => window.removeEventListener('scroll', reposition, true),
    ];
  }

  /** Sous le bouton s'il y a la place, sinon au-dessus ; centrée sur lui, dans l'écran. */
  private place(): void {
    const ref = this.bubble;
    if (!ref) return;
    const rect = this.el.nativeElement.getBoundingClientRect();
    const width = Math.min(WIDTH, window.innerWidth - 24);
    const height = ref.location.nativeElement.firstElementChild?.getBoundingClientRect().height || 280;
    const below = rect.bottom + GAP + height <= window.innerHeight - 8 || rect.top - GAP - height < 8;
    const center = rect.left + rect.width / 2;
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, center - width / 2));
    const b = ref.instance;
    b.width.set(width);
    b.left.set(left);
    b.below.set(below);
    b.top.set(below ? rect.bottom + GAP : Math.max(8, rect.top - GAP - height));
    b.caret.set(Math.max(16, Math.min(width - 16, center - left)));
  }

  private choose(level: Creativity): void {
    this.creativity.set(level);
    this.close(false);
    queueMicrotask(() => {
      this.replaying = true;
      try {
        this.el.nativeElement.click();
      } finally {
        this.replaying = false;
      }
    });
  }

  private close(refocus: boolean): void {
    if (this.bubble) {
      this.appRef.detachView(this.bubble.hostView);
      this.bubble.destroy();
      this.bubble = null;
    }
    this.listeners.forEach((fn) => fn());
    this.listeners = [];
    if (refocus) this.el.nativeElement.focus();
  }
}

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
import { CREATIVITY_LEVELS, CreativityLevel, creativityCost, creativityRank } from '@idem/shared-models';

const BUBBLE_WIDTH = 352;
const GAP = 10;

/**
 * LA BULLE DU NIVEAU DE CRÉATIVITÉ — un menu déroulant sous le bouton de génération qui l'a ouverte (au-dessus
 * s'il manque la place), une petite flèche vers lui. Chaque cran : son nom, ce que l'IA décide, son prix. Cliquer un cran
 * LANCE la génération. Échap ou un clic ailleurs referme sans rien lancer.
 */
@Component({
  selector: 'app-creativity-bubble',
  imports: [TranslateModule],
  styleUrl: './creativity-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'cg-bubble',
    '[style.position]': "'fixed'",
    '[style.zIndex]': '80',
    '[style.left.px]': 'left()',
    '[style.top.px]': 'top()',
    '[style.width.px]': 'width()',
    '(keydown.escape)': 'dismissed.emit()',
  },
  template: `
    <div class="cp-menu cg-panel" role="menu" [attr.aria-label]="'common.creativity.choose' | translate">
      <p class="cg-title">{{ 'common.creativity.choose' | translate }}</p>
      <p class="cp-help">{{ texts() + '.help' | translate }}</p>
      @for (level of levels; track level; let i = $index) {
        <button
          type="button"
          role="menuitemradio"
          class="cp-item"
          [attr.aria-checked]="value() === level"
          (click)="chosen.emit(level)"
          (keydown)="onItemKey($event, i)"
        >
          <span class="cp-item-text">
            <span class="cp-item-name">{{ 'common.creativity.levels.' + level + '.label' | translate }}</span>
            <span class="cp-item-line">{{ texts() + '.levels.' + level + '.line' | translate }}</span>
          </span>
          @if (costs(); as c) {
            <span class="cp-item-cost">{{ c[level] === 0 ? ('common.creativity.included' | translate) : ('common.creativity.cost' | translate: { cost: c[level] }) }}</span>
          }
          <i class="pi pi-arrow-right cp-check" aria-hidden="true"></i>
        </button>
      }
      <span class="cg-caret" [class.cg-caret-up]="below()" [style.left.px]="caret()" aria-hidden="true"></span>
    </div>
  `,
})
export class CreativityBubbleComponent {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  readonly value = input<CreativityLevel>('medium');
  readonly baseCost = input<number | null>(null);
  readonly kind = input<'default' | 'video'>('default');
  readonly chosen = output<CreativityLevel>();
  readonly dismissed = output<void>();

  /** Position (fixe), calculée par le déclencheur depuis le bouton. */
  readonly left = signal(0);
  readonly top = signal(0);
  readonly width = signal(BUBBLE_WIDTH);
  readonly caret = signal(24);
  readonly below = signal(false);

  protected readonly levels = CREATIVITY_LEVELS;
  protected readonly texts = computed(() => (this.kind() === 'video' ? 'common.creativity.video' : 'common.creativity'));
  protected readonly costs = computed(() => {
    const base = this.baseCost();
    return base == null ? null : (Object.fromEntries(CREATIVITY_LEVELS.map((l) => [l, creativityCost(base, l)])) as Record<CreativityLevel, number>);
  });

  focusCurrent(): void {
    this.items()[creativityRank(this.value())]?.focus();
  }

  protected onItemKey(event: KeyboardEvent, index: number): void {
    const last = CREATIVITY_LEVELS.length - 1;
    const to = event.key === 'ArrowDown' ? Math.min(last, index + 1) : event.key === 'ArrowUp' ? Math.max(0, index - 1) : event.key === 'Home' ? 0 : event.key === 'End' ? last : -1;
    if (to < 0) {
      if (event.key === 'Tab') this.dismissed.emit();
      return;
    }
    event.preventDefault();
    this.items()[to]?.focus();
  }

  private items(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.cp-item'));
  }
}

/**
 * LE NIVEAU DE CRÉATIVITÉ SE CHOISIT SUR LE BOUTON. Posé sur un bouton qui lance une génération IA, il
 * retient son clic, ouvre la bulle des crans juste en dessous, et rejoue le clic d'origine une fois le cran
 * choisi : le gestionnaire du bouton (ou l'envoi du formulaire) part avec ce cran déjà réglé.
 *
 *   <button appCreativityGate [(creativity)]="creativity" [creativityCost]="baseCost()" (click)="generate()">
 *
 * `creativityTarget` : posé sur un conteneur, seuls les clics sur les éléments qui correspondent à ce
 * sélecteur ouvrent la bulle (cartes de format, boutons d'un formulaire projeté).
 */
@Directive({
  selector: '[appCreativityGate]',
})
export class CreativityGateDirective {
  private readonly el: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly appRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);

  readonly creativity = model<CreativityLevel>('medium');
  readonly baseCost = input<number | null>(null, { alias: 'creativityCost' });
  readonly kind = input<'default' | 'video'>('default', { alias: 'creativityKind' });
  readonly target = input<string | null>(null, { alias: 'creativityTarget' });
  /** Vrai : le clic passe sans bulle (action qui ne génère rien dans cet état). */
  readonly off = input(false, { alias: 'creativityOff' });

  private bubble: ComponentRef<CreativityBubbleComponent> | null = null;
  private anchor: HTMLElement | null = null;
  private replaying = false;
  private readonly cleanups: (() => void)[] = [];

  constructor() {
    const host = this.el.nativeElement;
    // En capture : la bulle passe AVANT le gestionnaire du bouton (et avant l'envoi d'un formulaire).
    const onClick = (event: MouseEvent) => this.intercept(event);
    host.addEventListener('click', onClick, true);
    this.cleanups.push(() => host.removeEventListener('click', onClick, true));
    inject(DestroyRef).onDestroy(() => {
      this.close(false);
      this.cleanups.forEach((fn) => fn());
    });
  }

  private intercept(event: MouseEvent): void {
    if (this.replaying || this.off()) return;
    const host = this.el.nativeElement;
    const selector = this.target();
    const hit = selector ? ((event.target as Element | null)?.closest(selector) as HTMLElement | null) : host;
    if (!hit || !host.contains(hit) || (hit as HTMLButtonElement).disabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    if (this.bubble && this.anchor === hit) return this.close(true);
    this.open(hit);
  }

  private open(anchor: HTMLElement): void {
    this.close(false);
    this.anchor = anchor;
    const ref = createComponent(CreativityBubbleComponent, { environmentInjector: this.environmentInjector });
    ref.setInput('value', this.creativity());
    ref.setInput('baseCost', this.baseCost());
    ref.setInput('kind', this.kind());
    ref.instance.chosen.subscribe((level) => this.choose(level));
    ref.instance.dismissed.subscribe(() => this.close(true));
    this.appRef.attachView(ref.hostView);
    document.body.appendChild(ref.location.nativeElement);
    this.bubble = ref;
    this.place();
    ref.changeDetectorRef.detectChanges();
    // La place réelle connue, la bulle se recale (hauteur), puis le cran courant prend le focus.
    requestAnimationFrame(() => {
      this.place();
      ref.instance.focusCurrent();
    });

    const outside = (e: PointerEvent) => {
      const node = e.target as Node;
      if (!ref.location.nativeElement.contains(node) && !anchor.contains(node)) this.close(false);
    };
    const reposition = () => this.place();
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    this.cleanups.push(
      () => document.removeEventListener('pointerdown', outside, true),
      () => window.removeEventListener('resize', reposition),
      () => window.removeEventListener('scroll', reposition, true),
    );
  }

  /** Sous le bouton, comme un menu déroulant ; au-dessus s'il manque la place en bas. Centrée sur lui, dans l'écran. */
  private place(): void {
    const ref = this.bubble;
    const anchor = this.anchor;
    if (!ref || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(BUBBLE_WIDTH, window.innerWidth - 24);
    const height = ref.location.nativeElement.firstElementChild?.getBoundingClientRect().height || 320;
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

  private choose(level: CreativityLevel): void {
    const anchor = this.anchor;
    this.creativity.set(level);
    this.close(false);
    if (!anchor) return;
    // Le clic d'origine, rejoué : la génération part avec le cran choisi (le modèle est déjà à jour).
    queueMicrotask(() => {
      this.replaying = true;
      try {
        anchor.click();
      } finally {
        this.replaying = false;
      }
    });
  }

  private close(refocus: boolean): void {
    const anchor = this.anchor;
    if (this.bubble) {
      this.appRef.detachView(this.bubble.hostView);
      this.bubble.destroy();
      this.bubble = null;
    }
    // Les écouteurs de la bulle (les deux premiers restent : le clic du bouton).
    while (this.cleanups.length > 1) this.cleanups.pop()!();
    this.anchor = null;
    if (refocus && anchor) anchor.focus();
  }
}

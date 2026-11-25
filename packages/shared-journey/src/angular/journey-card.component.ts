import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { JourneyCardOptions, JourneyCardVariant, journeyCardView, journeyDismiss, journeyOpen, journeyShown } from '../card';
import type { JourneyClient } from '../client';
import { journeyIllustration, JOURNEY_ICONS } from '../illustrations';
import type { JourneyUrls } from '../links';
import type { IdemApp, Recommendation } from '../model';

/**
 * La carte « prochaine étape » (même rendu et mêmes mots que dans iCode) : un dessin, ce que l'utilisateur y gagne,
 * un bouton qui l'y emmène avec son projet déjà sélectionné, et « Plus tard ». Styles du design system
 * (`.idem-next`, `@idem/shared-styles`).
 *
 * `variant="float"` : la version posée en haut au centre (voir `idem-journey-float`), une croix pour la fermer.
 */
@Component({
  selector: 'idem-journey-card',
  imports: [IdemLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="glass-card idem-next"
      [class.idem-next--float]="float()"
      [attr.role]="float() ? 'status' : null"
      [attr.aria-labelledby]="titleId()"
      [attr.data-journey]="recommendation().id"
    >
      <span class="idem-next-art" [innerHTML]="illustration()"></span>
      <div class="idem-next-text">
        <p class="idem-next-label">{{ view().label }}</p>
        <h3 [id]="titleId()" class="idem-next-title" [attr.title]="float() ? view().text.title : null">{{ view().text.title }}</h3>
        @if (view().text.body) {
          <p class="idem-next-body" [attr.title]="float() ? view().text.body : null">{{ view().text.body }}</p>
        }
        <div class="idem-next-actions">
          <button type="button" class="inner-button button-sm" [disabled]="opening()" (click)="open()">
            @if (opening()) {
              <idem-loader size="xs" />
            }
            {{ view().text.cta }}
            @if (!opening()) {
              <span aria-hidden="true" [innerHTML]="arrow"></span>
            }
          </button>
          @if (!float()) {
            <button type="button" class="button-ghost button-sm" (click)="dismiss()">{{ view().dismissLabel }}</button>
          }
        </div>
      </div>
      @if (float()) {
        <button type="button" class="button-icon idem-next-close" [attr.aria-label]="view().closeLabel" [attr.title]="view().dismissLabel" (click)="dismiss()">
          <span aria-hidden="true" [innerHTML]="close"></span>
        </button>
      }
    </section>
  `,
})
export class JourneyCardComponent implements OnInit {
  private readonly sanitizer = inject(DomSanitizer);

  readonly recommendation = input.required<Recommendation>();
  readonly urls = input.required<JourneyUrls>();
  readonly from = input<IdemApp>('dashboard');
  readonly lang = input<string>('fr');
  readonly client = input<JourneyClient | undefined>(undefined);
  readonly beforeOpen = input<JourneyCardOptions['beforeOpen']>(undefined);
  readonly variant = input<JourneyCardVariant>('inline');
  /** Déjà signalée affichée par sa jumelle (la carte du fil) : pas de second « shown ». */
  readonly silent = input(false);
  readonly dismissed = output<void>();

  protected readonly opening = signal(false);
  protected readonly float = computed(() => this.variant() === 'float');
  protected readonly titleId = computed(() => `journey-${this.variant()}-${this.recommendation().id}`);
  private readonly options = computed<JourneyCardOptions>(() => ({
    recommendation: this.recommendation(),
    urls: this.urls(),
    from: this.from(),
    lang: this.lang(),
    client: this.client(),
    beforeOpen: this.beforeOpen(),
  }));
  protected readonly view = computed(() => journeyCardView(this.options()));
  // Dessins et pictogrammes écrits dans le paquet (jamais reçus d'ailleurs) : ils peuvent être insérés tels quels.
  protected readonly illustration = computed<SafeHtml>(() => this.sanitizer.bypassSecurityTrustHtml(journeyIllustration(this.recommendation().destination)));
  protected readonly arrow: SafeHtml = this.sanitizer.bypassSecurityTrustHtml(JOURNEY_ICONS.arrow);
  protected readonly close: SafeHtml = this.sanitizer.bypassSecurityTrustHtml(JOURNEY_ICONS.close);

  ngOnInit(): void {
    if (!this.silent()) journeyShown(this.options());
  }

  protected async open(): Promise<void> {
    this.opening.set(true);
    try {
      await journeyOpen(this.options());
    } finally {
      this.opening.set(false);
    }
  }

  protected dismiss(): void {
    journeyDismiss(this.options());
    this.dismissed.emit();
  }
}

/**
 * La carte posée EN HAUT AU CENTRE de l'écran (`.idem-float-stack`), par-dessus la page, sans la repousser — comme
 * l'« étape suivante » du dashboard. `top` : sous la barre du haut de l'hôte ; `center` : le centre de son contenu.
 *
 * Rattachée à `document.body` dès sa création : posée sous une surface en verre (`backdrop-filter`, `transform`),
 * une carte `position: fixed` serait sinon rognée et placée par rapport à cette surface, pas à l'écran.
 */
@Component({
  selector: 'idem-journey-float',
  imports: [JourneyCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="idem-float-stack" [style.--idem-float-top]="top()" [style.--idem-float-center]="center()">
      <idem-journey-card
        variant="float"
        [recommendation]="recommendation()"
        [urls]="urls()"
        [from]="from()"
        [lang]="lang()"
        [client]="client()"
        [beforeOpen]="beforeOpen()"
        [silent]="silent()"
        (dismissed)="dismissed.emit()"
      />
    </div>
  `,
})
export class JourneyFloatComponent implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly recommendation = input.required<Recommendation>();
  readonly urls = input.required<JourneyUrls>();
  readonly from = input<IdemApp>('dashboard');
  readonly lang = input<string>('fr');
  readonly client = input<JourneyClient | undefined>(undefined);
  readonly beforeOpen = input<JourneyCardOptions['beforeOpen']>(undefined);
  readonly silent = input(false);
  readonly top = input<string | null>(null);
  readonly center = input<string | null>(null);
  readonly dismissed = output<void>();

  ngOnInit(): void {
    if (typeof document === 'undefined') return;
    const element = this.host.nativeElement;
    document.body.appendChild(element);
    this.destroyRef.onDestroy(() => element.remove());
  }
}

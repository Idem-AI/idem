import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { JourneyCardOptions, journeyCardView, journeyDismiss, journeyOpen, journeyShown } from '../card';
import type { JourneyClient } from '../client';
import { journeyIllustration } from '../illustrations';
import type { JourneyUrls } from '../links';
import type { IdemApp, Recommendation } from '../model';

/**
 * La carte « prochaine étape » du dashboard (même rendu et mêmes mots que dans iCode) : un dessin, ce que
 * l'utilisateur y gagne, un bouton qui l'y emmène avec son projet déjà sélectionné, et « Plus tard ».
 */
@Component({
  selector: 'idem-journey-card',
  imports: [IdemLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="glass-card flex items-start gap-4 p-4" [attr.aria-labelledby]="'journey-' + recommendation().id" [attr.data-journey]="recommendation().id">
      <span class="shrink-0 text-[var(--color-primary-500)]" [innerHTML]="illustration()"></span>
      <div class="min-w-0 flex-1">
        <p class="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">{{ view().label }}</p>
        <h3 [id]="'journey-' + recommendation().id" class="mt-1 text-base font-semibold text-[var(--color-text-primary)]">{{ view().text.title }}</h3>
        @if (view().text.body) {
          <p class="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">{{ view().text.body }}</p>
        }
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" class="inner-button button-sm" [disabled]="opening()" (click)="open()">
            @if (opening()) { <idem-loader size="xs" /> }
            {{ view().text.cta }}
          </button>
          <button type="button" class="button-ghost button-sm" (click)="dismiss()">{{ view().dismissLabel }}</button>
        </div>
      </div>
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
  readonly dismissed = output<void>();

  protected readonly opening = signal(false);
  private readonly options = computed<JourneyCardOptions>(() => ({
    recommendation: this.recommendation(),
    urls: this.urls(),
    from: this.from(),
    lang: this.lang(),
    client: this.client(),
    beforeOpen: this.beforeOpen(),
  }));
  protected readonly view = computed(() => journeyCardView(this.options()));
  // Dessin écrit dans le paquet (jamais reçu d'ailleurs) : il peut être inséré tel quel.
  protected readonly illustration = computed<SafeHtml>(() => this.sanitizer.bypassSecurityTrustHtml(journeyIllustration(this.recommendation().destination)));

  ngOnInit(): void {
    journeyShown(this.options());
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

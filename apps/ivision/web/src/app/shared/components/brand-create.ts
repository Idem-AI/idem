import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { loadFontSheet } from '../../core/fonts';
import { Brand } from '../../core/models';
import { StudioState } from '../../core/studio.state';
import { CharterResult } from '../../pages/studio/chat/charter-result';
import { PolicyConsent } from './policy-consent';

/**
 * « CRÉER MA MARQUE ». Le site lu, on montre ce qui a été trouvé (logo, couleurs, polices) — rien n'est encore
 * créé dans IDEM. Le bouton ne s'active qu'une fois les politiques d'IDEM acceptées (confidentialité,
 * conditions d'utilisation, programme bêta) ; c'est seulement alors que le projet IDEM naît. Ensuite, la
 * charte graphique se crée d'un clic, et s'affiche ici.
 */
@Component({
  selector: 'iv-brand-create',
  imports: [TranslateModule, IdemLoaderComponent, PolicyConsent, CharterResult],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (brand(); as b) {
      <div class="mt-3 flex flex-col gap-3">
        <!-- Ce qui a été trouvé sur le site (masqué là où la marque est déjà présentée). -->
        @if (showFound()) {
        <div class="flex items-center gap-3 rounded-xl border border-[var(--glass-border-subtle)] p-3">
          @if (b.logoUrl) {
            <img [src]="b.logoUrl" alt="" class="h-12 w-12 flex-none rounded-lg border border-[var(--glass-border-subtle)] bg-[var(--color-surface-1)] object-contain p-1" />
          }
          <div class="min-w-0 flex-1">
            <p class="truncate font-semibold" [style.font-family]="quote(b.fonts.display)">{{ b.name }}</p>
            <p class="truncate text-xs text-[var(--color-text-tertiary)]">
              <span [style.font-family]="quote(b.fonts.display)">{{ b.fonts.display || '—' }}</span> · <span [style.font-family]="quote(b.fonts.body)">{{ b.fonts.body || '—' }}</span>
            </p>
          </div>
          <span class="flex h-8 flex-none overflow-hidden rounded-md border border-[var(--glass-border-subtle)]" role="img" [attr.aria-label]="'brands.palette' | translate">
            @for (c of swatches(); track $index) { <span class="w-6" [style.background]="c"></span> }
          </span>
        </div>
        }

        @if (b.idemProjectId) {
          <!-- La marque existe dans IDEM : sa charte graphique. -->
          @if (justCreated()) {
            <p class="text-sm text-[var(--color-text-secondary)]" role="status"><i class="pi pi-check text-[var(--color-success)]" aria-hidden="true"></i> {{ 'brandCreate.created' | translate }}</p>
          }
          <iv-charter-result [brandId]="b.id" [projectId]="b.idemProjectId" />
        } @else {
          <iv-policy-consent [(accepted)]="consent" />
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" class="inner-button button-sm" [disabled]="!consent() || creating()" (click)="create()">
              @if (creating()) { <idem-loader size="xs" /> } @else { <i class="pi pi-check-circle" aria-hidden="true"></i> }
              {{ 'brandCreate.cta' | translate }}
            </button>
            @if (creating() && status()) {
              <span class="text-xs text-[var(--color-text-secondary)]" role="status">{{ status() }}</span>
            } @else if (!consent()) {
              <span class="text-xs text-[var(--color-text-tertiary)]">{{ 'brandCreate.needConsent' | translate }}</span>
            }
          </div>
          @if (failed(); as f) {
            <p class="text-sm text-[var(--color-danger)]" role="alert">{{ f }}</p>
          }
        }
      </div>
    }
  `,
})
export class BrandCreate implements OnInit {
  private readonly api = inject(ApiService);
  private readonly translate = inject(TranslateService);
  private readonly state = inject(StudioState);

  readonly brandId = input.required<string>();
  /** Montrer le logo, les couleurs et les polices trouvés (non sur la carte d'une marque qui les montre déjà). */
  readonly showFound = input(true);

  /** La marque : celle de la liste, sinon chargée (et tenue à jour après la création). */
  private readonly loaded = signal<Brand | null>(null);
  protected readonly brand = computed(() => this.state.brands().find((b) => b.id === this.brandId()) ?? this.loaded());
  protected readonly swatches = computed(() => {
    const p = this.brand()?.palette || {};
    return [p.primary, p.secondary, p.accent, p.background].filter((c): c is string => !!c);
  });
  protected readonly consent = signal(false);
  protected readonly creating = signal(false);
  protected readonly justCreated = signal(false);
  protected readonly status = signal<string | null>(null);
  protected readonly failed = signal<string | null>(null);
  private sub: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.sub?.unsubscribe());
  }

  ngOnInit(): void {
    this.api.brand(this.brandId()).subscribe({
      next: (b) => {
        this.loaded.set(b);
        loadFontSheet(b.fonts.displayCss);
        loadFontSheet(b.fonts.bodyCss);
      },
      error: () => undefined,
    });
  }

  protected quote(family?: string): string {
    return family ? `'${family.replace(/'/g, '')}', system-ui, sans-serif` : 'inherit';
  }

  protected create(): void {
    if (!this.consent()) return;
    this.creating.set(true);
    this.failed.set(null);
    this.status.set(this.translate.instant('brandCreate.creating'));
    this.sub?.unsubscribe();
    this.sub = this.api.createBrandProject(this.brandId()).subscribe({
      next: (event) => {
        if (event.type === 'status') {
          const t = this.translate.instant(event.key);
          if (t !== event.key) this.status.set(t);
        }
        if (event.type === 'brand') {
          this.loaded.set(event.brand);
          if (event.brand.source !== 'auto') this.state.upsertBrand(event.brand);
          this.justCreated.set(!!event.brand.idemProjectId);
          if (!event.brand.idemProjectId) this.failed.set(this.translate.instant('brandCreate.failed'));
        }
        if (event.type === 'error') this.failed.set(event.message || this.translate.instant('brandCreate.failed'));
      },
      complete: () => this.creating.set(false),
      error: () => {
        this.creating.set(false);
        this.failed.set(this.translate.instant('brandCreate.failed'));
      },
    });
  }
}

import { DOCUMENT, DatePipe, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EMPTY, catchError, map, switchMap, tap } from 'rxjs';
import type { BuilderProfile, BuilderSignal } from '@idem/shared-models/builders/program';
import { environment } from '../../../environments/environment';
import { BuildersService } from '../../shared/services/builders.service';
import { SeoService } from '../../shared/services/seo.service';
import { BuilderCoverComponent } from '../builders-page/builder-cover';

type State = 'loading' | 'ready' | 'notfound' | 'error';

/** Ce que chaque signe « construit avec IDEM » veut dire, en mots de visiteur. */
const SIGNAL_LABELS: Record<BuilderSignal, string> = {
  sitePublished: $localize`:@@builder-detail.signal.sitePublished:Website online with iDeploy`,
  appPublished: $localize`:@@builder-detail.signal.appPublished:App online with iDeploy`,
  communication: $localize`:@@builder-detail.signal.communication:Marketing managed in IDEM`,
  domain: $localize`:@@builder-detail.signal.domain:Domain name registered with IDEM`,
  brand: $localize`:@@builder-detail.signal.brand:Brand identity`,
  charter: $localize`:@@builder-detail.signal.charter:Brand book`,
  businessPlan: $localize`:@@builder-detail.signal.businessPlan:Business plan`,
  pitchDeck: $localize`:@@builder-detail.signal.pitchDeck:Pitch deck`,
  legal: $localize`:@@builder-detail.signal.legal:Legal documents`,
  video: $localize`:@@builder-detail.signal.video:Promotional video`,
};

const ROLE_LABELS: Record<string, string> = {
  primary: $localize`:@@builder-detail.palette.primary:Primary`,
  secondary: $localize`:@@builder-detail.palette.secondary:Secondary`,
  accent: $localize`:@@builder-detail.palette.accent:Accent`,
  background: $localize`:@@builder-detail.palette.background:Background`,
  text: $localize`:@@builder-detail.palette.text:Text`,
};

/**
 * La page d'un projet Idem Builders.
 *
 * Tout ce qui s'y lit vient du projet lui-même, construit dans IDEM : sa
 * charte compose la couverture, son nom s'écrit dans sa police, sa palette et
 * ses polices sont montrées telles quelles. L'équipe n'apparaît que si le
 * candidat a choisi de la publier.
 *
 * Lue dans le navigateur, comme un billet du blog : un projet admis ce matin a
 * sa page ce matin.
 */
@Component({
  selector: 'app-builder-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, BuilderCoverComponent],
  templateUrl: './builder-detail-page.html',
  styleUrls: ['../../shared/styles/editorial-page.css', './builder-detail-page.css'],
})
export class BuilderDetailPage {
  private readonly builders = inject(BuildersService);
  private readonly seo = inject(SeoService);
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly joinUrl = `${environment.services.dashboard.url}/builders`;
  protected readonly state = signal<State>('loading');
  protected readonly builder = signal<BuilderProfile | null>(null);
  protected readonly copied = signal(false);
  private fontLink: HTMLLinkElement | null = null;
  private slug = '';

  /** La police de titre de la marque, chargée avec sa feuille de style. */
  protected readonly titleFont = computed(() => {
    const font = this.builder()?.brand?.fonts?.primary;
    return font ? `'${font.replace(/'/g, '')}', var(--font-family-display, inherit)` : null;
  });

  protected readonly textFont = computed(() => {
    const font = this.builder()?.brand?.fonts?.secondary;
    return font ? `'${font.replace(/'/g, '')}', inherit` : null;
  });

  protected readonly accent = computed(() => this.builder()?.brand?.primary ?? 'var(--color-primary-500)');

  protected readonly builtWith = computed(() =>
    (this.builder()?.builtWith ?? []).map((signal) => SIGNAL_LABELS[signal]).filter(Boolean),
  );

  protected readonly place = computed(() => {
    const b = this.builder();
    return [b?.city, b?.country].filter(Boolean).join(', ');
  });

  protected readonly paragraphs = computed(() =>
    (this.builder()?.story ?? '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
  );

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('slug') ?? ''),
        tap((slug) => {
          this.slug = slug;
          this.state.set('loading');
          this.builder.set(null);
        }),
        // Pas d'appel au prérendu : la page est rendue chez le visiteur.
        switchMap((slug) =>
          this.isBrowser
            ? this.builders.profile(slug).pipe(
                catchError((error: HttpErrorResponse) => {
                  this.state.set(error.status === 404 ? 'notfound' : 'error');
                  return EMPTY;
                }),
              )
            : EMPTY,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((builder) => {
        this.builder.set(builder);
        this.state.set('ready');
        this.seo.applyBuilder(builder);
        this.loadBrandFont(builder.brand?.fonts?.stylesheet);
      });

    this.destroyRef.onDestroy(() => this.fontLink?.remove());
  }

  protected retry(): void {
    this.state.set('loading');
    this.builders.profile(this.slug).subscribe({
      next: (builder) => {
        this.builder.set(builder);
        this.state.set('ready');
        this.seo.applyBuilder(builder);
        this.loadBrandFont(builder.brand?.fonts?.stylesheet);
      },
      error: (error: HttpErrorResponse) => this.state.set(error.status === 404 ? 'notfound' : 'error'),
    });
  }

  protected roleLabel(role: string): string {
    return ROLE_LABELS[role] ?? role;
  }

  protected initials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2);
    return letters.toUpperCase();
  }

  protected host(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  protected async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.document.location.href);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.copied.set(false);
    }
  }

  /** Charge la feuille de la police de marque, une fois, et la retire en quittant la page. */
  private loadBrandFont(href?: string): void {
    if (!this.isBrowser || !href) return;
    if (this.fontLink?.href === href) return;
    this.fontLink?.remove();
    const link = this.document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    this.document.head.appendChild(link);
    this.fontLink = link;
  }
}

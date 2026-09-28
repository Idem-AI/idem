import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet, UpperCasePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { Subject, debounceTime, switchMap, of, catchError } from 'rxjs';

import { BrandFont, BrandIdentityModel } from '../../../../models/brand-identity.model';
import {
  BrandPalette,
  HarmonizeResult,
  IdentityUpdateReport,
  IdentityUpdateRequest,
  PALETTE_ROLES,
  PaletteRole,
} from '../../../../models/brand-identity-update.model';
import { LogoModel } from '../../../../models/logo.model';
import { BrandingService } from '../../../../services/ai-agents/branding.service';
import { LogoImportResponse, LogoImportService } from '../../../../services/logo-import.service';
import { CatalogFont, TypographyService } from '../../../../../../shared/services/typography.service';

type LogoChoice =
  | { kind: 'current' }
  | { kind: 'generated'; logo: LogoModel }
  | { kind: 'imported'; result: LogoImportResponse; preview: string };

type FontRole = 'primary' | 'secondary';

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Changer l'identité visuelle — logo, couleurs, polices — et la voir appliquée
 * à tous les supports du projet. Tout le calcul est fait côté serveur, sans IA :
 * ce panneau ne fait que recueillir les choix et afficher ce qui change.
 */
@Component({
  selector: 'app-identity-editor',
  imports: [TranslateModule, IdemLoaderComponent, NgTemplateOutlet, UpperCasePipe],
  templateUrl: './identity-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'close()' },
})
export class IdentityEditorComponent {
  private readonly brandingService = inject(BrandingService);
  private readonly logoImportService = inject(LogoImportService);
  private readonly typographyService = inject(TypographyService);
  private readonly destroyRef = inject(DestroyRef);

  readonly projectId = input.required<string>();
  readonly branding = input.required<BrandIdentityModel>();

  readonly closed = output<void>();
  readonly applied = output<IdentityUpdateReport>();

  protected readonly roles = PALETTE_ROLES;
  protected readonly fontRoles: readonly FontRole[] = ['primary', 'secondary'];

  // ── Logo ────────────────────────────────────────────────────────────
  protected readonly logoChoice = signal<LogoChoice>({ kind: 'current' });
  protected readonly importing = signal(false);
  protected readonly importError = signal<string | null>(null);
  protected readonly colorsFromLogo = signal(false);

  protected readonly otherLogos = computed(() => {
    const current = this.branding().logo?.id;
    return (this.branding().generatedLogos ?? []).filter((logo) => logo.id !== current && !!logo.svg);
  });

  protected readonly logoPreview = computed(() => {
    const choice = this.logoChoice();
    if (choice.kind === 'imported') return choice.preview;
    const logo = choice.kind === 'generated' ? choice.logo : this.branding().logo;
    return logo?.assetUrls?.primary || logo?.svg || '';
  });

  protected readonly logoChanged = computed(() => this.logoChoice().kind !== 'current');

  // ── Couleurs ────────────────────────────────────────────────────────
  protected readonly draftColors = signal<Partial<BrandPalette>>({});
  protected readonly keptRoles = signal<ReadonlySet<PaletteRole>>(new Set());
  protected readonly harmonized = signal<HarmonizeResult | null>(null);
  protected readonly harmonizing = signal(false);
  private readonly paletteRequests = new Subject<void>();

  protected readonly currentPalette = computed<Partial<BrandPalette>>(
    () => this.branding().colors?.colors ?? {},
  );

  /** Ce que l'utilisateur verra appliqué : la palette harmonisée si elle existe. */
  protected readonly shownPalette = computed<Partial<BrandPalette>>(
    () => this.harmonized()?.palette ?? { ...this.currentPalette(), ...this.draftColors() },
  );

  protected readonly colorsChanged = computed(
    () => Object.keys(this.draftColors()).length > 0 || (this.colorsFromLogo() && this.logoChanged()),
  );

  // ── Polices ─────────────────────────────────────────────────────────
  protected readonly fontQuery = signal<Record<FontRole, string>>({ primary: '', secondary: '' });
  protected readonly fontResults = signal<Record<FontRole, CatalogFont[]>>({ primary: [], secondary: [] });
  protected readonly searchingFont = signal<FontRole | null>(null);
  protected readonly chosenFonts = signal<Partial<Record<FontRole, BrandFont>>>({});
  private readonly fontSearches = new Subject<FontRole>();

  protected readonly shownFonts = computed(() => ({
    primary: this.chosenFonts().primary?.family ?? this.branding().typography?.primaryFont ?? '',
    secondary: this.chosenFonts().secondary?.family ?? this.branding().typography?.secondaryFont ?? '',
  }));

  protected readonly fontsChanged = computed(() => Object.keys(this.chosenFonts()).length > 0);

  // ── Application ─────────────────────────────────────────────────────
  protected readonly preview = signal<IdentityUpdateReport | null>(null);
  protected readonly previewing = signal(false);
  protected readonly applying = signal(false);
  protected readonly result = signal<IdentityUpdateReport | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly hasChanges = computed(
    () => this.logoChanged() || this.colorsChanged() || this.fontsChanged(),
  );
  protected readonly busy = computed(() => this.previewing() || this.applying() || this.importing());

  constructor() {
    this.paletteRequests
      .pipe(
        debounceTime(250),
        switchMap(() => {
          const changes = this.draftColors();
          if (Object.keys(changes).length === 0) return of(null);
          this.harmonizing.set(true);
          return this.brandingService
            .previewPalette(this.projectId(), changes, [...this.keptRoles()])
            .pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.harmonizing.set(false);
        this.harmonized.set(result);
      });

    this.fontSearches
      .pipe(
        debounceTime(300),
        switchMap((role) => {
          const query = this.fontQuery()[role];
          if (query.trim().length < 2) return of({ role, fonts: [] as CatalogFont[] });
          this.searchingFont.set(role);
          return this.typographyService.searchFonts(query, null, null, 8).pipe(
            catchError(() => of([] as CatalogFont[])),
            switchMap((fonts) => of({ role, fonts })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ role, fonts }) => {
        this.searchingFont.set(null);
        this.fontResults.update((results) => ({ ...results, [role]: fonts }));
        void this.typographyService.loadFonts(fonts);
      });
  }

  // ── Logo ────────────────────────────────────────────────────────────

  protected onLogoFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const invalid = this.logoImportService.validateFile(file);
    if (invalid) {
      this.importError.set(invalid);
      return;
    }
    this.importError.set(null);
    this.importing.set(true);
    this.logoImportService
      .uploadLogo(file, this.projectId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (progress) => {
          if (progress.type === 'error') {
            this.importing.set(false);
            this.importError.set(progress.error ?? null);
          }
          if (progress.type === 'complete' && progress.result) {
            this.importing.set(false);
            const result = progress.result;
            this.logoChoice.set({ kind: 'imported', result, preview: result.logoUrl || '' });
            this.resetPreview();
          }
        },
        error: (error: { message?: string }) => {
          this.importing.set(false);
          this.importError.set(error?.message ?? null);
        },
      });
  }

  protected chooseLogo(logo: LogoModel): void {
    this.logoChoice.set({ kind: 'generated', logo });
    this.resetPreview();
  }

  protected isChosen(logo: LogoModel): boolean {
    const choice = this.logoChoice();
    return choice.kind === 'generated' && choice.logo.id === logo.id;
  }

  protected keepCurrentLogo(): void {
    this.logoChoice.set({ kind: 'current' });
    this.colorsFromLogo.set(false);
    this.resetPreview();
  }

  protected toggleColorsFromLogo(event: Event): void {
    this.colorsFromLogo.set((event.target as HTMLInputElement).checked);
    this.resetPreview();
  }

  // ── Couleurs ────────────────────────────────────────────────────────

  protected setColor(role: PaletteRole, value: string): void {
    const hex = value.trim().startsWith('#') ? value.trim() : `#${value.trim()}`;
    if (!HEX.test(hex)) return;
    this.draftColors.update((draft) => ({ ...draft, [role]: hex.toLowerCase() }));
    this.resetPreview();
    this.paletteRequests.next();
  }

  protected onColorInput(role: PaletteRole, event: Event): void {
    this.setColor(role, (event.target as HTMLInputElement).value);
  }

  protected toggleKeep(role: PaletteRole, event: Event): void {
    const keep = (event.target as HTMLInputElement).checked;
    this.keptRoles.update((roles) => {
      const next = new Set(roles);
      if (keep) next.add(role);
      else next.delete(role);
      return next;
    });
    this.resetPreview();
    this.paletteRequests.next();
  }

  protected resetColors(): void {
    this.draftColors.set({});
    this.keptRoles.set(new Set());
    this.harmonized.set(null);
    this.resetPreview();
  }

  protected isEdited(role: PaletteRole): boolean {
    return role in this.draftColors();
  }

  protected wasAdjusted(role: PaletteRole): boolean {
    return !!this.harmonized()?.adjustments.some((adjustment) => adjustment.role === role);
  }

  // ── Polices ─────────────────────────────────────────────────────────

  protected onFontQuery(role: FontRole, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.fontQuery.update((queries) => ({ ...queries, [role]: value }));
    this.fontSearches.next(role);
  }

  protected chooseFont(role: FontRole, font: CatalogFont): void {
    this.chosenFonts.update((fonts) => ({
      ...fonts,
      [role]: {
        family: font.family,
        source: font.source,
        cssUrl: font.cssUrl,
        category: font.category,
        weights: font.weights,
      },
    }));
    this.fontResults.update((results) => ({ ...results, [role]: [] }));
    this.fontQuery.update((queries) => ({ ...queries, [role]: '' }));
    this.resetPreview();
  }

  protected resetFont(role: FontRole): void {
    this.chosenFonts.update((fonts) => {
      const next = { ...fonts };
      delete next[role];
      return next;
    });
    this.resetPreview();
  }

  // ── Application ─────────────────────────────────────────────────────

  private buildRequest(dryRun: boolean): IdentityUpdateRequest {
    const request: IdentityUpdateRequest = { dryRun };
    const choice = this.logoChoice();
    if (choice.kind === 'generated') request.logo = { generatedLogoId: choice.logo.id };
    if (choice.kind === 'imported') {
      request.logo = {
        svg: choice.result.logoUrl || choice.result.svg,
        variations: choice.result.variations,
        colors: choice.result.extractedColors,
      };
    }
    if (this.colorsFromLogo() && this.logoChanged()) {
      request.colorsFromLogo = true;
    } else if (Object.keys(this.draftColors()).length > 0) {
      request.colors = this.draftColors();
      if (this.keptRoles().size) request.keepColors = [...this.keptRoles()];
    }
    if (this.fontsChanged()) request.typography = this.chosenFonts();
    return request;
  }

  protected showPreview(): void {
    this.run(true);
  }

  protected apply(): void {
    this.run(false);
  }

  private run(dryRun: boolean): void {
    if (!this.hasChanges() || this.busy()) return;
    this.error.set(null);
    (dryRun ? this.previewing : this.applying).set(true);
    this.brandingService
      .updateIdentity(this.projectId(), this.buildRequest(dryRun))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (report) => {
          (dryRun ? this.previewing : this.applying).set(false);
          if (dryRun) {
            this.preview.set(report);
            if (report.palette) this.harmonized.set(report.palette);
            return;
          }
          this.result.set(report);
          this.applied.emit(report);
        },
        error: (error: { error?: { message?: string } }) => {
          (dryRun ? this.previewing : this.applying).set(false);
          this.error.set(error?.error?.message ?? null);
        },
      });
  }

  private resetPreview(): void {
    this.preview.set(null);
    this.error.set(null);
  }

  protected close(): void {
    if (this.applying()) return;
    this.closed.emit();
  }
}

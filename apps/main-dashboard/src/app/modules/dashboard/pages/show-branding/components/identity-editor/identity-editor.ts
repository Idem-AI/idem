import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  linkedSignal,
  untracked,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet, UpperCasePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { Subject, debounceTime, switchMap, of, catchError } from 'rxjs';

import { ProjectModel } from '@idem/shared-models';

import {
  BrandFont,
  BrandIdentityModel,
  ColorModel,
  TypographyModel,
} from '../../../../models/brand-identity.model';
import {
  BrandPalette,
  HarmonizeResult,
  IdentityUpdateReport,
  IdentityUpdateRequest,
  PALETTE_ROLES,
  PaletteRole,
} from '../../../../models/brand-identity-update.model';
import { LogoModel, LogoType } from '../../../../models/logo.model';
import {
  IdentityJobKind,
  IdentityJobsService,
  LogoJobRequest,
} from '../../../../services/identity-jobs.service';
import { BrandingService } from '../../../../services/ai-agents/branding.service';
import { LogoImportResponse, LogoImportService } from '../../../../services/logo-import.service';
import { CatalogFont, TypographyService } from '../../../../../../shared/services/typography.service';
import { TypographyFontImportComponent } from '../../../create-project/components/typography-selection/typography-font-import/typography-font-import';
import { LogoSrcPipe } from '../../../../../../shared/pipes/logo-src.pipe';

type LogoChoice =
  | { kind: 'current' }
  | { kind: 'generated'; logo: LogoModel }
  | { kind: 'imported'; result: LogoImportResponse; preview: string };

type FontRole = 'primary' | 'secondary';

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Durées de sortie — identiques à celles de `identity-editor.css`. */
const EXIT_MS = { drawer: 240, modal: 160 } as const;

/**
 * Changer l'identité visuelle — logo, couleurs, polices — et la voir appliquée
 * à tous les supports du projet.
 *
 * Deux temps bien séparés :
 *   · PROPOSER : régénérer des logos, des palettes ou des paires de polices
 *     (IA), importer un logo ou des fichiers de police. Rien n'est appliqué.
 *   · APPLIQUER : le choix part à `PUT …/identity`, qui le propage à tous les
 *     supports sans IA.
 */
@Component({
  selector: 'app-identity-editor',
  imports: [
    TranslateModule,
    IdemLoaderComponent,
    NgTemplateOutlet,
    UpperCasePipe,
    LogoSrcPipe,
    TypographyFontImportComponent,
  ],
  templateUrl: './identity-editor.html',
  styleUrl: './identity-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape()' },
})
export class IdentityEditorComponent {
  private readonly brandingService = inject(BrandingService);
  private readonly logoImportService = inject(LogoImportService);
  private readonly typographyService = inject(TypographyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly jobs = inject(IdentityJobsService);

  readonly projectId = input.required<string>();
  readonly branding = input.required<BrandIdentityModel>();
  readonly project = input.required<ProjectModel>();

  readonly closed = output<void>();
  readonly applied = output<IdentityUpdateReport>();

  protected readonly roles = PALETTE_ROLES;
  protected readonly fontRoles: readonly FontRole[] = ['primary', 'secondary'];

  // ── Logo ────────────────────────────────────────────────────────────
  protected readonly logoChoice = signal<LogoChoice>({ kind: 'current' });
  protected readonly importing = signal(false);
  protected readonly importError = signal<string | null>(null);
  protected readonly colorsFromLogo = signal(false);

  // ── Régénérations : des tâches serveur, suivies par `IdentityJobsService` ──
  //
  // Elles survivent à la fermeture du panneau : seul « Annuler » les arrête.
  protected readonly projectJobs = computed(() => this.jobs.jobsFor(this.projectId()));
  /** Requête de démarrage en vol (le temps que le serveur réponde 202). */
  protected readonly startingJob = signal<IdentityJobKind | null>(null);
  /** Refus au démarrage (crédits insuffisants, tâche déjà en cours…). */
  protected readonly startErrors = signal<Partial<Record<IdentityJobKind, string>>>({});

  protected readonly regeneratingLogos = computed(() => this.isRunning('logos'));

  /** Logos de la tâche en cours ou terminée ; sinon, ceux déjà en base. */
  private readonly jobLogos = computed(() => {
    const job = this.projectJobs().logos;
    return job && (job.status === 'running' || job.logos?.length) ? (job.logos ?? []) : null;
  });

  /** Les propositions : celles de la régénération, sinon celles déjà en base. */
  protected readonly proposedLogos = computed(() => {
    const current = this.branding().logo?.id;
    const list = this.jobLogos() ?? this.branding().generatedLogos ?? [];
    return list.filter((logo) => logo.id !== current && !!logo.svg);
  });

  /** Emplacements encore en cours de génération, montrés en squelette. */
  protected readonly pendingLogoSlots = computed(() =>
    this.regeneratingLogos() ? Array.from({ length: Math.max(0, 3 - (this.jobLogos()?.length ?? 0)) }) : [],
  );

  // Options de génération — les mêmes qu'à la création du projet.
  protected readonly logoTypes: readonly LogoType[] = ['icon', 'name', 'initial'];
  protected readonly logoType = linkedSignal<LogoType | null>(() => this.branding().logoPreferences?.type ?? null);
  protected readonly logoBrief = linkedSignal(() => this.branding().logoPreferences?.customDescription ?? '');
  protected readonly optionsOpen = signal(false);

  protected readonly logoPreview = computed(() => {
    // Le logo adapté aux nouvelles couleurs / polices, dès que l'aperçu l'a calculé.
    const adapted = this.adaptedLogoPreview();
    if (adapted) return adapted;
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

  protected readonly proposedPalettes = computed(() =>
    (this.jobResult('colors') ?? this.branding().generatedColors ?? []).filter((palette) =>
      PALETTE_ROLES.every((role) => HEX.test(palette.colors?.[role] ?? '')),
    ),
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

  protected readonly proposedTypographies = computed(() =>
    (this.jobResult('typography') ?? this.branding().generatedTypography ?? []).filter(
      (typography) => !!typography.primaryFont,
    ),
  );
  /** Emplacement dont le panneau d'import de fichiers est ouvert. */
  protected readonly importingFontFor = signal<FontRole | null>(null);

  // ── Application ─────────────────────────────────────────────────────
  protected readonly preview = signal<IdentityUpdateReport | null>(null);
  protected readonly previewing = signal(false);
  protected readonly applying = signal(false);
  protected readonly result = signal<IdentityUpdateReport | null>(null);
  protected readonly error = signal<string | null>(null);

  // ── Et le logo ? ────────────────────────────────────────────────────
  //
  // Quand les couleurs ou les polices changent sans nouveau logo, on DEMANDE
  // ce que doit devenir le logo : l'adapter (sans IA), en créer de nouveaux
  // avec la nouvelle identité (IA), ou le garder tel quel.
  protected readonly logoFollowAsked = computed(
    () => !this.logoChanged() && !!this.branding().logo?.svg && (this.colorsChanged() || this.fontsChanged()),
  );
  /** Le nom du logo peut-il être reposé dans une autre police sans IA ? */
  protected readonly canRetypeset = computed(() => {
    const logo = this.branding().logo;
    return !!(logo?.lockup?.brandName && logo.iconSvg);
  });
  /** Ce que « adapter » ferait concrètement ; vide ⇒ l'option n'est pas offerte. */
  protected readonly adaptScope = computed<'colors' | 'fonts' | 'both' | null>(() => {
    const colors = this.colorsChanged() && !(this.colorsFromLogo() && this.logoChanged());
    const fonts = this.fontsChanged() && this.canRetypeset();
    return colors && fonts ? 'both' : colors ? 'colors' : fonts ? 'fonts' : null;
  });
  protected readonly logoFollowChoice = signal<'adapt' | 'regenerate' | 'keep'>('adapt');
  /** Le choix effectif : « adapter » retombe sur « garder » s'il n'est pas possible. */
  protected readonly logoFollow = computed(() =>
    this.logoFollowChoice() === 'adapt' && !this.adaptScope() ? 'keep' : this.logoFollowChoice(),
  );
  /** Logo adapté calculé par l'aperçu, affiché avant d'appliquer. */
  protected readonly adaptedLogoPreview = computed(() =>
    this.logoFollow() === 'adapt' ? (this.preview()?.logoAdaptation?.previewSvg ?? null) : null,
  );
  /** De nouveaux logos ont été lancés juste après l'application. */
  protected readonly regeneratedAfterApply = signal(false);

  protected readonly hasChanges = computed(
    () => this.logoChanged() || this.colorsChanged() || this.fontsChanged(),
  );
  /**
   * Une régénération en cours ne bloque PAS l'application : elle n'écrit que
   * ses propositions, et chaque logo proposé est enregistré dès qu'il est prêt.
   */
  protected readonly busy = computed(() => this.previewing() || this.applying() || this.importing());

  constructor() {
    // Chaque paire proposée s'affiche dans ses propres polices.
    effect(() => {
      for (const typography of this.proposedTypographies()) {
        void this.typographyService.loadTypography(typography);
      }
    });

    // Une tâche lancée avant un rechargement de la page est retrouvée ici.
    effect(() => {
      const projectId = this.projectId();
      untracked(() => this.jobs.track(projectId));
    });

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

  // ── Régénérations ───────────────────────────────────────────────────

  protected isRunning(kind: IdentityJobKind): boolean {
    return this.projectJobs()[kind]?.status === 'running';
  }

  /** Échec d'une tâche, ou refus à son démarrage : le message à afficher. */
  protected jobProblem(kind: IdentityJobKind): 'start' | 'analysis' | 'generation' | null {
    if (this.startErrors()[kind] !== undefined) return 'start';
    const job = this.projectJobs()[kind];
    if (job?.status !== 'failed') return null;
    return job.error === 'analysis_failed' ? 'analysis' : 'generation';
  }

  protected startError(kind: IdentityJobKind): string {
    return this.startErrors()[kind] ?? '';
  }

  private jobResult<T extends 'colors' | 'typography'>(kind: T) {
    const job = this.projectJobs()[kind];
    return job?.status === 'done' ? (job[kind] ?? null) : null;
  }

  /**
   * Démarre la tâche. Pas de `takeUntilDestroyed` : la requête ne fait que
   * démarrer une tâche serveur, elle doit aboutir même si le panneau se ferme.
   */
  private startJob(kind: IdentityJobKind, body: LogoJobRequest = {}): void {
    if (this.isRunning(kind) || this.startingJob() === kind) return;
    this.startingJob.set(kind);
    this.startErrors.update((errors) => {
      const next = { ...errors };
      delete next[kind];
      return next;
    });
    this.jobs.start(this.projectId(), kind, body).subscribe({
      next: () => this.startingJob.set(null),
      error: (error: { error?: { message?: string } }) => {
        this.startingJob.set(null);
        this.startErrors.update((errors) => ({ ...errors, [kind]: error?.error?.message ?? '' }));
      },
    });
  }

  protected cancelJob(kind: IdentityJobKind): void {
    this.jobs.cancel(this.projectId(), kind).subscribe({ error: () => undefined });
  }

  private logoPreferences(): LogoJobRequest['preferences'] {
    const brief = this.logoBrief().trim();
    return { type: this.logoType() ?? undefined, customDescription: brief || undefined };
  }

  /** De nouveaux logos, avec les options choisies. */
  protected regenerateLogos(): void {
    // Le logo choisi parmi les anciennes propositions disparaît avec elles.
    if (this.logoChoice().kind === 'generated') this.logoChoice.set({ kind: 'current' });
    this.resetPreview();
    this.startJob('logos', { preferences: this.logoPreferences() });
  }

  /**
   * Améliorer un logo : l'actuel, ou celui qu'on vient d'importer. Il est
   * analysé, et l'analyse (plus le souhait éventuel de l'utilisateur) devient
   * le brief des nouvelles propositions — comme à la création du projet.
   */
  protected improveLogo(source: 'current' | 'imported'): void {
    const choice = this.logoChoice();
    const improve: LogoJobRequest['improve'] =
      source === 'current'
        ? 'current'
        : choice.kind === 'imported' && choice.result.logoUrl
          ? { svg: choice.result.logoUrl }
          : undefined;
    if (!improve) return;
    this.resetPreview();
    this.startJob('logos', { preferences: this.logoPreferences(), improve });
  }

  protected setLogoType(type: LogoType): void {
    this.logoType.update((current) => (current === type ? null : type));
  }

  protected onLogoBrief(event: Event): void {
    this.logoBrief.set((event.target as HTMLTextAreaElement).value.slice(0, 1200));
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

  /** Nouvelles propositions de palettes OU de polices — l'autre liste reste. */
  protected regenerate(only: 'colors' | 'typography'): void {
    this.startJob(only);
  }

  /** Une palette proposée remplace les cinq rôles ; l'harmonisation la vérifie. */
  protected choosePalette(palette: ColorModel): void {
    const colors: Partial<BrandPalette> = {};
    for (const role of PALETTE_ROLES) colors[role] = palette.colors[role].toLowerCase();
    this.colorsFromLogo.set(false);
    this.draftColors.set(colors);
    this.keptRoles.set(new Set());
    this.resetPreview();
    this.paletteRequests.next();
  }

  protected isPaletteChosen(palette: ColorModel): boolean {
    const draft = this.draftColors();
    return PALETTE_ROLES.every((role) => draft[role] === palette.colors[role]?.toLowerCase());
  }

  protected chooseTypography(typography: TypographyModel): void {
    const toFont = (model: BrandFont | undefined, family: string): BrandFont =>
      model?.family ? model : { family, source: 'google' };
    this.chosenFonts.set({
      primary: toFont(typography.primary, typography.primaryFont),
      secondary: toFont(typography.secondary, typography.secondaryFont || typography.primaryFont),
    });
    this.importingFontFor.set(null);
    this.resetPreview();
  }

  protected isTypographyChosen(typography: TypographyModel): boolean {
    const chosen = this.chosenFonts();
    return (
      chosen.primary?.family === typography.primaryFont &&
      chosen.secondary?.family === (typography.secondaryFont || typography.primaryFont)
    );
  }

  protected toggleFontImport(role: FontRole): void {
    this.importingFontFor.update((current) => (current === role ? null : role));
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
        // Police importée : le serveur relit feuille et fichiers par cet id.
        ...(font.source === 'custom' ? { customFontId: font.sourceId } : {}),
      },
    }));
    this.importingFontFor.set(null);
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
    if (this.logoFollowAsked() && this.logoFollow() === 'adapt') request.adaptLogo = true;
    return request;
  }

  // ── Modale « Et le logo ? » ──────────────────────────────────────────
  //
  // La question se pose AU MOMENT d'appliquer, pas au fil de l'édition : c'est
  // là que l'utilisateur mesure la portée de son changement.
  protected readonly confirmOpen = signal(false);
  protected readonly confirmLeaving = signal(false);
  /** Logo adapté calculé pour la modale (aperçu serveur, rien n'est écrit). */
  protected readonly confirmPreviewSvg = signal<string | null>(null);
  protected readonly confirmPreviewLoading = signal(false);

  /** Ce qui a changé, pour formuler la question. */
  protected readonly changeKind = computed(() =>
    this.colorsChanged() && this.fontsChanged() ? 'both' : this.colorsChanged() ? 'colors' : 'fonts',
  );

  protected readonly currentLogoSrc = computed(() => {
    const logo = this.branding().logo;
    return logo?.assetUrls?.primary || logo?.svg || '';
  });

  /** « Appliquer partout » : on demande d'abord ce que devient le logo. */
  protected requestApply(): void {
    if (!this.hasChanges() || this.busy()) return;
    if (!this.logoFollowAsked()) {
      this.apply();
      return;
    }
    this.confirmLeaving.set(false);
    this.confirmOpen.set(true);
    this.loadAdaptPreview();
  }

  private loadAdaptPreview(): void {
    if (!this.adaptScope()) return;
    this.confirmPreviewLoading.set(true);
    this.confirmPreviewSvg.set(null);
    this.brandingService
      .updateIdentity(this.projectId(), { ...this.buildRequest(true), adaptLogo: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (report) => {
          this.confirmPreviewLoading.set(false);
          this.confirmPreviewSvg.set(report.logoAdaptation?.previewSvg ?? null);
        },
        error: () => this.confirmPreviewLoading.set(false),
      });
  }

  protected closeConfirm(then?: () => void): void {
    if (!this.confirmOpen() || this.confirmLeaving()) return;
    this.confirmLeaving.set(true);
    setTimeout(() => {
      this.confirmOpen.set(false);
      this.confirmLeaving.set(false);
      then?.();
    }, EXIT_MS.modal);
  }

  protected confirmApply(): void {
    this.closeConfirm(() => this.apply());
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
          // « Nouveaux logos avec la nouvelle identité » : la génération lit la
          // palette et les polices EN BASE, elle part donc après l'application.
          if (this.logoFollowAsked() && this.logoFollow() === 'regenerate') {
            this.regeneratedAfterApply.set(true);
            this.startJob('logos', { preferences: this.logoPreferences() });
          }
        },
        error: (error: { error?: { message?: string } }) => {
          (dryRun ? this.previewing : this.applying).set(false);
          this.error.set(error?.error?.message ?? null);
        },
      });
  }

  protected setLogoFollow(choice: 'adapt' | 'regenerate' | 'keep'): void {
    this.logoFollowChoice.set(choice);
    this.resetPreview();
  }

  /**
   * Retour à l'édition après une application : la marque vient d'être relue,
   * les brouillons repartent de zéro — et les logos lancés s'y affichent.
   */
  protected backToEditing(): void {
    this.result.set(null);
    this.regeneratedAfterApply.set(false);
    this.logoChoice.set({ kind: 'current' });
    this.colorsFromLogo.set(false);
    this.draftColors.set({});
    this.keptRoles.set(new Set());
    this.harmonized.set(null);
    this.chosenFonts.set({});
    this.logoFollowChoice.set('adapt');
    this.resetPreview();
  }

  private resetPreview(): void {
    this.preview.set(null);
    this.error.set(null);
  }

  // ── Ouverture / fermeture en douceur ─────────────────────────────────
  //
  // L'entrée est une animation CSS jouée au montage ; la sortie joue la sienne
  // PUIS prévient le parent, qui retire le panneau. Sans cette attente, le
  // panneau disparaissait d'un coup.
  protected readonly leaving = signal(false);

  protected onEscape(): void {
    if (this.confirmOpen()) this.closeConfirm();
    else this.close();
  }

  protected close(): void {
    if (this.applying() || this.leaving()) return;
    this.leaving.set(true);
    setTimeout(() => this.closed.emit(), EXIT_MS.drawer);
  }
}

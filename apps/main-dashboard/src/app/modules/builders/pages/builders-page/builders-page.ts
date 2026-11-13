import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import {
  BUILDERS_LEGAL_VERSION,
  BUILDERS_PROGRAM,
  BUILDER_BUILDING_SIGNALS,
  BUILDER_OPERATING_SIGNALS,
} from '@idem/shared-models/builders/program';
import { environment } from '../../../../../environments/environment';
import { CurrentProjectService } from '../../../../shared/services/current-project.service';
import { BuildersIllustrationComponent } from '../../../../shared/components/builders-illustration/builders-illustration';
import { CoverCropperComponent } from '../../components/cover-cropper/cover-cropper';
import { BuilderApplicationView, BuilderEligibility, BuildersService } from '../../services/builders.service';

/** Refus de l'API qui ont leur propre phrase dans les traductions (`builders.errors.*`). */
const KNOWN_ERRORS = ['COVER_INVALID', 'TERMS_REQUIRED', 'TERMS_OUTDATED', 'ALREADY_APPLIED', 'NOT_ELIGIBLE', 'PITCH_TOO_SHORT', 'PITCH_TOO_LONG', 'INVALID_URL', 'PROJECT_NOT_FOUND'];

/** Refus d'envoi de couverture qui ont leur phrase (`builders.cover.errors.*`). */
const COVER_ERRORS = ['COVER_FORMAT', 'COVER_TOO_HEAVY', 'COVER_TOO_SMALL', 'COVER_RATIO', 'COVER_UNREADABLE'];

/**
 * Idem Builders, côté candidat : choisir un projet, voir s'il est géré avec
 * IDEM, le présenter, suivre la décision.
 *
 * La condition d'entrée est montrée **avant** le formulaire, projet par
 * projet : un candidat dont le projet n'est ni en ligne ni suivi en
 * communication apprend ce qui lui manque et y va en un clic, au lieu de
 * remplir une présentation que l'API refusera.
 */
@Component({
  selector: 'app-builders-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    DecimalPipe,
    TranslateModule,
    IdemLoaderComponent,
    BuildersIllustrationComponent,
    CoverCropperComponent,
  ],
  templateUrl: './builders-page.html',
})
export class BuildersPage {
  private readonly builders = inject(BuildersService);
  private readonly currentProject = inject(CurrentProjectService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly program = BUILDERS_PROGRAM;
  protected readonly operatingSignals = BUILDER_OPERATING_SIGNALS;
  protected readonly buildingSignals = BUILDER_BUILDING_SIGNALS;
  protected readonly topupPercent = Math.round(BUILDERS_PROGRAM.topupBonusRate * 100);
  protected readonly hostingPercent = Math.round(BUILDERS_PROGRAM.hostingDiscountRate * 100);
  protected readonly showcaseUrl = `${environment.services.domain}/builders`;
  protected readonly termsUrl = `${environment.services.domain}/builders-terms`;
  protected readonly privacyUrl = `${environment.services.domain}/builders-privacy`;
  /** Le badge est servi par la landing : c'est la même adresse que celle du code à copier. */
  protected readonly badgeImageUrl = `${environment.services.domain}/assets/builders/idem-builder-badge.svg`;
  protected readonly badgeSnippet = `<a href="https://idem.africa/builders" target="_blank" rel="noopener"><img src="https://idem.africa/assets/builders/idem-builder-badge.svg" alt="Idem Builder" width="168" height="44"></a>`;

  protected readonly projects = this.currentProject.projects;
  protected readonly projectsLoaded = this.currentProject.isLoaded;

  protected readonly applications = signal<BuilderApplicationView[] | null>(null);
  protected readonly isBuilder = signal(false);
  protected readonly loadError = signal(false);

  protected readonly eligibility = signal<BuilderEligibility | null>(null);
  protected readonly checking = signal(false);
  protected readonly checkError = signal(false);

  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly submitted = signal<BuilderApplicationView | null>(null);
  protected readonly copied = signal(false);

  protected readonly form = new FormGroup({
    projectId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    pitch: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(BUILDERS_PROGRAM.pitchMinLength),
        Validators.maxLength(BUILDERS_PROGRAM.pitchMaxLength),
      ],
    }),
    publicUrl: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(300)] }),
    // Facultative : sans elle, la vitrine compose la couverture depuis la charte.
    coverUrl: new FormControl('', { nonNullable: true }),
    // L'équipe est faite de données personnelles : sa publication est un choix exprès.
    showTeam: new FormControl(false, { nonNullable: true }),
    // Conditions et politique de confidentialité du programme : jamais cochées d'avance.
    acceptTerms: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] }),
  });

  private readonly pitchValue = toSignal(this.form.controls.pitch.valueChanges, { initialValue: '' });
  protected readonly pitchLength = computed(() => this.pitchValue().trim().length);

  /** Le projet choisi peut être présenté : géré avec IDEM, sans candidature en cours. */
  protected readonly canApply = computed(() => {
    const check = this.eligibility();
    return !!check && check.eligible && !check.current;
  });

  /** Ce que le projet a été construit avec IDEM, en plus de ce qui le fait tourner. */
  protected readonly builtWith = computed(() => {
    const check = this.eligibility();
    return check ? this.buildingSignals.filter((signal) => check.signals[signal]) : [];
  });

  constructor() {
    this.currentProject.load().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => undefined });
    this.loadMine();

    this.form.controls.projectId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((projectId) => this.check(projectId));
  }

  protected loadMine(): void {
    this.loadError.set(false);
    this.builders.me().subscribe({
      next: (me) => {
        this.applications.set(me.applications);
        this.isBuilder.set(me.isBuilder);
      },
      error: () => {
        this.applications.set([]);
        this.loadError.set(true);
      },
    });
  }

  private check(projectId: string): void {
    this.eligibility.set(null);
    this.checkError.set(false);
    this.submitError.set(null);
    if (!projectId) return;

    this.checking.set(true);
    this.builders.eligibility(projectId).subscribe({
      next: (check) => {
        this.eligibility.set(check);
        this.checking.set(false);
        if (check.suggestedUrl && !this.form.controls.publicUrl.value) {
          this.form.controls.publicUrl.setValue(check.suggestedUrl);
        }
      },
      error: () => {
        this.checking.set(false);
        this.checkError.set(true);
      },
    });
  }

  protected retryCheck(): void {
    this.check(this.form.controls.projectId.value);
  }

  /** Ouvre le projet sur l'écran qui le rend éligible. */
  protected goTo(path: '/project/ideploy' | '/project/communication'): void {
    const projectId = this.form.controls.projectId.value;
    if (!projectId) return;
    this.currentProject.select(projectId, { navigate: false });
    void this.router.navigate([path]);
  }

  protected submit(): void {
    if (this.form.invalid || !this.canApply() || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    const { projectId, pitch, publicUrl, showTeam, coverUrl, acceptTerms } = this.form.getRawValue();
    this.submitting.set(true);
    this.submitError.set(null);

    this.builders
      .apply({
        projectId,
        pitch: pitch.trim(),
        publicUrl: publicUrl.trim() || undefined,
        showTeam,
        coverUrl: coverUrl || undefined,
        acceptTerms,
        termsVersion: BUILDERS_LEGAL_VERSION,
      })
      .subscribe({
      next: ({ application }) => {
        this.submitting.set(false);
        this.submitted.set(application);
        this.applications.update((list) => [application, ...(list ?? [])]);
        this.form.reset();
        this.coverPreview.set(null);
        this.coverFile.set(null);
        this.eligibility.set(null);
      },
      error: (error: HttpErrorResponse) => {
        this.submitting.set(false);
        // Le code de l'API, traduit ici : ses messages ne sont écrits qu'en français.
        const code = String(error.error?.error ?? '');
        this.submitError.set(KNOWN_ERRORS.includes(code) ? code : 'GENERIC');
      },
    });
  }

  protected readonly coverUploading = signal(false);
  protected readonly coverError = signal<string | null>(null);
  protected readonly coverPreview = signal<string | null>(null);

  /** L'image choisie, en attente de cadrage. */
  protected readonly coverFile = signal<File | null>(null);
  protected readonly coverDragOver = signal(false);

  /** Une image choisie passe d'abord par le cadrage, au format exact de la fiche. */
  protected onCoverSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.takeCover(file);
  }

  protected onCoverDragOver(event: DragEvent): void {
    event.preventDefault();
    this.coverDragOver.set(true);
  }

  protected onCoverDrop(event: DragEvent): void {
    event.preventDefault();
    this.coverDragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.takeCover(file);
  }

  private takeCover(file: File): void {
    this.coverError.set(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.coverError.set('COVER_FORMAT');
      return;
    }
    if (file.size > BUILDERS_PROGRAM.coverMaxBytes) {
      this.coverError.set('COVER_TOO_HEAVY');
      return;
    }
    this.coverFile.set(file);
  }

  /** Le cadrage validé part à l'API ; l'aperçu montre ce qu'elle a gardé. */
  protected uploadCropped(blob: Blob): void {
    this.coverFile.set(null);
    this.coverUploading.set(true);
    this.builders.uploadCover(new File([blob], 'cover.jpg', { type: 'image/jpeg' })).subscribe({
      next: ({ url }) => {
        this.coverUploading.set(false);
        this.form.controls.coverUrl.setValue(url);
        this.coverPreview.set(url);
      },
      error: (error: HttpErrorResponse) => {
        this.coverUploading.set(false);
        const code = String(error.error?.error ?? '');
        this.coverError.set(COVER_ERRORS.includes(code) ? code : 'COVER_GENERIC');
      },
    });
  }

  protected removeCover(): void {
    this.form.controls.coverUrl.setValue('');
    this.coverPreview.set(null);
    this.coverError.set(null);
  }

  protected async copyBadge(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.badgeSnippet);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2_000);
    } catch {
      this.copied.set(false);
    }
  }
}
